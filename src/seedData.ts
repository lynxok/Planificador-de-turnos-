import { Person, Shift, TargetCoverage, Area } from './types';

// Palette of colors for UI representation
const COLOR_PALETTES = ['emerald', 'indigo', 'sky', 'violet', 'amber', 'rose', 'cyan', 'orange'];

export const SEEDED_PERSONS: Person[] = [
  // AREA: ATENCIÓN (22 Persons)
  { id: 'p1', name: 'Simón Astudilla', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 18, color: 'indigo' },
  { id: 'p2', name: 'Sofía López', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'indigo' },
  { id: 'p3', name: 'Alejandro Rodríguez', area: 'Atención', maxDailyHours: 6, availabilityStart: 9, availabilityEnd: 15, color: 'indigo' },
  { id: 'p4', name: 'María Fernández', area: 'Atención', maxDailyHours: 8, availabilityStart: 12, availabilityEnd: 21, color: 'emerald' },
  { id: 'p5', name: 'Juan Pérez', area: 'Atención', maxDailyHours: 8, availabilityStart: 7, availabilityEnd: 16, color: 'emerald' },
  { id: 'p6', name: 'Lucrecia Martínez', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'emerald' },
  { id: 'p7', name: 'Mateo Sánchez', area: 'Atención', maxDailyHours: 8, availabilityStart: 10, availabilityEnd: 19, color: 'indigo' },
  { id: 'p8', name: 'Valentina Romero', area: 'Atención', maxDailyHours: 6, availabilityStart: 13, availabilityEnd: 19, color: 'indigo' },
  { id: 'p9', name: 'Carlos Gómez', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'indigo' },
  { id: 'p10', name: 'Camila Díaz', area: 'Atención', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'indigo' },
  { id: 'p11', name: 'Lucas Alvarez', area: 'Atención', maxDailyHours: 8, availabilityStart: 13, availabilityEnd: 22, color: 'indigo' },
  { id: 'p12', name: 'Martina Benítez', area: 'Atención', maxDailyHours: 8, availabilityStart: 7, availabilityEnd: 16, color: 'emerald' },
  { id: 'p13', name: 'Bautista Ruiz', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'emerald' },
  { id: 'p14', name: 'Florencia Castro', area: 'Atención', maxDailyHours: 6, availabilityStart: 9, availabilityEnd: 15, color: 'emerald' },
  { id: 'p15', name: 'Jerónimo Medina', area: 'Atención', maxDailyHours: 8, availabilityStart: 14, availabilityEnd: 22, color: 'indigo' },
  { id: 'p16', name: 'Catalina Ortiz', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'indigo' },
  { id: 'p17', name: 'Benjamín Silva', area: 'Atención', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'indigo' },
  { id: 'p18', name: 'Delfina Ramos', area: 'Atención', maxDailyHours: 8, availabilityStart: 10, availabilityEnd: 19, color: 'emerald' },
  { id: 'p19', name: 'Thiago Herrera', area: 'Atención', maxDailyHours: 8, availabilityStart: 12, availabilityEnd: 21, color: 'indigo' },
  { id: 'p20', name: 'Alma Flores', area: 'Atención', maxDailyHours: 6, availabilityStart: 8, availabilityEnd: 14, color: 'indigo' },
  { id: 'p21', name: 'Felipe Acosta', area: 'Atención', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'emerald' },
  { id: 'p22', name: 'Jazmín Rojas', area: 'Atención', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'emerald' },

  // AREA: SOPORTE (8 Persons)
  { id: 'p23', name: 'Tomás Molina', area: 'Soporte', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'sky' },
  { id: 'p24', name: 'Lola Quiroga', area: 'Soporte', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'sky' },
  { id: 'p25', name: 'Joaquín Cabrera', area: 'Soporte', maxDailyHours: 8, availabilityStart: 13, availabilityEnd: 22, color: 'sky' },
  { id: 'p26', name: 'Micaela López', area: 'Soporte', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'violet' },
  { id: 'p27', name: 'Ignacio Fuentes', area: 'Soporte', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'violet' },
  { id: 'p28', name: 'Abril Vega', area: 'Soporte', maxDailyHours: 8, availabilityStart: 14, availabilityEnd: 23, color: 'violet' },
  { id: 'p29', name: 'Lautaro Navarro', area: 'Soporte', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'sky' },
  { id: 'p30', name: 'Juliana Cáceres', area: 'Soporte', maxDailyHours: 8, availabilityStart: 10, availabilityEnd: 19, color: 'sky' },

  // AREA: VENTAS (7 Persons)
  { id: 'p31', name: 'Enzo Giménez', area: 'Ventas', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'amber' },
  { id: 'p32', name: 'Milagros Núñez', area: 'Ventas', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'amber' },
  { id: 'p33', name: 'Francisco Rossi', area: 'Ventas', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'rose' },
  { id: 'p34', name: 'Pilar Lucero', area: 'Ventas', maxDailyHours: 8, availabilityStart: 10, availabilityEnd: 19, color: 'amber' },
  { id: 'p35', name: 'Santiago Franco', area: 'Ventas', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'rose' },
  { id: 'p36', name: 'Victoria Sosa', area: 'Ventas', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'amber' },
  { id: 'p37', name: 'Bruno Paz', area: 'Ventas', maxDailyHours: 8, availabilityStart: 11, availabilityEnd: 20, color: 'rose' },

  // AREA: ADMINISTRACIÓN (6 Persons)
  { id: 'p38', name: 'Isabella Córdoba', area: 'Administración', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'cyan' },
  { id: 'p39', name: 'Santino Luna', area: 'Administración', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'cyan' },
  { id: 'p40', name: 'Olivia Torres', area: 'Administración', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 18, color: 'orange' },
  { id: 'p41', name: 'Emilio Vidal', area: 'Administración', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 17, color: 'cyan' },
  { id: 'p42', name: 'Juana Barraza', area: 'Administración', maxDailyHours: 8, availabilityStart: 9, availabilityEnd: 17, color: 'orange' },
  { id: 'p43', name: 'Félix Mercado', area: 'Administración', maxDailyHours: 8, availabilityStart: 8, availabilityEnd: 16, color: 'cyan' }
];

