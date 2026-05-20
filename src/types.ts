export type Area = string;

export interface Person {
  id: string;
  name: string;
  area: Area;
  maxDailyHours: number;
  availabilityStart: number; // e.g., 8 (08:00)
  availabilityEnd: number;   // e.g., 18 (18:00)
  color: string;             // Tailwind color class prefix (e.g., "blue", "teal")
  legajo?: string;           // Custom corporate registration ID
}

export interface Shift {
  id: string;
  personId: string;
  dayOfWeek: number;         // 1: Monday, 2: Tuesday, ..., 7: Sunday
  startHour: number;         // e.g., 8.5 for 08:30, 14 for 14:00 (0 to 23.5)
  duration: number;          // duration in hours (e.g. 4, 6, 8, 8.5)
  area: Area;                // Area assigned for this shift (usually inherits person area, but can vary)
}

export interface TargetCoverage {
  area: Area;
  dayOfWeek: number;
  hourlyTargets: number[];   // array of 24 numbers representing target count for hours 0..23
}
