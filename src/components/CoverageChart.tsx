import React, { useState, useRef } from 'react';
import { Area, Shift, Person, DemandRecord } from '../types';
import { formatHour, getHourRange, calculateCoverage } from '../utils';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Minus, 
  Settings2, 
  Calendar, 
  Clipboard, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  HelpCircle,
  Database,
  Trash2
} from 'lucide-react';
import { AppTheme } from '../themes';
import * as XLSX from 'xlsx';

interface CoverageChartProps {
  shifts: Shift[]; // Recibe todos los turnos para poder calcular las métricas semanales por día y por hora
  activeArea: Area;
  targetCount: number[]; // 24 números de objetivos del día actual
  onUpdateTargets: (newTargets: number[]) => void;
  theme?: AppTheme;
  
  // Nuevos atributos agregados bajo demanda
  currentDayOfWeek: number;
  weekDates?: string[]; // Fechas del Lunes al Domingo para cambiar de día
  onChangeDate?: (dateStr: string) => void;
  persons: Person[];
  onQuickImport?: (importedPersons: Person[], importedShifts: Shift[]) => void;
  demand?: DemandRecord[];
  activeDate?: string;
}

// Función factorial para Erlang C
function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Algoritmo matemático para estimación de tiempo teórico de espera en minutos (Erlang C)
function calculateTheoreticalWaitTime(
  artCalls: number,
  osCalls: number,
  actualAgents: number,
  artTime: number = 6, // minutos
  osTime: number = 4   // minutos
): number {
  if (artCalls === 0 && osCalls === 0) return 0;
  if (actualAgents === 0) return 99; // Indica saturación si hay demanda pero nadie atiende
  
  const lambda = artCalls + osCalls;
  const Ts = (artCalls * artTime + osCalls * osTime) / lambda; // tiempo de servicio promedio ponderado en minutos
  const TsHrs = Ts / 60;
  const A = lambda * TsHrs; // intensidad de tráfico
  
  if (actualAgents <= A) {
    // Saturación del sistema (tráfico >= capacidad)
    return Math.max(30, Math.round(Ts * 5));
  }
  
  // Calcular Pw (Probabilidad de esperar en cola)
  let sum = 0;
  for (let i = 0; i < actualAgents; i++) {
    sum += Math.pow(A, i) / factorial(i);
  }
  const term2 = (Math.pow(A, actualAgents) / factorial(actualAgents)) * (actualAgents / (actualAgents - A));
  const Pw = term2 / (sum + term2);
  
  // Tiempo de espera en cola en horas
  const WqHrs = (Pw * TsHrs) / (actualAgents - A);
  const WqMin = WqHrs * 60; // a minutos
  
  return isNaN(WqMin) ? 0 : Math.round(WqMin * 10) / 10;
}

