import React, { useState, useEffect } from 'react';
import { Person, Shift, Area } from '../types';
import { getInitials, formatHour } from '../utils';
import { Search, Plus, Filter, Clock, UserCheck, UserPlus, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { AppTheme, THEMES } from '../themes';

interface PeopleSidebarProps {
  persons: Person[];
  shifts: Shift[];
  selectedDate: string;
  selectedArea: Area | 'Todos';
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onQuickAddShift: (personId: string) => void;
  onSelectPerson: (person: Person) => void;
  activeFilterPersonId?: string | null;
  onEditPerson?: (person: Person) => void;
  areas: Area[];
  onAddArea: (area: Area) => boolean;
  onEditArea: (oldArea: Area, newArea: Area) => boolean;
  onDeleteArea: (area: Area) => boolean;
  theme?: AppTheme;
}

export function PeopleSidebar({
  persons,
  shifts,
  selectedDate,
  selectedArea,
  onAddPerson,
  onQuickAddShift,
  onSelectPerson,
  activeFilterPersonId = null,
  onEditPerson,
  areas,
  onAddArea,
  onEditArea,
  onDeleteArea,
  theme = THEMES[0],
}: PeopleSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<Area | 'Todos'>(selectedArea);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // States for area manager panel
  const [showAreaManager, setShowAreaManager] = useState(false);
  const [editingAreaName, setEditingAreaName] = useState<string | null>(null);
  const [editingAreaValue, setEditingAreaValue] = useState('');
  const [newAreaInput, setNewAreaInput] = useState('');

  // States for new person form
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState<Area>('');
  const [newMaxHours, setNewMaxHours] = useState(8);
  const [newAvailStart, setNewAvailStart] = useState(8);
  const [newAvailEnd, setNewAvailEnd] = useState(17);

  // Sync selectedArea property to local filter tab
  useEffect(() => {
    setAreaFilter(selectedArea);
  }, [selectedArea]);

  // Sync default form area to first available area
  useEffect(() => {
    if (areas.length > 0 && !newArea) {
      setNewArea(areas[0]);
    }
  }, [areas, newArea]);

  // Filter persons
  const filteredPersons = persons.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = areaFilter === 'Todos' || p.area === areaFilter;
    return matchesSearch && matchesArea;
  });

  // Calculate allocated hours for each person on the selected day
  const getPersonScheduledHours = (personId: string) => {
    const personShifts = shifts.filter((s) => s.personId === personId);
    return personShifts.reduce((acc, shift) => acc + shift.duration, 0);
  };

  const handleSubmitNewPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Pick a random tailwind color prefix
    const colors = ['indigo', 'emerald', 'sky', 'violet', 'amber', 'rose', 'cyan', 'orange'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    onAddPerson({
      name: newName.trim(),
      area: newArea,
      maxDailyHours: Number(newMaxHours),
      availabilityStart: Number(newAvailStart),
      availabilityEnd: Number(newAvailEnd),
      color: randomColor,
    });

    setNewName('');
    setShowAddForm(false);
  };

  return (
    <div className={`flex flex-col h-full ${theme.cardBg} rounded-xl border ${theme.cardBorder} shadow-sm overflow-hidden ${theme.cardText} transition-all duration-300`}>
      {/* Search and Filters Header */}
      <div className={`p-4 border-b ${theme.cardHeaderBorder} ${theme.cardHeaderBg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50/20 text-indigo-400 rounded-lg">
              <UserCheck size={18} />
            </span>
            <h2 className="text-sm font-semibold font-sans">
              Personal ({persons.length})
            </h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-lg cursor-pointer"
          >
            <Plus size={14} />
            Nuevo
          </button>
        </div>

        {/* Dynamic add person form inline */}
        {showAddForm && (
          <form onSubmit={handleSubmitNewPerson} className="mb-4 p-3 bg-white border border-indigo-100 rounded-lg shadow-sm animate-fade-in text-xs space-y-2">
            <div className="font-semibold text-indigo-900 border-b border-indigo-50 pb-1 mb-1">
              Agregar Persona
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Nombre Completo</label>
              <input
                type="text"
                placeholder="Ej. Juan Gómez"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Área</label>
                <select
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value as Area)}
                  className="w-full border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs text-slate-700"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a === 'Administración' ? 'Admin' : a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Hrs Máx.</label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  value={newMaxHours}
                  onChange={(e) => setNewMaxHours(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Disp. Inicio</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={newAvailStart}
                  onChange={(e) => setNewAvailStart(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Disp. Fin</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={newAvailEnd}
                  onChange={(e) => setNewAvailEnd(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2 py-1 border border-slate-200 text-slate-500 rounded hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </form>
        )}

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Dynamic Area Manager Panel inside Sidebar */}
        {showAreaManager && (
          <div className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-2 shadow-xs mb-3 animate-fade-in text-xs">
            <div className="font-bold text-indigo-900 border-b border-indigo-100/50 pb-1 mb-1.5 flex justify-between items-center">
              <span>Administrar Áreas</span>
              <span className="text-[10px] text-slate-400 font-normal">({areas.length} registradas)</span>
            </div>

            {/* Area listing */}
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {areas.map((areaItem) => {
                const isEditing = editingAreaName === areaItem;
                return (
                  <div key={areaItem} className="flex items-center justify-between gap-2 p-1 bg-white border border-slate-100 rounded-md">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingAreaValue}
                        onChange={(e) => setEditingAreaValue(e.target.value)}
                        className="flex-1 bg-slate-50 border border-indigo-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none font-semibold"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-slate-700 truncate pl-1">{areaItem}</span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingAreaValue.trim() && onEditArea(areaItem, editingAreaValue.trim())) {
                                setEditingAreaName(null);
                              }
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Guardar nombre"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAreaName(null)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAreaName(areaItem);
                              setEditingAreaValue(areaItem);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-605 hover:bg-slate-100 rounded cursor-pointer"
                            title="Renombrar área"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteArea(areaItem);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                            title="Eliminar área"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row to add new area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newAreaInput.trim();
                if (trimmed) {
                  if (onAddArea(trimmed)) {
                    setNewAreaInput('');
                  }
                }
              }}
              className="flex items-center gap-1 pb-1 pt-1.5 border-t border-indigo-100/50"
            >
              <input
                type="text"
                value={newAreaInput}
                onChange={(e) => setNewAreaInput(e.target.value)}
                placeholder="Nueva área (ej. Call Center)"
                className="flex-1 border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer active:scale-95 transition-all text-[11px]"
              >
                + Añadir
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center justify-between mb-2 mt-1">
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-slate-400" />
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Filtrar por Área</span>
          </div>
          <button
            onClick={() => setShowAreaManager(!showAreaManager)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
              showAreaManager 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Administrar Áreas de Trabajo"
          >
            <Edit2 size={10} />
            <span>Editar Áreas</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex flex-wrap gap-1">
            {['Todos', ...areas].map((area) => (
              <button
                key={area}
                onClick={() => setAreaFilter(area)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-full cursor-pointer transition-colors ${
                  areaFilter === area
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {area === 'Administración' ? 'Admin' : area}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* People Scrollable List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 divide-y divide-slate-50">
        {filteredPersons.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-slate-400">
            Ninguna persona coincide con tu filtro
          </div>
        ) : (
          filteredPersons.map((person) => {
            const scheduledHours = getPersonScheduledHours(person.id);
            const isOverHours = scheduledHours > person.maxDailyHours;
            const isUnscheduled = scheduledHours === 0;

            // Map color suffix to Tailwind background color classes
            const colorMapping: Record<string, string> = {
              indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
              emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
              sky: 'bg-sky-50 text-sky-700 border-sky-100',
              violet: 'bg-violet-50 text-violet-700 border-violet-100',
              amber: 'bg-amber-50 text-amber-700 border-amber-100',
              rose: 'bg-rose-50 text-rose-700 border-rose-100',
              cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
              orange: 'bg-orange-50 text-orange-700 border-orange-100',
            };

            const personBg = colorMapping[person.color] || 'bg-slate-50 text-slate-700 border-slate-200';
            const isActiveFilter = activeFilterPersonId === person.id;

            return (
              <div
                key={person.id}
                onClick={() => onSelectPerson(person)}
                className={`p-2 rounded flex items-center justify-between gap-1 group cursor-pointer border-l-2 transition-all duration-150 ${
                  isActiveFilter
                    ? 'bg-indigo-50/70 border-indigo-600 shadow-xs'
                    : 'border-transparent hover:bg-slate-50 hover:border-indigo-600/30'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs select-none ${personBg} shrink-0`}>
                    {getInitials(person.name)}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${theme.cardText} truncate group-hover:opacity-80 transition-opacity flex items-center gap-1`}>
                      <span>{person.name}</span>
                      {isActiveFilter && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                          <Filter size={8} /> Activo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                      <span className="font-semibold px-1 rounded bg-slate-100">{person.area}</span>
                      <span>•</span>
                      <span>Disp: {formatHour(person.availabilityStart)}-{formatHour(person.availabilityEnd)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Badge showing daily scheduled hours */}
                  <div className="flex flex-col items-end">
                    {isUnscheduled ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-400 font-mono font-medium">
                        0h / {person.maxDailyHours}h
                      </span>
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex items-center gap-0.5 ${
                        isOverHours 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        {isOverHours && <AlertCircle size={10} className="shrink-0 animate-pulse text-rose-500" />}
                        {scheduledHours}h / {person.maxDailyHours}h
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {/* Fast shift insertion trigger button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddShift(person.id);
                      }}
                      title="Asignar turno de cobertura sugerido"
                      className="p-1 hover:bg-indigo-50 border border-dashed border-slate-205 hover:border-indigo-300 rounded text-slate-400 hover:text-indigo-650 cursor-pointer"
                    >
                      <UserPlus size={13} />
                    </button>

                    {/* Open details/edit modal button */}
                    {onEditPerson && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPerson(person);
                        }}
                        title="Programar/Registrar turno detallado"
                        className="p-1 hover:bg-slate-100 border border-dashed border-slate-205 hover:border-slate-400 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
