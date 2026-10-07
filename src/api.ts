import { Person, Shift, TargetCoverage, Area, AttendanceRecord, DemandRecord } from './types';
import { supabase, supabaseControl } from './supabase';

interface DatabaseSchema {
  persons: Person[];
  shifts: Shift[];
  targets: TargetCoverage[];
  areas: Area[];
  demand: DemandRecord[];
  attendance: AttendanceRecord[];
}

async function fetchDemandWithFallback(): Promise<any[]> {
  // 1. First attempt: Supabase RPC fetch_planning_demand
  try {
    const { data: demandData, error: demandErr } = await supabase.rpc('fetch_planning_demand');
    if (!demandErr && Array.isArray(demandData) && demandData.length > 0) {
      try {
        localStorage.setItem('_planning_cached_demand', JSON.stringify(demandData));
      } catch (e) {}
      return demandData;
    }
    if (demandErr) {
      console.warn('fetch_planning_demand RPC timed out or failed (activating fast fallback):', demandErr.message);
    }
  } catch (err) {
    console.warn('fetch_planning_demand RPC threw exception:', err);
  }

  // 2. Second attempt: Fast parallel query for active date window (previous month + current + next month)
  try {
    console.log('Fetching patient demand via fast direct fallback...');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const pages = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000];
    const [cobsRes, ...pageResults] = await Promise.all([
      supabaseControl.from('turnera_coberturas').select('cobertura, clase'),
      ...pages.map(offset =>
        supabaseControl
          .from('planning_patient_appointments')
          .select('turno, cobertura')
          .gte('turno', startDate)
          .lte('turno', endDate)
          .range(offset, offset + 999)
      )
    ]);

    const allAppts: any[] = [];
    pageResults.forEach(r => {
      if (r.data) allAppts.push(...r.data);
    });

    if (allAppts.length > 0) {
      const artSet = new Set(
        (cobsRes.data || [])
          .filter((c: any) => (c.clase || '').toLowerCase().includes('art'))
          .map((c: any) => (c.cobertura || '').trim().toUpperCase())
      );

      const countMap = new Map<string, { date_string: string; hour: number; is_art: boolean; count: number }>();
      allAppts.forEach(a => {
        if (!a.turno) return;
        const date_string = a.turno.substring(0, 10);
        const hour = parseInt(a.turno.substring(11, 13), 10);
        if (isNaN(hour) || hour < 0 || hour > 23) return;
        const is_art = artSet.has((a.cobertura || '').trim().toUpperCase());
        const key = `${date_string}_${hour}_${is_art}`;
        const existing = countMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(key, { date_string, hour, is_art, count: 1 });
        }
      });

      const aggregated = Array.from(countMap.values());
      console.log(`✓ Fast fallback aggregated ${aggregated.length} demand records from ${allAppts.length} appointments.`);
      try {
        localStorage.setItem('_planning_cached_demand', JSON.stringify(aggregated));
      } catch (e) {}
      return aggregated;
    }
  } catch (fallbackErr) {
    console.warn('Fast demand fallback encountered an issue:', fallbackErr);
  }

  // 3. Third attempt: Use cached demand from localStorage if available
  try {
    const cached = localStorage.getItem('_planning_cached_demand');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`Using cached demand records (${parsed.length} entries).`);
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

