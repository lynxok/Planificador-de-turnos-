import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbguwmbwutvhqsirtjps.supabase.co';
const supabaseAnonKey = 'sb_publishable_HHSflu6QFeTOAOz32W2UdQ_wSQyiPIC';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'control_de_horas' }
});
import { 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Users
} from 'lucide-react';

interface ReportGeneratorProps {
  theme: any;
}

const FALLBACK_PROFESSIONALS = [
  'OBAID, LUIS MARCELO',
  'OBAID ANA FLORENCIA',
  'RIAL PEDRO JAVIER',
  'BARBERO CARLOS JULIAN',
  'CRESPO FERNANDO ADRIAN',
  'RIAL MARIA JOSE',
  'MENDOZA MARIA VIVIANA',
  'LIMONGI MERCEDES',
  'BRUNO DELFINA MARIA',
  'CASTILLO MARTIN',
  'PEREZLINDO LUCAS OSCAR',
  'GOLPE LUCIO',
  'DE LEON MIGUEL ARIEL',
  'FERNANDEZ MARIANO',
  'SOLANAS LUIS DANIEL'
];

export function ReportGenerator({ theme }: ReportGeneratorProps) {
  const [professionals, setProfessionals] = useState<string[]>(FALLBACK_PROFESSIONALS);
  const [selectedProf, setSelectedProf] = useState<string>('OBAID, LUIS MARCELO');
  const [startDate, setStartDate] = useState<string>('2026-04-01');
  const [endDate, setEndDate] = useState<string>('2026-07-22');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loadingProfs, setLoadingProfs] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfessionals() {
      try {
        setLoadingProfs(true);
        setLoadError(null);
        // Consultamos la tabla de mapeo de profesionales únicos
        const { data, error } = await supabase
          .from('turnera_profesionales')
          .select('profesional')
          .order('profesional', { ascending: true });

        if (error) throw error;

        // Deduplicar nombres por seguridad
        const uniqueProfs = Array.from(
          new Set((data || []).map(p => String(p.profesional).trim()))
        ).filter(p => p !== '' && p !== 'null');

        if (uniqueProfs.length > 0) {
          setProfessionals(uniqueProfs);
          
          // Seleccionar por defecto a Marcelo Obaid si existe en la lista
          const defaultProf = uniqueProfs.find(p => p.toUpperCase().includes('OBAID') && p.toUpperCase().includes('MARCELO'));
          if (defaultProf) {
            setSelectedProf(defaultProf);
          } else {
            setSelectedProf(uniqueProfs[0]);
          }
        }
      } catch (err: any) {
        console.error("Error al cargar profesionales:", err);
        setLoadError(err.message || String(err));
        // Mantenemos la lista de fallback
      } finally {
        setLoadingProfs(false);
      }
    }

    loadProfessionals();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedProf) {
      alert("Por favor, selecciona un profesional.");
      return;
    }

    try {
      setGenerating(true);
      console.log(`Buscando citas para: ${selectedProf} en rango ${startDate} a ${endDate}`);
      
      const { data, error } = await supabase
        .from('planning_patient_appointments')
        .select('*')
        .eq('profesional', selectedProf)
        .gte('turno', `${startDate}T00:00:00`)
        .lte('turno', `${endDate}T23:59:59`)
        .order('turno', { ascending: true });

      if (error) throw error;

      setReportData(data || []);
    } catch (err: any) {
      console.error("Error al generar el reporte:", err);
      alert(`Error al generar reporte: ${err.message || err}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportToExcel = () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar. Genera un reporte primero.");
      return;
    }

    try {
      const excelRows = reportData.map(row => {
        let fecha = '';
        let hora = '';
        if (row.turno) {
          const parts = row.turno.split('T');
          fecha = parts[0] || '';
          hora = parts[1] ? parts[1].substring(0, 5) : '';
        }
        return {
          'Fecha': fecha,
          'Hora': hora,
          'Paciente': row.paciente || '',
          'Profesional': row.profesional || '',
          'Obra Social / Cobertura': row.cobertura || '',
          'Asistió': row.asistio === 1 ? 'SÍ' : 'NO',
          'Atendido': row.atendido === 1 ? 'SÍ' : 'NO',
          'Nro Historia Clínica': row.nro_hc || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Turnos");
      
      // Sanitizar el nombre del profesional para el nombre del archivo
      const safeName = selectedProf.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(workbook, `Reporte_${safeName}_${startDate}_a_${endDate}.xlsx`);
    } catch (err: any) {
      console.error("Error al exportar a Excel:", err);
      alert(`Error al exportar a Excel: ${err.message || err}`);
    }
  };

  // KPIs
  const totalCitas = reportData.length;
  const asistieronCount = reportData.filter(r => r.asistio === 1).length;
  const ausentesCount = totalCitas - asistieronCount;
  const asistieronPct = totalCitas > 0 ? ((asistieronCount / totalCitas) * 100).toFixed(1) : '0';
  const ausentesPct = totalCitas > 0 ? (100 - parseFloat(asistieronPct)).toFixed(1) : '0';

  // 1. Funnel Data (Atenciones por Obra Social, sólo si asistio === 1)
  const coverageCounts = reportData
    .filter(r => r.asistio === 1)
    .reduce((acc: { [key: string]: number }, cur) => {
      const cov = cur.cobertura || 'Sin obra social';
      acc[cov] = (acc[cov] || 0) + 1;
      return acc;
    }, {});

  const funnelData = Object.entries(coverageCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxFunnelCount = funnelData.length > 0 ? funnelData[0].count : 1;

  // 2. Histogram Data (Turnos por Día)
  const turnosPorDia = reportData.reduce((acc: { [key: string]: number }, cur) => {
    if (cur.turno) {
      const dateStr = cur.turno.split('T')[0];
      acc[dateStr] = (acc[dateStr] || 0) + 1;
    }
    return acc;
  }, {});

  const histogramData = Object.entries(turnosPorDia)
    .map(([dateStr, count]) => {
      const parts = dateStr.split('-');
      const formatted = `${parts[2]}/${parts[1]}`;
      return { dateStr, formatted, count };
    })
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const maxHistogramCount = histogramData.length > 0 ? Math.max(...histogramData.map(d => d.count)) : 1;

  return (
    <div className={`flex-1 w-full ${theme.cardBg} rounded-2xl border ${theme.cardBorder} shadow-xl flex flex-col p-6 animate-fade-in`}>
      {/* Title */}
      <div className="flex items-center gap-3.5 mb-6 border-b border-slate-800/40 pb-4">
        <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <FileSpreadsheet size={20} />
        </div>
        <div>
          <h2 className={`text-base font-extrabold font-sans tracking-tight text-white`}>
            Extractor de Reportes Personalizados
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
            Turnera Supabase • Conexión Directa
          </p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-900/45 p-4 rounded-2xl border border-slate-800/80">
        {/* Professional Select */}
        <div className="flex flex-col gap-1.5 col-span-1 md:col-span-1">
          <div className="flex items-center justify-between w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Profesional Médico</label>
            {loadError && (
              <span className="text-[9px] font-bold text-amber-500 cursor-help" title={`Error de red Supabase. Usando médicos locales: ${loadError}`}>
                ⚠️ Local
              </span>
            )}
          </div>
          {loadingProfs && professionals.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2.5">
              <RefreshCw className="animate-spin text-indigo-400" size={13} />
              <span>Cargando médicos...</span>
            </div>
          ) : (
            <select
              value={selectedProf}
              onChange={(e) => setSelectedProf(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
            >
              {professionals.map((prof) => (
                <option key={prof} value={prof} className="bg-slate-950 text-white py-1">
                  {prof}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
          />
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-end gap-2">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-indigo-650 hover:bg-indigo-705 active:scale-95 disabled:opacity-50 text-white rounded-xl cursor-pointer shadow-md transition-all h-9"
          >
            {generating ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Search size={13} />
                <span>Generar Reporte</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards & Table (Visible if report generated) */}
      {totalCitas > 0 ? (
        <div className="flex-1 flex flex-col gap-5 min-h-0">
          {/* Export & KPI Layout */}
          <div className="flex flex-col md:flex-row items-stretch gap-4">
            {/* KPI Cards */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              {/* Total Card */}
              <div className="bg-slate-900/30 border border-slate-800/60 p-3.5 rounded-2xl flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Citas Totales</span>
                <span className="text-xl font-black text-white mt-1">{totalCitas}</span>
              </div>

              {/* Asistio Card */}
              <div className="bg-emerald-950/10 border border-emerald-900/20 p-3.5 rounded-2xl flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Asistencias</span>
                  <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md">{asistieronPct}%</span>
                </div>
                <span className="text-xl font-black text-emerald-400 mt-1">{asistieronCount}</span>
              </div>

              {/* Ausente Card */}
              <div className="bg-red-950/10 border border-red-900/20 p-3.5 rounded-2xl flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">Ausencias</span>
                  <span className="text-[9px] font-bold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md">{ausentesPct}%</span>
                </div>
                <span className="text-xl font-black text-red-400 mt-1">{ausentesCount}</span>
              </div>
            </div>

            {/* Export Card Button */}
            <div className="md:w-64 flex flex-col justify-center">
              <button
                onClick={handleExportToExcel}
                className="flex items-center justify-center gap-2.5 w-full py-4 text-xs font-black bg-emerald-600 hover:bg-emerald-705 active:scale-95 text-white rounded-2xl shadow-lg cursor-pointer transition-all border border-emerald-500"
              >
                <Download size={14} />
                <span>Exportar Reporte a Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Dashboards Row (Funnel & Histogram) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-1">
            {/* 1. Funnel Chart (Atenciones por Obra Social) */}
            <div className="bg-slate-900/45 border border-slate-800/80 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-800/40 pb-2.5">
                <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-xs font-bold text-white font-sans tracking-wide">
                  Top 5: Atenciones por Obra Social (Embudo)
                </h3>
              </div>
              
              {funnelData.length > 0 ? (
                <div className="flex flex-col gap-3.5 justify-center py-2 flex-1">
                  {funnelData.map((item, idx) => {
                    const relativePct = (item.count / maxFunnelCount) * 100;
                    const gradients = [
                      'from-indigo-600 to-indigo-750',
                      'from-violet-650 to-violet-750',
                      'from-purple-650 to-purple-750',
                      'from-fuchsia-650 to-fuchsia-750',
                      'from-pink-650 to-pink-755'
                    ];
                    const gradient = gradients[idx] || 'from-slate-650 to-slate-750';

                    return (
                      <div key={item.name} className="flex flex-col items-center w-full">
                        {/* Label info */}
                        <div className="flex justify-between w-full max-w-sm text-[10px] text-slate-400 font-bold mb-1 px-1.5">
                          <span className="truncate max-w-[200px]">{item.name}</span>
                          <span>{item.count} atenciones ({((item.count / asistieronCount) * 100).toFixed(0)}%)</span>
                        </div>
                        {/* Funnel Bar */}
                        <div className="w-full flex justify-center">
                          <div 
                            style={{ width: `${relativePct}%`, minWidth: '40%' }}
                            className={`h-7 bg-gradient-to-r ${gradient} rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-md border border-white/5 transition-all hover:brightness-110 select-none cursor-help`}
                            title={`${item.name}: ${item.count} atenciones de un total de ${asistieronCount}`}
                          >
                            <span className="truncate px-2">{item.name} ({item.count})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-xs text-slate-500 font-semibold">
                  <span>Sin atenciones registradas para graficar.</span>
                </div>
              )}
            </div>

            {/* 2. Histogram Chart (Turnos por Día) */}
            <div className="bg-slate-900/45 border border-slate-800/80 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-800/40 pb-2.5">
                <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-xs font-bold text-white font-sans tracking-wide">
                  Histograma: Frecuencia de Turnos por Día
                </h3>
              </div>

              {histogramData.length > 0 ? (
                <div className="flex-1 flex flex-col justify-end min-h-[190px]">
                  {/* Scrollable Bar Container */}
                  <div className="w-full overflow-x-auto custom-scrollbar flex items-end h-[150px] pb-1">
                    <div 
                      className="flex items-end gap-1.5 h-full px-2"
                      style={{ minWidth: '100%', width: `${histogramData.length * 30}px` }}
                    >
                      {histogramData.map((item) => {
                        const heightPct = (item.count / maxHistogramCount) * 85; // Capped at 85% for label padding
                        return (
                          <div key={item.dateStr} className="flex flex-col items-center justify-end h-full w-6 group/bar relative">
                            {/* Tooltip on hover */}
                            <div className="absolute -top-7 bg-slate-950 text-[9px] font-bold text-white px-1.5 py-0.5 rounded border border-slate-800 shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity z-20 pointer-events-none whitespace-nowrap">
                              {item.formatted}: {item.count} turnos
                            </div>
                            {/* Bar */}
                            <div 
                              style={{ height: `${heightPct}%`, minHeight: '6px' }}
                              className="w-full bg-gradient-to-t from-indigo-650 to-indigo-500 hover:from-violet-500 hover:to-violet-450 rounded-t-sm shadow-md transition-all cursor-pointer"
                            />
                            {/* Date label */}
                            <span className="text-[8px] font-bold text-slate-500 mt-1 select-none whitespace-nowrap">
                              {item.formatted}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 px-1 text-[9px] text-slate-500 font-bold">
                    <span>← Inicio Período</span>
                    <span>Desliza para navegar cronología →</span>
                    <span>Fin Período →</span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-xs text-slate-500 font-semibold">
                  <span>Sin turnos registrados para graficar.</span>
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 border border-slate-800/60 rounded-2xl overflow-hidden bg-slate-900/10 flex flex-col">
            <div className="overflow-y-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800/80">
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Hora</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Paciente</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Obra Social / Cobertura</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">¿Asistió?</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">¿Atendido?</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">HC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {reportData.map((row, idx) => {
                    let fecha = '';
                    let hora = '';
                    if (row.turno) {
                      const parts = row.turno.split('T');
                      if (parts[0]) {
                        const dParts = parts[0].split('-');
                        fecha = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
                      }
                      hora = parts[1] ? parts[1].substring(0, 5) : '';
                    }

                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-300">{fecha}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-400">{hora}</td>
                        <td className="px-4 py-2.5 text-xs font-extrabold text-white">{row.paciente}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-400">{row.cobertura || 'Sin obra social'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            row.asistio === 1 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                              : 'bg-red-500/10 text-red-400 border border-red-500/15'
                          }`}>
                            {row.asistio === 1 ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.atendido === 1
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/15'
                          }`}>
                            {row.atendido === 1 ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-400">{row.nro_hc || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 p-8 rounded-2xl bg-slate-900/15">
          <Calendar size={36} className="text-slate-500 mb-3 animate-pulse" />
          <span className="text-xs font-bold text-slate-400 text-center">
            Selecciona un profesional médico y un rango de fechas, luego presiona "Generar Reporte" para visualizar el historial.
          </span>
        </div>
      )}
    </div>
  );
}
