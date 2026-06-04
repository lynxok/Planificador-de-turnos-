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

// Converts a string ("08:30") to a numeric hour (8.5)
export function parseHour(hourStr: string): number {
  if (!hourStr) return 8;
  const parts = hourStr.split(':');
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

// Count how many people of a specific area are working during each of the 24 hours
export function calculateCoverage(
  shifts: Shift[],
  area: Area,
  hourRange: number[] = getHourRange(0, 23)
): number[] {
  const coverage = new Array(hourRange.length).fill(0);
  
  shifts.forEach((shift) => {
    if (shift.area !== area) return;
    
    const start = shift.startHour;
    const end = shift.startHour + shift.duration;
    
    hourRange.forEach((hour, idx) => {
      // If the hour falls within the shift
      // (a shift from 8.0 to 16.0 covers 8, 9, 10, 11, 12, 13, 14, 15 but not 16.0 onwards)
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

