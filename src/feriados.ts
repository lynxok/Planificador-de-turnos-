import { supabaseControl } from './supabase';

export interface Feriado {
  date: string;
  name: string;
}

export const DEFAULT_FERIADOS: Record<string, string> = {
  '2026-01-01': 'Año Nuevo',
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-03-24': 'Día Nac. de la Memoria',
  '2026-04-02': 'Día del Veterano y los Caídos en Malvinas',
  '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Día del Trabajador',
  '2026-05-25': 'Día de la Revolución de Mayo',
  '2026-06-15': 'Paso a la Inmortalidad del Gral. Güemes',
  '2026-06-20': 'Paso a la Inmortalidad del Gral. Belgrano',
  '2026-07-09': 'Día de la Independencia',
  '2026-08-17': 'Paso a la Inmortalidad del Gral. San Martín',
  '2026-10-12': 'Día del Respeto a la Diversidad Cultural',
  '2026-11-23': 'Día de la Soberanía Nacional (Trasladado)',
  '2026-12-08': 'Inmaculada Concepción de María',
  '2026-12-25': 'Navidad'
};

const STORAGE_KEY = 'iteo_custom_feriados_map';

// Objeto mutable exportado para mantener compatibilidad con todos los componentes que importan FERIADOS_2026
export const FERIADOS_2026: Record<string, string> = { ...DEFAULT_FERIADOS };

function syncInPlace(newMap: Record<string, string>) {
  Object.keys(FERIADOS_2026).forEach(k => delete FERIADOS_2026[k]);
  Object.assign(FERIADOS_2026, newMap);
}

// Inicializar desde localStorage si existe
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      syncInPlace(parsed);
    }
  }
} catch (e) {
  console.warn('Error leyendo feriados desde localStorage:', e);
}

export function getFeriadosMap(): Record<string, string> {
  return { ...FERIADOS_2026 };
}

export async function loadFeriadosFromSupabase(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabaseControl
      .from('planning_sync_logs')
      .select('details, created_at')
      .eq('source', 'FERIADOS_CONFIG')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0 && data[0].details?.feriados) {
      const remoteMap = data[0].details.feriados as Record<string, string>;
      syncInPlace(remoteMap);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMap));
      } catch (e) {}
      return { ...remoteMap };
    }
  } catch (err) {
    console.warn('No se pudieron cargar feriados remotos desde Supabase, usando locales:', err);
  }
  return { ...FERIADOS_2026 };
}

export async function saveFeriadosToSupabase(newMap: Record<string, string>): Promise<void> {
  syncInPlace(newMap);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMap));
  } catch (e) {}

  try {
    // Limpiar configuraciones previas de FERIADOS_CONFIG para no acumular registros
    await supabaseControl
      .from('planning_sync_logs')
      .delete()
      .eq('source', 'FERIADOS_CONFIG');

    await supabaseControl
      .from('planning_sync_logs')
      .insert({
        status: 'CONFIG',
        source: 'FERIADOS_CONFIG',
        details: {
          message: `Configuración de feriados actualizada (${Object.keys(newMap).length} días)`,
          feriados: newMap
        }
      });
  } catch (err) {
    console.error('Error guardando feriados en Supabase:', err);
    throw err;
  }
}
