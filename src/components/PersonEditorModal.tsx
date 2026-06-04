import React, { useState, useEffect } from 'react';
import { Person, Area } from '../types';
import { getInitials, formatHour, parseHour } from '../utils';
import { X, User, LayoutGrid, AlertCircle, Clock, Trash2, Plus, Sparkles, Briefcase } from 'lucide-react';
import { AREAS } from '../seedData';

interface PersonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  onSave: (person: Person) => void;
  onDelete?: (personId: string) => void;
  areas?: Area[];
}

const PRESTYLED_COLORS = ['indigo', 'emerald', 'sky', 'violet', 'amber', 'rose', 'cyan', 'orange'];

export function PersonEditorModal({
  isOpen,
  onClose,
  person,
  onSave,
  onDelete,
  areas = AREAS,
}: PersonEditorModalProps) {
  const [name, setName] = useState('');
  const [legajo, setLegajo] = useState('');
  const [area, setArea] = useState<Area>('Atención');
  const [color, setColor] = useState('indigo');
  const [maxDailyHours, setMaxDailyHours] = useState(8);
  const [availStartStr, setAvailStartStr] = useState('08:00');
  const [availEndStr, setAvailEndStr] = useState('17:00');
  const [possibleShifts, setPossibleShifts] = useState<{ startHour: number; duration: number }[]>([]);
  
  // New shift template form state
  const [newTemplateStart, setNewTemplateStart] = useState('08:00');
  const [newTemplateDuration, setNewTemplateDuration] = useState(8);
  const [templateError, setTemplateError] = useState('');

  useEffect(() => {
    if (person) {
      setName(person.name);
      setLegajo(person.legajo || '');
      setArea(person.area);
      setColor(person.color);
      setMaxDailyHours(person.maxDailyHours);
      setAvailStartStr(formatHour(person.availabilityStart));
      setAvailEndStr(formatHour(person.availabilityEnd));
      setPossibleShifts(person.possibleShifts || []);
    }
    setTemplateError('');
  }, [person, isOpen]);

  if (!isOpen || !person) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const startVal = parseHour(availStartStr);
    const endVal = parseHour(availEndStr);

    onSave({
      ...person,
      name: name.trim(),
      legajo: legajo.trim() || undefined,
      area,
      color,
      maxDailyHours: Number(maxDailyHours),
      availabilityStart: startVal,
      availabilityEnd: endVal,
      possibleShifts
    });
    onClose();
  };

  const handleAddShiftTemplate = () => {
    setTemplateError('');
    const startHour = parseHour(newTemplateStart);
    const duration = Number(newTemplateDuration);

    if (startHour + duration > 24) {
      // Let's format it in standard (+1d) format!
      const endHourFormatted = formatHour(startHour + duration);
      setTemplateError(`El rango (${newTemplateStart} a ${endHourFormatted}) supera la medianoche, pero es válido. Se agregará como plantilla.`);
    }

    // Check if it already exists
    const exists = possibleShifts.some(ps => ps.startHour === startHour && ps.duration === duration);
    if (exists) {
      setTemplateError('Esta plantilla de turno ya se encuentra registrada.');
      return;
    }

    setPossibleShifts([...possibleShifts, { startHour, duration }]);
    setTemplateError('');
  };

  const handleRemoveShiftTemplate = (index: number) => {
    setPossibleShifts(possibleShifts.filter((_, i) => i !== index));
  };

  // Color circles mapping
  const colorBgClass: Record<string, string> = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    cyan: 'bg-cyan-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden text-slate-700 animate-scale-up max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <User size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Ficha del Colaborador
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                Editar Datos de {person.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 text-xs space-y-4">
          
          <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            {/* Visual initials badge showing current color */}
            <div className={`w-14 h-14 rounded-full border border-current flex items-center justify-center font-bold text-lg select-none shrink-0 ${
              color === 'indigo' ? 'bg-indigo-50 text-indigo-700' :
              color === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
              color === 'sky' ? 'bg-sky-50 text-sky-700' :
              color === 'violet' ? 'bg-violet-50 text-violet-700' :
              color === 'amber' ? 'bg-amber-50 text-amber-700' :
              color === 'rose' ? 'bg-rose-50 text-rose-700' :
              color === 'cyan' ? 'bg-cyan-50 text-cyan-700' :
              'bg-orange-50 text-orange-700'
            }`}>
              {getInitials(name || 'Nuevo Colaborador')}
            </div>
            
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Color de Identificación</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESTYLED_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border cursor-pointer transition-all ${colorBgClass[c]} ${
                      color === c ? 'scale-115 ring-2 ring-indigo-500/50 ring-offset-1 border-white' : 'border-transparent hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Nombre */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Nombre Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-medium text-slate-800"
                required
              />
            </div>

            {/* Legajo */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">ID Legajo / Registro</label>
              <input
                type="text"
                value={legajo}
                onChange={(e) => setLegajo(e.target.value)}
                placeholder="Ej. LEG-1025"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Area Selector */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <LayoutGrid size={13} className="text-slate-400" /> Área / Departamento
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

            {/* Max Daily Hours */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Horas Diarias Máximas</label>
              <input
                type="number"
                min="4"
                max="12"
                value={maxDailyHours}
                onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Availability Start */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" /> Disp. Horaria Inicio
              </label>
              <input
                type="time"
                step="1800"
                value={availStartStr}
                onChange={(e) => setAvailStartStr(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                required
              />
            </div>

            {/* Availability End */}
            <div>
              <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" /> Disp. Horaria Fin
              </label>
              <input
                type="time"
                step="1800"
                value={availEndStr}
                onChange={(e) => setAvailEndStr(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Plantillas de Turnos Posibles (Dynamic list) */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-indigo-500 animate-pulse" />
              Plantillas de Turnos Posibles (Sugeridos)
            </h4>

            {possibleShifts.length === 0 ? (
              <div className="p-3 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-lg text-center font-medium">
                Sin plantillas predeterminadas. Puedes añadir plantillas personalizadas abajo.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {possibleShifts.map((ps, idx) => {
                  const endStr = formatHour(ps.startHour + ps.duration);
                  return (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 bg-indigo-50/50 border border-indigo-150 text-indigo-700 text-xs rounded-lg font-semibold flex items-center gap-2 group/tag"
                    >
                      <Clock size={11} className="text-indigo-400" />
                      <span>
                        {formatHour(ps.startHour)} a {endStr} ({ps.duration} hrs)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveShiftTemplate(idx)}
                        className="text-indigo-400 hover:text-rose-600 transition-colors p-0.5 rounded-full cursor-pointer hover:bg-white"
                        title="Eliminar plantilla"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Form to add a new possible shift template */}
            <div className="bg-slate-50/50 border border-slate-150/70 p-3 rounded-lg flex flex-col md:flex-row items-end gap-3">
              <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Inicio de Plantilla</label>
                  <input
                    type="time"
                    step="1800"
                    value={newTemplateStart}
                    onChange={(e) => {
                      setNewTemplateStart(e.target.value);
                      setTemplateError('');
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Duración (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={newTemplateDuration}
                    onChange={(e) => {
                      setNewTemplateDuration(Number(e.target.value));
                      setTemplateError('');
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddShiftTemplate}
                className="w-full md:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all text-xs"
              >
                <Plus size={13} />
                Añadir
              </button>
            </div>

            {templateError && (
              <div className={`p-2 rounded-lg text-[10px] font-semibold border ${
                templateError.includes('supera la medianoche')
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
                {templateError}
              </div>
            )}
          </div>

        </form>

        {/* Footer actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente a ${person.name}? Se borrarán todos sus turnos programados.`)) {
                  onDelete(person.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 border border-transparent rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all"
            >
              <Trash2 size={13} />
              Eliminar Colaborador
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
              onClick={handleFormSubmit}
              type="button"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              Guardar Cambios
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
