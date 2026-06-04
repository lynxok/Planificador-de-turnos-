import React, { useState, useEffect } from 'react';
import { Person, Shift, Area } from '../types';
import { formatHour, parseHour, checkOverlap, getOverlappingShift } from '../utils';
import { X, Clock, Trash2, ShieldCheck, User, LayoutGrid } from 'lucide-react';
import { DAYS_OF_WEEK, AREAS } from '../seedData';
import { FERIADOS_2026 } from '../feriados';

interface ShiftEditorModalProps {
  shift: Shift | null; // If null, we are in "Create Mode"
  persons: Person[];
  shifts: Shift[];
  selectedDate: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (shift: Shift | Omit<Shift, 'id'>, replicateDates?: string[], replicateWeeks?: string[]) => void;
  onDelete?: (shiftId: string) => void;
  preselectedPersonId?: string; // Optional context
  areas?: Area[];
}

interface MonthWeek {
  weekNum: number;
  startOfWeekStr: string;
  endOfWeekStr: string;
  label: string;
  isCurrentWeek: boolean;
}

function getWeekDatesForDate(dateStr: string): string[] {
  if (!dateStr) return [];
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0: Sunday, 1: Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day; // diff to Monday
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  
  const weekDatesArray: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    weekDatesArray.push(`${yyyy}-${mm}-${dd}`);
  }
  return weekDatesArray;
}