export const fetchDb = async (): Promise<DatabaseSchema> => {
  try {
    console.log("Fetching database via Supabase RPC...");

    // 1. Fetch core data via RPC
    const { data: rawData, error: dataErr } = await supabase.rpc('fetch_planning_data');
    if (dataErr) throw dataErr;

    const areas: Area[] = rawData.areas && rawData.areas.length > 0
      ? rawData.areas
      : ['Atención', 'Soporte', 'Ventas', 'Administración'];

    const persons: Person[] = (rawData.persons || []).map((p: any) => ({
      id: String(p.id),
      name: String(p.name),
      area: String(p.area),
      maxDailyHours: Number(p.maxDailyHours),
      availabilityStart: Number(p.availabilityStart),
      availabilityEnd: Number(p.availabilityEnd),
      color: String(p.color),
      legajo: p.legajo ? String(p.legajo) : undefined,
      possibleShifts: p.possibleShifts || []
    }));

    const shifts: Shift[] = (rawData.shifts || []).map((s: any) => ({
      id: String(s.id),
      personId: String(s.personId),
      date: String(s.date),
      startHour: Number(s.startHour),
      duration: Number(s.duration),
      area: String(s.area)
    }));

    const targets: TargetCoverage[] = (rawData.targets || []).map((t: any) => ({
      area: String(t.area),
      dayOfWeek: Number(t.dayOfWeek),
      hourlyTargets: t.hourlyTargets || Array(24).fill(0)
    }));

    const attendance: AttendanceRecord[] = (rawData.attendance || []).map((a: any) => ({
      shiftId: String(a.shiftId),
      dateString: String(a.dateString),
      status: a.status
    }));

    // 2. Fetch aggregated demand via resilient loader
    console.log("Fetching demand via Supabase RPC / fallback...");
    const rawDemand = await fetchDemandWithFallback();

    const demandMap: Record<string, DemandRecord> = {};
    (rawDemand || []).forEach((row: any) => {
      const dateStr = row.date_string;
      const hour = row.hour;
      const isArt = row.is_art;
      const count = row.count;
      
      // Key by date only: patient appointment data is cross-area (all professionals),
      // the 'area' field will be set later from persisted planning_demand records.
      if (!demandMap[dateStr]) {
        demandMap[dateStr] = {
          dateString: dateStr,
          area: 'Admision', // defaulted to Admision to match backend
          hourlyRequirements: Array(24).fill(0),
          hourlyArtPatients: Array(24).fill(0),
          hourlyOsPatients: Array(24).fill(0)
        };
      }
      
      if (hour >= 0 && hour < 24) {
        if (isArt) {
          if (!demandMap[dateStr].hourlyArtPatients) {
            demandMap[dateStr].hourlyArtPatients = Array(24).fill(0);
          }
          demandMap[dateStr].hourlyArtPatients[hour] += count;
        } else {
          if (!demandMap[dateStr].hourlyOsPatients) {
            demandMap[dateStr].hourlyOsPatients = Array(24).fill(0);
          }
          demandMap[dateStr].hourlyOsPatients[hour] += count;
        }
      }
    });

    // Merge persisted requirements from planning_demand table
    const persistedDemandList = rawData.persistedDemand || [];
    persistedDemandList.forEach((row: any) => {
      const dateStr = row.dateString;
      const area = row.area;
      const reqs = row.hourlyRequirements || Array(24).fill(0);
      
      if (demandMap[dateStr]) {
        demandMap[dateStr].area = area;
        demandMap[dateStr].hourlyRequirements = reqs;
      } else {
        demandMap[dateStr] = {
          dateString: dateStr,
          area: area,
          hourlyRequirements: reqs,
          hourlyArtPatients: Array(24).fill(0),
          hourlyOsPatients: Array(24).fill(0)
        };
      }
    });

    const demand = Object.values(demandMap);

    return {
      persons,
      shifts,
      targets,
      areas,
      demand,
      attendance
    };
  } catch (error) {
    console.error('Failed to fetch DB via Supabase RPC:', error);
    return {
      persons: [],
      shifts: [],
      targets: [],
      areas: ['Atención', 'Soporte', 'Ventas', 'Administración'],
      demand: [],
      attendance: []
    };
  }
};

export const saveDb = async (data: Partial<DatabaseSchema>) => {
  try {
    console.log("Saving changes via Supabase RPC...", Object.keys(data));
    
    // We send everything EXCEPT targets and demand to the RPC to avoid JSONB casting errors in postgres
    const payloadForRpc = { ...data };
    
    const targetsToSave = payloadForRpc.targets;
    delete payloadForRpc.targets;
    
    const demandToSave = payloadForRpc.demand;
    delete payloadForRpc.demand;
    
    // Ensure all areas referenced in shifts, persons, or areas array exist in planning_areas table
    if (payloadForRpc.shifts || payloadForRpc.persons || payloadForRpc.areas) {
      const shiftAreas = (payloadForRpc.shifts || []).map(s => s.area).filter(Boolean);
      const personAreas = (payloadForRpc.persons || []).map(p => p.area).filter(Boolean);
      const passedAreas = (payloadForRpc.areas || []).filter(Boolean);
      const allDistinctAreas = Array.from(new Set([
        ...passedAreas,
        ...shiftAreas,
        ...personAreas,
        'Admisión General',
        'Admisión ART',
        'Admisión',
        'VACACIONES',
        'FRANCO',
        'ENFERMEDAD',
        'FERIADO'
      ]));

      try {
        await supabaseControl.from('planning_areas').upsert(
          allDistinctAreas.map(name => ({ name })),
          { onConflict: 'name' }
        );
      } catch (err) {
        console.warn('Auto-upsert of planning_areas:', err);
      }

      if (payloadForRpc.areas) {
        payloadForRpc.areas = allDistinctAreas;
      }
    }

    const { error } = await supabase.rpc('save_planning_data', { payload: payloadForRpc });
    if (error) throw error;

    // Save targets sequentially if provided
    if (targetsToSave) {
      console.log("Saving targets separately...");
      await supabaseControl.from('planning_targets').delete().neq('area', 'dummy_delete_val_xyz');
      if (targetsToSave.length > 0) {
        const mappedTargets = targetsToSave.map(t => ({
          area: t.area,
          day_of_week: Number(t.dayOfWeek),
          hourly_requirements: t.hourlyTargets || []
        }));
        const { error: targetErr } = await supabaseControl.from('planning_targets').insert(mappedTargets);
        if (targetErr) throw targetErr;
      }
    }

    // Save demand sequentially ONLY if provided and contains records (prevents accidental wiping)
    if (demandToSave && demandToSave.length > 0) {
      console.log("Saving demand separately...", demandToSave.length);
      await supabaseControl.from('planning_demand').delete().neq('date_string', 'dummy_delete_val_xyz');
      const mappedDemand = demandToSave.map(d => ({
        date_string: d.dateString,
        area: d.area,
        hourly_requirements: d.hourlyRequirements || []
      }));
      const { error: demandErr } = await supabaseControl.from('planning_demand').insert(mappedDemand);
      if (demandErr) throw demandErr;
    }

    console.log("✓ Saved successfully via Supabase RPC.");
  } catch (error) {
    console.error('Failed to save via Supabase RPC:', error);
  }
};
