import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Person, Shift, Area } from '../types';
import { parseHour, formatHour } from '../utils';
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Download,
  Database,
  Settings,
  Calendar,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  Palmtree
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Constants
const PRESYLED_COLORS = ['indigo', 'emerald', 'sky', 'violet', 'amber', 'rose', 'cyan', 'orange'];

const PARSED_DAYS_MAP: Record<string, number> = {
  'LUNES': 1, 'LUN': 1, 'LUNES ': 1,
  'MARTES': 2, 'MAR': 2,
  'MIERCOLES': 3, 'MIÉRCOLES': 3, 'MIE': 3, 'MIÉ': 3,
  'JUEVES': 4, 'JUE': 4,
  'VIERNES': 5, 'VIE': 5,
  'SABADO': 6, 'SÁBADO': 6, 'SABADOS': 6, 'SÁBADOS': 6, 'SAB': 6, 'SÁB': 6,
  'DOMINGO': 7, 'DOMINGOS': 7, 'DOM': 7
};

const PARSED_AREAS_MAP: Record<string, Area> = {
  'ATENCION': 'Atención', 'ATENCIÓN': 'Atención', 'CUSTOMER SERVICE': 'Atención',
  'SOPORTE': 'Soporte', 'SUPPORT': 'Soporte', 'TECNICO': 'Soporte', 'TÉCNICO': 'Soporte',
  'VENTAS': 'Ventas', 'SALES': 'Ventas', 'COMERCIAL': 'Ventas',
  'ADMINISTRACION': 'Administración', 'ADMINISTRACIÓN': 'Administración', 'ADMIN': 'Administración', 'FINANZAS': 'Administración',
  'ADMISION': 'Admision', 'ADMISIÓN': 'Admision',
  'ART': 'ART',
  'FACTURACION': 'Facturación', 'FACTURACIÓN': 'Facturación'
};

interface ExcelImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: Person[];
  onImportCompleted: (importedPersons: Person[], importedShifts: Shift[]) => void;
  activeArea: Area;
  weekDates: string[];
  activeDate?: string;
  allShifts?: Shift[];
}

interface ParsedTemplateRow {
  index: number;
  rawName: string;
  rawLegajo: string;
  rawIngreso: string;
  rawSalida: string;
  rawDias: string;
  rawArea?: string;
  cleanName: string;
  cleanLegajo: string;
  startHour: number;
  duration: number;
  daysOfWeek: number[];
  assignedArea: Area;
  warnings: string[];
}

interface ParsedMatrixShift {
  excelName: string;
  matchedPersonId: string;
  matchedPersonName: string;
  role: string;
  date: string;
  startHour: number;
  duration: number;
  area: string;
  isLicencia: boolean;
  rawText: string;
}

