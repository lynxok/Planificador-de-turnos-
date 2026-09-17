import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabaseControl as supabase } from '../supabase';
import { FERIADOS_2026 } from '../feriados';
import { ShieldCheck, Download, Search, RefreshCw, Calendar, CheckSquare, Square, ChevronDown, ChevronRight, Calculator } from 'lucide-react';

interface GuardiasCalculatorProps {
  theme: any;
}

export function GuardiasCalculator({ theme }: GuardiasCalculatorProps) {
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [reportData, setReportData] = useState<any[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  const [professionals, setProfessionals] = useState<string[]>([]);
  const [selectedProfs, setSelectedProfs] = useState<Set<string>>(new Set());
  const [loadingProfs, setLoadingProfs] = useState<boolean>(true);

  useEffect(() => {
    async function loadProfessionals() {
      try {
        setLoadingProfs(true);
        const { data, error } = await supabase
          .from('turnera_profesionales')
          .select('profesional')
          .order('profesional', { ascending: true });

        if (error) throw error;
        const uniqueProfs = Array.from(
          new Set((data || []).map(p => String(p.profesional).trim()))
        ).filter(p => p !== '' && p !== 'null');
        
        setProfessionals(uniqueProfs);
      } catch (err: any) {
        console.error("Error al cargar profesionales:", err);
      } finally {
        setLoadingProfs(false);
      }
    }
    loadProfessionals();
  }, []);

  const toggleProf = (prof: string) => {
    const newSet = new Set(selectedProfs);
    if (newSet.has(prof)) {
      newSet.delete(prof);
    } else {
      newSet.add(prof);
    }
    setSelectedProfs(newSet);
  };

  const selectAllProfs = () => {
    setSelectedProfs(new Set(professionals));
  };

  const deselectAllProfs = () => {
    setSelectedProfs(new Set());
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert("Por favor selecciona una fecha de inicio y una fecha de fin.");
      return;
    }
    if (selectedProfs.size === 0) {
      alert("Por favor tilda al menos un profesional de la lista para calcular.");
      return;
    }

    try {
      setGenerating(true);

      let allData: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      // Traer todos los turnos del rango de fechas
      while (hasMore) {
        const { data, error } = await supabase
          .from('planning_patient_appointments')
          .select('profesional, turno, paciente, asistio')
          .gte('turno', `${startDate}T00:00:00`)
          .lte('turno', `${endDate}T23:59:59`)
          .order('turno', { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
        }

        if (!data || data.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      const statsMap = new Map<string, { fds: number, noche: number, total: number, detalles: any[] }>();
      
      // Inicializar el map solo para los seleccionados
      selectedProfs.forEach(prof => {
        statsMap.set(prof, { fds: 0, noche: 0, total: 0, detalles: [] });
      });

      allData.forEach(row => {
        if (!row.turno || !row.profesional) return;
        const prof = String(row.profesional).trim();
        
        // Solo calcular para los tildados
        if (!selectedProfs.has(prof)) return;
        
        // Asumo que se cuentan todos los turnos reales.
        if (row.asistio !== 1) return; 

        const parts = row.turno.split('T');
        const datePart = parts[0];
        const timePart = parts[1] ? parts[1].substring(0, 5) : '';

        if (!datePart || !timePart) return;

        const isFeriado = !!FERIADOS_2026[datePart];
        const dateObj = new Date(datePart + 'T12:00:00');
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let isGuardia = false;
        let tipo = '';

        // Regla 1: Fines de semana o feriados -> Todos los turnos
        if (isFeriado || isWeekend) {
          isGuardia = true;
          tipo = 'Fin de Semana/Feriado';
        } else {
          // Regla 2: Dia Habil -> Solo entre 20:00 y 08:00
          if (timePart >= '20:00' || timePart <= '08:00') {
            isGuardia = true;
            tipo = 'Trasnoche Habil';
          }
        }

        if (isGuardia) {
          const profStats = statsMap.get(prof)!;
          if (tipo === 'Fin de Semana/Feriado') {
            profStats.fds++;
          } else {
            profStats.noche++;
          }
          profStats.total++;
          
          profStats.detalles.push({
            Fecha: datePart,
            Hora: timePart,
            Paciente: row.paciente,
            TipoGuardia: tipo
          });
        }
      });

      // Convertir mapa a array ordenado por total descendente
      const finalStats = Array.from(statsMap.entries()).map(([profesional, stats]) => ({
        profesional,
        fds: stats.fds,
        noche: stats.noche,
        total: stats.total,
        detalles: stats.detalles
      })).sort((a, b) => b.total - a.total);

      setReportData(finalStats);

    } catch (err: any) {
      console.error("Error al calcular guardias:", err);
      alert(`Error al calcular guardias: ${err.message || err}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportToExcel = () => {
    if (reportData.length === 0) return;

    const resumenRows = reportData.map(row => ({
      'Profesional / Residente': row.profesional,
      'Pacientes (FDS/Feriado)': row.fds,
      'Pacientes (Trasnoche Hábil)': row.noche,
      'Total Pacientes Guardia': row.total
    }));
    const worksheetResumen = XLSX.utils.json_to_sheet(resumenRows);

    let detalleRows: any[] = [];
    reportData.forEach(row => {
      row.detalles.forEach((d: any) => {
        detalleRows.push({
          'Profesional / Residente': row.profesional,
          'Fecha': d.Fecha,
          'Hora': d.Hora,
          'Paciente': d.Paciente,
          'Regla Aplicada': d.TipoGuardia
        });
      });
    });
    detalleRows.sort((a, b) => {
      const dateA = a.Fecha + a.Hora;
      const dateB = b.Fecha + b.Hora;
      return dateA.localeCompare(dateB);
    });
    const worksheetDetalle = XLSX.utils.json_to_sheet(detalleRows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheetResumen, "Resumen Guardias");
    XLSX.utils.book_append_sheet(workbook, worksheetDetalle, "Detalle Pacientes");
    
    XLSX.writeFile(workbook, `Liquidacion_Guardias_${startDate}_a_${endDate}.xlsx`);
  };

  return (
    <div className={`flex-1 w-full ${theme.cardBg} rounded-2xl border ${theme.cardBorder} shadow-xl flex flex-col p-6 animate-fade-in overflow-hidden`}>
      {/* Title */}
      <div className="flex items-center gap-3.5 mb-6 border-b border-slate-800/40 pb-4 shrink-0">
        <div className="p-2.5 bg-amber-600/10 border border-amber-500/20 text-amber-400 rounded-xl">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className={`text-base font-extrabold font-sans tracking-tight text-white`}>
            Liquidador de Guardias (Residentes)
          </h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
            REGLAS: FDS/FERIADO (24H) • DÍAS HÁBILES (20:00 A 08:00)
          </p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-900/45 p-4 rounded-2xl border border-slate-800/80 shrink-0">
        
        {/* Date Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl text-white focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
          />
        </div>

        {/* Professionals Checkboxes */}
        <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2 md:row-span-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Residentes a Calcular ({selectedProfs.size})</label>
            <div className="flex gap-2">
              <button onClick={selectAllProfs} className="text-[9px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1"><CheckSquare size={10} /> Todos</button>
              <button onClick={deselectAllProfs} className="text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-1"><Square size={10} /> Ninguno</button>
            </div>
          </div>
          
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-2 max-h-[90px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
            {loadingProfs ? (
              <span className="text-xs text-slate-500 p-2">Cargando profesionales...</span>
            ) : professionals.map(prof => (
              <label key={prof} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900/80 p-1.5 rounded transition-colors group">
                <input 
                  type="checkbox" 
                  checked={selectedProfs.has(prof)} 
                  onChange={() => toggleProf(prof)} 
                  className="accent-amber-500 w-3 h-3 cursor-pointer" 
                />
                <span className={`text-xs ${selectedProfs.has(prof) ? 'text-amber-100 font-semibold' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  {prof}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 col-span-1 md:col-span-2 justify-end mt-2 md:mt-0">
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-xl cursor-pointer shadow-md transition-all h-9"
          >
            {generating ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Calculando Guardias...</span>
              </>
            ) : (
              <>
                <Search size={13} />
                <span>Ejecutar Reglas de Guardia</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportToExcel}
            disabled={reportData.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl cursor-pointer shadow-md transition-all h-9"
          >
            <Download size={13} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      {reportData.length > 0 ? (
        <div className="flex-1 border border-slate-800/60 rounded-2xl overflow-hidden bg-slate-900/10 flex flex-col">
          <div className="overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800/80">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Profesional / Residente</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center" title="Sábados, Domingos o Feriados">FDS / Feriado (Pacientes)</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center" title="Días Hábiles de 20:00 a 08:00">Trasnoche Hábil (Pacientes)</th>
                  <th className="px-4 py-3 text-[10px] font-black text-amber-400 uppercase tracking-wider text-center">Total Guardia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {reportData.map((row, idx) => {
                  const isExpanded = expandedRow === row.profesional;
                  
                  // Agrupar por dia para subtabla
                  const dailyStats = new Map<string, { fds: number, noche: number, total: number }>();
                  row.detalles.forEach((d: any) => {
                    if (!dailyStats.has(d.Fecha)) {
                      dailyStats.set(d.Fecha, { fds: 0, noche: 0, total: 0 });
                    }
                    const s = dailyStats.get(d.Fecha)!;
                    if (d.TipoGuardia === 'Fin de Semana/Feriado') s.fds++;
                    else s.noche++;
                    s.total++;
                  });
                  const dailyArray = Array.from(dailyStats.entries())
                    .map(([fecha, stats]) => ({ fecha, ...stats }))
                    .sort((a, b) => a.fecha.localeCompare(b.fecha));

                  return (
                    <React.Fragment key={idx}>
                      <tr 
                        className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                        onClick={() => setExpandedRow(isExpanded ? null : row.profesional)}
                      >
                        <td className="px-4 py-3 text-xs font-extrabold text-white flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} className="text-amber-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 group-hover:text-amber-500 shrink-0" />}
                          {row.profesional}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{row.fds}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{row.noche}</td>
                        <td className="px-4 py-3 text-xs font-black text-amber-400 text-center">{row.total}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="p-0 border-b border-slate-800/80 bg-slate-950/50">
                            <div className="px-8 py-4 animate-fade-in">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                Desglose Diario de Guardias
                              </h4>
                              {dailyArray.length > 0 ? (
                                <table className="w-full text-left border-collapse bg-slate-900/40 rounded-xl overflow-hidden border border-slate-800/50">
                                  <thead>
                                    <tr className="bg-slate-900 border-b border-slate-800">
                                      <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase">Fecha</th>
                                      <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase text-center">FDS / Feriado</th>
                                      <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase text-center">Trasnoche Hábil</th>
                                      <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase text-center">Total Día</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {dailyArray.map((day, i) => (
                                      <tr key={i} className="hover:bg-slate-800/30">
                                        <td className="px-3 py-2 text-xs font-semibold text-slate-300">{day.fecha}</td>
                                        <td className="px-3 py-2 text-xs font-medium text-slate-400 text-center">{day.fds > 0 ? day.fds : '-'}</td>
                                        <td className="px-3 py-2 text-xs font-medium text-slate-400 text-center">{day.noche > 0 ? day.noche : '-'}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-amber-500/80 text-center">{day.total}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No hay detalles registrados.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 p-8 rounded-2xl bg-slate-900/15">
          <Calendar size={36} className="text-slate-500 mb-3 animate-pulse" />
          <span className="text-xs font-bold text-slate-400 text-center max-w-md">
            Selecciona el rango de fechas, tilda los residentes que quieras calcular y presiona "Ejecutar Reglas de Guardia".
          </span>
        </div>
      )}
    </div>
  );
}
