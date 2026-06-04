import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DemandRecord } from '../types';
import { 
  Clock, 
  UploadCloud, 
  X, 
  Calculator, 
  Info, 
  Sliders, 
  Award, 
  Users, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Trash2,
  Zap,
  CheckCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  demand: DemandRecord[];
  activeDate: string;
  activeArea: string;
  onSaveDemand: (newDemand: DemandRecord[]) => void;
}

// Función factorial para Erlang C
function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Algoritmo Erlang C dinámico para calcular Admisores recomendados
function calculateAgentsRequired(
  artCalls: number, 
  osCalls: number,
  artServiceTime: number,  // minutos
  osServiceTime: number,   // minutos
  targetWaitTime: number,  // minutos
  slaTarget: number        // SLA, ej. 0.85
): number {
  if (artCalls === 0 && osCalls === 0) return 0;
  
  // Tasa de llegada total (lambda) por hora
  const lambda = artCalls + osCalls;
  
  // Tiempo de servicio promedio ponderado (Ts) en horas
  const totalServiceTimeHours = (artCalls * artServiceTime + osCalls * osServiceTime) / 60;
  const Ts = totalServiceTimeHours / lambda;
  
  // Intensidad de tráfico (A)
  const A = lambda * Ts;
  
  let m = Math.floor(A) + 1; // Mínimo de agentes para manejar la carga (rho < 1)
  
  const targetWaitHrs = targetWaitTime / 60;
  const targetProbability = 1 - slaTarget; // Probabilidad permitida de esperar > targetWait
  
  // Incrementar m hasta que la probabilidad cumpla con el SLA
  while (m < A + 100) { // Límite para evitar bucles infinitos
    let sum = 0;
    for (let i = 0; i < m; i++) {
      sum += Math.pow(A, i) / factorial(i);
    }
    const term2 = (Math.pow(A, m) / factorial(m)) * (m / (m - A));
    const Pw = term2 / (sum + term2);
    
    // Probabilidad de esperar > targetWaitHrs
    const pWaitTarget = Pw * Math.exp(-(m - A) * (targetWaitHrs / Ts));
    
    if (pWaitTarget < targetProbability) {
      break;
    }
    m++;
  }
  
  return m;
}

// Helper para formatear la hora (ej: 08:00 - 09:00)
function formatHourRange(hour: number): string {
  const start = String(hour).padStart(2, '0');
  const end = String((hour + 1) % 24).padStart(2, '0');
  return `${start}:00 - ${end}:00`;
}