export function CoverageChart({
  shifts,
  activeArea,
  targetCount,
  onUpdateTargets,
  theme,
  currentDayOfWeek,
  weekDates = [],
  onChangeDate,
  persons,
  onQuickImport,
  demand = [],
  activeDate,
}: CoverageChartProps) {
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isQuickLoaderOpen, setIsQuickLoaderOpen] = useState(false);
  const [quickLoaderTab, setQuickLoaderTab] = useState<'paste' | 'excel'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hourRange = getHourRange(0, 23, 1);
  
  // Filtrar los turnos correspondientes solo a HOY y de la área activa para el gráfico de 24 horas
  const todayShifts = shifts.filter(s => s.date === activeDate);
  
  // Agregar los desbordes de ayer que siguen activos hoy (para calcular la cobertura real de hoy)
  const yesterdayDate = (() => {
    if (!activeDate) return '';
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();
  
  const yesterdayOverflowShifts = activeDate
    ? shifts
        .filter(s => s.date === yesterdayDate && s.startHour + s.duration > 24)
        .map(s => ({
          ...s,
          startHour: 0,
          duration: s.startHour + s.duration - 24
        }))
    : [];
    
  const combinedShiftsForCoverage = [...todayShifts, ...yesterdayOverflowShifts];
  const activeAreaTodayShifts = todayShifts.filter(s => s.area === activeArea);
  
  // Cobertura real (personas activas por hora)
  const actualCoverage = calculateCoverage(combinedShiftsForCoverage, activeArea, hourRange);

  // Determinar el objetivo a mostrar: 
  // Si hay demanda calculada para el día y área actual, la usamos en vez de targetCount manual
  const todaysDemandRecord = activeDate ? demand.find(d => d.dateString === activeDate && d.area === activeArea) : undefined;
  const effectiveTargetCount = todaysDemandRecord ? todaysDemandRecord.hourlyRequirements : targetCount;

  // Calcular inicios y fin de turnos por hora (para la área activa de hoy)
  const startsPerHour = new Array(24).fill(0);
  const endsPerHour = new Array(24).fill(0);

  activeAreaTodayShifts.forEach(shift => {
    const start = Math.floor(shift.startHour);
    let end = Math.floor(shift.startHour + shift.duration);
    if (end >= 24) end -= 24;

    if (start >= 0 && start < 24) {
      startsPerHour[start]++;
    }
    if (end >= 0 && end < 24) {
      endsPerHour[end]++;
    }
  });

  // Métricas generales de cobertura de hoy
  let totalDeficitHours = 0;
  let totalSurplusHours = 0;
  let wellCoveredHours = 0;
  let activeWorkingHours = 0;

  hourRange.forEach((hour, idx) => {
    const target = effectiveTargetCount[idx];
    const actual = actualCoverage[idx];
    
    if (target > 0 || actual > 0) {
      activeWorkingHours++;
      if (actual < target) {
        totalDeficitHours += (target - actual);
      } else if (actual > target) {
        totalSurplusHours += (actual - target);
      } else {
        wellCoveredHours++;
      }
    }
  });

  const percentHealthy = activeWorkingHours > 0 
    ? Math.round((wellCoveredHours / activeWorkingHours) * 100) 
    : 100;

  const handleIncrementTarget = (hourIdx: number) => {
    if (todaysDemandRecord) return; // No permitir editar targets manuales si estamos viendo demanda calculada
    const updated = [...targetCount];
    updated[hourIdx] = Math.min(20, updated[hourIdx] + 1);
    onUpdateTargets(updated);
  };

  const handleDecrementTarget = (hourIdx: number) => {
    if (todaysDemandRecord) return; // No permitir editar targets manuales si estamos viendo demanda calculada
    const updated = [...targetCount];
    updated[hourIdx] = Math.max(0, updated[hourIdx] - 1);
    onUpdateTargets(updated);
  };

  // Calcular cantidad de turnos y horas totales por día de toda la semana (para el área activa)
  const daysOfWeekMapping = [
    { num: 1, name: 'Lun', fullName: 'Lunes' },
    { num: 2, name: 'Mar', fullName: 'Martes' },
    { num: 3, name: 'Mié', fullName: 'Miércoles' },
    { num: 4, name: 'Jue', fullName: 'Jueves' },
    { num: 5, name: 'Vie', fullName: 'Viernes' },
    { num: 6, name: 'Sáb', fullName: 'Sábado' },
    { num: 7, name: 'Dom', fullName: 'Domingo' }
  ];

  const weeklyDensity = daysOfWeekMapping.map(day => {
    const targetDate = weekDates[day.num - 1];
    const dayAreaShifts = shifts.filter(s => s.date === targetDate && s.area === activeArea);
    const count = dayAreaShifts.length;
    const hours = dayAreaShifts.reduce((sum, s) => sum + s.duration, 0);
    return {
      ...day,
      count,
      hours: Math.round(hours * 10) / 10
    };
  });

  // Procesador inteligente de copiado/pegado tipo CSV o tabla de Excel de turnos
  const handleProcessQuickPaste = () => {
    if (!pasteText.trim()) return;
    setImportLogs([]);
    setImportSuccess(null);

    const lines = pasteText.split('\n');
    let updatedPersons = [...persons];
    // Si marcamos "reemplazar", quitamos los turnos previos de esta área
    let updatedShifts = replaceExisting 
      ? shifts.filter(s => s.area !== activeArea) 
      : [...shifts];

    const PRESYLED_COLORS = ['indigo', 'emerald', 'sky', 'violet', 'amber', 'rose', 'cyan', 'orange'];
    const PARSED_DAYS_MAP: Record<string, number> = {
      'LUNES': 1, 'LUN': 1, 'LUNES ': 1, 'L': 1,
      'MARTES': 2, 'MAR': 2, 'MARTES ': 2, 'M': 2,
      'MIERCOLES': 3, 'MIÉRCOLES': 3, 'MIE': 3, 'MIÉ': 3, 'X': 3,
      'JUEVES': 4, 'JUE': 4, 'J': 4,
      'VIERNES': 5, 'VIE': 5, 'V': 5,
      'SABADO': 6, 'SÁBADO': 6, 'SAB': 6, 'SÁB': 6, 'S': 6,
      'DOMINGO': 7, 'DOMINGOS': 7, 'DOM': 7, 'D': 7
    };

    let importedShiftsCount = 0;
    let importedPeopleCount = 0;
    const logs: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

      // Detectar si es tabulado (Excel) o separado por comas / punto-y-coma
      let parts = trimmed.split('\t');
      if (parts.length < 2) {
        parts = trimmed.split(/[;,]/);
      }

      const cleanParts = parts.map(p => p.trim()).filter(Boolean);
      if (cleanParts.length < 2) {
        if (trimmed.length > 5) {
          logs.push(`Fila ${index + 1}: Omitida (Formato insuficiente).`);
        }
        return;
      }

      // Intentar mapear las columnas inteligente
      // Nombre | Legajo | Entrada | Salida | Dias
      let candidateName = '';
      let candidateLegajo = '';
      let times: string[] = [];
      let daysPart = '';

      // Escaneo inteligente
      cleanParts.forEach(part => {
        // ¿Es un rango de días o días de la semana?
        const norm = part.toUpperCase().normalize("NFD").replace(/[\u0300._-]/g, "");
        const containsDay = Object.keys(PARSED_DAYS_MAP).some(dayKey => norm.includes(dayKey));
        
        if (containsDay || /^[1-7](\s*,\s*[1-7])*$/.test(part)) {
          daysPart = part;
        } else if (part.includes(':') || /^\d{1,2}$/.test(part)) {
          times.push(part);
        } else if (part.startsWith('L-') || part.startsWith('LEG-') || /^[A-Z]-\d+$/.test(part) || /^\d{4,6}$/.test(part)) {
          candidateLegajo = part;
        } else {
          if (!candidateName) {
            candidateName = part;
          } else if (!candidateLegajo) {
            candidateLegajo = part; // fallback
          }
        }
      });

      // Valores por defecto si falla la inferencia
      if (!candidateName) {
        candidateName = cleanParts[0] || 'Nuevo Colaborador';
      }
      if (!candidateLegajo) {
        candidateLegajo = cleanParts[1] && cleanParts[1] !== daysPart && !times.includes(cleanParts[1]) 
          ? cleanParts[1] 
          : `LEG-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Convertir horas
      let startHour = 8;
      let duration = 8;
      
      const parseHourLocal = (str: string): number => {
        if (!str) return 8;
        if (str.includes(':')) {
          const p = str.split(':');
          const h = parseInt(p[0], 10) || 0;
          const m = parseInt(p[1], 10) || 0;
          return h + m / 60;
        }
        const val = parseFloat(str);
        if (!isNaN(val) && val > 0 && val < 1) {
          // Si el valor es menor a 1, probablemente sea una fracción matemática de Excel (ej: 0.2916 = 7 am)
          return val * 24;
        }
        return isNaN(val) ? 8 : val;
      };

      if (times.length >= 2) {
        startHour = parseHourLocal(times[0]);
        const endHour = parseHourLocal(times[1]);
        duration = endHour - startHour;
        if (duration <= 0) duration += 24; // overnight shift
      } else if (times.length === 1) {
        startHour = parseHourLocal(times[0]);
        duration = 8;
      }

      // Resolver días de la semana
      let daysOfWeek: number[] = [];
      if (daysPart) {
        daysOfWeek = daysPart
          .split(/[\s,|+&-]+/)
          .map(d => d.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
          .map(d => {
            if (PARSED_DAYS_MAP[d]) return PARSED_DAYS_MAP[d];
            if (d.includes('LUN')) return 1;
            if (d.includes('MAR')) return 2;
            if (d.includes('MIE') || d.includes('MIÉ')) return 3;
            if (d.includes('JUE')) return 4;
            if (d.includes('VIE')) return 5;
            if (d.includes('SAB') || d.includes('SÁB')) return 6;
            if (d.includes('DOM')) return 7;
            const val = parseInt(d, 10);
            if (val >= 1 && val <= 7) return val;
            return null;
          })
          .filter((v): v is number => v !== null);
      }

      // Determinar si es solo una plantilla de turno posible (sin días)
      const isPossibleShiftOnly = daysOfWeek.length === 0;

      // Verificar / Crear Persona
      let targetPerson = updatedPersons.find(
        (p) => (p.legajo && p.legajo.toLowerCase() === candidateLegajo.toLowerCase()) ||
               (p.name.toLowerCase() === candidateName.toLowerCase())
      );

      if (!targetPerson) {
        const newColor = PRESYLED_COLORS[updatedPersons.length % PRESYLED_COLORS.length];
        const newId = `p_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        targetPerson = {
          id: newId,
          name: candidateName,
          area: activeArea,
          maxDailyHours: Math.max(8, Math.ceil(duration)),
          availabilityStart: Math.floor(startHour),
          availabilityEnd: Math.min(24, Math.ceil(startHour + duration)),
          color: newColor,
          legajo: candidateLegajo
        };
        updatedPersons.push(targetPerson);
        importedPeopleCount++;
      }

      // Si no hay días, lo agregamos como turno posible y no creamos Shift
      if (isPossibleShiftOnly) {
        if (!targetPerson.possibleShifts) {
          targetPerson.possibleShifts = [];
        }
        const exists = targetPerson.possibleShifts.some(ps => ps.startHour === startHour && ps.duration === duration);
        if (!exists) {
          targetPerson.possibleShifts.push({ startHour, duration });
        }
        logs.push(`Fila ${index + 1}: Guardado como 'Turno Posible' para ${candidateName} (sin asignar a un día).`);
        return;
      }

      // Añadir turnos para cada día especificado
      daysOfWeek.forEach((dayVal) => {
        const targetDate = weekDates[dayVal - 1];
        // Validar superposición en el mismo día
        const overlaps = updatedShifts.some(s => s.personId === targetPerson!.id && s.date === targetDate);
        if (overlaps) {
          logs.push(`Fila ${index + 1}: ${candidateName} ya tiene un turno programado el día ${targetDate}. Omitido por superposición.`);
          return;
        }

        updatedShifts.push({
          id: `s_q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          personId: targetPerson!.id,
          date: targetDate,
          startHour,
          duration,
          area: activeArea
        });
        importedShiftsCount++;
      });
    });

    setImportLogs(logs);
    if (importedShiftsCount > 0) {
      setImportSuccess(`¡Cargados con éxito! Se registraron ${importedPeopleCount} colaboradores nuevos y se asignaron ${importedShiftsCount} turnos.`);
      setPasteText('');
      if (onQuickImport) {
        onQuickImport(updatedPersons, updatedShifts);
      }
    } else {
      setImportLogs(prev => [...prev, 'Error: No se ha podido importar ningún turno con los datos del portapapeles. Verifique el formato.']);
    }
  };

  // Procesador de arrastrar y soltar Excel
  const handleExcelUpload = (file: File) => {
    setImportLogs([]);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          setImportLogs(['El libro de Excel está vacío o es inválido.']);
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { raw: false, defval: '' });

        if (rows.length === 0) {
          setImportLogs(['No se encontraron registros en la primera hoja de Excel.']);
          return;
        }

        // Convertimos a texto bruto tabulado y reutilizamos nuestro procesador inteligente para consistencia
        let generatedText = '';
        rows.forEach(r => {
          const cols = Object.values(r).map(v => String(v).replace(/\t/g, ' '));
          generatedText += cols.join('\t') + '\n';
        });

        setPasteText(generatedText);
        setImportSuccess(`Excel "${file.name}" leído correctamente con ${rows.length} filas analizadas. Presiona 'Analizar y Cargar' para completar.`);
      } catch (err: any) {
        setImportLogs([`Error al procesar el archivo Excel: ${err?.message || 'Formato incorrecto'}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleExcelUpload(file);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleExcelUpload(file);
    }
  };

  return (
    <div className={`${theme?.cardBg || 'bg-slate-900'} ${theme?.cardText || 'text-white'} border ${theme?.cardBorder || 'border-slate-800'} rounded-2xl p-6 shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col gap-6`}>
      {/* Grid Pattern Backdrop Decors */}
      <div className="absolute inset-0 opacity-[0.01] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Segment 1: Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/5 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-emerald-400 animate-pulse" />
            <h3 className={`text-base font-extrabold tracking-tight ${theme?.cardText || 'text-slate-100'} font-sans uppercase`}>
              Monitor de Cobertura y Densidad de Personal — {activeArea}
            </h3>
          </div>
          <p className={`text-xs ${theme?.cardTextMuted || 'text-slate-400'}`}>
            Analiza turnos activos hoy por hora y el resumen de volumen semanal.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsEditingTargets(!isEditingTargets)}
            disabled={!!todaysDemandRecord}
            title={todaysDemandRecord ? "La meta actual proviene de la Demanda Calculada. No es editable." : "Ajustar meta manual"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
              todaysDemandRecord ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500' :
              isEditingTargets 
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                : `${theme?.cardHeaderBg || 'bg-slate-800'} ${theme?.cardHeaderBorder || 'border-slate-700'} ${theme?.cardText || 'text-slate-300'} hover:opacity-90`
            }`}
          >
            <Settings2 size={13} className={isEditingTargets ? 'animate-spin' : ''} />
            {todaysDemandRecord ? 'Usando Calculadora' : isEditingTargets ? 'Guardar Requisitos' : 'Ajustar Requisitos'}
          </button>

          <button
            onClick={() => setIsQuickLoaderOpen(!isQuickLoaderOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
              isQuickLoaderOpen
                ? 'bg-indigo-505/20 border-indigo-500/40 text-indigo-300'
                : 'bg-emerald-600 border-emerald-500/40 text-white hover:bg-emerald-700'
            }`}
          >
            <Clipboard size={13} />
            {isQuickLoaderOpen ? 'Cerrar Cargador' : '📥 Carga Rápida'}
          </button>
        </div>
      </div>

      {/* Segment 1.5: Panel de Carga Rápida de Datos Integrado (Opcional) */}
      {isQuickLoaderOpen && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 animate-scale-up relative z-10 text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="font-extrabold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
              <Database size={14} /> CARGADOR RÁPIDO DE TURNOS ({activeArea})
            </h4>
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setQuickLoaderTab('paste')}
                className={`px-3 py-1 font-bold rounded-md cursor-pointer transition-all ${
                  quickLoaderTab === 'paste' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Copiar / Pegar Texto
              </button>
              <button
                onClick={() => setQuickLoaderTab('excel')}
                className={`px-3 py-1 font-bold rounded-md cursor-pointer transition-all ${
                  quickLoaderTab === 'excel' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Subir Hojas (.xlsx)
              </button>
            </div>
          </div>

          {importSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl p-3 font-semibold flex items-center gap-2">
              <CheckCircle size={15} />
              <div>{importSuccess}</div>
            </div>
          )}

          {importLogs.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-350 rounded-xl p-3 space-y-1 font-medium max-h-[120px] overflow-y-auto">
              <div className="font-extrabold text-[10px] uppercase tracking-wider text-amber-400">Alertas del analizador:</div>
              {importLogs.map((log, lIdx) => (
                <div key={lIdx} className="flex items-start gap-1 text-[10px]">
                  <span>•</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}

          {quickLoaderTab === 'paste' ? (
            <div className="space-y-3">
              <label className="block text-slate-300 font-bold mb-1">
                Pega tus filas de datos (separadas por tabuladores de Excel o comas):
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Simón Astudilla, LEG-1001, 08:00, 16:00, Lunes, Martes, Miércoles&#10;María Fernández, LEG-1004, 13:00, 21:00, Lunes, Jueves, Viernes&#10;Soporte Técnico, LEG-099, 10:00, 18:00, Sábados, Domingos"
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 resize-none"
              />
              <div className="text-[10px] text-slate-400 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                💡 <strong>Tip de Autodetector:</strong> El sistema identifica automáticamente el Nombre, Legajo (ej. 1004 o LEG-X), Horario de Ingreso y Salida (ej. 08:30 y 16:30), y los días de asignación en español. ¡Sólo copia tu grilla de Excel y pégala aquí!
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-500/10' 
                  : 'border-white/10 bg-black/20 hover:border-white/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelectChange}
                className="hidden"
              />
              <Upload className="text-slate-400 w-8 h-8" />
              <div className="space-y-1">
                <p className="font-bold text-slate-200">Arrastra tu planilla o haz clic aquí</p>
                <p className="text-[10px] text-slate-400">Soporta libros Excel (.xlsx/.xls) o CSV con columnas de turnos.</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-350">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="accent-indigo-600 rounded"
              />
              <span>Borrar turnos existentes de {activeArea} antes de cargar</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPasteText('');
                  setImportSuccess(null);
                  setImportLogs([]);
                }}
                className="px-3 py-1.5 border border-white/10 hover:bg-white/5 rounded-lg text-xs font-bold text-slate-300 cursor-pointer"
              >
                Limpiar
              </button>
              <button
                onClick={handleProcessQuickPaste}
                disabled={!pasteText.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1"
              >
                <Check size={14} />
                <span>Analizar y Cargar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segment 2: RESUMEN SEMANAL DE TURNOS (DENSIDAD) */}
      <div className="bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-extrabold tracking-wider uppercase text-[#d4af37]">
            Volumen Semanal de Turnos ({activeArea})
          </span>
          <span className="text-[10px] text-slate-400 font-medium font-sans">
            Haz clic en cualquier día para abrir su planificador en el panel superior
          </span>
        </div>

        {/* 7 Days segments */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {weeklyDensity.map((day) => {
            const isActive = day.num === currentDayOfWeek;
            return (
              <button
                key={day.num}
                onClick={() => {
                  if (onChangeDate && weekDates[day.num - 1]) {
                    onChangeDate(weekDates[day.num - 1]);
                  }
                }}
                className={`p-3 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden group/day cursor-pointer select-none active:scale-95 ${
                  isActive 
                    ? 'bg-amber-500/10 border-[#d4af37] ring-1 ring-[#d4af37]/30 shadow-lg' 
                    : 'bg-black/10 border-white/5 hover:bg-black/30 hover:border-white/10'
                }`}
              >
                {isActive && (
                  <div className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
                
                <div>
                  <div className={`text-xs font-extrabold ${isActive ? 'text-[#d4af37]' : 'text-slate-300'}`}>
                    {day.fullName}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase">
                    {day.name === 'Sáb' || day.name === 'Dom' ? 'Finde' : 'Semana'}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-baseline justify-between">
                  <span className="text-sm font-black text-white">{day.count} <span className="text-[9px] font-bold text-slate-400">un.</span></span>
                  <span className="text-[10px] font-bold text-[#d4af37]/80 font-mono">{day.hours} hs</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Segment 3: GRÁFICO DE COBERTURA Y ANÁLISIS DE TURNOS POR HORA HOY */}
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold tracking-wider uppercase text-[#d4af37]">
            Gráfico de Cobertura por Hora y Flujo de Turnos (Entradas / Salidas)
          </span>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <HelpCircle size={11} /> Pasa el cursor sobre las columnas para ver los nombres y detalles de ingresos.
          </span>
        </div>

        <div className="relative">
          {/* Líneas de guía de fondo */}
          <div className="absolute inset-0 flex flex-col justify-between py-5 pointer-events-none opacity-5">
            {[0, 1, 2, 3, 4].map((v) => (
              <div key={v} className="border-b border-dashed border-white w-full" />
            ))}
          </div>

          {/* Columnas del gráfico */}
          <div className="grid grid-cols-24 gap-1.5 pt-4 pb-2 items-end min-h-[170px] px-1 relative z-15 overflow-x-auto overflow-y-hidden select-none custom-scrollbar">
            {hourRange.map((hour, idx) => {
              const actual = actualCoverage[idx];
              const target = effectiveTargetCount[idx];
              const maxVal = Math.max(1, ...actualCoverage, ...effectiveTargetCount);
              
              const actualPct = (actual / maxVal) * 100;
              const targetPct = (target / maxVal) * 100;

              const isUnderstaffed = actual < target;
              const isOverstaffed = actual > target;
              const isPerfect = actual === target && target > 0;

              let actualBarColor = 'bg-slate-500';
              if (isUnderstaffed) actualBarColor = 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
              if (isOverstaffed) actualBarColor = 'bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.3)]';
              if (isPerfect) actualBarColor = 'bg-[#d4af37] hover:bg-yellow-400 shadow-[0_0_8px_rgba(212,175,55,0.3)]';

              // Turnos que inician y terminan a esta hora exacta
              const starts = startsPerHour[hour] || 0;
              const ends = endsPerHour[hour] || 0;

              // Identificar personas ingresantes y salientes
              const peopleStarting = activeAreaTodayShifts
                .filter(s => Math.floor(s.startHour) === hour)
                .map(s => persons.find(p => p.id === s.personId)?.name || 'Colaborador');

              const peopleEnding = activeAreaTodayShifts
                .filter(s => {
                  let end = Math.floor(s.startHour + s.duration);
                  if (end >= 24) end -= 24;
                  return end === hour;
                })
                .map(s => persons.find(p => p.id === s.personId)?.name || 'Colaborador');

              return (
                <div key={hour} className="flex flex-col items-center h-full group min-w-[34px]">
                  {/* Edición Interactiva u Hovers de información de turnos */}
                  {isEditingTargets ? (
                    <div className="flex flex-col items-center gap-0.5 mb-1.5">
                      <button
                        onClick={() => handleIncrementTarget(idx)}
                        className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer hover:text-white"
                      >
                        <Plus size={10} />
                      </button>
                      <span className="text-[10px] font-bold text-amber-400 font-mono">{target}</span>
                      <button
                        onClick={() => handleDecrementTarget(idx)}
                        className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer hover:text-white"
                        disabled={target === 0}
                      >
                        <Minus size={10} />
                      </button>
                    </div>
                  ) : (
                    /* Tooltip ultra-detallado que incluye el recuento de turnos por hora, ingresos y egresos detallados */
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-950/95 border border-[#d4af37]/30 text-[#f1f5f9] text-[10px] rounded-xl p-3 shadow-2xl transition-all pointer-events-none z-50 flex flex-col gap-1.5 whitespace-nowrap">
                      <div className="font-extrabold text-slate-300 border-b border-white/5 pb-1 flex items-center justify-between">
                        <span>Hora: {formatHour(hour)}hs</span>
                        <span className="text-[#d4af37]">{daysOfWeekMapping[currentDayOfWeek - 1]?.fullName}</span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${actualBarColor}`} />
                          Personal en Cobertura: <strong className="text-white text-xs">{actual}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" />
                          Objetivo Mínimo: <strong className="text-slate-300">{target}</strong>
                        </span>
                      </div>

                      {/* Flujos de turnos que entran o salen */}
                      {(starts > 0 || ends > 0) && (
                        <div className="border-t border-white/5 pt-1.5 mt-1 space-y-1">
                          {starts > 0 && (
                            <div className="text-emerald-400 flex flex-col gap-0.5">
                              <span className="font-bold flex items-center gap-1">
                                <ArrowUpRight size={11} /> Inician {starts} turno(s):
                              </span>
                              <span className="text-[9px] pl-3.5 text-slate-350 max-w-[150px] truncate">
                                {peopleStarting.join(', ')}
                              </span>
                            </div>
                          )}
                          {ends > 0 && (
                            <div className="text-rose-400 flex flex-col gap-0.5">
                              <span className="font-bold flex items-center gap-1">
                                <ArrowDownRight size={11} /> Finalizan {ends} turno(s):
                              </span>
                              <span className="text-[9px] pl-3.5 text-slate-355 max-w-[150px] truncate">
                                {peopleEnding.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {isUnderstaffed && <div className="text-rose-400 font-extrabold text-[9px] uppercase tracking-wider mt-1 flex items-center gap-0.5">⚠️ Brecha crítica ({target - actual} vacantes)</div>}
                      {isPerfect && <div className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider mt-0.5">✓ Cobertura óptima</div>}
                    </div>
                  )}

                  {/* Contenedor gráfico de las barras */}
                  <div className="relative w-full h-[100px] flex items-end justify-center rounded bg-black/30 p-0.5 border border-white/5">
                    {/* Marcador horizontal brillante de Meta de Cobertura */}
                    {target > 0 && (
                      <div
                        style={{ bottom: `calc(${targetPct}% - 2px)` }}
                        className="absolute left-0 right-0 h-[3.5px] bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.95)] z-25 pointer-events-none rounded-full transition-all duration-300"
                        title={`Requisito de Cobertura: ${target}`}
                      />
                    )}

                    {/* Barra de Cobertura de Turnos real */}
                    {actual > 0 && (
                      <div
                        style={{ height: `${actualPct}%` }}
                        className={`w-full ${actualBarColor} rounded-t transition-all duration-500 ease-out z-10 flex items-center justify-center text-[9px] font-black tracking-tight select-none cursor-default`}
                      >
                        {actual}
                      </div>
                    )}
                  </div>

                  {/* Microindicadores físicos de inicios y egresos de turnos por hora */}
                  <div className="h-4 flex items-center justify-center gap-1 mt-1 shrink-0 w-full">
                    {starts > 0 && (
                      <div className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[8px] px-1 rounded-md font-extrabold flex items-center" title={`${starts} turnos inician`}>
                        ▲{starts}
                      </div>
                    )}
                    {ends > 0 && (
                      <div className="bg-rose-500/15 border border-rose-505/25 text-rose-400 text-[8px] px-1 rounded-md font-extrabold flex items-center" title={`${ends} turnos finalizan`}>
                        ▼{ends}
                      </div>
                    )}
                  </div>

                  {/* Horarios en el eje X */}
                  <span className="text-[10px] font-mono text-slate-400 mt-1 font-medium select-none">
                    {hour.toString().padStart(2, '0')}
                  </span>
                  
                  {/* Badge de diferencia */}
                  {!isEditingTargets && (
                    <span className={`text-[9px] font-extrabold tracking-tighter mt-1 font-mono px-1 rounded text-center min-w-[20px] select-none ${
                      isUnderstaffed ? 'text-rose-400 bg-rose-500/10' :
                      isOverstaffed ? 'text-sky-300 bg-indigo-500/10' :
                      target > 0 ? 'text-[#d4af37] bg-yellow-500/15' : 'text-slate-700'
                    }`}>
                      {isUnderstaffed ? `-${target - actual}` :
                       isOverstaffed ? `+${actual - target}` :
                       target > 0 ? 'OK' : '-'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda del gráfico */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-2 text-[10px] text-slate-400 border-t border-white/5 pt-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm" /> Deficiente (Subcobertura de turnos)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#d4af37] shadow-sm" /> Óptimo (Cubre exactamente el objetivo)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-indigo-505 bg-indigo-500 shadow-sm" /> Exceso beneficioso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-1 bg-[#fbbf24] rounded-full shadow-[0_0_4px_rgba(251,191,36,0.9)] animate-pulse" /> Línea de Requisito de Cobertura
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="text-xs">▲</span> Inicios de Turno
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="text-xs">▼</span> Finalizaciones de Turno
            </span>
          </div>
        </div>

        {/* Tabla de Métricas Horarias de Atención (Sin líneas) */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative z-10 text-[10px]">
          
          {/* Fila 1: Bocas Necesarias */}
          <div className="space-y-1">
            <div className="font-bold text-[#d4af37] uppercase tracking-wider text-[9px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
              <span>Cantidad de bocas de atenciones necesarias (Teórico):</span>
            </div>
            <div className="grid grid-cols-24 gap-1.5 text-center px-1">
              {hourRange.map((hour, idx) => {
                const target = effectiveTargetCount[idx];
                return (
                  <div key={hour} className="font-mono font-bold text-amber-400 select-none">
                    {target}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fila 2: Bocas Funcionando */}
          <div className="space-y-1 border-t border-white/5 pt-2">
            <div className="font-bold text-emerald-405 uppercase tracking-wider text-[9px] flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Cantidad de bocas de atencion funcionando (En su puesto de trabajo):</span>
            </div>
            <div className="grid grid-cols-24 gap-1.5 text-center px-1">
              {hourRange.map((hour, idx) => {
                const actual = actualCoverage[idx];
                const target = effectiveTargetCount[idx];
                const isUnder = actual < target;
                return (
                  <div key={hour} className={`font-mono font-bold select-none ${isUnder ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                    {actual}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fila 3: Tiempo Teórico de Espera */}
          <div className="space-y-1 border-t border-white/5 pt-2">
            <div className="font-bold text-sky-405 uppercase tracking-wider text-[9px] flex items-center gap-1.5 text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Tiempo teorico de espera (Cola estimada):</span>
            </div>
            <div className="grid grid-cols-24 gap-1.5 text-center px-1">
              {hourRange.map((hour, idx) => {
                const actual = actualCoverage[idx];
                const art = todaysDemandRecord?.hourlyArtPatients?.[idx] || 0;
                const os = todaysDemandRecord?.hourlyOsPatients?.[idx] || 0;
                
                const waitTime = calculateTheoreticalWaitTime(art, os, actual);
                
                let textColor = 'text-slate-405 text-slate-400';
                let displayText = `${waitTime}m`;
                
                if (art === 0 && os === 0) {
                  displayText = '0m';
                  textColor = 'text-slate-500';
                } else if (actual === 0) {
                  displayText = 'Sat.';
                  textColor = 'text-rose-500 font-extrabold animate-pulse';
                } else if (waitTime > 10) {
                  textColor = 'text-rose-450 text-rose-400 font-bold';
                } else if (waitTime > 5) {
                  textColor = 'text-amber-400 font-medium';
                } else {
                  textColor = 'text-emerald-400 font-medium';
                }
                
                return (
                  <div key={hour} className={`font-mono text-[9px] select-none ${textColor}`} title={actual === 0 && (art > 0 || os > 0) ? 'Saturado (Sin atención)' : `Espera estimada: ${waitTime} min`}>
                    {displayText}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