export function ShiftEditorModal({
  shift,
  persons,
  shifts,
  selectedDate,
  isOpen,
  onClose,
  onSave,
  onDelete,
  preselectedPersonId,
  areas = AREAS,
}: ShiftEditorModalProps) {
  const [personId, setPersonId] = useState('');
  const [dateStr, setDateStr] = useState(selectedDate);
  const [startHourStr, setStartHourStr] = useState('08:00');
  const [duration, setDuration] = useState(8);
  const [area, setArea] = useState<Area>('Atención');
  const [errorWord, setErrorWord] = useState('');
  const [selectedReplicationDates, setSelectedReplicationDates] = useState<string[]>([]);
  const [selectedReplicationWeeks, setSelectedReplicationWeeks] = useState<string[]>([]);


  // Hydrate form when modal opens or active shift changes
  useEffect(() => {
    if (shift) {
      setPersonId(shift.personId);
      setDateStr((shift as any).date || selectedDate);
      setStartHourStr(formatHour(shift.startHour));
      setDuration(shift.duration);
      setArea(shift.area);
    } else {
      setPersonId(preselectedPersonId || persons[0]?.id || '');
      setDateStr(selectedDate);
      setStartHourStr('08:00');
      setDuration(8);
      const preselectedPerson = persons.find(p => p.id === (preselectedPersonId || persons[0]?.id));
      setArea(preselectedPerson ? preselectedPerson.area : 'Atención');
    }
    setErrorWord('');
    setSelectedReplicationDates([]);
    setSelectedReplicationWeeks([]);
  }, [shift, isOpen, preselectedPersonId, persons, selectedDate]);

  if (!isOpen) return null;

  // React to change in person to automatically inherit their default Area
  const handlePersonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setPersonId(pId);
    const person = persons.find((p) => p.id === pId);
    if (person) {
      setArea(person.area);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedStart = parseHour(startHourStr);

    if (duration > 24) {
      setErrorWord('La duración de un turno individual no puede exceder las 24 horas.');
      return;
    }

    const candidate = {
      id: shift?.id,
      personId,
      date: dateStr,
      startHour: parsedStart,
      duration,
    };

    const overlap = getOverlappingShift(candidate as any, shifts);
    if (overlap) {
      setErrorWord(`¡Error de superposición! Esta persona ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return;
    }

    if (shift) {
      // Edit mode
      onSave({
        ...shift,
        personId,
        date: dateStr,
        startHour: parsedStart,
        duration,
        area,
      } as any, selectedReplicationDates, selectedReplicationWeeks);
    } else {
      // Create mode
      onSave({
        personId,
        date: dateStr,
        startHour: parsedStart,
        duration,
        area,
      } as any, selectedReplicationDates, selectedReplicationWeeks);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden text-slate-700 animate-scale-up">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock size={18} />
            </span>
            <h3 className="text-sm font-bold text-slate-900 font-sans">
              {shift ? 'Modificar Turno Asignado' : 'Asignar Nuevo Turno'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 text-xs space-y-4">
          
          {errorWord && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-lg p-3 font-medium">
              {errorWord}
            </div>
          )}

          {FERIADOS_2026[dateStr] && (
            <div className="bg-amber-50/60 border border-amber-250 text-amber-900 rounded-lg p-3 font-medium flex items-center gap-2.5 animate-fade-in shadow-2xs">
              <span className="text-base select-none">🎉</span>
              <div>
                <p className="text-[10px] text-amber-700 uppercase tracking-wider font-extrabold">Feriado Nacional</p>
                <p className="text-xs font-semibold">{FERIADOS_2026[dateStr]}</p>
              </div>
            </div>
          )}

          {/* Person Selector */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" /> Integrante Asignado
            </label>
            <select
              value={personId}
              onChange={handlePersonChange}
              className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
              required
            >
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.area})
                </option>
              ))}
            </select>
          </div>

          {/* Posibles Turnos (Si los tiene) */}
          {(() => {
            const selectedPerson = persons.find(p => p.id === personId);
            if (selectedPerson && selectedPerson.possibleShifts && selectedPerson.possibleShifts.length > 0) {
              return (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 mt-3 animate-fade-in">
                  <label className="block text-indigo-800 text-[10px] uppercase font-bold tracking-wider mb-2">
                    Turnos Posibles (Plantillas):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedPerson.possibleShifts.map((ps, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setStartHourStr(formatHour(ps.startHour));
                          setDuration(ps.duration);
                        }}
                        className="px-2.5 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors text-xs rounded-md shadow-sm font-semibold cursor-pointer active:scale-95 flex items-center gap-1.5"
                      >
                        <Clock size={12} />
                        {formatHour(ps.startHour)} a {formatHour(ps.startHour + ps.duration)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Fecha</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-sm"
                required
              />
            </div>

            {/* Area Selector (can override default area) */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <LayoutGrid size={13} className="text-slate-400" /> Área de Operación
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value as Area)}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium"
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Hour */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Hora Inicio</label>
              <input
                type="time"
                step="1800" // 30 minute jumps
                value={startHourStr}
                onChange={(e) => setStartHourStr(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                required
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Duración (Horas)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                required
              />
            </div>
          </div>

          {/* Helpful schedule representation preview */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between text-slate-500">
            <span>Rango Establecido:</span>
            <span className="font-mono font-bold text-slate-800">
              {startHourStr} a {formatHour(parseHour(startHourStr) + duration)} ({duration} hrs)
            </span>
          </div>

          {/* Replicar Turno */}
          <div className="border-t border-slate-100 pt-3">
            <label className="block text-slate-500 font-semibold mb-2">Replicar este turno en otros días de la semana:</label>
            <div className="grid grid-cols-4 gap-2">
              {getWeekDatesForDate(dateStr).map((wDate, idx) => {
                if (wDate === dateStr) return null;
                const daysOfWeekLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                const dayLabel = daysOfWeekLabels[idx];
                const isChecked = selectedReplicationDates.includes(wDate);
                
                return (
                  <label 
                    key={wDate} 
                    className={`flex items-center gap-1.5 p-1.5 border rounded-lg cursor-pointer transition-all select-none hover:bg-slate-50 ${
                      isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReplicationDates([...selectedReplicationDates, wDate]);
                        } else {
                          setSelectedReplicationDates(selectedReplicationDates.filter(d => d !== wDate));
                        }
                      }}
                      className="accent-indigo-600 rounded w-3.5 h-3.5"
                    />
                    <span className="text-[10px] truncate">{dayLabel.substring(0, 3)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Replicar en otras Semanas del mismo mes */}
          <div className="border-t border-slate-100 pt-3 mt-3">
            <label className="block text-slate-500 font-semibold mb-2">Replicar en otras semanas del mismo mes:</label>
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                if (!dateStr) return null;
                const d = new Date(dateStr + 'T00:00:00');
                const year = d.getFullYear();
                const month = d.getMonth();
                
                const weeksList: MonthWeek[] = [];
                const firstOfMonth = new Date(Date.UTC(year, month, 1));
                let start = new Date(firstOfMonth);
                const day = start.getUTCDay();
                const diffToMonday = day === 0 ? -6 : 1 - day;
                start.setUTCDate(start.getUTCDate() + diffToMonday);
                
                let weekIndex = 1;
                while (start.getUTCMonth() === month || (start.getUTCMonth() === (month - 1 + 12) % 12 && start.getUTCDate() + 6 >= 1 && start.getUTCMonth() === month) || (weekIndex <= 5 && start.getUTCFullYear() === year)) {
                  if (weekIndex > 5) break;
                  
                  const startMondayStr = start.toISOString().split('T')[0];
                  
                  const startStr = `${String(start.getUTCDate()).padStart(2, '0')}/${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
                  const end = new Date(start);
                  end.setUTCDate(start.getUTCDate() + 6);
                  const endStr = `${String(end.getUTCDate()).padStart(2, '0')}/${String(end.getUTCMonth() + 1).padStart(2, '0')}`;
                  
                  const label = `Semana ${weekIndex} (${startStr} - ${endStr})`;
                  const isCurrentWeek = getWeekDatesForDate(dateStr)[0] === startMondayStr;
                  
                  weeksList.push({
                    weekNum: weekIndex,
                    startOfWeekStr: startMondayStr,
                    endOfWeekStr: end.toISOString().split('T')[0],
                    label,
                    isCurrentWeek
                  });
                  
                  start.setUTCDate(start.getUTCDate() + 7);
                  weekIndex++;
                }
                
                return weeksList.map((wk) => {
                  const isChecked = selectedReplicationWeeks.includes(wk.startOfWeekStr);
                  
                  return (
                    <label 
                      key={wk.startOfWeekStr} 
                      className={`flex items-center gap-1.5 p-1.5 border rounded-lg cursor-pointer transition-all select-none hover:bg-slate-50 ${
                        wk.isCurrentWeek ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed opacity-60' :
                        isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={wk.isCurrentWeek ? true : isChecked}
                        disabled={wk.isCurrentWeek}
                        onChange={(e) => {
                          if (wk.isCurrentWeek) return;
                          if (e.target.checked) {
                            setSelectedReplicationWeeks([...selectedReplicationWeeks, wk.startOfWeekStr]);
                          } else {
                            setSelectedReplicationWeeks(selectedReplicationWeeks.filter(w => w !== wk.startOfWeekStr));
                          }
                        }}
                        className="accent-indigo-600 rounded w-3.5 h-3.5"
                      />
                      <span className="text-[10px] truncate">{wk.label}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
            {shift && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(shift.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 border border-transparent rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all"
              >
                <Trash2 size={13} />
                Eliminar
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 font-semibold cursor-pointer active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer active:scale-95 transition-all"
              >
                {shift ? 'Guardar Cambios' : 'Asignar Turno'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
