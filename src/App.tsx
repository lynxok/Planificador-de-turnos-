import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Person, Shift, Area, TargetCoverage, DemandRecord, AttendanceRecord } from './types';
import { fetchDb, saveDb } from './api';
import { SEEDED_PERSONS, INITIAL_SHIFTS, DEFAULT_TARGETS, DAYS_OF_WEEK } from './seedData';
import { FERIADOS_2026 } from './feriados';
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
import { PersonEditorModal } from './components/PersonEditorModal';
import { ExcelImporterModal } from './components/ExcelImporterModal';
import { DemandCalculatorModal } from './components/DemandCalculatorModal';
import { AttendanceTrackerModal } from './components/AttendanceTrackerModal';
import { ThemeSelector } from './components/ThemeSelector';
import { StaffManagement } from './components/StaffManagement';
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
  ChevronRight,
  Save
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
  const [demand, setDemand] = useState<DemandRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 2. Navigation/View States
  const [activeDate, setActiveDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'analysis' | 'staff'>('day');
  const [activeArea, setActiveArea] = useState<Area>('Atención');
  const [activeTab, setActiveTab] = useState<Area | 'Todos'>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalShift, setModalShift] = useState<Shift | null>(null);
  const [preselectedPersonId, setPreselectedPersonId] = useState<string | undefined>(undefined);
  const [showHelpTooltip, setShowHelpTooltip] = useState(true);
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);
  const [selectedPersonFilterId, setSelectedPersonFilterId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Compute current year and month dynamically based on activeDate state to support infinite navigation
  const dateObj = new Date(activeDate + 'T00:00:00');
  const currentYear = dateObj.getFullYear();
  const currentMonth = dateObj.getMonth();
  
  const activeMonthName = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ][currentMonth];

  // Generate date list dynamically for the current month/year
  const monthDays = useMemo(() => {
    return generateMonthDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);
  const currentDayOfWeek = getDayOfWeekFromDate(activeDate);

  // Filtrar areas dinamicamente: Solo mostrar areas que tengan al menos una persona asignada
  const visibleAreas = areas.filter(area => persons.some(p => p.area === area));
  const activeAreasList = visibleAreas.length > 0 ? visibleAreas : areas;

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

  // Navigations to previous and next days or weeks (dynamic with no calendar boundaries)
  const handlePrev = () => {
    if (viewMode === 'day') {
      const d = new Date(activeDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setActiveDate(`${yyyy}-${mm}-${dd}`);
    } else {
      const d = new Date(activeDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setActiveDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      const d = new Date(activeDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setActiveDate(`${yyyy}-${mm}-${dd}`);
    } else {
      const d = new Date(activeDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setActiveDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const handlePrevMonth = () => {
    const d = new Date(activeDate + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setActiveDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleNextMonth = () => {
    const d = new Date(activeDate + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setActiveDate(`${yyyy}-${mm}-${dd}`);
  };

  // 3. Load & Initialize API
  useEffect(() => {
    fetchDb().then((data) => {
      setPersons(data.persons || []);

      // MIGRATION: Convert old dayOfWeek to date based on activeDate week
      let loadedShifts = data.shifts || [];
      let needsMigration = false;
      loadedShifts = loadedShifts.map((s: any) => {
        if (s.dayOfWeek !== undefined && !s.date) {
          needsMigration = true;
          const baseDates = [
            '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
            '2026-05-22', '2026-05-23', '2026-05-24'
          ];
          const newDate = baseDates[s.dayOfWeek - 1] || '2026-05-18';
          const { dayOfWeek, ...rest } = s;
          return { ...rest, date: newDate };
        }
        return s;
      });
      if (needsMigration) {
        saveDb({ ...data, shifts: loadedShifts });
      }
      setShifts(loadedShifts);
      
      setTargets(data.targets || []);
      
      if (!data.areas || data.areas.length === 0) {
        // Mantenemos las áreas por defecto para que la app no se rompa al buscar una categoría, pero sin empleados.
        const defaultAreas = ['Atención', 'Soporte', 'Ventas', 'Administración'];
        setAreas(defaultAreas);
        saveDb({ areas: defaultAreas });
      } else {
        setAreas(data.areas);
      }

      setDemand(data.demand || []);
      setAttendance(data.attendance || []);
    });
  }, []);

  useEffect(() => {
    (window as any)._allShifts = shifts;
  }, [shifts]);

  // Auto-scroll inside horizontal calendar days carousel to center active day button without vertical side-effects
  useEffect(() => {
    if (carouselRef.current) {
      const activeEl = carouselRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        const timer = setTimeout(() => {
          const container = carouselRef.current;
          if (container) {
            const activeRect = activeEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Calculate target scroll position to center active element horizontally
            const activeCenter = activeRect.left + activeRect.width / 2;
            const containerCenter = containerRect.left + containerRect.width / 2;
            const targetScrollLeft = container.scrollLeft + (activeCenter - containerCenter);
            
            container.scrollTo({
              left: targetScrollLeft,
              behavior: 'smooth'
            });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [activeDate, viewMode, monthDays]);

  // 4. Save updates to API
  const saveToLocalStorage = (newPersons: Person[], newShifts: Shift[], newTargets: TargetCoverage[]) => {
    saveDb({ persons: newPersons, shifts: newShifts, targets: newTargets });
  };

  const handleManualSave = async () => {
    try {
      await saveDb({
        persons,
        shifts,
        targets,
        areas,
        demand,
        attendance
      });
      setHasUnsavedChanges(false);
      alert('¡Planificación guardada exitosamente en la base de datos de Neon Postgres!');
    } catch (error) {
      console.error('Failed manual save', error);
      alert('Ocurrió un error al intentar guardar la planificación en la base de datos.');
    }
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
    setHasUnsavedChanges(true);
    return true;
  };

  const handleDeleteShift = (shiftId: string) => {
    const filtered = shifts.filter((s) => s.id !== shiftId);
    setShifts(filtered);
    saveToLocalStorage(persons, filtered, targets);
    setHasUnsavedChanges(true);
  };

  const handleAddShift = (newShiftData: Omit<Shift, 'id'>): boolean => {
    const newId = 's_' + Date.now();
    const fullNewShift: Shift = {
      ...newShiftData,
      id: newId,
      date: (newShiftData as any).date || activeDate
    };

    const overlap = getOverlappingShift(fullNewShift, shifts);
    if (overlap) {
      alert(`¡Error de superposición! No se puede guardar. Este integrante ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
      return false;
    }

    const updated = [...shifts, fullNewShift];
    setShifts(updated);
    saveToLocalStorage(persons, updated, targets);
    setHasUnsavedChanges(true);
    return true;
  };

  const handleSaveModalShift = (
    shiftObj: Shift | Omit<Shift, 'id'>, 
    replicateDates?: string[],
    replicateWeeks?: string[]
  ) => {
    let success = false;
    let nextShiftsList = [...shifts];

    if ('id' in shiftObj) {
      // Edit mode: let's perform update in our local copy
      const current = nextShiftsList.find(s => s.id === shiftObj.id);
      if (!current) return;
      const candidate: Shift = { ...current, ...shiftObj };
      
      // Check overlap excluding itself
      const overlap = getOverlappingShift(candidate, nextShiftsList.filter(s => s.id !== shiftObj.id));
      if (overlap) {
        alert(`¡Error de superposición! No se puede guardar. Este integrante ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
        return;
      }
      nextShiftsList = nextShiftsList.map(s => s.id === shiftObj.id ? candidate : s);
      success = true;
    } else {
      // Create mode
      const newId = 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const fullNewShift: Shift = {
        ...shiftObj,
        id: newId,
        date: (shiftObj as any).date || activeDate
      } as Shift;
      const overlap = getOverlappingShift(fullNewShift, nextShiftsList);
      if (overlap) {
        alert(`¡Error de superposición! No se puede guardar. Este integrante ya tiene asignado otro turno el mismo día en el rango de ${formatHour(overlap.startHour)} a ${formatHour(overlap.startHour + overlap.duration)}.`);
        return;
      }
      nextShiftsList.push(fullNewShift);
      success = true;
    }

    if (success) {
      const newShiftsToInsert: Shift[] = [];
      let overlapErrors = 0;

      // Pattern of days to replicate: current selected date + any other days checked in same week
      const daysPattern = [shiftObj.date, ...(replicateDates || [])];

      // Get Monday of current week
      const currentWeekDates = getWeekDates(shiftObj.date);
      const currentWeekMonday = currentWeekDates[0];

      // 1. Replicate to selected other weeks (Option b)
      if (replicateWeeks && replicateWeeks.length > 0) {
        replicateWeeks.forEach((targetMonday) => {
          daysPattern.forEach((baseDate) => {
            // Find offset of baseDate from currentWeekMonday
            const baseDateObj = new Date(baseDate + 'T00:00:00');
            const mondayObj = new Date(currentWeekMonday + 'T00:00:00');
            const diffDays = Math.round((baseDateObj.getTime() - mondayObj.getTime()) / 86400000);

            // Calculate target date
            const targetDateObj = new Date(targetMonday + 'T00:00:00');
            targetDateObj.setDate(targetDateObj.getDate() + diffDays);
            const yyyy = targetDateObj.getFullYear();
            const mm = String(targetDateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDateObj.getDate()).padStart(2, '0');
            const targetDateStr = `${yyyy}-${mm}-${dd}`;

            // Make sure we are not duplicating the main saved date or same-week checked dates
            if (targetDateStr !== shiftObj.date && !(replicateDates || []).includes(targetDateStr)) {
              const candidateShift: Omit<Shift, 'id'> = {
                personId: shiftObj.personId,
                date: targetDateStr,
                startHour: shiftObj.startHour,
                duration: shiftObj.duration,
                area: shiftObj.area
              };

              const fullShiftCandidate = {
                ...candidateShift,
                id: 's_temp_' + Math.random()
              };

              if (checkOverlap(fullShiftCandidate, [...nextShiftsList, ...newShiftsToInsert])) {
                overlapErrors++;
              } else {
                newShiftsToInsert.push({
                  ...candidateShift,
                  id: 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
                });
              }
            }
          });
        });
      }

      // 2. Replicate to selected other days of same week (Option a)
      if (replicateDates && replicateDates.length > 0) {
        replicateDates.forEach((rDate) => {
          const candidateShift: Omit<Shift, 'id'> = {
            personId: shiftObj.personId,
            date: rDate,
            startHour: shiftObj.startHour,
            duration: shiftObj.duration,
            area: shiftObj.area
          };

          const fullShiftCandidate = {
            ...candidateShift,
            id: 's_temp_' + Math.random()
          };

          if (checkOverlap(fullShiftCandidate, [...nextShiftsList, ...newShiftsToInsert])) {
            overlapErrors++;
          } else {
            newShiftsToInsert.push({
              ...candidateShift,
              id: 's_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
            });
          }
        });
      }

      const finalCombinedShifts = [...nextShiftsList, ...newShiftsToInsert];
      setShifts(finalCombinedShifts);
      saveToLocalStorage(persons, finalCombinedShifts, targets);
      setHasUnsavedChanges(true);

      if (overlapErrors > 0) {
        alert(`Se guardó el turno y se replicó en los días/semanas libres, pero ${overlapErrors} días fueron omitidos por superposición con turnos existentes.`);
      }
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
    setHasUnsavedChanges(true);
  };

  const handleDeletePersons = (personIds: string[]) => {
    const newPersons = persons.filter(p => !personIds.includes(p.id));
    const newShifts = shifts.filter(s => !personIds.includes(s.personId));
    
    setPersons(newPersons);
    setShifts(newShifts);
    
    if (selectedPersonFilterId && personIds.includes(selectedPersonFilterId)) {
      setSelectedPersonFilterId(null);
    }
    
    saveToLocalStorage(newPersons, newShifts, targets);
    setHasUnsavedChanges(true);
  };

  const saveAreasToLocalStorage = (newAreas: Area[]) => {
    saveDb({ areas: newAreas });
  };
  const saveDemandToDb = (newDemand: DemandRecord[]) => {
    saveDb({ demand: newDemand });
  };
  const saveAttendanceToDb = (newAttendance: AttendanceRecord[]) => {
    saveDb({ attendance: newAttendance });
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
    
    // Switch visual focus to the day we dropped on so the user sees the output
    setActiveDate(targetDate);
  };

  const handleSavePerson = (updatedPerson: Person) => {
    let updated;
    const exists = persons.some(p => p.id === updatedPerson.id);
    if (exists) {
      updated = persons.map(p => p.id === updatedPerson.id ? updatedPerson : p);
    } else {
      updated = [...persons, updatedPerson];
    }
    setPersons(updated);
    
    saveDb({
      persons: updated,
      shifts,
      targets,
      areas,
      demand,
      attendance
    });
    setHasUnsavedChanges(true);
  };

  const handleDeletePersonFromDb = (personId: string) => {
    const updatedPersons = persons.filter(p => p.id !== personId);
    const updatedShifts = shifts.filter(s => s.personId !== personId);
    setPersons(updatedPersons);
    setShifts(updatedShifts);

    saveDb({
      persons: updatedPersons,
      shifts: updatedShifts,
      targets,
      areas,
      demand,
      attendance
    });
    setHasUnsavedChanges(true);
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
      date: activeDate,
      startHour: bestStartHour,
      duration: finalDuration,
      area: person.area
    });
  };

  const handleUpdateTargets = (newHourlyTargets: number[], areaToUpdate: Area = activeArea) => {
    const updated = targets.map((t) => {
      // Update targets matching both selected area AND day of week
      if (t.area === areaToUpdate) {
        return { ...t, hourlyTargets: newHourlyTargets };
      }
      return t;
    });

    // If target doesn't exist for this combination yet, declare it
    const exists = targets.some(t => t.area === areaToUpdate);
    let finalTargets = updated;
    if (!exists) {
      const newTargetObj: TargetCoverage = {
        area: areaToUpdate,
        dayOfWeek: currentDayOfWeek,
        hourlyTargets: newHourlyTargets
      };
      finalTargets = [...targets, newTargetObj];
    }

    setTargets(finalTargets);
    saveToLocalStorage(persons, shifts, finalTargets);
    setHasUnsavedChanges(true);
  };

  const handleSyncDemand = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-demand', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const result = await res.json();
      alert(`¡Sincronización completada con éxito! Se sincronizaron los turnos en Supabase (Días con demanda: ${result.demandCount}).`);
      
      // Refresh the dashboard data
      const data = await fetchDb();
      setPersons(data.persons || []);
      setShifts(data.shifts || []);
      setTargets(data.targets || []);
      setAreas(data.areas || []);
      setDemand(data.demand || []);
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Failed to sync demand', error);
      alert('Ocurrió un error al intentar sincronizar los turnos desde el FTP.');
    } finally {
      setIsSyncing(false);
    }
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
      saveDb({
        persons: SEEDED_PERSONS,
        shifts: INITIAL_SHIFTS,
        targets: DEFAULT_TARGETS,
        areas: defaultAreas
      });
      setHasUnsavedChanges(true);
    }
  };

  // 7. Auto Optimizer/Scheduler helper
  const handleAutoBalanceCoverage = () => {
    // Look at current day & active department. Count deficits.
    const deptTargets = targets.find(t => t.area === activeArea)?.hourlyTargets || Array(24).fill(0);
    const deptShiftsToday = shifts.filter(s => s.date === activeDate && s.area === activeArea);
    const currentCoverage = calculateCoverage(deptShiftsToday, activeArea);

    // Identify people in this area with 0 hours scheduled today
    const idlePeople = persons.filter(p => p.area === activeArea && !shifts.some(s => s.date === activeDate && s.personId === p.id));

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
            date: activeDate,
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
      setHasUnsavedChanges(true);
      alert(`¡Optimización Exitosa! Se asignaron automáticamente ${addedCount} personas inactivas para cubrir picos deficientes.`);
    } else {
      alert(`La cobertura actual para ${activeArea} ya cumple con todos los objetivos o no se detectaron brechas críticas.`);
    }
  };

  const handleCopyWeek = () => {
    const currentWeekDates = getWeekDates(activeDate);
    const currentWeekShifts = shifts.filter(s => currentWeekDates.includes(s.date));
    
    if (currentWeekShifts.length === 0) {
      alert('No hay turnos programados en la semana actual para copiar.');
      return;
    }

    const monDate = new Date(activeDate + 'T00:00:00');
    monDate.setDate(monDate.getDate() + 7);
    const yyyy = monDate.getFullYear();
    const mm = String(monDate.getMonth() + 1).padStart(2, '0');
    const dd = String(monDate.getDate()).padStart(2, '0');
    const nextWeekActiveDate = `${yyyy}-${mm}-${dd}`;
    const nextWeekDates = getWeekDates(nextWeekActiveDate);

    const newShifts = currentWeekShifts.map(s => {
      const idx = currentWeekDates.indexOf(s.date);
      const newDate = nextWeekDates[idx] || nextWeekDates[0];
      return {
        ...s,
        id: `s_copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: newDate
      };
    });

    if (window.confirm(`¿Copiar ${newShifts.length} turnos a la semana del ${nextWeekDates[0]}?`)) {
      const combined = [...shifts, ...newShifts];
      setShifts(combined);
      saveToLocalStorage(persons, combined, targets);
      setHasUnsavedChanges(true);
      alert('¡Semana copiada con éxito! Navega a la próxima semana para ver los cambios.');
    }
  };

  // Fetch target specifications for currently selected combinations
  const activeTargetsObj = targets.find(t => t.area === activeArea) || {
    area: activeArea,
    dayOfWeek: currentDayOfWeek,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 2, 4, 6, 6, 6, 4, 4, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0] // fallbacks
  };

  const admisionTargetsObj = targets.find(t => t.area === 'Admision') || {
    area: 'Admision' as Area,
    dayOfWeek: currentDayOfWeek,
    hourlyTargets: [0, 0, 0, 0, 0, 0, 0, 2, 4, 6, 6, 6, 4, 4, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0]
  };

  // 8. Filter overall shifts representing just the currently active Date
  const activeDayOfWeekShifts = shifts.filter((s) => s.date === activeDate);

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
              Panel interactivo de planificación | {activeMonthName} {currentYear} • {persons.length} Colaboradores
            </p>
          </div>
        </div>

        {/* Global actions: Auto balance and Reset */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md border border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"
              title="Guardar cambios pendientes en la base de datos de Supabase"
            >
              <Save size={14} className="text-white" />
              <span>Guardar Planificación</span>
            </button>
          ) : (
            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors shadow-2xs"
              title="Planificación guardada y sincronizada"
            >
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Sincronizado</span>
            </button>
          )}

          <button
            onClick={handleSyncDemand}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            title="Sincronizar turnos desde la turnera FTP a la base de datos de Supabase"
          >
            <RefreshCw size={14} className={`text-indigo-100 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Turnos'}</span>
          </button>

          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md"
            title="Registrar Presentismo"
          >
            <CheckCircle2 size={14} className="text-blue-100" />
            Presentismo
          </button>

          <button
            onClick={() => setIsDemandModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md"
            title="Calculadora de Demanda"
          >
            <Clock size={14} className="text-orange-100" />
            Demanda
          </button>

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
            onClick={handleCopyWeek}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 active:scale-95 transition-all text-white rounded-lg cursor-pointer shadow-md"
            title="Copiar toda la programación de esta semana a la siguiente"
          >
            {/* Si no tenemos icono Copy, usamos RefreshCw temporalmente o Plus */}
            <span className="font-bold">+</span>
            Copiar Semana
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
          {/* Day / Week / Analysis View Switcher */}
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
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'analysis'
                  ? 'bg-white text-indigo-600 shadow-xs border border-transparent'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Análisis de Turnera
            </button>
            <button
              onClick={() => setViewMode('staff')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'staff'
                  ? 'bg-white text-indigo-600 shadow-xs border border-transparent'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Gestión de Personal
            </button>
          </div>

          {viewMode !== 'analysis' && viewMode !== 'staff' && (
            <>
              <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
                <button
              onClick={handlePrev}
              className="p-1 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title={viewMode === 'day' ? "Día Anterior" : "Semana Anterior"}
            >
              <ChevronLeft size={16} />
              <span>{viewMode === 'day' ? 'Día' : 'Semana'} Ant.</span>
            </button>
            <span className="text-xs font-bold text-slate-600 font-sans px-2 select-none">
              {viewMode === 'day' ? 'Navegación Diaria' : 'Navegación Semanal'}
            </span>
            <button
              onClick={handleNext}
              className="p-1 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title={viewMode === 'day' ? "Día Siguiente" : "Semana Siguiente"}
            >
              <span>{viewMode === 'day' ? 'Día' : 'Semana'} Sig.</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Selector y Navegador de Mes Completo */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 px-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Mes Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            
            <select
              value={`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [yearStr, monthStr] = e.target.value.split('-');
                const y = parseInt(yearStr, 10);
                const m = parseInt(monthStr, 10) - 1;
                const d = new Date(Date.UTC(y, m, 1));
                const yyyy = d.getUTCFullYear();
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(d.getUTCDate()).padStart(2, '0');
                setActiveDate(`${yyyy}-${mm}-${dd}`);
              }}
              className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer mx-1.5"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const monthNames = [
                  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ];
                const monthVal = String(i + 1).padStart(2, '0');
                return (
                  <option key={i} value={`${currentYear}-${monthVal}`}>
                    {monthNames[i]} {currentYear}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 px-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Mes Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>          <span className="text-xs text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-3 py-1 rounded-lg hidden xl:inline font-medium animate-pulse">
            💡 ¡Nuevo! Arrastra un turno y suéltalo en cualquier día del calendario para cambiar su día de asignación.
          </span>
            </>
          )}
        </div>
        {/* Calendar Days Horizon Carousel */}
        {viewMode !== 'analysis' && viewMode !== 'staff' && (
          <div ref={carouselRef} className="flex items-center gap-1.5 max-w-full overflow-x-auto py-1 custom-scrollbar px-1">
          {monthDays.map((day: CalendarDay) => {
            const isSelected = viewMode === 'day'
              ? activeDate === day.dateString
              : getWeekDates(activeDate).includes(day.dateString);
            
            const isWeekFirstDay = viewMode === 'week' && day.dateString === getWeekDates(activeDate)[0];
            const isDraggedOver = draggedOverDate === day.dateString;
            
            const isHoliday = !!FERIADOS_2026[day.dateString];

            let buttonStyles = "bg-slate-50 border-slate-200/60 text-slate-650 hover:bg-slate-200 hover:border-slate-300";
            if (isHoliday && !isSelected && !isDraggedOver) {
              buttonStyles = "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400";
            }
            if (isSelected) {
              if (viewMode === 'day' || isWeekFirstDay) {
                buttonStyles = isHoliday
                  ? "bg-indigo-600 border-amber-400 text-white shadow-md ring-2 ring-amber-300/70 ring-offset-1 -translate-y-0.5 font-bold"
                  : "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200/80 -translate-y-0.5";
              } else {
                buttonStyles = isHoliday
                  ? "bg-amber-50 border-amber-300 text-indigo-700 shadow-sm -translate-y-px font-bold ring-1 ring-amber-300"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs -translate-y-px font-semibold";
              }
            }
            if (isDraggedOver) {
              buttonStyles = "bg-emerald-500 border-emerald-500 text-white scale-105 ring-2 ring-emerald-300 ring-offset-1 shadow-md shadow-emerald-100/90";
            }

            return (
              <button
                key={day.dateString}
                data-active={isSelected}
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
                title={FERIADOS_2026[day.dateString] ? `🎉 Feriado: ${FERIADOS_2026[day.dateString]}` : undefined}
                className={`flex flex-col items-center p-2 rounded-xl text-center min-w-[54px] border transition-all cursor-pointer ${buttonStyles}`}
              >
                <span className={`text-[10px] font-bold ${
                  (viewMode === 'day' && isSelected) || isDraggedOver || isWeekFirstDay
                    ? 'text-indigo-150' 
                    : isSelected                     ? 'text-indigo-400' 
                    : isHoliday
                    ? 'text-amber-500'
                    : 'text-slate-400'
                }`}>
                  {day.label}
                </span>
                <span className="text-base font-extrabold tracking-tight font-sans">
                  {day.dayNum}
                </span>
                {isHoliday && (
                  <span className={`text-[8px] leading-tight font-bold mt-0.5 ${
                    ((viewMode === 'day' && isSelected) || isWeekFirstDay) ? 'text-amber-300' : 'text-amber-500'
                  }`}>🎉</span>
                )}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* 3. Main Operational Panels Container */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden min-h-0">
        {viewMode === 'analysis' ? (
          <div className="flex-1 h-full w-full bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col animate-fade-in">
            <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-slate-700 font-sans">Reporte Estadístico e Histórico Consolidador</span>
              </div>
              <a 
                href="./analisis_turnos.html" 
                target="_blank" 
                rel="noreferrer"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                <span>Abrir en pestaña nueva ↗</span>
              </a>
            </div>
            <iframe 
              src="./analisis_turnos.html" 
              className="flex-1 w-full h-full border-0" 
              title="Análisis de Turnos"
            />
          </div>
        ) : viewMode === 'staff' ? (
          <StaffManagement
            persons={persons}
            areas={areas}
            onAddPerson={() => {
              setEditingPerson({
                id: 'p_new_' + Date.now(),
                name: '',
                area: areas[0] || 'Admision',
                maxDailyHours: 8,
                availabilityStart: 8,
                availabilityEnd: 17,
                color: 'indigo',
                possibleShifts: []
              });
              setIsPersonModalOpen(true);
            }}
            onEditPerson={(person) => {
              setEditingPerson(person);
              setIsPersonModalOpen(true);
            }}
            onDeletePerson={handleDeletePersonFromDb}
            theme={activeTheme}
          />
        ) : (
          <>
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
              setEditingPerson(person);
              setIsPersonModalOpen(true);
            }}
            onDeletePersons={handleDeletePersons}
            areas={activeAreasList}
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
                {['Todos', ...activeAreasList].map((tab) => (
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
                {activeAreasList.map((a) => (
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
              shifts={shifts}
              activeArea="Admision"
              targetCount={admisionTargetsObj.hourlyTargets}
              demand={demand}
              activeDate={activeDate}
              onUpdateTargets={(newTargets) => handleUpdateTargets(newTargets, 'Admision')}
              theme={activeTheme}
              currentDayOfWeek={currentDayOfWeek}
              weekDates={getWeekDates(activeDate)}
              onChangeDate={setActiveDate}
              persons={persons}
              onQuickImport={(importedPersons, importedShifts) => {
                setPersons(importedPersons);
                setShifts(importedShifts);
                saveToLocalStorage(importedPersons, importedShifts, targets);
                setHasUnsavedChanges(true);
              }}
            />
          </div>
        </div>
          </>
        )}
      </div>

      {/* Modals & Popups */}
      <DemandCalculatorModal
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
        demand={demand}
        activeDate={activeDate}
        activeArea="Admision"
        onSaveDemand={(newDemand) => {
          setDemand(newDemand);
          saveDemandToDb(newDemand);
        }}
      />

      <AttendanceTrackerModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        activeDate={activeDate}
        persons={persons}
        shifts={shifts}
        attendance={attendance}
        onSaveAttendance={(newAttendance) => {
          setAttendance(newAttendance);
          saveAttendanceToDb(newAttendance);
        }}
      />

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
        areas={activeAreasList}
      />

      <ExcelImporterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        persons={persons}
        activeArea={activeArea}
        weekDates={getWeekDates(activeDate)}
        onImportCompleted={(importedPersons, importedShifts) => {
          setPersons(importedPersons);
          setShifts(importedShifts);
          
          // Auto-discover areas
          const newAreas = Array.from(new Set([
             ...areas,
             ...importedPersons.map(p => p.area)
          ]));
          setAreas(newAreas);

          saveDb({
            persons: importedPersons,
            shifts: importedShifts,
            targets: targets,
            areas: newAreas
          });
          setHasUnsavedChanges(true);
          setIsImportModalOpen(false);
        }}
      />

      <PersonEditorModal
        isOpen={isPersonModalOpen}
        onClose={() => {
          setIsPersonModalOpen(false);
          setEditingPerson(null);
        }}
        person={editingPerson}
        onSave={handleSavePerson}
        onDelete={handleDeletePersonFromDb}
        areas={activeAreasList}
      />
    </div>
  );
}
