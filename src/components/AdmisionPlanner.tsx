import React, { useState, useMemo } from 'react';
import { Person, Shift, Area } from '../types';
import { supabaseControl as supabase } from '../supabase';
import { Calendar, Users, Briefcase, Plus, Search, CheckSquare, Square, RefreshCw, Save, ChevronLeft, ChevronRight, X } from 'lucide-react';

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

export function AdmisionPlanner({ theme, persons, shifts, setPersons, setShifts, onSave, areas, targets = [], demand = [] }: AdmisionPlannerProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'staff' | 'timeoff'>('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  return (
    <div className={`h-full flex flex-col ${theme.timelineBg} ${theme.timelineHeaderText}`}>
      <div className={`p-4 border-b ${theme.timelineHeaderBorder} ${theme.timelineHeaderBg} flex flex-col gap-4 shadow-sm shrink-0`}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase size={24} className="text-blue-600" />
            Planificación de Admisión 24/7
          </h2>
          <button 
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-md"
          >
            <Save size={18} />
            Guardar Cambios
          </button>
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
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm text-slate-600"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm font-medium text-slate-700"
          >
            Hoy
          </button>
          <button 
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 transition-colors shadow-sm text-slate-600"
          >
            <ChevronRight size={16} />
          </button>
          <span className="font-semibold ml-4 text-slate-700">Semana: {weekStr}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10 shadow-sm bg-slate-100">
            <tr>
              <th className="p-3 border-b border-r border-slate-200 font-bold text-center w-28 text-slate-700">Horario (24h)</th>
              {days.map((d: Date, i: number) => (
                <th key={i} className={`p-3 border-b border-r border-slate-200 font-bold text-center text-slate-700 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-slate-200' : ''}`}>
                  <div className="text-xs uppercase tracking-wider">{d.toLocaleDateString('es-AR', { weekday: 'short' })}</div>
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
                                <button onClick={() => handleDeleteShift(s.id)} className="opacity-60 hover:opacity-100 p-0.5 hover:bg-black hover:bg-opacity-20 rounded transition-all shrink-0"><X size={12}/></button>
                              </div>
                            );
                          })}
                          <button
                            className="text-xs font-semibold opacity-35 group-hover:opacity-100 text-center py-1.5 transition-opacity w-full border border-dashed border-red-300 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-400 rounded shadow-sm"
                            title="Asignar alguien"
                            onClick={() => { setAssignModal({isOpen: true, dateStr, hour, endHour: (hour + 8) % 24, selectedPersons: new Set(), shiftArea: 'Admisión General'}); setSearchTerm(''); }}
                          >
                            + Sin Asignar
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
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  className="pl-7 pr-2 py-1 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto mb-6 border border-slate-200 p-2 rounded-lg bg-slate-50 shadow-inner">
              {persons.filter((p: Person) => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((p: Person) => (
                <label key={p.id} className="flex items-center gap-3 p-2.5 hover:bg-white cursor-pointer rounded-md transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    checked={assignModal.selectedPersons.has(p.id)}
                    onChange={(e) => {
                      const newSet = new Set(assignModal.selectedPersons);
                      if (e.target.checked) newSet.add(p.id);
                      else newSet.delete(p.id);
                      setAssignModal({...assignModal, selectedPersons: newSet});
                    }}
                  />
                  <span className="font-medium text-slate-700">{p.name}</span>
                </label>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setAssignModal(null)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-medium transition-colors">Cancelar</button>
              <button onClick={handleSaveAssignment} className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95">Guardar Asignación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeOffTab({ theme, persons, shifts, setShifts }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ personId: '', type: 'VACACIONES', startDate: '', endDate: '', notes: '' });

  const timeOffs = useMemo(() => {
    return shifts.filter((s: Shift) => ['VACACIONES', 'FRANCO', 'ENFERMEDAD', 'FERIADO'].includes(s.area));
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
        <button onClick={() => setModalOpen(true)} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md flex items-center gap-2 transition-all">
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
                      <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 font-medium hover:bg-red-50 px-3 py-1 rounded transition-colors">Eliminar</button>
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
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-slate-500 hover:text-slate-800 font-medium transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95">Guardar Licencia</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
