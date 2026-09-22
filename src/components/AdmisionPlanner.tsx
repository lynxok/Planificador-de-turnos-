import React, { useState, useMemo } from 'react';
import { Person, Shift, Area } from '../types';
import { supabaseControl as supabase } from '../supabase';
import { Calendar, Users, Briefcase, Plus, Search, CheckSquare, Square, RefreshCw, Save, ChevronLeft, ChevronRight, X, Printer, FileText, Download } from 'lucide-react';

interface AdmisionPlannerProps {
  theme: any;
  persons: Person[];
  shifts: Shift[];
  setPersons: React.Dispatch<React.SetStateAction<Person[]>>;
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  onSave: () => void;
  areas: Area[];
  targets?: any[];
  demand?: any[];
}

// Factorial para cálculo de Erlang C
function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// Algoritmo Erlang C para cálculo de agentes por hora
function calculateAgentsRequired(
  artCalls: number, 
  osCalls: number,
  artServiceTime: number = 6,  // minutos
  osServiceTime: number = 4,   // minutos
  targetWaitTime: number = 8,  // minutos
  slaTarget: number = 0.85     // SLA
): number {
  if (artCalls === 0 && osCalls === 0) return 0;
  
  const lambda = artCalls + osCalls;
  const totalServiceTimeHours = (artCalls * artServiceTime + osCalls * osServiceTime) / 60;
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

export function AdmisionPlanner({ theme, persons, shifts, setPersons, setShifts, onSave, areas, targets = [], demand = [] }: AdmisionPlannerProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'staff' | 'timeoff'>('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  
  return (
    <div className={`h-full flex flex-col ${theme.timelineBg} ${theme.timelineHeaderText}`}>
      <div className={`p-4 border-b ${theme.timelineHeaderBorder} ${theme.timelineHeaderBg} flex flex-col gap-4 shadow-sm shrink-0`}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase size={24} className="text-blue-600" />
            Planificación de Admisión 24/7
          </h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md text-sm active:scale-95 cursor-pointer"
              title="Exportar o imprimir cronograma semanal en PDF"
            >
              <Printer size={18} />
              Exportar / Imprimir PDF
            </button>
            <button 
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 cursor-pointer"
            >
              <Save size={18} />
              Guardar Cambios
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-blue-600 text-white' : `${theme.cardHeaderBg} opacity-70 hover:opacity-100 transition-opacity`}`}
          >
            <Calendar size={18} />
            Vista Semanal
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'staff' ? 'bg-blue-600 text-white' : `${theme.cardHeaderBg} opacity-70 hover:opacity-100 transition-opacity`}`}
          >
            <Users size={18} />
            Gestión de Personal
          </button>
          <button 
            onClick={() => setActiveTab('timeoff')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'timeoff' ? 'bg-blue-600 text-white' : `${theme.cardHeaderBg} opacity-70 hover:opacity-100 transition-opacity`}`}
          >
            <Briefcase size={18} />
            Licencias y Francos
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-auto p-4 ${theme.timelineBg}`}>
        {activeTab === 'calendar' && (
          <CalendarTab 
            theme={theme} 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate} 
            persons={persons} 
            shifts={shifts} 
            setShifts={setShifts} 
            targets={targets} 
            demand={demand} 
          />
        )}
        
        {activeTab === 'staff' && (
          <div className="text-center p-8 opacity-70 font-medium">
            [Gestión de Personal - Utilizá el botón 'Gestión de Personal' del menú principal izquierdo]
          </div>
        )}

        {activeTab === 'timeoff' && (
          <TimeOffTab 
            theme={theme}
            persons={persons}
            shifts={shifts}
            setShifts={setShifts}
          />
        )}
      </div>

      {isPdfModalOpen && (
        <ExportPdfModal 
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          currentDate={currentDate}
          persons={persons}
          shifts={shifts}
        />
      )}
    </div>
  );
}

function CalendarTab({ theme, currentDate, setCurrentDate, persons, shifts, setShifts, targets, demand }: any) {
  const [assignModal, setAssignModal] = useState<{isOpen: boolean, dateStr: string, hour: number, endHour: number, selectedPersons: Set<string>, shiftArea: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getDaysOfWeek = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);
    
    const days = [];
    for(let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };
  
  const days = getDaysOfWeek(currentDate);
  const weekStart = days[0];
  const weekEnd = days[6];
  const weekStr = `${weekStart.getDate()}/${weekStart.getMonth()+1} al ${weekEnd.getDate()}/${weekEnd.getMonth()+1}`;

  // Selector de día para la columna de demanda
  const [selectedDemandDayIdx, setSelectedDemandDayIdx] = useState<number>(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const idx = days.findIndex(d => d.toISOString().split('T')[0] === todayStr);
    return idx >= 0 ? idx : 0;
  });

  const getRequirementFor = (d: Date, hour: number): number => {
    const dateStr = d.toISOString().split('T')[0];
    const isAdmisionArea = (area: string) => ['Admisión General', 'Admision', 'General', 'Admisión ART', 'Admisión'].includes(area);

    const specificDemand = (demand || []).find((dr: any) => dr.dateString === dateStr && isAdmisionArea(dr.area));
    if (specificDemand && specificDemand.hourlyRequirements) return specificDemand.hourlyRequirements[hour] || 0;

    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
    const dTarget = (targets || []).find((t: any) => t.dayOfWeek === dayOfWeek && isAdmisionArea(t.area));
    if (dTarget && dTarget.hourlyTargets) return dTarget.hourlyTargets[hour] || 0;

    return 0;
  };

  const handleDeleteShift = (id: string) => {
    setShifts((prev: Shift[]) => prev.filter(s => s.id !== id));
  };

  const handleSaveAssignment = () => {
    if (!assignModal) return;
    
    let duration = assignModal.endHour - assignModal.hour;
    if (duration <= 0) duration += 24; 
    
    const newShifts: Shift[] = Array.from(assignModal.selectedPersons).map(personId => ({
      id: crypto.randomUUID(),
      personId,
      date: assignModal.dateStr,
      startHour: assignModal.hour,
      duration: duration,
      area: assignModal.shiftArea
    }));
    
    setShifts((prev: Shift[]) => [...prev, ...newShifts]);
    setAssignModal(null);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50 gap-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm text-slate-600 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm font-medium text-slate-700 cursor-pointer"
          >
            Hoy
          </button>
          <button 
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm text-slate-600 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-3 font-semibold text-base sm:text-lg text-slate-800">Semana: {weekStr}</span>
        </div>

        {/* Selector interactivo de día para la columna de demanda */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase px-2">Ver Demanda:</span>
          {days.map((d: Date, idx: number) => {
            const isSelected = selectedDemandDayIdx === idx;
            const dayInitial = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDemandDayIdx(idx)}
                className={`px-2 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={`Ver demanda calculada de ${dayInitial} ${d.getDate()}`}
              >
                {dayInitial} {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 shadow-sm bg-slate-100">
            <tr>
              <th className="p-3 border-b border-r border-slate-200 font-bold text-center w-28 text-slate-700">Horario (24h)</th>
              
              {/* Encabezado Columna Demanda */}
              <th className="p-2 border-b border-r border-slate-200 font-bold text-center w-52 text-rose-700 bg-rose-50/80">
                <div className="flex flex-col items-center justify-center">
                  <div className="text-xs uppercase tracking-wider font-extrabold text-rose-800">
                    Demanda {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][(days[selectedDemandDayIdx] || days[0]).getDay()]} {(days[selectedDemandDayIdx] || days[0]).getDate()}
                  </div>
                  <div className="text-[10px] text-rose-600 font-medium">Esquema Islas (Dedicado)</div>
                </div>
              </th>

              {days.map((d: Date, i: number) => (
                <th key={i} className={`p-3 border-b border-r border-slate-200 font-bold text-center text-slate-700 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-slate-200' : ''} ${selectedDemandDayIdx === i ? 'bg-rose-50/40 text-rose-900' : ''}`}>
                  <div>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()]}</div>
                  <div className="text-xl text-slate-800">{d.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 24 }).map((_, hour) => {
              const isNight = hour >= 22 || hour < 6;
              const isMorning = hour >= 6 && hour < 14;

              const rowClass = isNight ? 'bg-indigo-50' : isMorning ? 'bg-amber-50' : 'bg-orange-50';

              return (
                <tr key={hour} className={`border-b border-slate-200 ${rowClass} hover:bg-slate-100/70 transition-colors`}>
                  <td className="p-2 border-r border-slate-200 text-center align-middle font-bold font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {hour.toString().padStart(2, '0')}:00 - {(hour+1).toString().padStart(2, '0')}:00
                  </td>

                  {/* COLUMNA DE DEMANDA CON PASTILLA DE ESQUEMA ISLAS (DEDICADO) */}
                  {(() => {
                    const selectedDate = days[selectedDemandDayIdx] || days[0];
                    const dateStr = selectedDate.toISOString().split('T')[0];
                    const isAdmisionArea = (area: string) => ['Admisión General', 'Admision', 'General', 'Admisión ART', 'Admisión'].includes(area);
                    const rec = (demand || []).find((d: any) => d.dateString === dateStr && isAdmisionArea(d.area));

                    const artPac = (rec && rec.hourlyArtPatients && rec.hourlyArtPatients[hour]) || 0;
                    const osPac = (rec && rec.hourlyOsPatients && rec.hourlyOsPatients[hour]) || 0;

                    const recArt = calculateAgentsRequired(artPac, 0);
                    const recOs = calculateAgentsRequired(0, osPac);
                    const recNoPol = recArt + recOs;

                    return (
                      <td className="p-1.5 border-r border-slate-200 text-center align-middle bg-rose-50/30 whitespace-nowrap">
                        <div className="flex justify-center items-center">
                          <div className={`px-2 py-1 rounded-xl text-center text-[10px] font-bold border transition-all shadow-xs flex items-center gap-1.5 shrink-0 ${
                            recNoPol > 0 
                              ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-[0_0_6px_rgba(244,63,94,0.1)]' 
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                            <div className="flex items-center gap-1">
                              <span className="bg-blue-100/80 text-blue-700 px-1 rounded font-mono text-[9px]" title={`Pacientes ART: ${artPac} → Admisores requeridos: ${recArt}`}>ART:{recArt}</span>
                              <span>+</span>
                              <span className="bg-purple-100/80 text-purple-700 px-1 rounded font-mono text-[9px]" title={`Pacientes OS / Part.: ${osPac} → Admisores requeridos: ${recOs}`}>OS:{recOs}</span>
                            </div>
                            <span>=</span>
                            <span className="font-black text-xs font-mono bg-rose-600 text-white px-1.5 py-0.5 rounded-md shadow-sm" title={`Total Requerido: ${recNoPol} Admisores (${artPac} pac. ART + ${osPac} pac. OS)`}>{recNoPol}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })()}

                  {/* 7 COLUMNAS DIAS DE LA SEMANA */}
                  {days.map((d: Date, i: number) => {
                    const dateStr = d.toISOString().split('T')[0];

                    const workingHere = shifts.filter((s: Shift) => {
                      if (s.date !== dateStr) return false;
                      const sEnd = s.startHour + s.duration;
                      return hour >= s.startHour && hour < sEnd;
                    });

                    const req = getRequirementFor(d, hour);
                    const covered = workingHere.filter((s: Shift) => !['VACACIONES', 'FRANCO', 'ENFERMEDAD', 'FERIADO'].includes(s.area)).length;

                    return (
                      <td key={i} className="p-1.5 border-r border-slate-200 align-top relative min-h-[55px] group">
                        {req > 0 && (
                          <div
                            className={`absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm z-[1] ${covered >= req ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                            title={`Cobertura: ${covered} de ${req} requeridos`}
                          >
                            {covered}/{req}
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 min-h-[48px]">
                          {workingHere.map((s: Shift) => {
                            const person = persons.find((p: Person) => p.id === s.personId);
                            if (!person) return null;
                            const isTimeOff = s.area === 'VACACIONES' || s.area === 'FRANCO' || s.area === 'ENFERMEDAD' || s.area === 'FERIADO';
                            const isArt = s.area === 'Admisión ART' || s.area === 'ART';
                            const bgColor = isTimeOff ? 'bg-red-500 text-white' : isArt ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white';

                            return (
                              <div key={s.id} className={`text-[13px] p-1.5 rounded font-medium flex justify-between items-center shadow-sm ${bgColor}`}>
                                <span className="truncate drop-shadow-md" title={person.name}>{person.name}</span>
                                <button onClick={() => handleDeleteShift(s.id)} className="opacity-60 hover:opacity-100 p-0.5 hover:bg-black hover:bg-opacity-20 rounded transition-all shrink-0 cursor-pointer"><X size={12}/></button>
                              </div>
                            );
                          })}
                          <button
                            className="text-xs font-semibold opacity-35 group-hover:opacity-100 text-center py-1.5 transition-opacity w-full border border-dashed border-red-300 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-400 rounded shadow-sm cursor-pointer"
                            title="Asignar alguien"
                            onClick={() => { setAssignModal({isOpen: true, dateStr, hour, endHour: (hour + 8) % 24, selectedPersons: new Set(), shiftArea: 'Admisión General'}); setSearchTerm(''); }}
                          >
                            + Asignar
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assignModal && assignModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white text-slate-800 p-6 rounded-xl w-[450px] max-w-full shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold mb-1 text-slate-900">Asignar Personal</h3>
            <p className="mb-5 text-slate-500 font-medium">Fecha: {assignModal.dateStr.split('-').reverse().join('/')} - Desde las {assignModal.hour.toString().padStart(2, '0')}:00</p>
            
            <div className="flex gap-4 mb-5">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Desde Hora</label>
                <select className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={assignModal.hour} onChange={e => setAssignModal({...assignModal, hour: parseInt(e.target.value)})}>
                  {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Hasta Hora</label>
                <select className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={assignModal.endHour} onChange={e => setAssignModal({...assignModal, endHour: parseInt(e.target.value)})}>
                  {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                </select>
              </div>
            </div>

            
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tipo de Admisión</label>
            <div className="flex gap-6 mb-5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="shiftArea" className="w-4 h-4 text-blue-600 focus:ring-blue-500" value="Admisión General" checked={assignModal.shiftArea === 'Admisión General'} onChange={() => setAssignModal({...assignModal, shiftArea: 'Admisión General'})} />
                <span className="text-sm font-bold text-blue-700">Admisión General</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="shiftArea" className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" value="Admisión ART" checked={assignModal.shiftArea === 'Admisión ART'} onChange={() => setAssignModal({...assignModal, shiftArea: 'Admisión ART'})} />
                <span className="text-sm font-bold text-indigo-700">Admisión ART</span>
              </label>
            </div>

            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Seleccionar Colaboradores</label>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-7 pr-2 py-1 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto mb-6 border border-slate-200 p-2 rounded-lg bg-slate-50 shadow-inner">
              {persons
                .filter((p: Person) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((p: Person) => {
                const isSelected = assignModal.selectedPersons.has(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-3 p-2.5 hover:bg-white cursor-pointer rounded-md transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      checked={isSelected}
                      onChange={() => {
                        const next = new Set(assignModal.selectedPersons);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        setAssignModal({...assignModal, selectedPersons: next});
                      }}
                    />
                    <span className="font-semibold text-slate-700">{p.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setAssignModal(null)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer">Cancelar</button>
              <button onClick={handleSaveAssignment} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95 cursor-pointer">Guardar Asignación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeOffTab({ theme, persons, shifts, setShifts }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ personId: string; type: string; startDate: string; endDate: string }>({
    personId: '',
    type: 'VACACIONES',
    startDate: '',
    endDate: ''
  });

  const timeOffs = useMemo(() => {
    return shifts.filter((s: Shift) => s.area === 'VACACIONES' || s.area === 'FRANCO' || s.area === 'FERIADO' || s.area === 'ENFERMEDAD');
  }, [shifts]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.personId || !formData.startDate || !formData.endDate) return;

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const newShifts: Shift[] = [];
    
    let curr = new Date(start);
    while (curr <= end) {
      newShifts.push({
        id: crypto.randomUUID(),
        personId: formData.personId,
        date: curr.toISOString().split('T')[0],
        startHour: 0,
        duration: 24,
        area: formData.type as Area
      });
      curr.setDate(curr.getDate() + 1);
    }

    setShifts((prev: Shift[]) => [...prev, ...newShifts]);
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setShifts((prev: Shift[]) => prev.filter(s => s.id !== id));
  };

  return (
    <div className={`p-6 rounded-lg ${theme.timelineBg} shadow-sm border ${theme.timelineHeaderBorder} min-h-full ${theme.timelineHeaderText}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800">Registro de Vacaciones, Francos y Feriados</h3>
        <button onClick={() => setModalOpen(true)} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer">
          <Plus size={18} /> Nueva Licencia / Franco
        </button>
      </div>

      <div className="overflow-auto border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-left">
          <thead className={`${theme.timelineHeaderBg} ${theme.timelineHeaderText}`}>
            <tr>
              <th className="p-3 border-b border-slate-200 font-bold">Personal</th>
              <th className="p-3 border-b border-slate-200 font-bold">Tipo</th>
              <th className="p-3 border-b border-slate-200 font-bold">Fecha</th>
              <th className="p-3 border-b border-slate-200 font-bold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {timeOffs.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-medium">No hay licencias registradas actualmente.</td></tr>
            ) : (
              timeOffs.sort((a: Shift, b: Shift) => a.date.localeCompare(b.date)).map((t: Shift) => {
                const person = persons.find((p: Person) => p.id === t.personId);
                return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-700">{person?.name || 'Desconocido'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${t.area === 'VACACIONES' ? 'bg-orange-500' : 'bg-red-500'} text-white`}>
                        {t.area}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-600">{t.date.split('-').reverse().join('/')}</td>
                    <td className="p-3">
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 font-medium hover:bg-red-50 px-3 py-1 rounded transition-colors cursor-pointer">Eliminar</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[500px] shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold mb-5 text-slate-900">Registrar Licencia / Franco</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Empleado</label>
                <select required className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.personId} onChange={e => setFormData({...formData, personId: e.target.value})}>
                  <option value="">Seleccionar colaborador...</option>
                  {persons.map((p: Person) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tipo de Licencia</label>
                <select required className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="VACACIONES">Vacaciones</option>
                  <option value="FRANCO">Franco Compensatorio</option>
                  <option value="FERIADO">Feriado No Laborable</option>
                  <option value="ENFERMEDAD">Licencia Médica</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fecha Inicio</label>
                  <input type="date" required className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Fecha Fin (inclusive)</label>
                  <input type="date" required className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95 cursor-pointer">Guardar Licencia</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  persons: Person[];
  shifts: Shift[];
}

function ExportPdfModal({ isOpen, onClose, currentDate, persons, shifts }: ExportPdfModalProps) {
  const [exportMode, setExportMode] = useState<'grid' | 'staff'>('staff');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('ALL');

  const getDaysOfWeek = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);
    
    const days = [];
    for(let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const days = getDaysOfWeek(currentDate);
  const weekStart = days[0];
  const weekEnd = days[6];
  const weekStr = `${weekStart.toLocaleDateString('es-AR')} al ${weekEnd.toLocaleDateString('es-AR')}`;

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const filteredPersons = useMemo(() => {
    if (selectedPersonId === 'ALL') return persons;
    return persons.filter(p => p.id === selectedPersonId);
  }, [persons, selectedPersonId]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes en tu navegador para imprimir/guardar el PDF.');
      return;
    }

    let bodyHtml = '';

    if (exportMode === 'grid') {
      // Landscape 24h Grid
      bodyHtml = `
        <div class="header">
          <div class="title-group">
            <h1>SFH ITEO - Planificación de Admisión 24/7</h1>
            <h2>Cronograma Semanal General: ${weekStr}</h2>
          </div>
          <div class="meta">Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        <div class="legend">
          <span class="badge general">Admisión General</span>
          <span class="badge art">Admisión ART</span>
          <span class="badge timeoff">Licencias / Ausencias</span>
        </div>

        <table class="grid-table">
          <thead>
            <tr>
              <th style="width: 85px;">Horario</th>
              ${days.map((d, idx) => `
                <th>
                  <div>${dayNames[idx]}</div>
                  <div style="font-size: 13px; font-weight: normal; color: #475569;">${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 24 }).map((_, hour) => {
              const hourStr = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
              const isNight = hour >= 22 || hour < 6;
              return `
                <tr class="${isNight ? 'night-row' : ''}">
                  <td class="hour-cell">${hourStr}</td>
                  ${days.map(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const working = shifts.filter(s => {
                      if (s.date !== dateStr) return false;
                      const sEnd = s.startHour + s.duration;
                      return hour >= s.startHour && hour < sEnd;
                    });

                    const namesHtml = working.map(s => {
                      const person = persons.find(p => p.id === s.personId);
                      if (!person) return '';
                      const isTimeOff = ['VACACIONES', 'FRANCO', 'ENFERMEDAD', 'FERIADO'].includes(s.area);
                      const isArt = s.area === 'Admisión ART' || s.area === 'ART';
                      const badgeClass = isTimeOff ? 'badge-timeoff' : isArt ? 'badge-art' : 'badge-general';
                      return `<div class="person-tag ${badgeClass}">${person.name}</div>`;
                    }).join('');

                    return `<td>${namesHtml}</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      // Individual Staff Cards Mode
      bodyHtml = `
        <div class="cards-container">
          ${filteredPersons.map(person => {
            const personShifts = shifts.filter(s => s.personId === person.id);
            
            let totalHoursWeek = 0;
            const weekDaysRows = days.map((d, idx) => {
              const dateStr = d.toISOString().split('T')[0];
              const dayShifts = personShifts.filter(s => s.date === dateStr);

              let scheduleText = 'Franco / Sin Turno';
              let badgeType = 'off';
              let hoursCount = 0;

              if (dayShifts.length > 0) {
                const shift = dayShifts[0];
                const isTimeOff = ['VACACIONES', 'FRANCO', 'ENFERMEDAD', 'FERIADO'].includes(shift.area);
                if (isTimeOff) {
                  scheduleText = `Licencia: ${shift.area}`;
                  badgeType = 'timeoff';
                } else {
                  const endH = (shift.startHour + shift.duration) % 24;
                  scheduleText = `${shift.startHour.toString().padStart(2, '0')}:00 a ${endH.toString().padStart(2, '0')}:00 (${shift.area})`;
                  badgeType = shift.area.includes('ART') ? 'art' : 'general';
                  hoursCount = shift.duration;
                  totalHoursWeek += hoursCount;
                }
              }

              return `
                <tr>
                  <td style="font-weight: bold;">${dayNames[idx]}</td>
                  <td>${d.toLocaleDateString('es-AR')}</td>
                  <td><span class="status-badge ${badgeType}">${scheduleText}</span></td>
                  <td style="text-align: right; font-weight: bold;">${hoursCount > 0 ? `${hoursCount} hs` : '-'}</td>
                </tr>
              `;
            }).join('');

            return `
              <div class="staff-card">
                <div class="card-header">
                  <div>
                    <h2 style="margin: 0; color: #1e293b; font-size: 18px;">${person.name}</h2>
                    <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Legajo: ${person.legajo || 'S/D'} &bull; Área: ${person.area || 'Admisión'}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 13px; font-weight: bold; color: #2563eb;">Semana: ${weekStr}</div>
                    <div style="font-size: 13px; color: #0f172a; margin-top: 2px;">Total semanal: <strong>${totalHoursWeek} horas</strong></div>
                  </div>
                </div>

                <table class="staff-table">
                  <thead>
                    <tr>
                      <th style="width: 25%;">Día</th>
                      <th style="width: 25%;">Fecha</th>
                      <th style="width: 35%;">Turno / Detalle</th>
                      <th style="width: 15%; text-align: right;">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${weekDaysRows}
                  </tbody>
                </table>

                <div class="card-footer">
                  <div class="sign-box">Firma del Colaborador</div>
                  <div class="sign-box">Firma / Aprobación Supervisor</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>SFH ITEO - Cronograma Semanal (${weekStr})</title>
        <style>
          @page {
            size: ${exportMode === 'grid' ? 'landscape' : 'portrait'};
            margin: 8mm 10mm;
          }
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
          body { margin: 0; padding: 10px; color: #0f172a; background: #fff; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 18px; color: #1e3a8a; }
          .header h2 { margin: 3px 0 0 0; font-size: 14px; color: #475569; }
          .header .meta { font-size: 11px; color: #64748b; }

          .legend { display: flex; gap: 10px; margin-bottom: 10px; font-size: 11px; }
          .badge { padding: 3px 8px; border-radius: 4px; font-weight: bold; }
          .badge.general { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
          .badge.art { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
          .badge.timeoff { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

          /* Grid Table Styles */
          .grid-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .grid-table th, .grid-table td { border: 1px solid #cbd5e1; padding: 3px 4px; text-align: center; vertical-align: top; }
          .grid-table th { background: #f1f5f9; color: #1e293b; font-weight: bold; }
          .grid-table .hour-cell { font-family: monospace; font-weight: bold; background: #f8fafc; color: #475569; width: 90px; text-align: center; vertical-align: middle; }
          .grid-table tr.night-row { background-color: #f8fafc; }
          .person-tag { margin-bottom: 2px; padding: 2px 4px; border-radius: 3px; font-weight: 600; font-size: 9.5px; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .person-tag.badge-general { background: #2563eb; color: #fff; }
          .person-tag.badge-art { background: #4f46e5; color: #fff; }
          .person-tag.badge-timeoff { background: #ef4444; color: #fff; }

          /* Staff Cards Styles */
          .cards-container { display: flex; flex-direction: column; gap: 24px; }
          .staff-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; page-break-inside: avoid; margin-bottom: 16px; }
          ${exportMode === 'staff' && filteredPersons.length > 1 ? '.staff-card { page-break-after: always; }' : ''}
          .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
          .staff-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
          .staff-table th, .staff-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
          .staff-table th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 11px; text-transform: uppercase; }
          .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }
          .status-badge.general { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
          .status-badge.art { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
          .status-badge.timeoff { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
          .status-badge.off { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }
          
          .card-footer { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; }
          .sign-box { width: 45%; border-top: 1px dashed #94a3b8; text-align: center; padding-top: 5px; font-size: 11px; color: #64748b; }

          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Exportar / Imprimir Horarios en PDF</h3>
              <p className="text-xs text-slate-500 font-medium">Semana: {weekStr}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Formato de Exportación</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportMode('staff')}
                className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${exportMode === 'staff' ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <FileText size={16} className={exportMode === 'staff' ? 'text-emerald-600' : 'text-slate-400'} />
                  Fichas Individuales por Empleado
                </div>
                <p className="text-xs text-slate-500">Ideal para enviar a cada colaborador o imprimir planillas individuales con firma.</p>
              </button>

              <button
                type="button"
                onClick={() => setExportMode('grid')}
                className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${exportMode === 'grid' ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <Calendar size={16} className={exportMode === 'grid' ? 'text-emerald-600' : 'text-slate-400'} />
                  Grilla Semanal Completa (24h)
                </div>
                <p className="text-xs text-slate-500">Matriz apaisada con todos los días y turnos asignados por franja horaria.</p>
              </button>
            </div>
          </div>

          {/* Filter Person (only for staff cards) */}
          {exportMode === 'staff' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Colaborador</label>
              <select
                value={selectedPersonId}
                onChange={e => setSelectedPersonId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">👥 Todos los colaboradores ({persons.length} personas)</option>
                {persons.map(p => (
                  <option key={p.id} value={p.id}>👤 {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Summary / Preview Box */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span>💡 Consejos para guardar en PDF:</span>
            </div>
            <p>1. Al hacer clic en <strong>Generar e Imprimir PDF</strong>, se abrirá la vista previa de impresión de tu navegador.</p>
            <p>2. En el campo <strong>Destino</strong>, seleccioná la opción <strong>"Guardar como PDF"</strong>.</p>
            <p>3. En <strong>Más opciones</strong>, activá la casilla <strong>"Gráficos de fondo"</strong> para que se exporten los colores de los turnos.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Printer size={16} />
            Generar e Imprimir PDF
          </button>
        </div>
      </div>
    </div>
  );
}