export function ExcelImporterModal({
  isOpen,
  onClose,
  persons,
  onImportCompleted,
  activeArea,
  weekDates,
  activeDate,
  allShifts = []
}: ExcelImporterModalProps) {
  // Mode: 'matrix' (Monthly RRHH Matrix like Guardias 2026.xlsx) or 'tabular' (Classic Template)
  const [importMode, setImportMode] = useState<'matrix' | 'tabular'>('matrix');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isApplied, setIsApplied] = useState(false);
  const [successCount, setSuccessCount] = useState({ people: 0, shifts: 0, licencias: 0 });

  // Tabular mode states
  const [parsedRows, setParsedRows] = useState<ParsedTemplateRow[]>([]);
  const [cleanExistingShifts, setCleanExistingShifts] = useState(false);
  const [cleanExistingPersons, setCleanExistingPersons] = useState(false);
  const [defaultArea, setDefaultArea] = useState<Area>(activeArea);

  // Matrix mode states
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [personMapping, setPersonMapping] = useState<Record<string, string>>({}); // excelName -> personId
  const [replaceExistingInPeriod, setReplaceExistingInPeriod] = useState<boolean>(true);
  const [importLicencias, setImportLicencias] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fuzzy matching between Excel employee names and System Persons
  const findBestPersonMatch = (rawName: string, systemPersons: Person[]): Person | undefined => {
    if (!rawName) return undefined;
    const norm = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // 1. Exact full name match
    let found = systemPersons.find(p => {
      const pNorm = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return pNorm === norm;
    });
    if (found) return found;

    // 2. Specific known nicknames / aliases for ITEO RRHH
    const knownAliases: Record<string, string> = {
      'carlos': 'dans carlos',
      'brian': 'abalos brian',
      'julian': 'mora rojas julian',
      'juli': 'mora rojas julian',
      'lucas': 'schmidt lucas',
      'guille': 'bravo guillermo',
      'guillermo': 'bravo guillermo',
      'laura': 'terranova laura',
      'nair': 'ramirez nair',
      'fabiana': 'cardoso marcela',
      'fabi': 'cardoso marcela',
      'milena': 'leon sara araceli milena',
      'exequiel': 'grandoli exequiel',
      'maria': 'barreto maria silvia',
      'paula': 'vicentin ortiz maria paula',
      'viviana': 'bergamasco viviana'
    };

    const aliasTarget = knownAliases[norm];
    if (aliasTarget) {
      found = systemPersons.find(p => {
        const pNorm = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return pNorm.includes(aliasTarget);
      });
      if (found) return found;
    }

    // 3. Substring / Token matching
    const candidates = systemPersons.filter(p => {
      const pNorm = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const parts = pNorm.split(/\s+/);
      return parts.some(part => part === norm || (norm.length >= 4 && part.startsWith(norm)) || (norm.length >= 4 && norm.startsWith(part)));
    });

    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      // Prioritize Admision area
      const inAdmision = candidates.find(p => p.area.toLowerCase().includes('admi'));
      return inAdmision || candidates[0];
    }

    return undefined;
  };

  // Helper to parse time strings like "06:00 a 14:00"
  const parseMatrixTime = (timeStr: string): { startHour: number; duration: number } | null => {
    if (!timeStr) return null;
    const clean = timeStr.trim().replace(/\s+/g, ' ');
    const m = clean.match(/(\d{1,2}):(\d{2})\s*[aA]\s*(\d{1,2}):(\d{2})/);
    if (m) {
      const sh = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
      const eh = parseInt(m[3], 10) + parseInt(m[4], 10) / 60;
      const duration = eh >= sh ? eh - sh : (24 - sh) + eh;
      return { startHour: sh, duration };
    }
    return null;
  };

  // Process uploaded Excel file
  const handleExcelProcessing = (file: File) => {
    setFileName(file.name);
    setErrorMessage('');
    setIsApplied(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          setErrorMessage('El libro de Excel está vacío o es inválido.');
          return;
        }

        setWorkbookRef(workbook);

        // Detect if file contains monthly matrix sheets (e.g., 'NOVIEMBRE 2026', 'DICIEMBRE', etc.)
        let monthSheets = workbook.SheetNames.filter(name => {
          const upper = name.toUpperCase();
          const isMonth = /ENERO|FEBR|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE|DIC/i.test(upper);
          const hasYear = /\d{4}/.test(upper);
          return isMonth || (hasYear && !upper.includes('TABLA') && !upper.includes('ROTACION'));
        });

        // If no sheets matched by name, inspect sheet content to see if it is a monthly matrix (>= 4 date columns)
        if (monthSheets.length === 0) {
          for (const sName of workbook.SheetNames) {
            const ws = workbook.Sheets[sName];
            if (!ws) continue;
            const previewData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
            const hasDateRow = previewData.slice(0, 8).some(row => {
              if (!Array.isArray(row)) return false;
              let dateCount = 0;
              for (let c = 2; c < row.length; c++) {
                const cell = row[c];
                if (typeof cell === 'number' && cell > 40000 && cell < 60000) dateCount++;
                else if (typeof cell === 'string' && /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell.trim())) dateCount++;
              }
              return dateCount >= 4;
            });
            if (hasDateRow) {
              monthSheets.push(sName);
            }
          }
        }

        if (monthSheets.length > 0) {
          // Switch to Matrix mode
          setImportMode('matrix');
          setAvailableSheets(monthSheets);

          // Select default sheet based on activeDate or first available
          let defaultSheet = monthSheets[0];
          if (activeDate) {
            const [y, m] = activeDate.split('-');
            const monthNames = [
              'ENERO', 'FEBR', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
              'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
            ];
            const targetMonthName = monthNames[parseInt(m, 10) - 1];
            const matching = monthSheets.find(s => s.toUpperCase().includes(targetMonthName));
            if (matching) defaultSheet = matching;
          }
          setSelectedSheet(defaultSheet);
          buildPersonMappingForSheet(workbook, defaultSheet);
        } else {
          // Tabular classic mode
          setImportMode('tabular');
          processTabularSheet(workbook, workbook.SheetNames[0]);
        }
      } catch (err: any) {
        console.error('Error leyendo el archivo Excel:', err);
        setErrorMessage(`Error al procesar el archivo Excel: ${err.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const buildPersonMappingForSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;
    const sheetData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const initialMapping: Record<string, string> = { ...personMapping };

    // Dynamically find date row index (scan first 8 rows)
    let dateRowIdx = 4;
    for (let r = 0; r < Math.min(sheetData.length, 8); r++) {
      const row = sheetData[r];
      if (!Array.isArray(row)) continue;
      let dCount = 0;
      for (let c = 2; c < row.length; c++) {
        const val = row[c];
        if (typeof val === 'number' && val > 40000 && val < 60000) dCount++;
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim())) dCount++;
      }
      if (dCount >= 4) {
        dateRowIdx = r;
        break;
      }
    }

    // Rows from dateRowIdx + 1 onwards contain employees
    for (let r = dateRowIdx + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (row && row[0] && typeof row[0] === 'string') {
        const rawName = row[0].trim();
        const lower = rawName.toLowerCase();
        if (lower === 'nombre' || lower === 'empleado' || lower === 'lunes' || lower === 'martes' || lower === 'miércoles' || lower === 'miercoles' || lower === 'jueves' || lower === 'viernes' || lower === 'sábado' || lower === 'domingo') continue;
        if (rawName && !initialMapping[rawName]) {
          const matched = findBestPersonMatch(rawName, persons);
          if (matched) {
            initialMapping[rawName] = matched.id;
          }
        }
      }
    }
    setPersonMapping(initialMapping);
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbookRef) {
      buildPersonMappingForSheet(workbookRef, newSheet);
    }
  };

  // Matrix Shifts Calculation
  const matrixCalculation = useMemo(() => {
    if (!workbookRef || !selectedSheet || importMode !== 'matrix') {
      return { shifts: [], licenciasCount: 0, workCount: 0, uniqueDates: [] };
    }

    const ws = workbookRef.Sheets[selectedSheet];
    if (!ws) return { shifts: [], licenciasCount: 0, workCount: 0, uniqueDates: [] };

    const sheetData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    
    // Dynamically locate the date row (scan first 8 rows)
    let dateRowIdx = 4;
    for (let r = 0; r < Math.min(sheetData.length, 8); r++) {
      const row = sheetData[r];
      if (!Array.isArray(row)) continue;
      let dCount = 0;
      for (let c = 2; c < row.length; c++) {
        const val = row[c];
        if (typeof val === 'number' && val > 40000 && val < 60000) dCount++;
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim())) dCount++;
      }
      if (dCount >= 4) {
        dateRowIdx = r;
        break;
      }
    }

    const dateRow = sheetData[dateRowIdx] || [];
    const dates: { col: number; dateStr: string }[] = [];

    for (let c = 2; c < dateRow.length; c++) {
      const cellVal = dateRow[c];
      if (typeof cellVal === 'number' && cellVal > 40000 && cellVal < 60000) {
        const d = XLSX.SSF.parse_date_code(cellVal);
        const dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        dates.push({ col: c, dateStr });
      } else if (typeof cellVal === 'string') {
        const trimmed = cellVal.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          dates.push({ col: c, dateStr: trimmed });
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
          const [d, m, y] = trimmed.split('/');
          dates.push({ col: c, dateStr: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` });
        }
      }
    }

    const shifts: ParsedMatrixShift[] = [];
    let licenciasCount = 0;
    let workCount = 0;

    for (let r = dateRowIdx + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row || !row[0]) continue;
      const excelName = String(row[0]).trim();
      const lower = excelName.toLowerCase();
      if (lower === 'nombre' || lower === 'empleado' || lower === 'lunes' || lower === 'martes' || lower === 'miércoles' || lower === 'miercoles' || lower === 'jueves' || lower === 'viernes' || lower === 'sábado' || lower === 'domingo') continue;

      const role = String(row[1] || 'Admision').trim();
      const personId = personMapping[excelName];
      const person = persons.find(p => p.id === personId);

      if (!personId || !person) continue;

      dates.forEach(({ col, dateStr }) => {
        const cell = row[col];
        if (cell === null || cell === undefined || cell === '') return;
        const text = String(cell).trim();
        const upper = text.toUpperCase();

        // 1. Check for VACACIONES / LICENCIA / ENFERMEDAD / FRANCO
        if (upper.includes('VACACIONES') || upper.includes('LICENCIA') || upper.includes('ENFERMEDAD') || upper === 'FRANCO') {
          if (importLicencias) {
            licenciasCount++;
            let areaLic = 'LICENCIA';
            if (upper.includes('VACACIONES')) areaLic = 'VACACIONES';
            else if (upper.includes('ENFERMEDAD')) areaLic = 'ENFERMEDAD';
            else if (upper === 'FRANCO') areaLic = 'FRANCO';

            shifts.push({
              excelName,
              matchedPersonId: person.id,
              matchedPersonName: person.name,
              role,
              date: dateStr,
              startHour: 0,
              duration: 24,
              area: areaLic,
              isLicencia: true,
              rawText: text
            });
          }
          return;
        }

        // 2. Check for working shift times
        const parsedTime = parseMatrixTime(text);
        if (parsedTime) {
          workCount++;
          const targetArea = role && role !== 'undefined' ? role : person.area;
          shifts.push({
            excelName,
            matchedPersonId: person.id,
            matchedPersonName: person.name,
            role,
            date: dateStr,
            startHour: parsedTime.startHour,
            duration: parsedTime.duration,
            area: targetArea,
            isLicencia: false,
            rawText: text
          });
        }
      });
    }

    const uniqueDates = Array.from(new Set(dates.map(d => d.dateStr))).sort();

    return { shifts, licenciasCount, workCount, uniqueDates };
  }, [workbookRef, selectedSheet, importMode, personMapping, persons, importLicencias]);

  // Tabular mode parser helper
  const processTabularSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { raw: false, defval: '' });

    if (rows.length === 0) {
      setErrorMessage('No se encontraron registros en la hoja de Excel.');
      return;
    }

    const findRowValueByKeywords = (row: Record<string, any>, keywords: string[]): any => {
      const keys = Object.keys(row);
      for (const key of keys) {
        const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const kw of keywords) {
          if (normalizedKey === kw || normalizedKey.includes(kw)) {
            return row[key];
          }
        }
      }
      return undefined;
    };

    const parseExcelTime = (val: any): string => {
      if (val === undefined || val === null || val === '') return '';
      const str = String(val).trim();
      const regex = /^(\d{1,2}):(\d{1,2})(:(\d{1,2}))?/;
      const match = str.match(regex);
      if (match) {
        return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
      }
      return str;
    };

    const parseDaysString = (daysStr: string): number[] => {
      if (!daysStr) return [];
      return daysStr
        .split(',')
        .map(d => d.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
        .map(d => {
          if (PARSED_DAYS_MAP[d]) return PARSED_DAYS_MAP[d];
          if (d.includes('LUN')) return 1;
          if (d.includes('MAR')) return 2;
          if (d.includes('MIE') || d.includes('MIÉ')) return 3;
          if (d.includes('JUE')) return 4;
          if (d.includes('VIE')) return 5;
          if (d.includes('SAB') || d.includes('SÁB')) return 6;
          if (d.includes('DOM')) return 7;
          return null;
        })
        .filter((v): v is number => v !== null);
    };

    const formattedRows: ParsedTemplateRow[] = rows.map((row, index) => {
      const rawName = String(findRowValueByKeywords(row, ['empleado', 'nombre', 'colaborador', 'persona']) || '').trim();
      const rawLegajo = String(findRowValueByKeywords(row, ['legajo', 'id', 'colaborador_id', 'registro', 'nro_legajo']) || '').trim();
      const rawIngreso = String(findRowValueByKeywords(row, ['ingreso', 'entrada', 'desde', 'inicio']) || '').trim();
      const rawSalida = String(findRowValueByKeywords(row, ['salida', 'hasta', 'fin']) || '').trim();
      const rawDias = String(findRowValueByKeywords(row, ['dias', 'jornada', 'semana']) || '').trim();
      const rawArea = String(findRowValueByKeywords(row, ['area', 'departamento', 'sector', 'especialidad']) || '').trim();

      const cleanName = rawName || 'Colaborador Desconocido';
      const cleanLegajo = rawLegajo || `LEG-${1000 + index}`;
      const timeIngreso = parseExcelTime(rawIngreso);
      const timeSalida = parseExcelTime(rawSalida);

      const parsedIngreso = parseHour(timeIngreso);
      const parsedSalida = parseHour(timeSalida);
      const startHour = isNaN(parsedIngreso) ? 8 : parsedIngreso;
      const endHour = isNaN(parsedSalida) ? 17 : parsedSalida;
      const duration = endHour >= startHour ? endHour - startHour : (24 - startHour) + endHour;
      const daysOfWeek = parseDaysString(rawDias).length > 0 ? parseDaysString(rawDias) : [1, 2, 3, 4, 5];

      return {
        index,
        rawName,
        rawLegajo,
        rawIngreso,
        rawSalida,
        rawDias,
        rawArea,
        cleanName,
        cleanLegajo,
        startHour,
        duration,
        daysOfWeek,
        assignedArea: rawArea || defaultArea,
        warnings: []
      };
    });

    setParsedRows(formattedRows);
  };

  // Execution: Commit Matrix Shifts
  const handleApplyMatrixImport = () => {
    if (matrixCalculation.shifts.length === 0) {
      alert('No se detectaron turnos para importar en esta hoja.');
      return;
    }

    const { shifts, uniqueDates } = matrixCalculation;
    const dateSet = new Set(uniqueDates);

    // Filter existing shifts: if replace option is active, remove existing shifts for imported persons on these dates
    let finalShifts = [...allShifts];
    if (replaceExistingInPeriod) {
      const importedPersonIds = new Set(shifts.map(s => s.matchedPersonId));
      finalShifts = finalShifts.filter(s => {
        if (importedPersonIds.has(s.personId) && dateSet.has(s.date)) {
          return false;
        }
        return true;
      });
    }

    // Convert matrix shifts to system Shift objects
    const newShifts: Shift[] = shifts.map((s, idx) => ({
      id: `shift_rrhh_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      personId: s.matchedPersonId,
      date: s.date,
      startHour: s.startHour,
      duration: s.duration,
      area: s.area
    }));

    finalShifts = [...finalShifts, ...newShifts];

    setSuccessCount({
      people: Object.keys(personMapping).filter(k => !!personMapping[k]).length,
      shifts: matrixCalculation.workCount,
      licencias: matrixCalculation.licenciasCount
    });
    setIsApplied(true);

    onImportCompleted(persons, finalShifts);
  };

  // Execution: Commit Tabular Shifts
  const handleApplyTabularImport = () => {
    if (parsedRows.length === 0) return;

    let targetPersons: Person[] = cleanExistingPersons ? [] : [...persons];
    let createdShifts: Shift[] = cleanExistingShifts ? [] : [...allShifts];
    let newPersonsCount = 0;

    parsedRows.forEach((row, idx) => {
      let person = targetPersons.find(p =>
        (row.cleanLegajo && p.legajo === row.cleanLegajo) ||
        (p.name.toLowerCase() === row.cleanName.toLowerCase())
      );

      if (!person) {
        newPersonsCount++;
        const newColor = PRESYLED_COLORS[targetPersons.length % PRESYLED_COLORS.length];
        person = {
          id: `p_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: row.cleanName,
          legajo: row.cleanLegajo,
          area: row.assignedArea,
          maxDailyHours: 8,
          availabilityStart: row.startHour,
          availabilityEnd: Math.min(23, row.startHour + row.duration),
          color: newColor,
          possibleShifts: [{ startHour: row.startHour, duration: row.duration, isPrimary: true }]
        };
        targetPersons.push(person);
      }

      row.daysOfWeek.forEach(dayNumber => {
        const targetDate = weekDates[dayNumber - 1];
        if (!targetDate) return;

        createdShifts.push({
          id: `shift_tab_${Date.now()}_${idx}_${dayNumber}`,
          personId: person!.id,
          date: targetDate,
          startHour: row.startHour,
          duration: row.duration,
          area: row.assignedArea
        });
      });
    });

    setSuccessCount({
      people: newPersonsCount,
      shifts: createdShifts.length,
      licencias: 0
    });
    setIsApplied(true);

    onImportCompleted(targetPersons, createdShifts);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExcelProcessing(e.dataTransfer.files[0]);
    }
  };
  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleExcelProcessing(e.target.files[0]);
    }
  };

  const closeDialog = () => {
    onClose();
    setWorkbookRef(null);
    setAvailableSheets([]);
    setFileName('');
    setErrorMessage('');
    setIsApplied(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col text-slate-200 animate-fade-in">

        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <FileSpreadsheet size={20} />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-white font-sans">
                Importador de Horarios de RRHH & Turnera
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Carga planillas mensuales (ej: Guardias 2026) o plantillas tabulares clásicas para asignar turnos y licencias.
              </p>
            </div>
          </div>
          <button
            onClick={closeDialog}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-3 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setImportMode('matrix')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors cursor-pointer flex items-center gap-2 ${
              importMode === 'matrix'
                ? 'bg-slate-900 border-slate-800 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={14} />
            <span>Planilla Mensual de RRHH (Guardias)</span>
            {availableSheets.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded-md font-mono">
                {availableSheets.length} hojas
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setImportMode('tabular')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors cursor-pointer flex items-center gap-2 ${
              importMode === 'tabular'
                ? 'bg-slate-900 border-slate-800 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Plantilla Tabular Clásica</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-4 flex items-start gap-2.5 text-xs font-semibold">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {isApplied ? (
            /* Success State */
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto my-6">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Check size={26} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">¡Importación Exitosa!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Se ha actualizado el planificador y la base de datos de turnos satisfactoriamente.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-emerald-500/20 text-xs font-semibold">
                <div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wider">Empleados</div>
                  <div className="text-emerald-400 text-lg font-bold">{successCount.people}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wider">Turnos</div>
                  <div className="text-emerald-400 text-lg font-bold">{successCount.shifts}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px] uppercase tracking-wider">Licencias</div>
                  <div className="text-amber-400 text-lg font-bold">{successCount.licencias}</div>
                </div>
              </div>
              <button
                onClick={closeDialog}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-md"
              >
                Aceptar y Volver al Planificador
              </button>
            </div>
          ) : (
            /* File Upload & Preview */
            <div className="space-y-6">

              {/* Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : fileName
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelectChange}
                  className="hidden"
                />

                {fileName ? (
                  <>
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                      <FileSpreadsheet size={22} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white break-all">{fileName}</p>
                      <p className="text-[10px] text-emerald-400 font-medium">Archivo cargado con éxito. Haz clic si deseas cambiarlo.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                      <Upload size={22} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white">Arrastra aquí el archivo Excel (ej: Guardias 2026.xlsx) o haz clic para buscarlo</p>
                      <p className="text-[10px] text-slate-500">Soporta libros con pestañas mensuales de RRHH (Enero a Diciembre) o listas tabulares clásicas.</p>
                    </div>
                  </>
                )}
              </div>

              {/* MATRIX MODE CONFIG & PREVIEW */}
              {importMode === 'matrix' && (
                <div className="space-y-5">
                  {availableSheets.length > 0 ? (
                    <>
                      {/* Sheet Selector Bar */}
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={14} className="text-amber-400" />
                            <span>Pestaña / Mes a Importar:</span>
                          </label>
                          <select
                            value={selectedSheet}
                            onChange={(e) => handleSheetChange(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer"
                          >
                            {availableSheets.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* Counts badges */}
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Clock size={12} />
                            <span>{matrixCalculation.workCount} Turnos</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            <Palmtree size={12} />
                            <span>{matrixCalculation.licenciasCount} Licencias</span>
                          </span>
                        </div>
                      </div>

                      {/* Options checkboxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
                          <input
                            type="checkbox"
                            checked={replaceExistingInPeriod}
                            onChange={(e) => setReplaceExistingInPeriod(e.target.checked)}
                            className="accent-amber-500 rounded cursor-pointer"
                          />
                          <span>Reemplazar turnos previos de estos empleados en las fechas importadas</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
                          <input
                            type="checkbox"
                            checked={importLicencias}
                            onChange={(e) => setImportLicencias(e.target.checked)}
                            className="accent-sky-500 rounded cursor-pointer"
                          />
                          <span>Registrar celdas "VACACIONES" como ausencias de <strong>LICENCIA</strong></span>
                        </label>
                      </div>

                      {/* Person Mapping Table */}
                      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={13} className="text-amber-400" />
                            Mapeo de Colaboradores Detectados ({Object.keys(personMapping).length})
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Verifica o ajusta qué empleado del sistema corresponde a cada nombre de la planilla
                          </span>
                        </div>

                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-850 custom-scrollbar">
                          {Object.keys(personMapping).map(excelName => {
                            const assignedPersonId = personMapping[excelName];
                            return (
                              <div key={excelName} className="px-4 py-2 flex items-center justify-between gap-4 hover:bg-slate-900/50">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-amber-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {excelName}
                                  </span>
                                  <ArrowRight size={12} className="text-slate-500" />
                                </div>

                                <div className="flex-1 max-w-sm">
                                  <select
                                    value={assignedPersonId || ''}
                                    onChange={(e) => {
                                      setPersonMapping({
                                        ...personMapping,
                                        [excelName]: e.target.value
                                      });
                                    }}
                                    className="w-full bg-slate-900 border border-slate-750 text-white font-medium text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">-- No vincular --</option>
                                    {persons.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.area})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Preview Sample Table */}
                      {matrixCalculation.shifts.length > 0 && (
                        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Muestra de Turnos a Importar ({matrixCalculation.shifts.length} registros)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {matrixCalculation.uniqueDates[0]} al {matrixCalculation.uniqueDates[matrixCalculation.uniqueDates.length - 1]}
                            </span>
                          </div>

                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase bg-slate-950/80 sticky top-0">
                                  <th className="px-3 py-2">Colaborador</th>
                                  <th className="px-3 py-2">Fecha</th>
                                  <th className="px-3 py-2">Horario / Estado</th>
                                  <th className="px-3 py-2">Duración</th>
                                  <th className="px-3 py-2">Área / Tipo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850">
                                {matrixCalculation.shifts.slice(0, 15).map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-900/40">
                                    <td className="px-3 py-1.5 font-bold text-white">{s.matchedPersonName}</td>
                                    <td className="px-3 py-1.5 font-mono text-slate-400">{s.date}</td>
                                    <td className="px-3 py-1.5">
                                      {s.isLicencia ? (
                                        <span className="inline-flex items-center gap-1 text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded text-[10px] border border-sky-500/20">
                                          <Palmtree size={10} /> LICENCIA (Vacaciones)
                                        </span>
                                      ) : (
                                        <span className="font-mono text-amber-300 font-bold">{s.rawText}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 font-mono text-slate-400">{s.duration} hs</td>
                                    <td className="px-3 py-1.5 text-slate-400">{s.area}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Commit Button */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleApplyMatrixImport}
                          disabled={matrixCalculation.shifts.length === 0}
                          className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 size={16} />
                          <span>
                            Confirmar e Importar {matrixCalculation.shifts.length} Registros ({matrixCalculation.workCount} Turnos + {matrixCalculation.licenciasCount} Licencias)
                          </span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-500 italic bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 p-6">
                      Carga un archivo Excel con pestañas mensuales de RRHH (ej. Guardias 2026.xlsx) para visualizar las opciones de importación.
                    </div>
                  )}
                </div>
              )}

              {/* TABULAR CLASSIC MODE */}
              {importMode === 'tabular' && (
                <div className="space-y-4">
                  {parsedRows.length > 0 ? (
                    <>
                      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Filas tabulares detectadas ({parsedRows.length})
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase bg-slate-950 sticky top-0">
                                <th className="px-3 py-2">Empleado</th>
                                <th className="px-3 py-2">Legajo</th>
                                <th className="px-3 py-2">Horario</th>
                                <th className="px-3 py-2">Días</th>
                                <th className="px-3 py-2">Área</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {parsedRows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-900/40">
                                  <td className="px-3 py-1.5 font-bold text-white">{r.cleanName}</td>
                                  <td className="px-3 py-1.5 font-mono text-slate-400">{r.cleanLegajo}</td>
                                  <td className="px-3 py-1.5 font-mono text-amber-300">
                                    {formatHour(r.startHour)} a {formatHour(r.startHour + r.duration)}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-400">{r.rawDias || 'Lunes a Viernes'}</td>
                                  <td className="px-3 py-1.5 text-slate-400">{r.assignedArea}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleApplyTabularImport}
                          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 size={16} />
                          <span>Aplicar Importación Tabular</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-500 italic bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 p-6">
                      Arrastra una planilla en formato columnar (Empleado, Legajo, Ingreso, Salida, Días).
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Formato soportado: Planillas de Turnos RRHH (.xlsx) y Archivos Delimitados (.csv)
          </span>
          <button
            type="button"
            onClick={closeDialog}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
