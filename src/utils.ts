import { Area, Shift, Person } from './types';

export function formatHour(hourNum: number): string {
  const rounded = Math.round(hourNum * 100) / 100; // avoid floating point issues
  const hRaw = Math.floor(rounded);
  const m = Math.round((rounded - hRaw) * 60);
  const h = hRaw % 24;
  const daysLater = Math.floor(hRaw / 24);
  const daySuffix = daysLater > 0 ? ` (+${daysLater}d)` : '';
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}${daySuffix}`;
}

// Formatea la hora exclusivamente en HH:mm (00-23) para inputs HTML <input type="time">
export function formatTimeInput(hourNum: number): string {
  const rounded = Math.round(hourNum * 100) / 100;
  const hRaw = Math.floor(rounded);
  const m = Math.round((rounded - hRaw) * 60);
  const h = ((hRaw % 24) + 24) % 24;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Identifica si el área del turno corresponde a tareas administrativas (no boca de atención)
export function isAdministrativeShift(areaStr: string): boolean {
  if (!areaStr) return false;
  const norm = areaStr.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes('ADMINISTRATIV') || norm === 'ADMINISTRACION';
}

// Converts a string ("08:30") to a numeric hour (8.5)
export function parseHour(hourStr: string): number {
  if (!hourStr) return 8;
  const cleanStr = hourStr.split(' ')[0]; // elimina sufijos como (+1d) si existieran
  const parts = cleanStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + m / 60;
}

// Generates an array of hours (e.g., 0, 1, ..., 23)
export function getHourRange(start = 0, end = 23, step = 1): number[] {
  const range: number[] = [];
  for (let i = start; i <= end; i += step) {
    range.push(i);
  }
  return range;
}

// Get day of week integer (1: Lunes, ..., 7: Domingo) from YYYY-MM-DD
export function getDayOfWeekFromDate(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  let day = date.getDay(); // 0: Sunday, 1: Monday, ...
  return day === 0 ? 7 : day;
}

// Generate the days of a specific month in a given year
export interface CalendarDay {
  dateString: string; // YYYY-MM-DD
  dayNum: number;     // e.g. 15
  dayOfWeek: number;  // 1..7
  label: string;      // e.g. 'Lun'
}

export function generateMonthDays(year: number, monthZeroBased: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const date = new Date(Date.UTC(year, monthZeroBased, 1));
  const labels = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  while (date.getUTCMonth() === monthZeroBased) {
    const dayOfWeekStr = date.toISOString().split('T')[0];
    const jsDay = date.getUTCDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    
    days.push({
      dateString: dayOfWeekStr,
      dayNum: date.getUTCDate(),
      dayOfWeek,
      label: labels[dayOfWeek]
    });
    
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

// Helper para comprobar coincidencia de áreas
export function doesAreaMatch(shiftArea: string, targetArea: string): boolean {
  if (!targetArea || targetArea === 'Todos') return true;
  if (!shiftArea) return false;
  if (shiftArea === targetArea) return true;
  
  const sUpper = shiftArea.trim().toUpperCase();
  const tUpper = targetArea.trim().toUpperCase();
  if (sUpper === tUpper) return true;

  // Normalizar tildes para Admisión vs Admision
  const normS = sUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normT = tUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normS === normT) return true;

  // Si el objetivo es Admisión / Atención y el turno es de una sub-área de admisión
  if ((normT.includes('ADMIS') || normT.includes('ATENCI')) && (normS.includes('ADMIS') || normS.includes('ATENCI'))) {
    return true;
  }

  return false;
}

// Count how many people of a specific area are working during each of the 24 hours
export function calculateCoverage(
  shifts: Shift[],
  area: Area,
  hourRange: number[] = getHourRange(0, 23)
): number[] {
  const coverage = new Array(hourRange.length).fill(0);
  
  shifts.forEach((shift) => {
    // Si es ausencia (Franco, Vacaciones, Licencia, etc.), no cuenta como personal trabajando
    if (isAbsenceArea(shift.area)) return;
    if (!doesAreaMatch(shift.area, area)) return;
    
    const start = shift.startHour;
    const end = shift.startHour + shift.duration;
    
    hourRange.forEach((hour, idx) => {
      // If the hour falls within the shift
      if (hour >= start && hour < end) {
        coverage[idx]++;
      }
    });
  });
  
  return coverage;
}

// Gets initials for name badge
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Factorial para cálculo de Erlang C
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Configuración de Demanda y Buenas Prácticas
export interface DemandConfig {
  artTime: number; // minutos por paciente ART (ej: 6)
  osTime: number;  // minutos por paciente OS / Particular (ej: 4)
  maxWait: number; // minutos máximos tolerables de espera (ej: 8)
  sla: number;     // % SLA (ej: 85)
}

export const DEFAULT_DEMAND_CONFIG: DemandConfig = {
  artTime: 6,
  osTime: 4,
  maxWait: 8,
  sla: 85
};

export function getDemandConfig(): DemandConfig {
  try {
    const saved = localStorage.getItem('CHRONOS_DEMAND_CONFIG');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        artTime: Number(parsed.artTime) || DEFAULT_DEMAND_CONFIG.artTime,
        osTime: Number(parsed.osTime) || DEFAULT_DEMAND_CONFIG.osTime,
        maxWait: Number(parsed.maxWait) || DEFAULT_DEMAND_CONFIG.maxWait,
        sla: Number(parsed.sla) || DEFAULT_DEMAND_CONFIG.sla,
      };
    }
  } catch (e) {}
  return DEFAULT_DEMAND_CONFIG;
}

export function saveDemandConfig(config: DemandConfig) {
  try {
    localStorage.setItem('CHRONOS_DEMAND_CONFIG', JSON.stringify(config));
  } catch (e) {}
}

// Curva de Demanda Teórica de Guardia (Exactamente 60 turnos diarios)
// - Franja 08 a 11 hs: 8 turnos (no supera los 10 turnos)
// - Franja 11 a 18 hs: 44 turnos (mayor concentración, picos a las 14:00 y 17:00 hs)
// - Franja 18 a 22 hs: 9 turnos (no supera los 10 turnos)
// - Franja noche/madrugada: 5 turnos
export const THEORETICAL_GUARDIA_DEMAND: number[] = [
  1, 0, 0, 0, 0, 0, 1, 1, // 00 a 07 hs (3 turnos)
  2, 3, 3,                // 08 a 10 hs (8 turnos <= 10)
  5, 6, 6, 8, 5, 6, 8,    // 11 a 17 hs (44 turnos, picos a las 14 y 17 hs)
  3, 3, 2, 1,             // 18 a 21 hs (9 turnos <= 10)
  1, 1                    // 22 a 23 hs (2 turnos)
]; // Suma total = 60 turnos

// Algoritmo Erlang C dinámico para calcular Admisores/Bocas requeridas por hora
export function calculateAgentsRequired(
  artCalls: number, 
  osCalls: number,
  artServiceTime: number = 6,  // minutos
  osServiceTime: number = 4,   // minutos
  targetWaitTime: number = 8,  // minutos
  slaTarget: number = 0.85,    // SLA
  guardiaCalls: number = 0,    // turnos de guardia
  guardiaServiceTime: number = 5 // minutos admisión guardia
): number {
  if (artCalls === 0 && osCalls === 0 && guardiaCalls === 0) return 0;
  
  const lambda = artCalls + osCalls + guardiaCalls;
  const totalServiceTimeHours = (artCalls * artServiceTime + osCalls * osServiceTime + guardiaCalls * guardiaServiceTime) / 60;
  const Ts = totalServiceTimeHours / lambda;
  const A = lambda * Ts;
  
  let m = Math.floor(A) + 1;
  const targetWaitHrs = targetWaitTime / 60;
  const targetProbability = 1 - slaTarget;
  
  while (m < A + 100) {
    let sum = 0;
    for (let i = 0; i < m; i++) {
      sum += Math.pow(A, i) / factorial(i);
    }
    const term2 = (Math.pow(A, m) / factorial(m)) * (m / (m - A));
    const Pw = term2 / (sum + term2);
    const pWaitTarget = Pw * Math.exp(-(m - A) * (targetWaitHrs / Ts));
    
    if (pWaitTarget < targetProbability) {
      break;
    }
    m++;
  }
  
  return m;
}

// Verifica si un área corresponde a ausencia / franco / licencia
export function isAbsenceArea(area: string): boolean {
  if (!area) return false;
  const upper = area.trim().toUpperCase();
  return ['VACACIONES', 'FRANCO', 'ENFERMEDAD', 'ENFERMO', 'LICENCIA', 'FERIADO'].includes(upper);
}

// Algoritmo matemático para estimación de tiempo teórico de espera en minutos (Erlang C)
export function calculateTheoreticalWaitTime(
  artCalls: number,
  osCalls: number,
  actualAgents: number,
  artTime: number = 6,
  osTime: number = 4,
  guardiaCalls: number = 0,
  guardiaTime: number = 5
): number {
  if (artCalls === 0 && osCalls === 0 && guardiaCalls === 0) return 0;
  if (actualAgents === 0) return 99;
  
  const lambda = artCalls + osCalls + guardiaCalls;
  const Ts = (artCalls * artTime + osCalls * osTime + guardiaCalls * guardiaTime) / lambda;
  const TsHrs = Ts / 60;
  const A = lambda * TsHrs;
  
  if (actualAgents <= A) {
    return Math.max(30, Math.round(Ts * 5));
  }
  
  let sum = 0;
  for (let i = 0; i < actualAgents; i++) {
    sum += Math.pow(A, i) / factorial(i);
  }
  const term2 = (Math.pow(A, actualAgents) / factorial(actualAgents)) * (actualAgents / (actualAgents - A));
  const Pw = term2 / (sum + term2);
  
  const WqHrs = (Pw * TsHrs) / (actualAgents - A);
  const WqMin = WqHrs * 60;
  
  return isNaN(WqMin) ? 0 : Math.round(WqMin * 10) / 10;
}

/**
 * Checks if a candidate shift overlaps with any existing shift for the same person, including overnight shifts.
 */
export function checkOverlap(
  candidate: { id?: string; personId: string; date: string; startHour: number; duration: number },
  allShifts: Shift[]
): boolean {
  if (!candidate.date) return false;
  const candidateDate = new Date(candidate.date + 'T00:00:00').getTime() / 3600000;
  const candStart = candidateDate + candidate.startHour;
  const candEnd = candStart + candidate.duration;

  return allShifts.some((s) => {
    if (candidate.id && s.id === candidate.id) return false;
    if (s.personId !== candidate.personId) return false;
    
    const sDate = new Date(s.date + 'T00:00:00').getTime() / 3600000;
    const sStart = sDate + s.startHour;
    const sEnd = sStart + s.duration;

    return candStart < sEnd && sStart < candEnd;
  });
}

/**
 * Returns the first overlapping shift if it exists, otherwise undefined, including overnight shifts.
 */
export function getOverlappingShift(
  candidate: { id?: string; personId: string; date: string; startHour: number; duration: number },
  allShifts: Shift[]
): Shift | undefined {
  if (!candidate.date) return undefined;
  const candidateDate = new Date(candidate.date + 'T00:00:00').getTime() / 3600000;
  const candStart = candidateDate + candidate.startHour;
  const candEnd = candStart + candidate.duration;

  return allShifts.find((s) => {
    if (candidate.id && s.id === candidate.id) return false;
    if (s.personId !== candidate.personId) return false;
    
    const sDate = new Date(s.date + 'T00:00:00').getTime() / 3600000;
    const sStart = sDate + s.startHour;
    const sEnd = sStart + s.duration;

    return candStart < sEnd && sStart < candEnd;
  });
}