export function DemandCalculatorModal({ isOpen, onClose, demand, activeDate, activeArea, onSaveDemand }: Props) {
  // Parámetros globales de Buenas Prácticas
  const [artTime, setArtTime] = useState<number>(6); // minutos, por defecto 6
  const [osTime, setOsTime] = useState<number>(4);  // minutos, por defecto 4
  const [maxWait, setMaxWait] = useState<number>(8); // minutos, por defecto 8
  const [sla, setSla] = useState<number>(85);       // %, por defecto 85%

  // Grilla horaria de demanda (24 horas)
  const [hourlyArt, setHourlyArt] = useState<number[]>(Array(24).fill(0));
  const [hourlyOs, setHourlyOs] = useState<number[]>(Array(24).fill(0));

  // Estado para la carga rápida por lotes
  const [batchStartHour, setBatchStartHour] = useState<number>(8);
  const [batchEndHour, setBatchEndHour] = useState<number>(16);
  const [batchArtValue, setBatchArtValue] = useState<number>(10);
  const [batchOsValue, setBatchOsValue] = useState<number>(15);
  const [showBatchTools, setShowBatchTools] = useState<boolean>(false);

  // Archivo masivo
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [fileImportedCount, setFileImportedCount] = useState<number | null>(null);

  // Estado local para la fecha activa dentro del modal (permite scroll/navegación de fechas)
  const [modalDate, setModalDate] = useState<string>(activeDate);

  // Estados para el Simulador de Rango de Fechas
  const [isRangeActive, setIsRangeActive] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  // Inicializar fechas del rango automáticamente al abrir o cambiar la base de datos
  useEffect(() => {
    if (isOpen) {
      const targetArea = activeArea || 'Admision';
      const admisionRecords = demand.filter(d => d.area === targetArea);
      if (admisionRecords.length > 0) {
        const sortedDates = admisionRecords.map(d => d.dateString).sort();
        setRangeStart(sortedDates[0]);
        setRangeEnd(sortedDates[sortedDates.length - 1]);
      } else {
        const d = new Date(modalDate + 'T00:00:00');
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        setRangeStart(`${year}-${month}-01`);
        const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
        setRangeEnd(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
      }
    }
  }, [isOpen, demand, activeArea, modalDate]);

  // Cálculo dinámico consolidado del Rango de Fechas
  const rangeStats = useMemo(() => {
    if (!isRangeActive || !rangeStart || !rangeEnd) {
      return {
        polTotalHours: 0,
        noPolTotalHours: 0,
        wasteHours: 0,
        wastePercent: 0,
        extraFte: 0,
        daysWithData: 0,
        breakdown: [] as {
          date: string;
          totalPatients: number;
          polHours: number;
          noPolHours: number;
          wasteHours: number;
        }[]
      };
    }

    const start = new Date(rangeStart + 'T00:00:00');
    const end = new Date(rangeEnd + 'T00:00:00');
    const targetArea = activeArea || 'Admision';

    // Filtrar los registros en el rango de fechas
    const recordsInRange = demand.filter(d => {
      if (d.area !== targetArea) return false;
      const dDate = new Date(d.dateString + 'T00:00:00');
      return dDate >= start && dDate <= end;
    });

    let polTotalHours = 0;
    let noPolTotalHours = 0;
    const breakdown = [];

    // Ordenar cronológicamente
    const sortedRecords = [...recordsInRange].sort((a, b) => a.dateString.localeCompare(b.dateString));

    for (const record of sortedRecords) {
      const artPatients = record.hourlyArtPatients || Array(24).fill(0);
      const osPatients = record.hourlyOsPatients || Array(24).fill(0);
      
      let dayPolHours = 0;
      let dayNoPolHours = 0;
      let dayTotalPatients = 0;

      for (let h = 0; h < 24; h++) {
        const art = artPatients[h] || 0;
        const os = osPatients[h] || 0;
        dayTotalPatients += art + os;

        // Polivalente
        const pol = calculateAgentsRequired(art, os, artTime, osTime, maxWait, sla / 100);
        dayPolHours += pol;

        // Islas (No Polivalente)
        const recArt = calculateAgentsRequired(art, 0, artTime, osTime, maxWait, sla / 100);
        const recOs = calculateAgentsRequired(0, os, artTime, osTime, maxWait, sla / 100);
        dayNoPolHours += (recArt + recOs);
      }

      polTotalHours += dayPolHours;
      noPolTotalHours += dayNoPolHours;

      breakdown.push({
        date: record.dateString,
        totalPatients: dayTotalPatients,
        polHours: dayPolHours,
        noPolHours: dayNoPolHours,
        wasteHours: Math.max(0, dayNoPolHours - dayPolHours)
      });
    }

    const wasteHours = Math.max(0, noPolTotalHours - polTotalHours);
    const wastePercent = polTotalHours > 0 ? Math.round((wasteHours / polTotalHours) * 100) : 0;
    const daysWithData = sortedRecords.length;
    const extraFte = daysWithData > 0 ? Math.round((wasteHours / 8 / daysWithData) * 10) / 10 : 0;

    return {
      polTotalHours,
      noPolTotalHours,
      wasteHours,
      wastePercent,
      extraFte,
      daysWithData,
      breakdown
    };
  }, [isRangeActive, rangeStart, rangeEnd, demand, activeArea, artTime, osTime, maxWait, sla]);

  // Sincronizar fecha del modal al abrirse
  useEffect(() => {
    if (isOpen) {
      setModalDate(activeDate);
    }
  }, [isOpen, activeDate]);

  // Carga inicial y sincronización de datos según la fecha seleccionada en el modal (modalDate)
  useEffect(() => {
    if (isOpen && modalDate) {
      const targetArea = activeArea || 'Admision';
      const existing = demand.find(d => d.dateString === modalDate && d.area === targetArea);
      if (existing) {
        setHourlyArt(existing.hourlyArtPatients || Array(24).fill(0));
        setHourlyOs(existing.hourlyOsPatients || Array(24).fill(0));
      } else {
        setHourlyArt(Array(24).fill(0));
        setHourlyOs(Array(24).fill(0));
      }
      setLogs([]);
      setFileImportedCount(null);
    }
  }, [isOpen, modalDate, demand, activeArea]);

  // Navegador inteligente de fechas con guardado automático al paso
  const handleNavigateDate = (daysOffset: number, directDate?: string) => {
    // 1. Guardar la demanda actual del día modalDate actual
    const targetArea = activeArea || 'Admision';
    const requirements = Array(24).fill(0).map((_, h) => {
      return calculateAgentsRequired(
        hourlyArt[h],
        hourlyOs[h],
        artTime,
        osTime,
        maxWait,
        sla / 100
      );
    });

    const filtered = demand.filter(d => !(d.dateString === modalDate && d.area === targetArea));
    const currentRecord: DemandRecord = {
      dateString: modalDate,
      area: targetArea,
      hourlyRequirements: requirements,
      hourlyArtPatients: hourlyArt,
      hourlyOsPatients: hourlyOs
    };
    
    const updatedDemandList = [...filtered, currentRecord];
    onSaveDemand(updatedDemandList);

    // 2. Calcular la nueva fecha
    let newDateStr = '';
    if (directDate) {
      newDateStr = directDate;
    } else {
      const d = new Date(modalDate + 'T00:00:00');
      d.setDate(d.getDate() + daysOffset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      newDateStr = `${yyyy}-${mm}-${dd}`;
    }

    // 3. Actualizar la fecha del modal
    setModalDate(newDateStr);
    setLogs(prev => [...prev, `Guardada demanda del día y navegando al: ${newDateStr}`]);
  };

  if (!isOpen) return null;

  // Modificación de un valor particular en la grilla
  const handleCellChange = (hour: number, type: 'art' | 'os', value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    if (type === 'art') {
      const updated = [...hourlyArt];
      updated[hour] = num;
      setHourlyArt(updated);
    } else {
      const updated = [...hourlyOs];
      updated[hour] = num;
      setHourlyOs(updated);
    }
  };

  // Carga rápida por lotes
  const handleApplyBatch = () => {
    const updatedArt = [...hourlyArt];
    const updatedOs = [...hourlyOs];
    
    const start = Math.min(batchStartHour, batchEndHour);
    const end = Math.max(batchStartHour, batchEndHour);

    for (let h = start; h <= end; h++) {
      if (h >= 0 && h < 24) {
        updatedArt[h] = batchArtValue;
        updatedOs[h] = batchOsValue;
      }
    }
    setHourlyArt(updatedArt);
    setHourlyOs(updatedOs);
    setLogs(prev => [...prev, `Aplicados valores por lote de ${start}:00 a ${end}:00 hs.`]);
  };

  // Limpiar todas las horas
  const handleClearAll = () => {
    if (window.confirm('¿Deseas restablecer todos los valores de demanda de hoy a cero?')) {
      setHourlyArt(Array(24).fill(0));
      setHourlyOs(Array(24).fill(0));
    }
  };

  // Guardar y persistir la curva de 24 horas
  const handleSave = () => {
    const targetArea = activeArea || 'Admision';
    
    // Calcular dotación de admisores hora por hora en base a Erlang C
    const requirements = Array(24).fill(0).map((_, h) => {
      return calculateAgentsRequired(
        hourlyArt[h],
        hourlyOs[h],
        artTime,
        osTime,
        maxWait,
        sla / 100
      );
    });

    const filtered = demand.filter(d => !(d.dateString === modalDate && d.area === targetArea));
    const newRecord: DemandRecord = {
      dateString: modalDate,
      area: targetArea,
      hourlyRequirements: requirements,
      hourlyArtPatients: hourlyArt,
      hourlyOsPatients: hourlyOs
    };

    onSaveDemand([...filtered, newRecord]);
    onClose();
  };

  // Cargar masiva desde Excel o CSV con autodetección
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLogs(["Detectando formato de archivo..."]);
    setFileImportedCount(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const newDemands = demand.filter(d => d.area !== 'Admision');
        let processedCount = 0;

        if (isCsv) {
          setLogs(prev => [...prev, "Procesando archivo como CSV de texto plano..."]);
          const text = evt.target?.result as string;
          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          
          if (lines.length === 0) {
            throw new Error("El archivo CSV está vacío.");
          }

          // Autodetectar delimitador buscando en la primera línea de cabeceras
          const headerLine = lines[0];
          let delimiter = ',';
          if (headerLine.includes(';')) delimiter = ';';
          else if (headerLine.includes('\t')) delimiter = '\t';
          
          setLogs(prev => [...prev, `Delimitador autodetectado: '${delimiter === '\t' ? '\\t' : delimiter}'`]);

          const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());
          const dateIdx = headers.findIndex(h => h.includes('fecha') || h.includes('date'));
          const hourIdx = headers.findIndex(h => h.includes('hora') || h.includes('hour'));
          const artIdx = headers.findIndex(h => h.includes('art'));
          const osIdx = headers.findIndex(h => h.includes('os') || h.includes('particular') || h.includes('os/particular'));

          if (dateIdx === -1 || hourIdx === -1) {
            throw new Error("No se encontraron las columnas requeridas (Fecha y Hora) en la cabecera del CSV.");
          }

          lines.slice(1).forEach((line, index) => {
            const cols = line.split(delimiter).map(c => c.trim());
            if (cols.length < 2) return;

            const rawDate = cols[dateIdx];
            const rawHour = cols[hourIdx];
            const rawArt = artIdx !== -1 ? cols[artIdx] : '0';
            const rawOs = osIdx !== -1 ? cols[osIdx] : '0';

            // Ignorar filas inválidas o incompletas de cabeceras extras / desconocidas
            if (!rawDate || rawDate.toLowerCase().includes('desconocida') || rawHour.toLowerCase() === 'n/a') {
              return;
            }

            // Convertir fecha de formato DD/MM/YYYY a YYYY-MM-DD si es necesario
            let dateStr = '';
            if (rawDate.includes('/')) {
              const parts = rawDate.split('/');
              if (parts.length === 3) {
                const dd = parts[0].padStart(2, '0');
                const mm = parts[1].padStart(2, '0');
                const yyyy = parts[2];
                dateStr = `${yyyy}-${mm}-${dd}`;
              }
            } else {
              dateStr = rawDate; // Asumir formato YYYY-MM-DD
            }

            const hour = parseInt(rawHour, 10);
            const art = parseInt(rawArt, 10) || 0;
            const os = parseInt(rawOs, 10) || 0;

            if (dateStr && !isNaN(hour) && hour >= 0 && hour <= 23) {
              const requiredStaff = calculateAgentsRequired(
                art, 
                os, 
                artTime, 
                osTime, 
                maxWait, 
                sla / 100
              );
              
              let record = newDemands.find(d => d.dateString === dateStr && d.area === 'Admision');
              if (!record) {
                record = { 
                  dateString: dateStr, 
                  area: 'Admision', 
                  hourlyRequirements: Array(24).fill(0),
                  hourlyArtPatients: Array(24).fill(0),
                  hourlyOsPatients: Array(24).fill(0)
                };
                newDemands.push(record);
              }
              record.hourlyRequirements[hour] = requiredStaff;
              if (!record.hourlyArtPatients) record.hourlyArtPatients = Array(24).fill(0);
              if (!record.hourlyOsPatients) record.hourlyOsPatients = Array(24).fill(0);
              record.hourlyArtPatients[hour] = art;
              record.hourlyOsPatients[hour] = os;
              processedCount++;
            } else {
              if (index < 3) {
                setLogs(prev => [...prev, `Fila ${index + 2}: Omitida (Formato de fecha o hora inválido).`]);
              }
            }
          });

        } else {
          setLogs(prev => [...prev, "Procesando archivo como Excel binario (.xlsx/.xls)..."]);
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          const data = XLSX.utils.sheet_to_json<any>(ws);
          setLogs(prev => [...prev, `Se detectaron ${data.length} filas en la hoja de Excel.`]);
          
          data.forEach((row, index) => {
            const rawDate = row['Fecha'] || row['Date'] || row['fecha'] || row['date'];
            let dateStr = '';
            if (typeof rawDate === 'number') {
              const d = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
              dateStr = d.toISOString().split('T')[0];
            } else {
              dateStr = rawDate ? String(rawDate).trim() : '';
            }
            
            const hour = parseInt(row['Hora'] || row['Hour'] || row['hora'] || row['hour']) ?? -1;
            const art = parseInt(row['ART'] || row['art']) || 0;
            const os = parseInt(row['OS'] || row['os'] || row['OS/Particular'] || row['particular']) || 0;

            if (dateStr && hour >= 0 && hour <= 23) {
              const requiredStaff = calculateAgentsRequired(
                art, 
                os, 
                artTime, 
                osTime, 
                maxWait, 
                sla / 100
              );
              
              let record = newDemands.find(d => d.dateString === dateStr && d.area === 'Admision');
              if (!record) {
                record = { 
                  dateString: dateStr, 
                  area: 'Admision', 
                  hourlyRequirements: Array(24).fill(0),
                  hourlyArtPatients: Array(24).fill(0),
                  hourlyOsPatients: Array(24).fill(0)
                };
                newDemands.push(record);
              }
              record.hourlyRequirements[hour] = requiredStaff;
              if (!record.hourlyArtPatients) record.hourlyArtPatients = Array(24).fill(0);
              if (!record.hourlyOsPatients) record.hourlyOsPatients = Array(24).fill(0);
              record.hourlyArtPatients[hour] = art;
              record.hourlyOsPatients[hour] = os;
              processedCount++;
            } else {
              if (index < 3) {
                setLogs(prev => [...prev, `Fila ${index + 2}: Omitida (Fecha o hora inválida).`]);
              }
            }
          });
        }

        // Actualizar grilla en vivo si el archivo importado tiene datos del día activo
        const currentActiveData = newDemands.find(d => d.dateString === activeDate && d.area === 'Admision');
        if (currentActiveData) {
          setHourlyArt(currentActiveData.hourlyArtPatients || Array(24).fill(0));
          setHourlyOs(currentActiveData.hourlyOsPatients || Array(24).fill(0));
        }

        onSaveDemand(newDemands);
        setFileImportedCount(processedCount);
        setLogs(prev => [
          ...prev, 
          `¡Cálculo exitoso! Se procesaron ${processedCount} registros de demanda.`
        ]);
      } catch (err) {
        setLogs(prev => [...prev, "Error al procesar el archivo: " + (err as Error).message]);
      } finally {
        setIsProcessing(false);
      }
    };

    if (isCsv) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsBinaryString(file);
    }
  };

  // Resumen del día actual
  const totalArtPac = hourlyArt.reduce((sum, val) => sum + val, 0);
  const totalOsPac = hourlyOs.reduce((sum, val) => sum + val, 0);
  const totalPac = totalArtPac + totalOsPac;

  // 1. Requisitos Polivalentes (Esquema unificado eficiente)
  const polRequirements = Array(24).fill(0).map((_, h) => {
    return calculateAgentsRequired(
      hourlyArt[h],
      hourlyOs[h],
      artTime,
      osTime,
      maxWait,
      sla / 100
    );
  });
  const totalHoursPol = polRequirements.reduce((sum, val) => sum + val, 0);

  // 2. Requisitos No Polivalentes (Esquema fragmentado ineficiente: ART y OS por separado)
  const artOnlyRequirements = Array(24).fill(0).map((_, h) => {
    return calculateAgentsRequired(
      hourlyArt[h],
      0, // demanda OS = 0
      artTime,
      osTime,
      maxWait,
      sla / 100
    );
  });

  const osOnlyRequirements = Array(24).fill(0).map((_, h) => {
    return calculateAgentsRequired(
      0, // demanda ART = 0
      hourlyOs[h],
      artTime,
      osTime,
      maxWait,
      sla / 100
    );
  });

  const noPolRequirements = Array(24).fill(0).map((_, h) => {
    return artOnlyRequirements[h] + osOnlyRequirements[h];
  });
  const totalHoursNoPol = noPolRequirements.reduce((sum, val) => sum + val, 0);

  // 3. Métricas comparativas
  const wasteHours = totalHoursNoPol - totalHoursPol;
  const wastePercent = totalHoursPol > 0 ? Math.round((wasteHours / totalHoursPol) * 100) : 0;
  
  // Equivalencia aproximada en puestos de trabajo adicionales necesarios
  const extraFte = Math.round((wasteHours / 8) * 10) / 10; // Asumiendo jornada estándar de 8hs

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-700 animate-scale-up border border-slate-100">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500 text-white rounded-2xl border border-orange-400 shadow-md">
              <Calculator size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 font-sans tracking-tight">
                Modelador de Demanda de Admisión & Buenas Prácticas
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Cálculo matemático dinámico por hora para <strong className="text-slate-800">Admisión</strong>
              </p>
            </div>
          </div>

          {/* Navegador Interactivo de Fechas con Scroll de días */}
          <div className="flex items-center bg-slate-100 border border-slate-200/80 p-1.5 rounded-2xl shadow-sm gap-1.5 mx-auto sm:mx-0 select-none">
            <button
              type="button"
              onClick={() => handleNavigateDate(-1)}
              className="p-1 px-2 text-slate-650 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer font-extrabold flex items-center gap-0.5 text-[11px]"
              title="Día Anterior (Auto-guarda cambios)"
            >
              <ChevronLeft size={16} />
              <span>Día Ant.</span>
            </button>
            
            <input
              type="date"
              value={modalDate}
              onChange={(e) => handleNavigateDate(0, e.target.value)}
              title="Selecciona una fecha (Auto-guarda cambios)"
              className="text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-50 border border-slate-250 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer shadow-xs"
            />

            <button
              type="button"
              onClick={() => handleNavigateDate(1)}
              className="p-1 px-2 text-slate-650 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer font-extrabold flex items-center gap-0.5 text-[11px]"
              title="Día Siguiente (Auto-guarda cambios)"
            >
              <span>Día Sig.</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0 self-end sm:self-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* COLUMNA IZQUIERDA: Parámetros de Buenas Prácticas (5 cols) */}
          <div className="lg:col-span-4 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col justify-between gap-5">
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-200/50 pb-3">
                <Sliders size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Parámetros de Atención</h3>
              </div>

              {/* Slider ART */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-650">Tiempo de Atención ART:</span>
                  <span className="text-indigo-600 font-mono">{artTime} Minutos</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={artTime} 
                  onChange={(e) => setArtTime(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[9px] text-slate-400 leading-tight">
                  Recepción de documentación de accidentes laborales y validación patronal.
                </p>
              </div>

              {/* Slider OS */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-650">Tiempo de Atención OS:</span>
                  <span className="text-indigo-600 font-mono">{osTime} Minutos</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  value={osTime} 
                  onChange={(e) => setOsTime(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[9px] text-slate-400 leading-tight">
                  Enrolamiento estándar, verificación de credenciales y cobro de copagos.
                </p>
              </div>

              {/* Slider Espera */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-650">Espera Máx. Tolerada:</span>
                  <span className="text-indigo-600 font-mono">{maxWait} Minutos</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="30" 
                  value={maxWait} 
                  onChange={(e) => setMaxWait(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[9px] text-slate-400 leading-tight">
                  Tiempo máximo recomendado que un paciente debe esperar en fila.
                </p>
              </div>

              {/* Slider SLA */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-650">Nivel de Servicio (SLA %):</span>
                  <span className="text-indigo-600 font-mono">{sla}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="99" 
                  value={sla} 
                  onChange={(e) => setSla(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[9px] text-slate-400 leading-tight">
                  Porcentaje mínimo de pacientes atendidos antes del tiempo de espera fijado.
                </p>
              </div>
            </div>

            {/* Badge de Excelencia */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Award className="text-indigo-600 shrink-0" size={16} />
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-850">Estándar de Calidad</p>
              </div>
              <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                Atender al <span className="font-bold text-indigo-600">{sla}%</span> de los ingresantes en menos de <span className="font-bold text-indigo-600">{maxWait} min</span>.
              </p>
            </div>
          </div>

          {/* COLUMNA DERECHA: Modelador Horario de Pacientes por Hora (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-5 min-h-0">
            
            {/* Resumen de Flujos Generales y Botones de Grilla */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 border border-slate-200/50 rounded-2xl">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>ART: <strong className="text-slate-800">{totalArtPac}</strong></span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Obra Social: <strong className="text-slate-800">{totalOsPac}</strong></span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Total Pacientes: <strong className="text-slate-800">{totalPac}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchTools(!showBatchTools)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    showBatchTools 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                      : 'bg-white border-slate-250 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Zap size={13} />
                  <span>Carga Rápida</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-250 bg-white hover:bg-red-50 hover:text-red-650 text-slate-705 transition-all cursor-pointer"
                  title="Limpiar todos los inputs del día"
                >
                  <Trash2 size={13} />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>

            {/* Panel de Carga Rápida por Lotes (Batch Fill) */}
            {showBatchTools && (
              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-4 space-y-4 animate-scale-up">
                <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900">
                  <Zap size={15} className="text-indigo-600" />
                  <span>CARGA EN LOTE PARA HORAS PICO</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500">Hora Inicio</label>
                    <select
                      value={batchStartHour}
                      onChange={(e) => setBatchStartHour(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-slate-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00 hs</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500">Hora Fin</label>
                    <select
                      value={batchEndHour}
                      onChange={(e) => setBatchEndHour(Number(e.target.value))}
                      className="w-full text-xs font-bold border border-slate-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00 hs</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500">Pac. ART / Hora</label>
                    <input
                      type="number"
                      min="0"
                      value={batchArtValue}
                      onChange={(e) => setBatchArtValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full text-xs font-mono font-bold border border-slate-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500">Pac. OS / Hora</label>
                    <input
                      type="number"
                      min="0"
                      value={batchOsValue}
                      onChange={(e) => setBatchOsValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full text-xs font-mono font-bold border border-slate-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-indigo-100/50 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowBatchTools(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                  >
                    Ocultar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBatch}
                    className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    Aplicar a Grilla
                  </button>
                </div>
              </div>
            )}

            {/* GRILLA INTERACTIVA 24 HORAS */}
            <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden flex flex-col min-h-[250px] max-h-[360px] shadow-sm">
              <div className="grid grid-cols-12 gap-1 bg-slate-50 border-b border-slate-200 px-4 py-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-500 text-center items-center select-none">
                <div className="col-span-2 text-left">Rango Horario</div>
                <div className="col-span-2">Pacientes ART</div>
                <div className="col-span-2">Obra Social / Part.</div>
                <div className="col-span-3 text-indigo-650 bg-indigo-50 border border-indigo-100 py-1 rounded-xl">Polivalente (Pool Único)</div>
                <div className="col-span-3 text-rose-650 bg-rose-50 border border-rose-100 py-1 rounded-xl">Esquema Islas (Dedicado)</div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                {Array.from({ length: 24 }).map((_, h) => {
                  const artVal = hourlyArt[h] || 0;
                  const osVal = hourlyOs[h] || 0;
                  
                  // Calcular admisores recomendados para esta hora (Polivalente unificado)
                  const recStaff = calculateAgentsRequired(
                    artVal,
                    osVal,
                    artTime,
                    osTime,
                    maxWait,
                    sla / 100
                  );

                  // Calcular admisores recomendados en Islas (Separados)
                  const recArt = calculateAgentsRequired(artVal, 0, artTime, osTime, maxWait, sla / 100);
                  const recOs = calculateAgentsRequired(0, osVal, artTime, osTime, maxWait, sla / 100);
                  const recNoPol = recArt + recOs;

                  return (
                    <div key={h} className="grid grid-cols-12 gap-1 px-4 py-1.5 items-center text-center hover:bg-slate-50/50 transition-colors">
                      {/* Hora */}
                      <div className="col-span-2 text-left text-xs font-bold text-slate-650 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{formatHourRange(h)}</span>
                      </div>

                      {/* Inputs ART */}
                      <div className="col-span-2 px-1">
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={artVal === 0 ? '' : artVal}
                          placeholder="0"
                          onChange={(e) => handleCellChange(h, 'art', e.target.value)}
                          className="w-full text-center text-xs font-mono font-bold border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg py-1 px-1.5 focus:outline-none bg-slate-50/40 text-blue-700 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Inputs OS */}
                      <div className="col-span-2 px-1">
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={osVal === 0 ? '' : osVal}
                          placeholder="0"
                          onChange={(e) => handleCellChange(h, 'os', e.target.value)}
                          className="w-full text-center text-xs font-mono font-bold border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg py-1 px-1.5 focus:outline-none bg-slate-50/40 text-purple-700 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Dotación Recomendada Polivalente */}
                      <div className="col-span-3 flex justify-center">
                        <div className={`px-2.5 py-1 rounded-xl text-center text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0 ${
                          recStaff > 0 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-[0_0_6px_rgba(99,102,241,0.1)] font-extrabold' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          <Users size={12} className={recStaff > 0 ? 'text-indigo-500' : 'text-slate-400'} />
                          <span>{recStaff} {recStaff === 1 ? 'Admisor' : 'Admisores'}</span>
                        </div>
                      </div>

                      {/* Dotación Recomendada No Polivalente (Islas) */}
                      <div className="col-span-3 flex justify-center">
                        <div className={`px-2 py-1 rounded-xl text-center text-[10px] font-bold border transition-all shadow-xs flex items-center gap-1.5 shrink-0 ${
                          recNoPol > 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-[0_0_6px_rgba(244,63,94,0.1)]' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          <div className="flex items-center gap-1">
                            <span className="bg-blue-100/80 text-blue-700 px-1 rounded font-mono text-[9px]" title={`Admisores dedicados a ART: ${recArt}`}>ART:{recArt}</span>
                            <span>+</span>
                            <span className="bg-purple-100/80 text-purple-700 px-1 rounded font-mono text-[9px]" title={`Admisores dedicados a OS: ${recOs}`}>OS:{recOs}</span>
                          </div>
                          <span>=</span>
                          <span className="font-black text-xs font-mono bg-rose-600 text-white px-1.5 py-0.5 rounded-md shadow-sm" title={`Total en Islas: ${recNoPol} Admisores`}>{recNoPol}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carga masiva de Excel (Colapsado / Compacto) */}
            <div className="border border-slate-200 bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <h4 className="text-xs font-extrabold uppercase text-slate-800">
                    Carga Masiva de Curva de Pacientes (Histórico)
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">Fecha | Hora (0-23) | ART | OS</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] text-slate-500">
                  <Info size={14} className="text-indigo-550 shrink-0" />
                  <span>Sube una planilla Excel (.xlsx) o archivo CSV (.csv) con columnas históricas de flujos por hora para procesar de golpe.</span>
                </div>

                <label className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md transition-all flex items-center gap-1.5 font-sans">
                  <UploadCloud size={14} />
                  <span>{isProcessing ? 'Procesando...' : 'Subir Archivo'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                </label>
              </div>

              {/* Logs de procesamiento */}
              {logs.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 text-green-400 font-mono text-[9px] p-2.5 rounded-xl max-h-20 overflow-y-auto">
                  {logs.map((l, i) => <div key={i} className="py-0.5">{l}</div>)}
                </div>
              )}
            </div>

          </div>

          {/* SIMULADOR DE POLIVALENCIA Y EFICIENCIA OPERATIVA */}
          <div className="lg:col-span-12 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 border border-indigo-500/30 shadow-xl space-y-5 mt-2 animate-scale-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-3 gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30 w-fit">
                  <TrendingUp size={20} className="text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-200">
                    Simulador de Gestión: El Impacto de la Polivalencia (Erlang C)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Demostración científica de eficiencia: Recepción Unificada vs. Recepción Fragmentada (ART / OS separados).
                  </p>
                </div>
              </div>

              {/* Selector de Modalidad: Día Único vs Rango */}
              <div className="flex bg-white/10 p-1 rounded-xl border border-white/15 w-fit">
                <button
                  type="button"
                  onClick={() => setIsRangeActive(false)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    !isRangeActive
                      ? 'bg-white text-indigo-950 shadow-md font-extrabold'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📅 Día Seleccionado
                </button>
                <button
                  type="button"
                  onClick={() => setIsRangeActive(true)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    isRangeActive
                      ? 'bg-white text-indigo-950 shadow-md font-extrabold'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📊 Rango de Fechas
                </button>
              </div>
            </div>

            {/* Controles de Rango de Fechas */}
            {isRangeActive && (
              <div className="flex flex-wrap items-center bg-white/5 border border-white/10 p-4 rounded-2xl gap-4 animate-scale-up">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-300">Fecha Inicio:</span>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="text-xs font-bold bg-slate-900 border border-white/20 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-300">Fecha Fin:</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="text-xs font-bold bg-slate-900 border border-white/20 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-2xs">
                  ✓ {rangeStats.daysWithData} Días con registros en el rango
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Tarjeta 1: Esquema Polivalente */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-[130px] hover:border-emerald-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    <span>Esquema Polivalente (Pool Único)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Admisores capacitados para atender indistintamente ART y Obra Social de forma ágil y combinada.
                  </p>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/5 pt-2 mt-2">
                  <span className="text-slate-400 text-[10px] font-bold">
                    {isRangeActive ? 'Total Horas del Rango:' : 'Total Horas-Hombre:'}
                  </span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {isRangeActive ? rangeStats.polTotalHours : totalHoursPol} hs
                  </span>
                </div>
              </div>

              {/* Tarjeta 2: Esquema Fragmentado (No Polivalente) */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between h-[130px] hover:border-rose-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-1.5 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                    <span>Esquema Fragmentado (Dedicado)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Recepción rígida con islas de trabajo exclusivas. Quien atiende ART no puede tocar pacientes de OS.
                  </p>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/5 pt-2 mt-2">
                  <span className="text-slate-400 text-[10px] font-bold">
                    {isRangeActive ? 'Total Horas del Rango:' : 'Total Horas-Hombre:'}
                  </span>
                  <span className="text-xl font-black text-rose-400 font-mono">
                    {isRangeActive ? rangeStats.noPolTotalHours : totalHoursNoPol} hs
                  </span>
                </div>
              </div>

              {/* Tarjeta 3: Indicador de Desperdicio y Conclusión Operativa */}
              {(() => {
                const waste = isRangeActive ? rangeStats.wasteHours : wasteHours;
                const pct = isRangeActive ? rangeStats.wastePercent : wastePercent;
                const fte = isRangeActive ? rangeStats.extraFte : extraFte;

                return (
                  <div className={`border rounded-2xl p-4 flex flex-col justify-between h-[130px] transition-all duration-300 ${
                    waste > 0 
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.15)]' 
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 font-extrabold text-[10px] uppercase tracking-wider mb-2">
                        <span>⚠️ Brecha de Ineficiencia</span>
                      </div>
                      {waste > 0 ? (
                        <p className="text-[10px] leading-relaxed text-slate-350">
                          {isRangeActive 
                            ? 'La rigidez operativa acumulada en el rango fuerza tener personal redundante en picos dispares.' 
                            : 'La falta de polivalencia te obliga a tener personal ocioso mientras la otra fila se satura, generando pérdidas críticas.'
                          }
                        </p>
                      ) : (
                        <p className="text-[10px] leading-relaxed text-slate-400">
                          No hay desperdicio en las condiciones actuales o la demanda es nula.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col border-t border-white/5 pt-2 mt-2 gap-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-slate-400 font-bold">Dotación Redundante:</span>
                        <span className={`text-lg font-black font-mono ${waste > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {waste > 0 ? `+${pct}%` : '0%'}
                        </span>
                      </div>
                      {waste > 0 && (
                        <span className="text-[8px] text-rose-350 text-right font-medium">
                          ⚠️ {isRangeActive 
                            ? `Equivale a contratar ${fte} admisores extras promedio por día de forma innecesaria.`
                            : `Equivale a contratar ${fte} admisores extras de forma innecesaria.`
                          }
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* TABLA DE DESGLOSE DIARIO DE RANGO (Premium) */}
            {isRangeActive && rangeStats.breakdown.length > 0 && (
              <div className="border border-white/10 bg-white/5 rounded-2xl p-4 space-y-2.5 animate-scale-up mt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-300">Desglose de Desperdicio Día por Día</span>
                  <span className="text-[9px] text-slate-400">Total días analizados: {rangeStats.daysWithData}</span>
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center border-b border-white/5 pb-1">
                    <div className="col-span-3 text-left">Fecha</div>
                    <div className="col-span-2">Pacientes</div>
                    <div className="col-span-2 text-emerald-400">Polivalente</div>
                    <div className="col-span-2 text-rose-400">Islas</div>
                    <div className="col-span-3 text-amber-400">Desperdicio (Brecha)</div>
                  </div>
                  {rangeStats.breakdown.map((row) => {
                    const [y, m, d] = row.date.split('-');
                    const formattedDate = `${d}/${m}/${y}`;
                    return (
                      <div key={row.date} className="grid grid-cols-12 text-[10px] font-mono text-center py-1.5 items-center border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg px-1 transition-colors">
                        <div className="col-span-3 text-left font-sans font-bold text-slate-200">{formattedDate}</div>
                        <div className="col-span-2 font-bold text-slate-350">{row.totalPatients} pac.</div>
                        <div className="col-span-2 text-emerald-400 font-extrabold">{row.polHours} hs</div>
                        <div className="col-span-2 text-rose-400 font-extrabold">{row.noPolHours} hs</div>
                        <div className="col-span-3 text-amber-300 font-extrabold flex items-center justify-center gap-1.5">
                          <span>+{row.wasteHours} hs</span>
                          {row.polHours > 0 && (
                            <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/20 px-1 rounded-sm font-sans font-bold">
                              +{Math.round((row.wasteHours / row.polHours) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fila de Explicación de Gestión */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-[10px] leading-relaxed space-y-2">
              <p className="text-slate-300 font-bold">
                ¿Por qué el esquema polivalente es drásticamente más eficiente?
              </p>
              <p className="text-slate-400">
                De acuerdo con la **ley física de colas (Erlang C)**, cuando fragmentas la recepción en islas dedicadas, impides la absorción mutua de picos de demanda. Si un admisor exclusivo de ART se encuentra libre porque no hay accidentes laborales en esa hora, **su tiempo de trabajo se desperdicia por completo** mientras los pacientes de Obra Social se acumulan en otra fila interminable.
              </p>
              <p className="text-slate-400">
                Unificar el pool de admisores y capacitar al personal para que atienda ambos tipos de pacientes permite que el sistema opere con **hasta un {isRangeActive ? rangeStats.wastePercent : wastePercent}% menos de presupuesto de personal (ahorro de {isRangeActive ? rangeStats.wasteHours : wasteHours} horas-hombre)** logrando el mismo estándar de calidad y SLA exigido de {sla}% en menos de {maxWait} minutos.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Info size={13} className="text-slate-350" />
            <span>Los cambios impactarán instantáneamente los requisitos del sector de Admisión en pantalla.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white rounded-xl cursor-pointer shadow-md shadow-indigo-100"
            >
              Guardar Requisitos Horarios
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
