import React, { useState, useEffect } from 'react';
import { Person, Shift, Area } from '../types';
import { formatHour, parseHour, checkOverlap, getOverlappingShift } from '../utils';
import { X, Clock, Trash2, ShieldCheck, User, LayoutGrid } from 'lucide-react';
import { DAYS_OF_WEEK, AREAS } from '../seedData';

interface ShiftEditorModalProps {
  shift: Shift | null; // If null, we are in "Create Mode"
  persons: Person[];
  shifts: Shift[];
  selectedDate: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (shift: Shift | Omit<Shift, 'id'>) => void;
  onDelete?: (shiftId: string) => void;
  preselectedPersonId?: string; // Optional context
  areas?: Area[];
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
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startHourStr, setStartHourStr] = useState('08:00');
  const [duration, setDuration] = useState(8);
  const [area, setArea] = useState<Area>('Atención');
  const [errorWord, setErrorWord] = useState('');


  // Hydrate form when modal opens or active shift changes
  useEffect(() => {
    if (shift) {
      setPersonId(shift.personId);
      setDayOfWeek(shift.dayOfWeek);
      setStartHourStr(formatHour(shift.startHour));
      setDuration(shift.duration);
      setArea(shift.area);
    } else {
      // Default creation setups
      setPersonId(preselectedPersonId || persons[0]?.id || '');
      setDayOfWeek(1);
      setStartHourStr('08:00');
      setDuration(8);
      const preselectedPerson = persons.find(p => p.id === (preselectedPersonId || persons[0]?.id));
      setArea(preselectedPerson ? preselectedPerson.area : 'Atención');
    }
    setErrorWord('');
  }, [shift, isOpen, preselectedPersonId, persons]);

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

    if (parsedStart + duration > 24) {
      setErrorWord('El turno supera las 24:00 horas del día. Por favor acorta la duración o adelanta la hora de inicio.');
      return;
    }

    const candidate = {
      id: shift?.id,
      personId,
      dayOfWeek,
      startHour: parsedStart,
      duration,
    };

    const overlap = getOverlappingShift(candidate, shifts);
    if (overlap) {
      setErrorWord(`¡Error de superposición! Esta persona ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return;
    }

    if (shift) {
      // Edit mode
      onSave({
        ...shift,
        personId,
        dayOfWeek,
        startHour: parsedStart,
        duration,
        area,
      });
    } else {
      // Create mode
      onSave({
        personId,
        dayOfWeek,
        startHour: parsedStart,
        duration,
        area,
      });
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

          <div className="grid grid-cols-2 gap-4">
            {/* Day of the week */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Día de la Semana</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
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
