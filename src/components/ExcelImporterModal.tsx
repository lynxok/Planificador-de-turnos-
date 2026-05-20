import React, { useState, useRef } from 'react';
import { Person, Shift, Area } from '../types';
import { parseHour, formatHour } from '../utils';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Download, Database, Settings } from 'lucide-react';
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
  'ADMINISTRACION': 'Administración', 'ADMINISTRACIÓN': 'Administración', 'ADMIN': 'Administración', 'FINANZAS': 'Administración'
};

interface ExcelImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: Person[];
  onImportCompleted: (importedPersons: Person[], importedShifts: Shift[]) => void;
  activeArea: Area;
}

interface ParsedTemplateRow {
  index: number;
  rawName: string;
  rawLegajo: string;
  rawIngreso: string;
  rawSalida: string;
  rawDias: string;
  rawArea?: string;
  
  // Computed fields
  cleanName: string;
  cleanLegajo: string;
  startHour: number;
  duration: number;
  daysOfWeek: number[];
  assignedArea: Area;
  warnings: string[];
}

export function ExcelImporterModal({
  isOpen,
  onClose,
  persons,
  onImportCompleted,
  activeArea
}: ExcelImporterModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedTemplateRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successCount, setSuccessCount] = useState({ people: 0, shifts: 0 });
  const [isApplied, setIsApplied] = useState(false);
  
  // Custom states
  const [cleanExistingShifts, setCleanExistingShifts] = useState(false);
  const [cleanExistingPersons, setCleanExistingPersons] = useState(false);
  const [defaultArea, setDefaultArea] = useState<Area>(activeArea);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Keyword parser functions
  const findRowValueByKeywords = (row: Record<string, any>, keywords: string[]): any => {
    const keys = Object.keys(row);
    for (const key of keys) {
      const normalizedKey = key.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
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
    
    if (typeof val === 'number') {
      // Fraction of a day (eg. 0.33333333 for 08:00)
      if (val > 0 && val < 1) {
        const totalSeconds = Math.round(val * 24 * 3600);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
      // Simple integer hour like 8 or 14
      if (val >= 0 && val <= 24) {
        return `${Math.floor(val).toString().padStart(2, '0')}:00`;
      }
    }
    
    const str = String(val).trim();
    const regex = /^(\d{1,2}):(\d{1,2})(:(\d{1,2}))?/;
    const match = str.match(regex);
    if (match) {
      const h = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      return `${h}:${m}`;
    }

    const valNum = parseFloat(str);
    if (!isNaN(valNum) && valNum >= 0 && valNum <= 24) {
      const hours = Math.floor(valNum);
      const minutes = Math.round((valNum - hours) * 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    return str;
  };

  const parseDaysString = (daysStr: string): number[] => {
    if (!daysStr) return [];
    return daysStr
      .split(',')
      .map(d => d.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      )
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

  const parseAreaString = (areaStr: any): Area | null => {
    if (!areaStr) return null;
    const norm = String(areaStr).trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (PARSED_AREAS_MAP[norm]) return PARSED_AREAS_MAP[norm];
    for (const key of Object.keys(PARSED_AREAS_MAP)) {
      if (norm.includes(key)) return PARSED_AREAS_MAP[key];
    }
    return null;
  };

  // Convert files
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

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

        if (rows.length === 0) {
          setErrorMessage('No se encontraron registros en la primera hoja de Excel.');
          return;
        }

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
          
          const startHour = parseHour(timeIngreso);
          const endHour = parseHour(timeSalida);
          
          let duration = endHour - startHour;
          if (duration <= 0 && timeIngreso && timeSalida) {
            duration += 24; // Overnight shifts support
          }
          if (isNaN(duration) || duration <= 0) {
            duration = 8; // Standard 8 hours fallback
          }

          const daysOfWeek = parseDaysString(rawDias);
          const extractedArea = parseAreaString(rawArea);
          const assignedArea = extractedArea || defaultArea;

          // Validity and warnings checking
          const warnings: string[] = [];
          if (!rawName) warnings.push('Nombre ausente (se generó genérico).');
          if (!rawLegajo) warnings.push('Legajo ausente (se generó automático).');
          if (!timeIngreso || !timeSalida) warnings.push('Formato de hora de ingreso/salida inválido, se asumió 08:00 - 16:00.');
          if (daysOfWeek.length === 0) warnings.push('Días no especificados o no coincide con LUNES a DOMINGO.');
          if (duration > 12) warnings.push('El turno supera las 12 horas diarias (Alerta de horas extra).');

          return {
            index: index + 1,
            rawName,
            rawLegajo,
            rawIngreso,
            rawSalida,
            rawDias,
            rawArea,
            cleanName,
            cleanLegajo,
            startHour: isNaN(startHour) ? 8 : startHour,
            duration,
            daysOfWeek,
            assignedArea,
            warnings
          };
        });

        // Check overlaps between rows and with existing database shifts
        for (let i = 0; i < formattedRows.length; i++) {
          const rowA = formattedRows[i];
          const startA = rowA.startHour;
          const endA = rowA.startHour + rowA.duration;
          
          // Check overlap with other rows inside the Excel
          for (let j = 0; j < formattedRows.length; j++) {
            if (i === j) continue;
            const rowB = formattedRows[j];
            
            const matchPerson = 
              (rowA.cleanLegajo && rowB.cleanLegajo && rowA.cleanLegajo.toLowerCase() === rowB.cleanLegajo.toLowerCase()) ||
              (rowA.cleanName && rowB.cleanName && rowA.cleanName.toLowerCase() === rowB.cleanName.toLowerCase());
              
            if (matchPerson) {
              const commonDays = rowA.daysOfWeek.filter(d => rowB.daysOfWeek.includes(d));
              if (commonDays.length > 0) {
                const startB = rowB.startHour;
                const endB = rowB.startHour + rowB.duration;
                if (startA < endB && startB < endA) {
                  rowA.warnings.push(`Se superpone con la fila #${rowB.index} del Excel el mismo día.`);
                  break;
                }
              }
            }
          }

          // Check overlap with existing shifts
          if (!cleanExistingShifts) {
            const existingShifts: Shift[] = (window as any)._allShifts || [];
            const targetPerson = persons.find(
              (p) => (p.legajo && p.legajo.toLowerCase() === rowA.cleanLegajo.toLowerCase()) ||
                     (p.name.toLowerCase() === rowA.cleanName.toLowerCase())
            );
            if (targetPerson) {
              const pShifts = existingShifts.filter(s => s.personId === targetPerson.id);
              for (const s of pShifts) {
                if (rowA.daysOfWeek.includes(s.dayOfWeek)) {
                  const sEnd = s.startHour + s.duration;
                  if (startA < sEnd && s.startHour < endA) {
                    rowA.warnings.push(`Superpone turno actual del sistema (${formatHour(s.startHour)}-${formatHour(sEnd)}).`);
                    break;
                  }
                }
              }
            }
          }
        }

        setParsedRows(formattedRows);
      } catch (err: any) {
        setErrorMessage(`Error al procesar el archivo: ${err?.message || 'Formato incorrecto'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleExcelProcessing(file);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleExcelProcessing(file);
    }
  };

  // Generate Sample spreadsheet template for downloading
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Empleado": "Juan Pérez",
        "Legajo": "L-1011",
        "Horario de ingreso": "08:00",
        "Horario de salida": "16:00",
        "Dias": "LUNES, MIERCOLES, VIERNES",
        "Area": "Atención"
      },
      {
        "Empleado": "Juan Pérez",
        "Legajo": "L-1011",
        "Horario de ingreso": "19:00",
        "Horario de salida": "22:00",
        "Dias": "LUNES",
        "Area": "Atención"
      },
      {
        "Empleado": "María González",
        "Legajo": "L-2033",
        "Horario de ingreso": "09:00",
        "Horario de salida": "17:00",
        "Dias": "MARTES, JUEVES",
        "Area": "Soporte"
      },
      {
        "Empleado": "Carlos Estévez",
        "Legajo": "L-5044",
        "Horario de ingreso": "14:00",
        "Horario de salida": "22:00",
        "Dias": "SABADOS, DOMINGO",
        "Area": "Ventas"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Config_Turnos");
    
    // Auto-fit column widths
    const maxCols = ["Empleado", "Legajo", "Horario de ingreso", "Horario de salida", "Dias", "Area"];
    ws["!cols"] = maxCols.map(() => ({ wch: 22 }));

    XLSX.writeFile(wb, "Plantilla_Importar_Turnos.xlsx");
  };

  // Perform actual database import on confirmation
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    let updatedPersons = cleanExistingPersons ? [] : [...persons];
    const newShifts: Shift[] = [];
    
    let addedPeopleCount = 0;
    let addedShiftsCount = 0;

    // We process each parsed row to locate/create standard Persons and assign shifts
    parsedRows.forEach((row) => {
      // Find matching person
      let targetPerson = updatedPersons.find(
        (p) => p.legajo && p.legajo.trim().toLowerCase() === row.cleanLegajo.trim().toLowerCase()
      );

      if (!targetPerson) {
        targetPerson = updatedPersons.find(
          (p) => p.name.trim().toLowerCase() === row.cleanName.trim().toLowerCase()
        );
      }

      if (targetPerson) {
        // Person already matches!
        // Sync or expand their corporate Legajo and availability ranges if needed
        let availabilityModified = false;
        
        const currentStart = targetPerson.availabilityStart;
        const currentEnd = targetPerson.availabilityEnd;
        const potentialEnd = row.startHour + row.duration;

        const newStart = Math.min(currentStart, row.startHour);
        const newEnd = Math.max(currentEnd, potentialEnd);

        if (newStart !== currentStart || newEnd !== currentEnd) {
          availabilityModified = true;
          targetPerson.availabilityStart = newStart;
          targetPerson.availabilityEnd = Math.min(24, newEnd);
        }

        // Handle max hours update if shift duration is greater
        if (row.duration > targetPerson.maxDailyHours) {
          targetPerson.maxDailyHours = Math.ceil(row.duration);
        }

        if (!targetPerson.legajo) {
          targetPerson.legajo = row.cleanLegajo;
        }
      } else {
        // Create new corporate user
        const newColor = PRESYLED_COLORS[(updatedPersons.length + addedPeopleCount) % PRESYLED_COLORS.length];
        const newId = `p_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        const finishHour = Math.min(24, row.startHour + row.duration);

        const newPersonObj: Person = {
          id: newId,
          name: row.cleanName,
          area: row.assignedArea,
          maxDailyHours: Math.max(8, Math.ceil(row.duration)),
          availabilityStart: Math.floor(row.startHour),
          availabilityEnd: Math.ceil(finishHour),
          color: newColor,
          legajo: row.cleanLegajo
        };

        updatedPersons.push(newPersonObj);
        targetPerson = newPersonObj;
        addedPeopleCount++;
      }

      // Add appropriate shifts for each mapped day of the week
      row.daysOfWeek.forEach((dayNum) => {
        const shiftId = `s_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newShifts.push({
          id: shiftId,
          personId: targetPerson!.id,
          dayOfWeek: dayNum,
          startHour: row.startHour,
          duration: row.duration,
          area: row.assignedArea
        });
        addedShiftsCount++;
      });
    });

    const finalShifts = cleanExistingShifts ? newShifts : [...onClearCompletedFilterShifts(), ...newShifts];

    setSuccessCount({ people: addedPeopleCount, shifts: addedShiftsCount });
    setIsApplied(true);
    
    // Fire callback
    onImportCompleted(updatedPersons, finalShifts);
  };

  // Helper to retrieve shifts NOT cleaned
  const onClearCompletedFilterShifts = (): Shift[] => {
    // Return all shifts normally if not cleaning, otherwise managed cleanly
    return cleanExistingShifts ? [] : (window as any)._allShifts || [];
  };

  const closeDialog = () => {
    onClose();
    // Reset internal state for subsequent imports
    setParsedRows([]);
    setFileName('');
    setErrorMessage('');
    setIsApplied(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-slate-700 animate-scale-up">
        
        {/* Header bar */}
        <div className="px-6 py-4 bg-slate-55 border-b border-rose-50/10 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet size={20} />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 font-sans">
                Asignador de Turnos Masivos por Excel
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Carga un archivo Excel para automatizar la creación de empleados y la asignación de múltiples turnos corporativos.
              </p>
            </div>
          </div>
          <button
            onClick={closeDialog}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Panels Content Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-4 flex items-start gap-2 text-xs font-semibold">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>{errorMessage}</div>
            </div>
          )}

          {isApplied ? (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto my-6">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <Check size={26} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">¡Importación Exitosa!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Se ha actualizado el planificador satisfactoriamente con la configuración del personal.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-white/60 p-3 rounded-xl border border-emerald-100/50 text-xs font-semibold text-slate-650">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Nuevos Empleados</div>
                  <div className="text-emerald-700 text-lg font-bold">{successCount.people}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Turnos Asignados</div>
                  <div className="text-emerald-700 text-lg font-bold">{successCount.shifts}</div>
                </div>
              </div>
              <button
                onClick={closeDialog}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                Aceptar y Volver al Planificador
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Top step uploader / instructions layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Column 1 & 2: Drag/Drop & File selector */}
                <div className="md:col-span-2 space-y-3">
                  <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>1. Carga tu Documento</span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">EXCEL o CSV</span>
                  </div>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50/20' 
                        : fileName
                          ? 'border-emerald-500 bg-emerald-50/10'
                          : 'border-slate-200 hover:border-slate-350 bg-slate-50/30'
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
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                          <FileSpreadsheet size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 break-all">{fileName}</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Archivo listo para procesar. Haz clic para cambiarlo</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full">
                          <Upload size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">Arrastra tu planilla aquí o búscalo en el dispositivo</p>
                          <p className="text-[10px] text-slate-400">Soporta hojas de cálculo en formato excel (.xlsx/xls) o archivos delimitados por coma (.csv)</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Column 3: Format checklist and templates */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Settings size={14} className="text-slate-400" />
                    <span>Requisitos de Columnas</span>
                  </div>
                  
                  <ul className="text-[10px] text-slate-500 space-y-2 font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      <div><strong>Empleado</strong>: Nombre y apellido</div>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      <div><strong>Legajo</strong>: Código corporativo del personal (ej: L-241)</div>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      <div><strong>Horario de ingreso</strong>: "08:00" o "8"</div>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      <div><strong>Horario de salida</strong>: "16:30" o "17"</div>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                      <div><strong>Dias</strong>: "LUNES, MIERCOLES, VIERNES" o "SABADOS, DOMINGO" (separados por comas)</div>
                    </li>
                  </ul>

                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <Download size={13} />
                    <span>Descargar Plantilla Demo</span>
                  </button>
                </div>

              </div>

              {/* Merge / Import Settings Accordion Row */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Área por defecto de nuevos empleados
                  </label>
                  <select
                    value={defaultArea}
                    onChange={(e) => setDefaultArea(e.target.value as Area)}
                    className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 font-semibold focus:outline-none text-xs"
                  >
                    <option value="Atención">Atención (Especial)</option>
                    <option value="Soporte">Soporte</option>
                    <option value="Ventas">Ventas</option>
                    <option value="Administración">Administración</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-600 mt-2">
                    <input
                      type="checkbox"
                      checked={cleanExistingShifts}
                      onChange={(e) => setCleanExistingShifts(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>Reemplazar todos los turnos existentes</span>
                  </label>
                  <span className="text-[10px] text-slate-400 pl-6 mt-0.5">
                    Activa esto si quieres borrar asignaciones previas en el planificador.
                  </span>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-600 mt-2">
                    <input
                      type="checkbox"
                      checked={cleanExistingPersons}
                      onChange={(e) => setCleanExistingPersons(e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                    <span>Limpiar base de datos de personal</span>
                  </label>
                  <span className="text-[10px] text-slate-400 pl-6 mt-0.5">
                    Activa esto para vaciar el personal antes de cargar el Excel.
                  </span>
                </div>

              </div>

              {/* Preview table of Parsed Data */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                    <span>2. Vista Previa de Datos Analizados ({parsedRows.length} registros)</span>
                    <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                      Verifica que los datos coincidan antes de procesar
                    </span>
                  </div>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-150 font-sans select-none">
                        <tr>
                          <th className="p-2.5 pl-4 w-12 text-center">Fila</th>
                          <th className="p-2.5">Colaborador</th>
                          <th className="p-2.5">Legajo</th>
                          <th className="p-2.5">Rango Ingreso/Salida</th>
                          <th className="p-2.5">Días</th>
                          <th className="p-2.5">Área Mapeada</th>
                          <th className="p-2.5 pr-4">Estado / Alertas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {parsedRows.map((row) => (
                          <tr key={row.index} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-center text-slate-400 font-mono font-semibold">{row.index}</td>
                            <td className="p-2.5 font-bold text-slate-800">
                              {row.cleanName}
                              {row.rawName === '' && <span className="text-rose-500 ml-1">(Vacio)</span>}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">{row.cleanLegajo}</td>
                            <td className="p-2.5 font-mono">
                              <span className="font-bold text-slate-700">{formatHour(row.startHour)}</span> a <span className="font-bold text-slate-700">{formatHour(row.startHour + row.duration)}</span> ({row.duration}h)
                            </td>
                            <td className="p-2.5">
                              {row.daysOfWeek.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.daysOfWeek.map((day) => {
                                    const names = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
                                    return (
                                      <span key={day} className="bg-slate-100 text-slate-700 border border-slate-205/50 px-1 py-0.2 rounded text-[9px] font-semibold">
                                        {names[day]}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-rose-500 font-bold">Sin días válidos (omitido)</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-750 border border-indigo-100/50 font-semibold text-[10px]">
                                {row.assignedArea}
                              </span>
                            </td>
                            <td className="p-2.5 pr-4">
                              {row.warnings.length === 0 ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                  <Check size={12} /> Correcto
                                </span>
                              ) : (
                                <div className="text-amber-600 flex flex-col gap-0.5">
                                  {row.warnings.map((w, idx) => (
                                    <span key={idx} className="flex items-center gap-0.5 font-medium text-[9px]">
                                      <AlertCircle size={10} className="shrink-0" /> {w}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Apply Bar */}
              <div className="pt-4 border-t border-slate-150 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <Database size={13} />
                  <span>Se actualizará el almacenamiento persistente del navegador de forma segura.</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={closeDialog}
                    className="px-4 py-2 border border-slate-250 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 cursor-pointer transition-all active:scale-95"
                  >
                    Aceptar
                  </button>
                  <button
                    disabled={parsedRows.length === 0}
                    onClick={handleConfirmImport}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Check size={14} />
                    <span>Confirmar e Importar</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
