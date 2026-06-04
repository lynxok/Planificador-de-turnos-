import React, { useState } from 'react';
import { Person, Shift, Area } from '../types';
import { formatHour, getHourRange, getDayOfWeekFromDate } from '../utils';
import { Edit2, Trash2, Clock, AlertTriangle, ChevronLeft, ChevronRight, Plus, Eye, MonitorPlay, Search, X, User, Filter } from 'lucide-react';
import { AppTheme } from '../themes';
import { FERIADOS_2026 } from '../feriados';

interface TimelineGridProps {
  persons: Person[];
  shifts: Shift[];
  activeArea: Area | 'Todos';
  selectedDate: string;
  onUpdateShift: (shiftId: string, updatedFields: Partial<Shift>) => void;
  onDeleteShift: (shiftId: string) => void;
  onAddShift: (shift: Omit<Shift, 'id'>) => void;
  onSelectShift: (shift: Shift) => void;
  selectedPersonFilterId?: string | null;
  onClearPersonFilter?: () => void;
  viewMode?: 'day' | 'week';
  weekDates?: string[];
  theme: AppTheme;
}

export function TimelineGrid({
  persons,
  shifts,
  activeArea,
  selectedDate,
  onUpdateShift,
  onDeleteShift,
  onAddShift,
  onSelectShift,
  selectedPersonFilterId = null,
  onClearPersonFilter,
  viewMode = 'day',
  weekDates = [],
  theme,
}: TimelineGridProps) {
  const [dragOverCell, setDragOverCell] = useState<{ personId: string; dateStr: string; hour: number } | null>(null);
  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithShifts, setOnlyWithShifts] = useState(false);

  const hours = getHourRange(0, 23); // 24 columns
  const currentDayOfWeek = getDayOfWeekFromDate(selectedDate);

  // Filter persons based on active area tab AND search name AND external sidebar filter AND shifts presence
  const activePersons = persons.filter((p) => {
    const matchesArea = activeArea === 'Todos' || p.area === activeArea;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSidebarFilter = !selectedPersonFilterId || p.id === selectedPersonFilterId;

    if (!matchesArea || !matchesSearch || !matchesSidebarFilter) {
      return false;
    }

    if (onlyWithShifts) {
      if (viewMode === 'day') {
        return shifts.some((s) => s.personId === p.id && s.date === selectedDate);
      } else {
        return shifts.some((s) => s.personId === p.id && weekDates.includes(s.date));
      }
    }

    return true;
  });

  // Filter shifts associated to the active employees
  const activePersonIds = new Set(activePersons.map((p) => p.id));
  const activeShiftsQuery = shifts.filter((s) => activePersonIds.has(s.personId));

  interface TimelineRow {
    id: string; // "p1_3" for person 1, day 3
    person: Person;
    dayOfWeek: number;
    dayLabel: string;
    dateStr: string;
  }

  const rows: TimelineRow[] = [];
  if (viewMode === 'day') {
    activePersons.forEach((person) => {
      rows.push({
        id: `${person.id}_${selectedDate}`,
        person,
        dayOfWeek: currentDayOfWeek,
        dayLabel: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][currentDayOfWeek - 1],
        dateStr: selectedDate,
      });
    });
  } else {
    activePersons.forEach((person) => {
      for (let d = 1; d <= 7; d++) {
        const dateStr = weekDates[d - 1] || selectedDate;
        rows.push({
          id: `${person.id}_${dateStr}`,
          person,
          dayOfWeek: d,
          dayLabel: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][d - 1],
          dateStr,
        });
      }
    });
  }

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, shiftId: string) => {
    setDraggedShiftId(shiftId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', shiftId);
    // Small timeout to allow ghost drag image to build without hiding original
    setTimeout(() => {
      const element = document.getElementById(`shift-${shiftId}`);
      if (element) element.style.opacity = '0.3';
    }, 0);
  };

  // Handle Drag End
  const handleDragEnd = (shiftId: string) => {
    setDraggedShiftId(null);
    setDragOverCell(null);
    const element = document.getElementById(`shift-${shiftId}`);
    if (element) element.style.opacity = '1';
  };

  // Drag Over timeline slot
  const handleDragOverSlot = (e: React.DragEvent, personId: string, dateStr: string, hour: number) => {
    e.preventDefault();
    if (!draggedShiftId) return;
    setDragOverCell({ personId, dateStr, hour });
  };

  // Drop shift into specific slot
  const handleDropSlot = (e: React.DragEvent, targetPersonId: string, targetDateStr: string, targetHour: number) => {
    e.preventDefault();
    if (!draggedShiftId) return;

    const shift = shifts.find((s) => s.id === draggedShiftId);
    if (!shift) return;

    const targetPerson = persons.find((p) => p.id === targetPersonId);
    if (!targetPerson) return;

    let adjustedStartHour = targetHour;
    if (adjustedStartHour + shift.duration > 24) {
      adjustedStartHour = 24 - shift.duration;
    }

    onUpdateShift(draggedShiftId, {
      personId: targetPersonId,
      date: targetDateStr,
      startHour: Math.max(0, adjustedStartHour),
      area: targetPerson.area,
    });

    setDraggedShiftId(null);
    setDragOverCell(null);
  };

  // Create a shift in that cell on double click
  const handleCellDoubleClick = (personId: string, dateStr: string, hour: number) => {
    const person = persons.find((p) => p.id === personId);
    if (!person) return;
    
    onAddShift({
      personId,
      date: dateStr,
      startHour: hour,
      duration: Math.min(8, 24 - hour),
      area: person.area,
    });
  };

  return (
    <div className={`${theme.cardBg} rounded-xl border ${theme.cardBorder} shadow-sm overflow-hidden flex flex-col h-full ${theme.cardText} transition-all duration-300`}>
      
      {/* Timeline Header Instruction */}
      <div className={`${theme.cardHeaderBg} px-4 py-2 border-b ${theme.cardHeaderBorder} flex items-center justify-between text-xs`}>
        <span className={`${theme.cardText} font-medium flex items-center gap-1.5`}>
          <MonitorPlay size={14} className="animate-pulse" />
          <strong>Tip del Planificador:</strong> Arrastra y suelta turnos para reasociar o modificar horarios. Doble clic para crear turnos rápidamente.
        </span>
        <div className={`flex gap-4 text-[10px] ${theme.cardTextMuted} font-semibold uppercase`}>
          <span className="flex items-center gap-1">🖰 Click simple para editar duración</span>
          <span className="flex items-center gap-1">✥ Arrastrar para ajustar tiempo</span>
        </div>
      </div>

      {/* Search and Filter panel inside the grid */}
      <div className={`${theme.timelineHeaderBg} border-b ${theme.timelineHeaderBorder} px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0`}>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar por nombre en línea de tiempo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={13} />
              </button>
            )}
          </div>
          
          {selectedPersonFilterId && (
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100/60 text-indigo-700 px-2 py-1 rounded-lg font-medium text-[11px] animate-pulse">
              <span>Filtrado por Sidebar</span>
              <button
                onClick={onClearPersonFilter}
                className="hover:bg-indigo-100 hover:text-indigo-900 p-0.5 rounded transition-all"
                title="Quitar filtro de persona"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {viewMode === 'day' && FERIADOS_2026[selectedDate] && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/60 text-amber-850 px-2.5 py-1 rounded-lg font-semibold text-[11px] animate-pulse shadow-sm">
              <span>🎉 Feriado Nacional: <strong>{FERIADOS_2026[selectedDate]}</strong></span>
            </div>
          )}
        </div>

        {/* Status toggle & indicators */}
        <div className="flex items-center gap-4 shrink-0 font-sans text-slate-650 justify-between w-full sm:w-auto">
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold">
            <input
              type="checkbox"
              checked={onlyWithShifts}
              onChange={(e) => setOnlyWithShifts(e.target.checked)}
              className="accent-indigo-600 rounded border-slate-300 focus:ring-indigo-505"
            />
            <span>Solo asignados hoy</span>
          </label>

          <span className="text-slate-250 hidden sm:inline">|</span>

          <span className="text-slate-500 font-bold shrink-0">
            Filas: <strong className="text-slate-800">{activePersons.length}</strong> de <strong className="text-slate-500 font-semibold">{persons.filter((p) => activeArea === 'Todos' || p.area === activeArea).length}</strong>
          </span>
        </div>
      </div>

      {/* Main Timeline View */}
      <div className="flex-1 overflow-auto custom-scrollbar min-h-[400px]">
        <div className="min-w-[980px] flex flex-col">
          
          {/* Hour Scale Title bar */}
          <div className={`flex ${theme.timelineHeaderBg} border-b ${theme.timelineHeaderBorder} sticky top-0 z-20 font-medium ${theme.cardTextMuted} font-sans select-none`}>
            {/* Person Profile Column Header placeholder */}
            <div className={`w-[180px] p-3 text-xs font-bold shrink-0 border-r ${theme.cardBorder}`}>
              Personal / Área
            </div>
            {/* Hour headers column */}
            <div className="flex-1 grid grid-cols-24">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={`col-span-1 py-1.5 text-center border-r ${theme.timelineCellBorder} font-mono text-[10px] flex flex-col justify-between items-center ${theme.timelineHeaderBg}`}
                >
                  <span className={`font-bold ${theme.cardText}`}>{hour.toString().padStart(2, '0')}</span>
                  <span className={`text-[8px] ${theme.cardTextMuted}`}>00</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Persons Rows */}
          <div className="divide-y divide-slate-150 relative">
            {rows.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-slate-100 text-slate-500 rounded-full">
                  <User size={20} />
                </div>
                <div>
                  No hay integrantes que coincidan con la búsqueda o filtros aplicados.
                </div>
                {(searchTerm || onlyWithShifts || selectedPersonFilterId) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setOnlyWithShifts(false);
                      if (onClearPersonFilter) onClearPersonFilter();
                    }}
                    className="mt-2 px-3 py-1 bg-slate-250 hover:bg-slate-350 text-slate-700 text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    Restablecer Filtros
                  </button>
                )}
              </div>
            ) : (
              rows.map((row) => {
                const yesterdayDate = (() => {
                  const d = new Date(row.dateStr + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  return `${yyyy}-${mm}-${dd}`;
                })();

                const todayShifts = activeShiftsQuery.filter(
                  (s) => s.personId === row.person.id && s.date === row.dateStr
                );

                const yesterdayOverflowShifts = activeShiftsQuery.filter(
                  (s) => s.personId === row.person.id && s.date === yesterdayDate && s.startHour + s.duration > 24
                );
                
                const totalHours = todayShifts.reduce((acc, shift) => acc + shift.duration, 0);
                const isOverworked = totalHours > row.person.maxDailyHours;

                return (
                  <div key={row.id} className={`flex relative ${theme.timelineRowHover} border-b ${theme.cardBorder} transition-all group/row min-h-[58px]`}>
                    {/* Person identification column */}
                    <div 
                      className={`w-[185px] p-2 shrink-0 border-r ${theme.cardBorder} ${
                        theme.cardBg === 'bg-white' ? 'bg-white/50' : theme.cardBg
                      } sticky left-0 z-10 flex flex-col justify-center gap-0.5 ${
                        isOverworked ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      <div className={`text-xs font-semibold ${theme.cardText} truncate flex items-center gap-1`}>
                        {row.person.name}
                        {isOverworked && (
                          <span title="Horas excesivas en este día" className="text-rose-500">
                            <AlertTriangle size={13} className="inline animate-bounce" />
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 justify-between text-[9px] ${theme.cardTextMuted}`}>
                        {viewMode === 'day' ? (
                          <span className="font-semibold bg-slate-100 text-slate-600 px-1 rounded">{row.person.area}</span>
                        ) : (
                          <span 
                            title={FERIADOS_2026[row.dateStr] ? `🎉 Feriado Nacional: ${FERIADOS_2026[row.dateStr]}` : undefined}
                            className={`font-bold px-1 rounded-sm uppercase tracking-wide text-[8px] flex items-center gap-0.5 border ${
                              FERIADOS_2026[row.dateStr]
                                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs font-extrabold'
                                : 'text-indigo-700 bg-indigo-50 border-transparent'
                            }`}
                          >
                            {row.dayLabel} {FERIADOS_2026[row.dateStr] ? '🎉' : ''}
                          </span>
                        )}
                        <span className="font-mono">{totalHours > 0 ? `${totalHours} hrs` : 'Sin turno'}</span>
                      </div>
                    </div>

                    {/* Timeline grid cell backdrop */}
                    <div className="flex-1 grid grid-cols-24 relative bg-[#000000]/5">
                      
                      {/* 24 hour slots for droppable coordinates */}
                      {hours.map((hour) => {
                        const isOver = dragOverCell?.personId === row.person.id && dragOverCell?.dateStr === row.dateStr && dragOverCell?.hour === hour;
                        return (
                          <div
                            key={hour}
                            onDragOver={(e) => handleDragOverSlot(e, row.person.id, row.dateStr, hour)}
                            onDrop={(e) => handleDropSlot(e, row.person.id, row.dateStr, hour)}
                            onDoubleClick={() => handleCellDoubleClick(row.person.id, row.dateStr, hour)}
                            className={`col-span-1 border-r ${theme.timelineCellBorder} h-full relative cursor-crosshair transition-all ${
                              isOver ? theme.timelineDragOverBg : ''
                            }`}
                          />
                        );
                      })}

                      {/* Render absolute floating shift bars starting today */}
                      {todayShifts.map((shift) => {
                        // Capping the visual end to 24 hours so it fits the grid row perfectly
                        const displayDuration = Math.min(shift.duration, 24 - shift.startHour);
                        const startPct = (shift.startHour / 24) * 100;
                        const widthPct = (displayDuration / 24) * 100;

                        // Identify color accents via theme
                        const palette = theme.areaColors?.[shift.area] || theme.areaColors?.['Atención'] || {
                          bg: 'bg-[#4f46e5] text-white',
                          ring: 'focus:ring-indigo-300 border-indigo-700',
                          text: 'text-indigo-200',
                          handle: 'bg-indigo-300'
                        };

                        const isOvernight = shift.startHour + shift.duration > 24;

                        return (
                          <div
                            key={shift.id}
                            id={`shift-${shift.id}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, shift.id)}
                            onDragEnd={() => handleDragEnd(shift.id)}
                            className={`absolute top-2 bottom-2 rounded-lg shadow-sm font-sans flex flex-col justify-center px-2 py-1 select-none cursor-grab active:cursor-grabbing border transition-transform duration-100 group/shift hover:-translate-y-0.5 z-10 ${palette.bg} ${
                              isOvernight ? 'border-amber-400 ring-1 ring-amber-300/30' : ''
                            }`}
                            style={{
                              left: `${startPct}%`,
                              width: `${widthPct}%`,
                              minWidth: '40px'
                            }}
                          >
                            {/* Inner shift information line */}
                            <div className="flex items-center justify-between gap-1 w-full overflow-hidden text-[9px] font-bold">
                              <span className="truncate">
                                {formatHour(shift.startHour)} - {formatHour(shift.startHour + shift.duration)}
                              </span>
                              
                              {/* Hover actions */}
                              <div className="opacity-0 group-hover/shift:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity bg-slate-900/80 px-1 py-0.5 rounded ml-1 text-white">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSelectShift(shift); }}
                                  className="p-0.5 hover:text-indigo-200 cursor-pointer"
                                  title="Editar Turno"
                                >
                                  <Edit2 size={9} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDeleteShift(shift.id); }}
                                  className="p-0.5 hover:text-rose-200 cursor-pointer"
                                  title="Borrar Turno"
                                >
                                  <Trash2 size={9} />
                                </button>
                              </div>
                            </div>

                            {/* Resize adjusting handles built inside card */}
                            <div className="flex items-center justify-between w-full mt-0.5 text-[8px] opacity-100 select-none">
                              {/* Quick left/right shifting controls for finer precision */}
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStart = Math.max(0, shift.startHour - 0.5);
                                    onUpdateShift(shift.id, { startHour: nextStart });
                                  }}
                                  className="text-[10px] bg-white/20 hover:bg-white/30 px-0.5 rounded cursor-pointer font-bold select-none text-white"
                                  title="Mover inicio -30 min"
                                >
                                  ‹
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStart = Math.min(23.5, shift.startHour + 0.5);
                                    if (nextStart + shift.duration <= 48) { // allow shifting overnight shifts
                                      onUpdateShift(shift.id, { startHour: nextStart });
                                    }
                                  }}
                                  className="text-[10px] bg-white/20 hover:bg-white/30 px-0.5 rounded cursor-pointer font-bold select-none text-white"
                                  title="Mover inicio +30 min"
                                >
                                  ›
                                </button>
                              </div>

                              <span className={`${palette.text} font-medium tracking-tight text-[8px] flex items-center gap-0.5`}>
                                {shift.duration}h {isOvernight && '🌙'}
                              </span>

                              {/* Duration expanding controls */}
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextDur = Math.max(1, shift.duration - 0.5);
                                    onUpdateShift(shift.id, { duration: nextDur });
                                  }}
                                  className="text-[10px] bg-slate-900/30 hover:bg-slate-900/50 px-0.5 rounded cursor-pointer text-white"
                                  title="Acortar duración -30 min"
                                >
                                  -
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextDur = Math.min(24, shift.duration + 0.5);
                                    onUpdateShift(shift.id, { duration: nextDur });
                                  }}
                                  className="text-[10px] bg-slate-900/30 hover:bg-slate-900/50 px-0.5 rounded cursor-pointer text-white"
                                  title="Extender duración +30 min"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Render absolute floating shift bars starting yesterday that overflow into today */}
                      {yesterdayOverflowShifts.map((shift) => {
                        const displayDuration = shift.startHour + shift.duration - 24;
                        const startPct = 0;
                        const widthPct = (displayDuration / 24) * 100;

                        // Identify color accents via theme
                        const palette = theme.areaColors?.[shift.area] || theme.areaColors?.['Atención'] || {
                          bg: 'bg-[#4f46e5]/80 text-white',
                          ring: 'focus:ring-indigo-300 border-indigo-700',
                          text: 'text-indigo-200',
                          handle: 'bg-indigo-300'
                        };

                        return (
                          <div
                            key={`overflow-${shift.id}`}
                            className={`absolute top-2.5 bottom-2.5 rounded-lg shadow-sm font-sans flex flex-col justify-center px-2 py-1 select-none border border-dashed border-indigo-400 bg-indigo-50/70 text-indigo-800 opacity-80 z-10`}
                            style={{
                              left: `${startPct}%`,
                              width: `${widthPct}%`,
                              minWidth: '40px'
                            }}
                            title={`Turno iniciado el día anterior: ${formatHour(shift.startHour)} a ${formatHour(shift.startHour + shift.duration)}`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full overflow-hidden text-[9px] font-bold">
                              <span className="truncate flex items-center gap-0.5">
                                🌙 (Cont.) 00:00 - {formatHour(shift.startHour + shift.duration)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Scale Footer */}
          <div className="flex bg-slate-50 border-t border-slate-200 font-medium text-slate-500 py-1.5 select-none text-[10px] font-mono sticky bottom-0">
            <div className="w-[180px] px-3 shrink-0" />
            <div className="flex-1 grid grid-cols-24">
              {hours.map((hour) => (
                <span key={hour} className="col-span-1 text-center border-r border-slate-100">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
