import { Person, Shift, TargetCoverage, Area, AttendanceRecord, DemandRecord } from './types';
import { supabase } from './supabase';

interface DatabaseSchema {
  persons: Person[];
  shifts: Shift[];
  targets: TargetCoverage[];
  areas: Area[];
  demand: DemandRecord[];
  attendance: AttendanceRecord[];
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

    // 2. Fetch aggregated demand via RPC
    console.log("Fetching demand via Supabase RPC...");
    let rawDemand: any[] = [];
    try {
      const { data: demandData, error: demandErr } = await supabase.rpc('fetch_planning_demand');
      if (demandErr) {
        console.warn('fetch_planning_demand failed (non-fatal):', demandErr.message);
      } else {
        rawDemand = demandData || [];
      }
    } catch (demandEx) {
      console.warn('fetch_planning_demand threw (non-fatal):', demandEx);
    }

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
          area: '', // will be matched by date only in CoverageChart
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
    
    // We send the data payload directly to our transactional save RPC function
    const { error } = await supabase.rpc('save_planning_data', { payload: data });
    if (error) throw error;

    console.log("✓ Saved successfully via Supabase RPC.");
  } catch (error) {
    console.error('Failed to save via Supabase RPC:', error);
  }
};
