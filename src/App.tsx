import React, { useState, useEffect } from 'react';
import { Person, Shift, Area, TargetCoverage } from './types';
import { SEEDED_PERSONS, INITIAL_SHIFTS, DEFAULT_TARGETS, DAYS_OF_WEEK } from './seedData';
import { 
  formatHour, 
  getDayOfWeekFromDate, 
  generateMonthDays, 
  CalendarDay, 
  calculateCoverage,
  checkOverlap,
  getOverlappingShift
} from './utils';

// UI components
import { PeopleSidebar } from './components/PeopleSidebar';
import { TimelineGrid } from './components/TimelineGrid';
import { CoverageChart } from './components/CoverageChart';
import { ShiftEditorModal } from './components/ShiftEditorModal';
import { ExcelImporterModal } from './components/ExcelImporterModal';
import { ThemeSelector } from './components/ThemeSelector';
import { THEMES } from './themes';

// Icons
import { 
  Calendar, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet,
  Undo,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function App() {
  // Theme States
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('cov_active_theme') || 'minimal';
  });
  
  const activeTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];

  const handleSelectTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    localStorage.setItem('cov_active_theme', themeId);
  };

  // 1. Core States
  const [persons, setPersons] = useState<Person[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [targets, setTargets] = useState<TargetCoverage[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // 2. Navigation/View States
  const [activeDate, setActiveDate] = useState('2026-05-18'); // Defaults to Monday May 18, 2026
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [activeArea, setActiveArea] = useState<Area>('Atención');
  const [activeTab, setActiveTab] = useState<Area | 'Todos'>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalShift, setModalShift] = useState<Shift | null>(null);
  const [preselectedPersonId, setPreselectedPersonId] = useState<string | undefined>(undefined);
  const [showHelpTooltip, setShowHelpTooltip] = useState(true);
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);
  const [selectedPersonFilterId, setSelectedPersonFilterId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Generate date list for May 2026
  const monthDays = generateMonthDays(2026, 4); // May (0-based 4)
  const currentDayOfWeek = getDayOfWeekFromDate(activeDate);

  // Helper to get week dates (Monday to Sunday) containing a target date
  const getWeekDates = (dateStr: string): string[] => {
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
  };

  // Navigations to previous and next days or weeks
  const handlePrev = () => {
    if (viewMode === 'day') {
      const currentIndex = monthDays.findIndex(day => day.dateString === activeDate);
      if (currentIndex > 0) {
        setActiveDate(monthDays[currentIndex - 1].dateString);
      }
    } else {
      const currentWeekMon = getWeekDates(activeDate)[0];
      const monDate = new Date(currentWeekMon + 'T00:00:00');
      monDate.setDate(monDate.getDate() - 7);
      const yyyy = monDate.getFullYear();
      const mm = String(monDate.getMonth() + 1).padStart(2, '0');
      const dd = String(monDate.getDate()).padStart(2, '0');
      const targetDate = `${yyyy}-${mm}-${dd}`;
      
      if (monthDays.some(day => day.dateString === targetDate)) {
        setActiveDate(targetDate);
      } else {
        const firstMon = '2026-05-04';
        if (activeDate !== firstMon) {
          setActiveDate(firstMon);
        }
      }
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      const currentIndex = monthDays.findIndex(day => day.dateString === activeDate);
      if (currentIndex >= 0 && currentIndex < monthDays.length - 1) {
        setActiveDate(monthDays[currentIndex + 1].dateString);
      }
    } else {
      const currentWeekMon = getWeekDates(activeDate)[0];
      const monDate = new Date(currentWeekMon + 'T00:00:00');
      monDate.setDate(monDate.getDate() + 7);
      const yyyy = monDate.getFullYear();
      const mm = String(monDate.getMonth() + 1).padStart(2, '0');
      const dd = String(monDate.getDate()).padStart(2, '0');
      const targetDate = `${yyyy}-${mm}-${dd}`;
      
      if (monthDays.some(day => day.dateString === targetDate)) {
        setActiveDate(targetDate);
      } else {
        const lastMon = '2026-05-25';
        if (activeDate !== lastMon) {
          setActiveDate(lastMon);
        }
      }
    }
  };

  // 3. Load & Initialize LocalStorage
  useEffect(() => {
    const savedPersons = localStorage.getItem('cov_persons_v2');
    const savedShifts = localStorage.getItem('cov_shifts_v2');
    const savedTargets = localStorage.getItem('cov_targets_v2');
    const savedAreas = localStorage.getItem('cov_areas_v2');

    if (savedPersons && savedShifts && savedTargets) {
      setPersons(JSON.parse(savedPersons));
      setShifts(JSON.parse(savedShifts));
      setTargets(JSON.parse(savedTargets));
    } else {
      // Seed initial defaults
      setPersons(SEEDED_PERSONS);
      setShifts(INITIAL_SHIFTS);
      setTargets(DEFAULT_TARGETS);
      
      localStorage.setItem('cov_persons_v2', JSON.stringify(SEEDED_PERSONS));
      localStorage.setItem('cov_shifts_v2', JSON.stringify(INITIAL_SHIFTS));
      localStorage.setItem('cov_targets_v2', JSON.stringify(DEFAULT_TARGETS));
    }

    if (savedAreas) {
      setAreas(JSON.parse(savedAreas));
    } else {
      const initialAreas = ['Atención', 'Soporte', 'Ventas', 'Administración'];
      setAreas(initialAreas);
      localStorage.setItem('cov_areas_v2', JSON.stringify(initialAreas));
    }
  }, []);

  useEffect(() => {
    (window as any)._allShifts = shifts;
  }, [shifts]);

  // 4. Save updates to LocalStorage
  const saveToLocalStorage = (newPersons: Person[], newShifts: Shift[], newTargets: TargetCoverage[]) => {
    localStorage.setItem('cov_persons_v2', JSON.stringify(newPersons));
    localStorage.setItem('cov_shifts_v2', JSON.stringify(newShifts));
    localStorage.setItem('cov_targets_v2', JSON.stringify(newTargets));
  };

  // 5. Operations handlers
  const handleUpdateShift = (shiftId: string, updatedFields: Partial<Shift>): boolean => {
    const currentShift = shifts.find((s) => s.id === shiftId);
    if (!currentShift) return false;

    const candidate: Shift = { ...currentShift, ...updatedFields };
    const overlap = getOverlappingShift(candidate, shifts);
    if (overlap) {
      alert(`¡Error de superposición! No se puede guardar. Este integrante ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return false;
    }

    const updated = shifts.map((s) => {
      if (s.id === shiftId) {
        return { ...s, ...updatedFields };
      }
      return s;
    });
    setShifts(updated);
    saveToLocalStorage(persons, updated, targets);
    return true;
  };

  const handleDeleteShift = (shiftId: string) => {
    const filtered = shifts.filter((s) => s.id !== shiftId);
    setShifts(filtered);
    saveToLocalStorage(persons, filtered, targets);
  };

  const handleAddShift = (newShiftData: Omit<Shift, 'id'>): boolean => {
    const newId = 's_' + Date.now();
    const fullNewShift: Shift = {
      ...newShiftData,
      id: newId,
      dayOfWeek: newShiftData.dayOfWeek || currentDayOfWeek
    };

    const overlap = getOverlappingShift(fullNewShift, shifts);
    if (overlap) {
      alert(`¡Error de superposición! No se puede guardar. Este integrante ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return false;
    }

    const updated = [...shifts, fullNewShift];
    setShifts(updated);
    saveToLocalStorage(persons, updated, targets);
    return true;
  };

  const handleSaveModalShift = (shiftObj: Shift | Omit<Shift, 'id'>) => {
    if ('id' in shiftObj) {
      // Edit mode
      handleUpdateShift(shiftObj.id, shiftObj);
    } else {
      // Create mode
      handleAddShift(shiftObj);
    }
  };

  const handleAddPerson = (newPersonFields: Omit<Person, 'id'>) => {
    const newId = 'p_' + Date.now();
    const newPerson: Person = {
      ...newPersonFields,
      id: newId
    };
    const updated = [...persons, newPerson];
    setPersons(updated);
    saveToLocalStorage(updated, shifts, targets);
  };

  const saveAreasToLocalStorage = (newAreas: Area[]) => {
    localStorage.setItem('cov_areas_v2', JSON.stringify(newAreas));
  };

  const handleAddArea = (newAreaName: string): boolean => {
    const trimmed = newAreaName.trim();
    if (!trimmed) return false;
    if (areas.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      alert('¡Error! Esta área ya existe.');
      return false;
    }
    const updatedAreas = [...areas, trimmed];
    setAreas(updatedAreas);
    saveAreasToLocalStorage(updatedAreas);
    return true;
  };

  const handleEditArea = (oldAreaName: string, newAreaName: string): boolean => {
    const trimmedNew = newAreaName.trim();
    if (!trimmedNew || oldAreaName === trimmedNew) return false;
    if (areas.some(a => a.toLowerCase() === trimmedNew.toLowerCase() && a !== oldAreaName)) {
      alert('¡Error! Ya existe otra área con ese nombre.');
      return false;
    }

    // Update areas array
    const updatedAreas = areas.map(a => a === oldAreaName ? trimmedNew : a);
    setAreas(updatedAreas);
    saveAreasToLocalStorage(updatedAreas);

    // Update persons area
    const updatedPersons = persons.map(p => p.area === oldAreaName ? { ...p, area: trimmedNew } : p);
    setPersons(updatedPersons);

    // Update shifts area
    const updatedShifts = shifts.map(s => s.area === oldAreaName ? { ...s, area: trimmedNew } : s);
    setShifts(updatedShifts);

    // Update targets
    const updatedTargets = targets.map(t => t.area === oldAreaName ? { ...t, area: trimmedNew } : t);
    setTargets(updatedTargets);

    // Update dynamic views
    if (activeArea === oldAreaName) setActiveArea(trimmedNew);
    if (activeTab === oldAreaName) setActiveTab(trimmedNew);

    saveToLocalStorage(updatedPersons, updatedShifts, updatedTargets);
    return true;
  };

  const handleDeleteArea = (areaToDelete: string): boolean => {
    if (areas.length <= 1) {
      alert('Debe haber al menos un área de trabajo registrada en el sistema.');
      return false;
    }
    
    const countPeople = persons.filter(p => p.area === areaToDelete).length;
    const countShifts = shifts.filter(s => s.area === areaToDelete).length;
    
    // Choose the first available fallback area that is NOT the deleted area
    const remainingAreas = areas.filter(a => a !== areaToDelete);
    const fallbackArea = remainingAreas[0];
    
    const confirmationMsg = countPeople > 0 || countShifts > 0 
      ? `¿Estás seguro de eliminar el área "${areaToDelete}"? \n` + 
        `Esto afectará a ${countPeople} integrantes y ${countShifts} turnos asignados, \n` +
        `los cuales serán reasignados automáticamente al área "${fallbackArea}".` 
      : `¿Estás seguro de que quieres eliminar el área "${areaToDelete}"?`;

    if (!window.confirm(confirmationMsg)) {
      return false;
    }

    // Update areas array
    setAreas(remainingAreas);
    saveAreasToLocalStorage(remainingAreas);

    // Reassign persons who belong to the deleted area
    const updatedPersons = persons.map(p => p.area === areaToDelete ? { ...p, area: fallbackArea } : p);
    setPersons(updatedPersons);

    // Reassign shifts that exist in that area
    const updatedShifts = shifts.map(s => s.area === areaToDelete ? { ...s, area: fallbackArea } : s);
    setShifts(updatedShifts);

    // Update target coverages
    const updatedTargets = targets.filter(t => t.area !== areaToDelete);
    setTargets(updatedTargets);

    // Update dynamic views
    if (activeArea === areaToDelete) setActiveArea(fallbackArea);
    if (activeTab === areaToDelete) setActiveTab('Todos');

    saveToLocalStorage(updatedPersons, updatedShifts, updatedTargets);
    return true;
  };

  const handleDropShiftOnDate = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDraggedOverDate(null);
    const shiftId = e.dataTransfer.getData('text/plain');
    if (!shiftId) return;

    const targetDayOfWeek = getDayOfWeekFromDate(targetDate);
    
    // Find matching shift
    const currentShift = shifts.find((s) => s.id === shiftId);
    if (!currentShift) return;

    const candidate: Shift = { ...currentShift, dayOfWeek: targetDayOfWeek };
    const overlap = getOverlappingShift(candidate, shifts);
    if (overlap) {
      alert(`¡Error de superposición! No se puede mover el turno a esta fecha. Este integrante ya tiene asignado otro turno ese día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return;
    }

    // Update the shift's dayOfWeek
    const updated = shifts.map((s) => {
      if (s.id === shiftId) {
        return { ...s, dayOfWeek: targetDayOfWeek };
      }
      return s;
    });

    setShifts(updated);
    saveToLocalStorage(persons, updated, targets);
    
    // Switch visual focus to the day we dropped on so the user sees the output
    setActiveDate(targetDate);
  };

  // Quick insertion when clicking plus on sidebar
  const handleQuickAddShift = (personId: string) => {
    const person = persons.find(p => p.id === personId);
    if (!person) return;
    
    // Find first hour where this department has deficient coverage (actual < target)
    const areaTargets = targets.find(t => t.area === person.area)?.hourlyTargets || Array(24).fill(0);
    const hourlyCoverage = calculateCoverage(shifts.filter(s => s.dayOfWeek === currentDayOfWeek), person.area);
    
    let bestStartHour = person.availabilityStart;
    for (let h = person.availabilityStart; h < person.availabilityEnd; h++) {
      if (hourlyCoverage[h] < areaTargets[h]) {
        bestStartHour = h;
        break;
      }
    }

    // Set standard length matching available window up to max hrs
    const possibleDuration = Math.min(person.maxDailyHours, person.availabilityEnd - bestStartHour);
    const finalDuration = possibleDuration > 0 ? possibleDuration : 8;

    handleAddShift({
      personId,
      dayOfWeek: currentDayOfWeek,
      startHour: bestStartHour,
      duration: finalDuration,
      area: person.area
    });
  };

  const handleUpdateTargets = (newHourlyTargets: number[]) => {
    const updated = targets.map((t) => {
      // Update targets matching both selected area AND day of week
      if (t.area === activeArea) {
        return { ...t, hourlyTargets: newHourlyTargets };
      }
      return t;
    });

    // If target doesn't exist for this combination yet, declare it
    const exists = targets.some(t => t.area === activeArea);
    let finalTargets = updated;
    if (!exists) {
      const newTargetObj: TargetCoverage = {
        area: activeArea,
        dayOfWeek: currentDayOfWeek,
        hourlyTargets: newHourlyTargets
      };
      finalTargets = [...targets, newTargetObj];
    }

    setTargets(finalTargets);
    saveToLocalStorage(persons, shifts, finalTargets);
  };

  // 6. Reset to Factory seeds
  const handleResetData = () => {
    if (window.confirm('¿Estás seguro de que quieres restablecer todos los horarios y personas a su estado por defecto?')) {
      const defaultAreas = ['Atención', 'Soporte', 'Ventas', 'Administración'];
      setPersons(SEEDED_PERSONS);
      setShifts(INITIAL_SHIFTS);
      setTargets(DEFAULT_TARGETS);
      setAreas(defaultAreas);
      setActiveArea('Atención');
      setActiveTab('Todos');
      saveToLocalStorage(SEEDED_PERSONS, INITIAL_SHIFTS, DEFAULT_TARGETS);
      localStorage.setItem('cov_areas_v2', JSON.stringify(defaultAreas));
    }
  };

  // 7. Auto Optimizer/Scheduler helper
  const handleAutoBalanceCoverage = () => {
    // Look at current day & active department. Count deficits.
    const deptTargets = targets.find(t => t.area === activeArea)?.hourlyTargets || Array(24).fill(0);
    const deptShiftsToday = shifts.filter(s => s.dayOfWeek === currentDayOfWeek && s.area === activeArea);
    const currentCoverage = calculateCoverage(deptShiftsToday, activeArea);

    // Identify people in this area with 0 hours scheduled today
    const idlePeople = persons.filter(p => p.area === activeArea && !shifts.some(s => s.dayOfWeek === currentDayOfWeek && s.personId === p.id));

    if (idlePeople.length === 0) {
      alert(`No quedan recursos inactivos disponibles de ${activeArea} para auto-asignar hoy. Agrega nuevo personal o libera turnos.`);
      return;
    }

    let addedCount = 0;
    const addedShifts: Shift[] = [];

    // Scan hours for deficits and match with idle citizens
    for (let h = 0; h < 24; h++) {
      const deficit = deptTargets[h] - (currentCoverage[h] + addedShifts.filter(s => h >= s.startHour && h < s.startHour + s.duration).length);
      
      if (deficit > 0 && idlePeople.length > 0) {
        // Assign the next available idle person
        const person = idlePeople.shift();
        if (person) {
          const shiftStart = Math.max(person.availabilityStart, h);
          const shiftDuration = Math.min(person.maxDailyHours, 24 - shiftStart);
          
          addedShifts.push({
            id: 's_auto_' + Date.now() + '_' + addedCount,
            personId: person.id,
            dayOfWeek: currentDayOfWeek,
            startHour: shiftStart,
            duration: shiftDuration,
            area: activeArea
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      const nextShifts = [...shifts, ...addedShifts];
      setShifts(nextShifts);
      saveToLocalStorage(persons, nextShifts, targets);
      alert(`¡Optimización Exitosa! Se asignaron automáticamente ${addedCount} personas inactivas para cubrir picos deficientes.`);
    } else {
      alert(`La cobertura actual para ${activeArea} ya cumple con todos los objetivos o no se detectaron brechas críticas.`);
    }
  };

  // Fetch target specifications for currently selected combinations
  const activeTargetsObj = targets.find(t => t.area === activeArea) || {
    area: activeArea,
    dayOfWeek: currentDayOfWeek,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 2, 4, 6, 6, 6, 4, 4, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0] // fallbacks
  };

  // 8. Filter overall shifts representing just the currently active Day of Week
  const activeDayOfWeekShifts = shifts.filter((s) => s.dayOfWeek === currentDayOfWeek);

  return (
    <div className={`min-h-screen ${activeTheme.bg} transition-colors duration-300 font-sans flex flex-col antialiased`}>
      
      {/* 1. Header Area bar */}
      <header className={`${activeTheme.headerBg} ${activeTheme.headerBorder} ${activeTheme.headerText} px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 sticky top-0 z-45 shrink-0 transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg border border-indigo-500">
            <Calendar size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Planificador de Cobertura de Turnos
            </h1>
            <p className={`text-[11px] ${activeTheme.headerSubtext}`}>
              Panel interactivo de planificación | Mayo 2026 • 43 Colaboradores
            </p>
          </div>
        </div>

        {/* Global actions: Auto balance and Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md"
            title="Importar turnos y empleados de una planilla Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-100" />
            Importar Excel
          </button>

          <button
            onClick={handleAutoBalanceCoverage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer"
            title="Asigna automáticamente personas libres a horas con déficit"
          >
            <Sparkles size={14} className="text-indigo-200 animate-pulse" />
            Auto-Asignar Brechas ({activeArea})
          </button>
          
          <button
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-705 active:scale-95 text-slate-300 border border-slate-700/50 rounded-lg cursor-pointer"
            title="Restaurar base de datos nativa"
          >
            <RefreshCw size={13} />
            Reajustar Valores
          </button>
        </div>
      </header>

      {/* Theme Selector Widget */}
      <div className="px-6 pt-6">
        <ThemeSelector activeThemeId={activeThemeId} onSelectTheme={handleSelectTheme} />
      </div>

      {/* 2. Interactive Month Date Navigator bar */}
      <div className={`${activeTheme.cardBg} ${activeTheme.cardBorder} border-b py-3 px-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 transition-colors duration-300`}>
        <div className="flex flex-wrap items-center gap-4">
          {/* Day / Week View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-white text-indigo-600 shadow-xs border border-transparent'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Vista Diaria
            </button>
            <button
              onClick={() => {
                setViewMode('week');
                const mondayDate = getWeekDates(activeDate)[0];
                setActiveDate(mondayDate);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-indigo-600 shadow-xs border border-transparent'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semana Completa
            </button>
          </div>

          <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
            <button
              onClick={handlePrev}
              disabled={
                viewMode === 'day'
                  ? monthDays.findIndex(day => day.dateString === activeDate) === 0
                  : getWeekDates(activeDate)[0] === '2026-05-04'
              }
              className="p-1 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
              title={viewMode === 'day' ? "Día Anterior" : "Semana Anterior"}
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>
            <span className="text-xs font-bold text-slate-700 uppercase font-mono px-3 select-none">
              {viewMode === 'day' ? 'Mayo 2026' : `Semana del ${getWeekDates(activeDate)[0].split('-')[2]} al ${getWeekDates(activeDate)[6].split('-')[2]} de Mayo 2026`}
            </span>
            <button
              onClick={handleNext}
              disabled={
                viewMode === 'day'
                  ? monthDays.findIndex(day => day.dateString === activeDate) === monthDays.length - 1
                  : getWeekDates(activeDate)[0] === '2026-05-25'
              }
              className="p-1 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
              title={viewMode === 'day' ? "Día Siguiente" : "Semana Siguiente"}
            >
              <span>Siguiente</span>
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-xs text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-3 py-1 rounded-lg hidden xl:inline font-medium animate-pulse">
            💡 ¡Nuevo! Arrastra un turno y suéltalo en cualquier día del calendario para cambiar su día de asignación.
          </span>
        </div>

        {/* Calendar Days Horizon Carousel */}
        <div className="flex items-center gap-1.5 max-w-full overflow-x-auto py-1 custom-scrollbar px-1">
          {monthDays.map((day: CalendarDay) => {
            const isSelected = viewMode === 'day'
              ? activeDate === day.dateString
              : getWeekDates(activeDate).includes(day.dateString);
            
            const isWeekFirstDay = viewMode === 'week' && day.dateString === getWeekDates(activeDate)[0];
            const isDraggedOver = draggedOverDate === day.dateString;
            
            let buttonStyles = "bg-slate-50 border-slate-200/60 text-slate-650 hover:bg-slate-200 hover:border-slate-300";
            if (isSelected) {
              if (viewMode === 'day' || isWeekFirstDay) {
                buttonStyles = "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200/80 -translate-y-0.5";
              } else {
                buttonStyles = "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs -translate-y-px font-semibold";
              }
            }
            if (isDraggedOver) {
              buttonStyles = "bg-emerald-500 border-emerald-500 text-white scale-105 ring-2 ring-emerald-300 ring-offset-1 shadow-md shadow-emerald-100/90";
            }

            return (
              <button
                key={day.dateString}
                onClick={() => {
                  if (viewMode === 'day') {
                    setActiveDate(day.dateString);
                  } else {
                    const mondayOfClicked = getWeekDates(day.dateString)[0];
                    setActiveDate(mondayOfClicked);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedOverDate !== day.dateString) {
                    setDraggedOverDate(day.dateString);
                  }
                }}
                onDragLeave={() => {
                  if (draggedOverDate === day.dateString) {
                    setDraggedOverDate(null);
                  }
                }}
                onDrop={(e) => handleDropShiftOnDate(e, day.dateString)}
                className={`flex flex-col items-center p-2 rounded-xl text-center min-w-[54px] border transition-all cursor-pointer ${buttonStyles}`}
              >
                <span className={`text-[10px] font-bold ${
                  (viewMode === 'day' && isSelected) || isDraggedOver || isWeekFirstDay
                    ? 'text-indigo-150' 
                    : isSelected 
                    ? 'text-indigo-400' 
                    : 'text-slate-400'
                }`}>
                  {day.label}
                </span>
                <span className="text-base font-extrabold tracking-tight font-sans">
                  {day.dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Operational Panels Container */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden min-h-0">
        
        {/* Left column: People sidebar (Manage resources) */}
        <div className="w-full lg:w-[320px] h-[580px] lg:h-auto shrink-0 flex flex-col">
          <PeopleSidebar
            persons={persons}
            shifts={shifts}
            selectedDate={activeDate}
            selectedArea={activeArea}
            onAddPerson={handleAddPerson}
            onQuickAddShift={handleQuickAddShift}
            onSelectPerson={(person) => {
              if (selectedPersonFilterId === person.id) {
                setSelectedPersonFilterId(null);
              } else {
                setSelectedPersonFilterId(person.id);
              }
            }}
            activeFilterPersonId={selectedPersonFilterId}
            onEditPerson={(person) => {
              setPreselectedPersonId(person.id);
              setModalShift(null);
              setIsModalOpen(true);
            }}
            areas={areas}
            onAddArea={handleAddArea}
            onEditArea={handleEditArea}
            onDeleteArea={handleDeleteArea}
            theme={activeTheme}
          />
        </div>

        {/* Right column: Interactive scheduler sheet & coverage graph */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">
          
          {/* Areas Filtering tabs & Timeline controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-150 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 mr-2 uppercase">Filtrar Línea de Tiempo por:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/50">
                {['Todos', ...areas].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab !== 'Todos') {
                        setActiveArea(tab); // sync area requirements focus
                      }
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'Administración' ? 'Admin' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Area Monitor Focus Selector (Active Coverage Chart Target Dept) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Ver Cobertura de:</span>
              <select
                value={activeArea}
                onChange={(e) => {
                  const val = e.target.value as Area;
                  setActiveArea(val);
                }}
                className="text-xs font-bold border border-slate-250 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a === 'Atención' ? 'Atención (Especial)' : a}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setModalShift(null);
                  setPreselectedPersonId(undefined);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all rounded-lg cursor-pointer ml-1"
              >
                + Registrar Turno
              </button>
            </div>
          </div>

          {/* Timeline chart wrapper */}
          <div className="flex-1 min-h-0 flex flex-col">
            <TimelineGrid
              persons={persons}
              shifts={shifts}
              activeArea={activeTab}
              selectedDate={activeDate}
              onUpdateShift={handleUpdateShift}
              onDeleteShift={handleDeleteShift}
              onAddShift={handleAddShift}
              onSelectShift={(shift) => {
                setModalShift(shift);
                setIsModalOpen(true);
              }}
              selectedPersonFilterId={selectedPersonFilterId}
              onClearPersonFilter={() => setSelectedPersonFilterId(null)}
              viewMode={viewMode}
              weekDates={getWeekDates(activeDate)}
              theme={activeTheme}
            />
          </div>

          {/* Bottom stats chart */}
          <div className="shrink-0">
            <CoverageChart
              shifts={activeDayOfWeekShifts}
              activeArea={activeArea}
              targetCount={activeTargetsObj.hourlyTargets}
              onUpdateTargets={handleUpdateTargets}
              theme={activeTheme}
            />
          </div>

        </div>
      </div>

      {/* Modals & Popups */}
      <ShiftEditorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalShift(null);
          setPreselectedPersonId(undefined);
        }}
        shift={modalShift}
        persons={persons}
        shifts={shifts}
        selectedDate={activeDate}
        preselectedPersonId={preselectedPersonId}
        onSave={handleSaveModalShift}
        onDelete={modalShift ? () => handleDeleteShift(modalShift.id) : undefined}
        areas={areas}
      />

      <ExcelImporterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        persons={persons}
        activeArea={activeArea}
        onImportCompleted={(importedPersons, importedShifts) => {
          setPersons(importedPersons);
          setShifts(importedShifts);
          saveToLocalStorage(importedPersons, importedShifts, targets);
          setIsImportModalOpen(false);
        }}
      />
    </div>
  );
}
