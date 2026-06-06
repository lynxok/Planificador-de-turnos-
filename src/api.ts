import { Person, Shift, TargetCoverage, Area, AttendanceRecord, DemandRecord } from './types';

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
    const res = await fetch('/api/db');
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch DB', error);
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
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Failed to save DB', error);
  }
};