export const INITIAL_SHIFTS: any[] = [
  // Monday Shifts (dayOfWeek: 1)
  { id: 's1', personId: 'p1', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Atención' },
  { id: 's2', personId: 'p2', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Atención' },
  { id: 's3', personId: 'p3', dayOfWeek: 1, startHour: 9, duration: 6, area: 'Atención' },
  { id: 's4', personId: 'p4', dayOfWeek: 1, startHour: 13, duration: 8, area: 'Atención' },
  { id: 's5', personId: 'p5', dayOfWeek: 1, startHour: 7, duration: 8.5, area: 'Atención' },
  { id: 's6', personId: 'p6', dayOfWeek: 1, startHour: 8.5, duration: 8, area: 'Atención' },
  { id: 's7', personId: 'p7', dayOfWeek: 1, startHour: 10, duration: 8, area: 'Atención' },
  { id: 's8', personId: 'p8', dayOfWeek: 1, startHour: 13, duration: 6, area: 'Atención' },
  { id: 's9', personId: 'p9', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Atención' },
  { id: 's10', personId: 'p10', dayOfWeek: 1, startHour: 9.5, duration: 8, area: 'Atención' },
  { id: 's11', personId: 'p11', dayOfWeek: 1, startHour: 14, duration: 8, area: 'Atención' },
  { id: 's12', personId: 'p12', dayOfWeek: 1, startHour: 7.5, duration: 8, area: 'Atención' },
  { id: 's13', personId: 'p13', dayOfWeek: 1, startHour: 8, duration: 8.5, area: 'Atención' },
  { id: 's14', personId: 'p14', dayOfWeek: 1, startHour: 9, duration: 6, area: 'Atención' },
  { id: 's15', personId: 'p15', dayOfWeek: 1, startHour: 14, duration: 8, area: 'Atención' },

  // Soporte (Monday)
  { id: 's16', personId: 'p23', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Soporte' },
  { id: 's17', personId: 'p24', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Soporte' },
  { id: 's18', personId: 'p25', dayOfWeek: 1, startHour: 13.5, duration: 8, area: 'Soporte' },
  { id: 's19', personId: 'p26', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Soporte' },
  { id: 's20', personId: 'p27', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Soporte' },

  // Ventas (Monday)
  { id: 's21', personId: 'p31', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Ventas' },
  { id: 's22', personId: 'p32', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Ventas' },
  { id: 's23', personId: 'p33', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Ventas' },
  { id: 's24', personId: 'p34', dayOfWeek: 1, startHour: 10, duration: 8, area: 'Ventas' },

  // Administración (Monday)
  { id: 's25', personId: 'p38', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Administración' },
  { id: 's26', personId: 'p39', dayOfWeek: 1, startHour: 8, duration: 8, area: 'Administración' },
  { id: 's27', personId: 'p40', dayOfWeek: 1, startHour: 9, duration: 8, area: 'Administración' },

  // Let's add standard shifts for Tuesday (dayOfWeek: 2)
  { id: 's2_1', personId: 'p1', dayOfWeek: 2, startHour: 8, duration: 8, area: 'Atención' },
  { id: 's2_2', personId: 'p2', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Atención' },
  { id: 's2_3', personId: 'p3', dayOfWeek: 2, startHour: 9, duration: 6, area: 'Atención' },
  { id: 's2_4', personId: 'p4', dayOfWeek: 2, startHour: 13, duration: 8, area: 'Atención' },
  { id: 's2_5', personId: 'p6', dayOfWeek: 2, startHour: 8, duration: 8, area: 'Atención' },
  { id: 's2_6', personId: 'p16', dayOfWeek: 2, startHour: 8, duration: 8, area: 'Atención' },
  { id: 's2_7', personId: 'p17', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Atención' },
  { id: 's2_8', personId: 'p18', dayOfWeek: 2, startHour: 10, duration: 8, area: 'Atención' },
  { id: 's2_9', personId: 'p19', dayOfWeek: 2, startHour: 12, duration: 8, area: 'Atención' },

  // Soporte (Tuesday)
  { id: 's2_10', personId: 'p23', dayOfWeek: 2, startHour: 8, duration: 8, area: 'Soporte' },
  { id: 's2_11', personId: 'p24', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Soporte' },
  { id: 's2_12', personId: 'p28', dayOfWeek: 2, startHour: 14, duration: 8, area: 'Soporte' },

  // Ventas (Tuesday)
  { id: 's2_13', personId: 'p31', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Ventas' },
  { id: 's2_14', personId: 'p35', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Ventas' },
  { id: 's2_15', personId: 'p36', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Ventas' },

  // Administración (Tuesday)
  { id: 's2_16', personId: 'p41', dayOfWeek: 2, startHour: 8, duration: 8, area: 'Administración' },
  { id: 's2_17', personId: 'p42', dayOfWeek: 2, startHour: 9, duration: 8, area: 'Administración' }
];

// Target shifts coverage requirements per hour for each area (0..23 hours).
// Default is e.g. normal distribution: low at night, peak in morning/afternoon, low in evening.
export const DEFAULT_TARGETS: TargetCoverage[] = [
  {
    area: 'Atención',
    dayOfWeek: 1,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 1, 3, 8, 10, 12, 12, 10, 10, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0]
  },
  {
    area: 'Soporte',
    dayOfWeek: 1,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 4, 4, 3, 2, 2, 1, 1, 0, 0, 0]
  },
  {
    area: 'Ventas',
    dayOfWeek: 1,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0, 0, 0]
  },
  {
    area: 'Administración',
    dayOfWeek: 1,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 2, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0]
  }
];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' }
];

export const AREAS: Area[] = ['Atención', 'Soporte', 'Ventas', 'Administración'];
