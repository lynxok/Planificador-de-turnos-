import React, { useState, useMemo, useEffect } from 'react';
import { Person, Shift, Area } from '../types';
import { FERIADOS_2026 } from '../feriados';
import {
  X,
  Printer,
  Calendar,
  Layers,
  Info
} from 'lucide-react';

interface MonthlySectorPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDate: string; // 'YYYY-MM-DD'
  persons: Person[];
  shifts: Shift[];
  areas: Area[];
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

const ABSENCE_AREAS = new Set(['VACACIONES', 'LICENCIA', 'ENFERMEDAD', 'FRANCO', 'FERIADO']);

function isAbsenceAreaName(area?: string): boolean {
  if (!area) return false;
  const upper = area.trim().toUpperCase();
  return ABSENCE_AREAS.has(upper) || upper.includes('VACACIONES') || upper.includes('LICENCIA') || upper.includes('ENFERMEDAD');
}

function normalizeSectorDisplay(rawSector?: string): string {
  const trimmed = (rawSector || 'Sin Sector').trim();
  const norm = trimmed.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm === 'ART' || norm === 'ADMISION ART') return 'ART';
  if (norm === 'ADMISION' || norm === 'ADMISION GENERAL') return 'Admisión';
  if (norm === 'FACTURACION') return 'Facturación';
  if (norm === 'ADMINISTRACION') return 'Administración';
  if (norm === 'KINESIO' || norm === 'KINESIOLOGIA') return 'KINESIO';
  return trimmed;
}

export function MonthlySectorPdfExportModal({
  isOpen,
  onClose,
  activeDate,
  persons,
  shifts,
  areas
}: MonthlySectorPdfExportModalProps) {
  // Initial year and month from activeDate
  const initialDate = useMemo(() => {
    if (activeDate && /^\d{4}-\d{2}-\d{2}$/.test(activeDate)) {
      const parts = activeDate.split('-');
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1 };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [activeDate]);

  const [selectedYear, setSelectedYear] = useState<number>(initialDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.month);
  const [onlyScheduledInMonth, setOnlyScheduledInMonth] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeLicenses, setIncludeLicenses] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setSelectedYear(initialDate.year);
      setSelectedMonth(initialDate.month);
    }
  }, [isOpen, initialDate.year, initialDate.month]);

  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;

  // Map shifts in the selected month by personId
  const monthShiftsByPerson = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach(s => {
      if (s.date.startsWith(monthPrefix)) {
        const arr = map.get(s.personId) || [];
        arr.push(s);
        map.set(s.personId, arr);
      }
    });
    return map;
  }, [shifts, monthPrefix]);

  // Resolve effective sector per person for the selected month:
  // If the person has working shifts in this month, use their dominant working shift area;
  // otherwise fall back to person.subArea or person.area.
  const resolvedPersonSectors = useMemo(() => {
    return persons.map(person => {
      const pShifts = monthShiftsByPerson.get(person.id) || [];
      const workingShifts = pShifts.filter(s => !isAbsenceAreaName(s.area));

      let effectiveSector = normalizeSectorDisplay(person.subArea || person.area);
      if (workingShifts.length > 0) {
        const counts: Record<string, number> = {};
        workingShifts.forEach(ws => {
          const sec = normalizeSectorDisplay(ws.area);
          counts[sec] = (counts[sec] || 0) + 1;
        });
        effectiveSector = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      }

      return {
        person,
        sector: effectiveSector,
        hasAnyShiftInMonth: pShifts.length > 0
      };
    });
  }, [persons, monthShiftsByPerson]);

  const activeEntries = useMemo(() => {
    if (onlyScheduledInMonth) {
      const withShifts = resolvedPersonSectors.filter(e => e.hasAnyShiftInMonth);
      // If nobody has shifts in the selected month yet, show everyone so the user isn't stuck with 0 sectors
      if (withShifts.length > 0) return withShifts;
    }
    return resolvedPersonSectors;
  }, [resolvedPersonSectors, onlyScheduledInMonth]);

  // Available sectors based on resolved personnel
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    activeEntries.forEach(e => set.add(e.sector));
    if (set.size === 0) {
      areas.filter(a => !isAbsenceAreaName(a)).forEach(a => set.add(normalizeSectorDisplay(a)));
    }
    return Array.from(set);
  }, [activeEntries, areas]);

  const [selectedSectors, setSelectedSectors] = useState<string[]>(availableSectors);

  // Sync selectedSectors whenever availableSectors changes (e.g. changing month or filter)
  useEffect(() => {
    setSelectedSectors(availableSectors);
  }, [availableSectors]);

  // Days count in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Array of date info objects for the month
  const monthDaysList = useMemo(() => {
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth, day);
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const holidayName = FERIADOS_2026[dateStr] || null;

      list.push({
        day,
        dateStr,
        dayOfWeek,
        dayLabel: DAY_NAMES_SHORT[dayOfWeek],
        isWeekend,
        holidayName
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  if (!isOpen) return null;

  const handleToggleSector = (sector: string) => {
    if (selectedSectors.includes(sector)) {
      setSelectedSectors(selectedSectors.filter(s => s !== sector));
    } else {
      setSelectedSectors([...selectedSectors, sector]);
    }
  };

  const handleSelectAllSectors = () => setSelectedSectors(availableSectors);
  const handleDeselectAllSectors = () => setSelectedSectors([]);

  // Format a shift for the matrix table cell
  const formatShiftCell = (shift?: Shift) => {
    if (!shift) return { text: '-', color: 'empty', isAbsence: false, hours: 0 };

    const areaUpper = (shift.area || '').toUpperCase();
    if (areaUpper.includes('VACACIONES')) {
      return includeLicenses
        ? { text: 'VAC', color: 'vacaciones', isAbsence: true, hours: 0 }
        : { text: '-', color: 'empty', isAbsence: true, hours: 0 };
    }
    if (areaUpper.includes('ENFERMEDAD')) {
      return includeLicenses
        ? { text: 'ENF', color: 'enfermedad', isAbsence: true, hours: 0 }
        : { text: '-', color: 'empty', isAbsence: true, hours: 0 };
    }
    if (areaUpper.includes('LICENCIA')) {
      return includeLicenses
        ? { text: 'LIC', color: 'licencia', isAbsence: true, hours: 0 }
        : { text: '-', color: 'empty', isAbsence: true, hours: 0 };
    }
    if (areaUpper === 'FRANCO') {
      return includeLicenses
        ? { text: 'F', color: 'franco', isAbsence: true, hours: 0 }
        : { text: '-', color: 'empty', isAbsence: true, hours: 0 };
    }

    // Normal working shift: format startHour and endHour compactly, e.g. 06-14, 14-22, 22-06
    const startH = Math.floor(shift.startHour);
    const startM = Math.round((shift.startHour - startH) * 60);
    const endHourRaw = (shift.startHour + shift.duration) % 24;
    const endH = Math.floor(endHourRaw);
    const endM = Math.round((endHourRaw - endH) * 60);

    const startStr = startM > 0
      ? `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`
      : String(startH).padStart(2, '0');
    const endStr = endM > 0
      ? `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
      : String(endH).padStart(2, '0');

    return {
      text: `${startStr}-${endStr}`,
      color: 'work',
      isAbsence: false,
      hours: shift.duration
    };
  };

  // Execution: Build and trigger Print PDF
  const handlePrintPdf = () => {
    if (selectedSectors.length === 0) {
      alert('Por favor selecciona al menos un sector para exportar.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1250,height=900');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes en tu navegador para generar el PDF.');
      return;
    }

    const monthName = MONTH_NAMES[selectedMonth];
    const generatedDateStr = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const generatedTimeStr = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build pages HTML for each sector
    const sectorsHtml = selectedSectors.map((sectorName, sectorIndex) => {
      const sectorEntries = activeEntries.filter(e => e.sector === sectorName);
      const sectorPersons = sectorEntries.map(e => e.person);

      let sectorTotalHours = 0;
      let sectorTotalShifts = 0;

      const rowsHtml = sectorPersons.map(person => {
        let personTotalHours = 0;
        let personTotalShifts = 0;
        const pShifts = monthShiftsByPerson.get(person.id) || [];

        const cellsHtml = monthDaysList.map(dayInfo => {
          const shift = pShifts.find(s => s.date === dayInfo.dateStr);
          const cell = formatShiftCell(shift);

          if (!cell.isAbsence && cell.hours > 0) {
            personTotalHours += cell.hours;
            personTotalShifts++;
          }

          let cellClass = 'day-cell';
          if (dayInfo.isWeekend) cellClass += ' weekend-cell';
          if (dayInfo.holidayName) cellClass += ' holiday-cell';
          if (cell.color === 'work') cellClass += ' work-shift';
          else if (cell.color === 'vacaciones') cellClass += ' vac-shift';
          else if (cell.color === 'enfermedad') cellClass += ' enf-shift';
          else if (cell.color === 'licencia') cellClass += ' lic-shift';
          else if (cell.color === 'franco') cellClass += ' franco-shift';

          const titleAttr = shift ? `${person.name} (${dayInfo.dateStr}): ${cell.text}` : '';

          return `<td class="${cellClass}" title="${titleAttr}"><span>${cell.text}</span></td>`;
        }).join('');

        sectorTotalHours += personTotalHours;
        sectorTotalShifts += personTotalShifts;

        return `
          <tr>
            <td class="person-cell">
              <div class="person-name">${person.name}</div>
              <div class="person-meta">${person.puesto || (person.legajo ? `Leg. ${person.legajo}` : sectorName)}</div>
            </td>
            ${cellsHtml}
            <td class="total-hours-cell"><strong>${personTotalHours}h</strong></td>
          </tr>
        `;
      }).join('');

      return `
        <div class="sector-page ${sectorIndex < selectedSectors.length - 1 ? 'page-break' : ''}">
          
          <!-- Sector Page Header -->
          <div class="page-header">
            <div class="brand-group">
              <div class="logo-box">ITEO</div>
              <div>
                <h1 class="main-title">SFH ITEO - Sanatorio Fitz Roy</h1>
                <h2 class="sub-title">Planificación y Cronograma Mensual de Horarios por Sector</h2>
              </div>
            </div>
            
            <div class="meta-box">
              <div class="badge-sector">SECTOR: ${sectorName.toUpperCase()}</div>
              <div class="period-text">Período: <strong>${monthName} ${selectedYear}</strong></div>
              <div class="gen-date">Emisión: ${generatedDateStr} - ${generatedTimeStr}</div>
            </div>
          </div>

          <!-- Summary Bar -->
          <div class="summary-bar">
            <span>Dotación Asignada: <strong>${sectorPersons.length} Colaboradores</strong></span>
            <span>Turnos Programados: <strong>${sectorTotalShifts}</strong></span>
            <span>Horas Totales del Sector: <strong>${sectorTotalHours} hrs</strong></span>
            <span class="legend-mini">
              <span class="badge-legend work">00-00 Turno</span>
              ${includeLicenses ? `
                <span class="badge-legend vac">VAC Vacaciones</span>
                <span class="badge-legend enf">ENF Enfermedad</span>
                <span class="badge-legend lic">LIC Licencia</span>
              ` : ''}
            </span>
          </div>

          <!-- Monthly Grid Table -->
          <div class="table-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="col-person">Colaborador</th>
                  ${monthDaysList.map(d => `
                    <th class="col-day ${d.isWeekend ? 'th-weekend' : ''} ${d.holidayName ? 'th-holiday' : ''}" title="${d.holidayName || ''}">
                      <div class="th-day-num">${String(d.day).padStart(2, '0')}</div>
                      <div class="th-day-name">${d.dayLabel}</div>
                    </th>
                  `).join('')}
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sectorPersons.length > 0 ? rowsHtml : `
                  <tr>
                    <td colspan="${daysInMonth + 2}" class="no-data">
                      No hay colaboradores con turnos asignados en el sector ${sectorName} para este período.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- Sector Page Footer / Signatures -->
          ${includeSignatures ? `
            <div class="signatures-box">
              <div class="sig-col">
                <div class="sig-line"></div>
                <div class="sig-title">Firma y Sello Jefatura / Coordinación</div>
                <div class="sig-sub">Sector ${sectorName}</div>
              </div>
              <div class="sig-col">
                <div class="sig-line"></div>
                <div class="sig-title">Firma y Sello RRHH / Adm. Personal</div>
                <div class="sig-sub">Sanatorio Fitz Roy - SFH ITEO</div>
              </div>
            </div>
          ` : ''}

        </div>
      `;
    }).join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Horarios Mensuales por Sector - ${monthName} ${selectedYear}</title>
        <style>
          @page {
            size: landscape;
            margin: 8mm 6mm 8mm 6mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 8px;
          }

          .sector-page {
            padding: 4px;
            margin-bottom: 20px;
          }

          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }

          .brand-group {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .logo-box {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 900;
            font-size: 14px;
            padding: 4px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }

          .main-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            text-transform: uppercase;
          }

          .sub-title {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            margin: 2px 0 0 0;
          }

          .meta-box {
            text-align: right;
          }

          .badge-sector {
            display: inline-block;
            background-color: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            font-size: 11px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            margin-bottom: 2px;
          }

          .period-text {
            font-size: 10px;
            color: #1e293b;
          }

          .gen-date {
            font-size: 8px;
            color: #64748b;
          }

          .summary-bar {
            display: flex;
            align-items: center;
            gap: 16px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 8.5px;
            color: #334155;
            margin-bottom: 8px;
          }

          .legend-mini {
            margin-left: auto;
            display: flex;
            gap: 6px;
          }

          .badge-legend {
            font-size: 7.5px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            border: 1px solid transparent;
          }
          .badge-legend.work { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }
          .badge-legend.vac { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
          .badge-legend.enf { background: #ffe4e6; color: #be123c; border-color: #fecdd3; }
          .badge-legend.lic { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }

          .table-container {
            width: 100%;
            overflow: hidden;
          }

          .matrix-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            table-layout: fixed;
          }

          .matrix-table th, .matrix-table td {
            border: 1px solid #cbd5e1;
            padding: 3px 1px;
            text-align: center;
            vertical-align: middle;
          }

          .col-person {
            width: 145px;
            text-align: left !important;
            padding-left: 5px !important;
            background-color: #f1f5f9;
            font-weight: 700;
          }

          .col-day {
            background-color: #f8fafc;
            width: 25px;
          }

          .th-weekend {
            background-color: #e2e8f0 !important;
          }

          .th-holiday {
            background-color: #fef3c7 !important;
            color: #92400e !important;
          }

          .th-day-num {
            font-size: 8.5px;
            font-weight: 800;
          }

          .th-day-name {
            font-size: 7px;
            color: #64748b;
          }

          .col-total {
            width: 38px;
            background-color: #f1f5f9;
            font-weight: 800;
          }

          .person-cell {
            text-align: left !important;
            padding: 3.5px 5px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background-color: #fafaf9;
          }

          .person-name {
            font-weight: 700;
            font-size: 8.5px;
            color: #0f172a;
          }

          .person-meta {
            font-size: 7px;
            color: #64748b;
          }

          .day-cell {
            font-size: 7px;
            font-weight: 600;
            color: #64748b;
          }

          .weekend-cell {
            background-color: #f8fafc;
          }

          .holiday-cell {
            background-color: #fffbeb;
          }

          .work-shift {
            background-color: #eef2ff !important;
            color: #312e81 !important;
            font-weight: 700 !important;
          }

          .vac-shift {
            background-color: #e0f2fe !important;
            color: #075985 !important;
            font-weight: 800 !important;
          }

          .enf-shift {
            background-color: #ffe4e6 !important;
            color: #9f1239 !important;
            font-weight: 800 !important;
          }

          .lic-shift {
            background-color: #f3e8ff !important;
            color: #581c87 !important;
            font-weight: 800 !important;
          }

          .franco-shift {
            background-color: #f1f5f9 !important;
            color: #475569 !important;
            font-weight: 700 !important;
          }

          .total-hours-cell {
            background-color: #f8fafc;
            color: #1e3a8a;
            font-size: 8.5px;
          }

          .no-data {
            padding: 20px !important;
            color: #94a3b8;
            font-size: 10px;
          }

          .signatures-box {
            display: flex;
            justify-content: space-around;
            margin-top: 25px;
            padding-top: 10px;
            break-inside: avoid;
          }

          .sig-col {
            text-align: center;
            width: 250px;
          }

          .sig-line {
            border-bottom: 1px solid #475569;
            margin-bottom: 5px;
            height: 30px;
          }

          .sig-title {
            font-size: 8.5px;
            font-weight: 700;
            color: #1e293b;
          }

          .sig-sub {
            font-size: 7.5px;
            color: #64748b;
          }

          @media screen {
            body {
              background: #64748b;
              padding: 20px;
            }
            .sector-page {
              background: white;
              max-width: 1350px;
              margin: 0 auto 20px auto;
              padding: 15px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              border-radius: 4px;
            }
          }
        </style>
      </head>
      <body>
        ${sectorsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full max-h-[92vh] flex flex-col my-auto animate-scale-up overflow-hidden text-slate-700">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Printer size={20} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans">
                Exportar Horarios Mensuales por Sector (PDF)
              </h3>
              <p className="text-[11px] text-slate-500">
                Consolida todos los horarios del mes agrupados por sector en un único archivo imprimible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Configuration Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs overscroll-contain">
          
          {/* Período: Mes y Año */}
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
            <label className="block text-indigo-900 font-bold mb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" />
              Período a Exportar:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Mes</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Año</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-indigo-700 mt-2 font-medium">
              📅 {MONTH_NAMES[selectedMonth]} {selectedYear} cuenta con {daysInMonth} días de programación ({activeEntries.length} colaboradores activos).
            </p>
          </div>

          {/* Sectores / Áreas a incluir */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers size={14} className="text-slate-500" />
                Sectores a incluir en el PDF ({selectedSectors.length} de {availableSectors.length}):
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSectors}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllSectors}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Ninguno
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              {availableSectors.map((sector) => {
                const isSelected = selectedSectors.includes(sector);
                const count = activeEntries.filter(e => e.sector === sector).length;
                return (
                  <label
                    key={sector}
                    className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSector(sector)}
                        className="accent-indigo-600 rounded w-3.5 h-3.5"
                      />
                      <span className="text-xs truncate">{sector}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-bold ml-1 shrink-0">
                      {count}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Opciones de Formato */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-white">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Opciones de Presentación
            </span>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyScheduledInMonth}
                onChange={(e) => setOnlyScheduledInMonth(e.target.checked)}
                className="accent-indigo-600 rounded w-4 h-4"
              />
              <span className="text-slate-700 font-medium">
                Mostrar únicamente personal con turnos o licencias asignados en el mes
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="accent-indigo-600 rounded w-4 h-4"
              />
              <span className="text-slate-700 font-medium">
                Incluir cuadro de firmas (Jefatura de Sector y RRHH) al pie de cada página
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeLicenses}
                onChange={(e) => setIncludeLicenses(e.target.checked)}
                className="accent-indigo-600 rounded w-4 h-4"
              />
              <span className="text-slate-700 font-medium">
                Resaltar licencias, vacaciones y francos con badges diferenciados
              </span>
            </label>
          </div>

          {/* Info note */}
          <div className="bg-blue-50/60 border border-blue-200 text-blue-900 rounded-xl p-3 flex items-start gap-2.5 text-[11px] leading-relaxed">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Salto de página inteligente:</strong> Cada sector se imprimirá automáticamente en su propia página con su cabecera y grilla mensual completa, consolidando todos los sectores en <strong>un solo archivo PDF</strong> al presionar imprimir o guardar como PDF en el navegador.
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 font-semibold cursor-pointer active:scale-95 transition-all text-xs"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg shadow-md hover:shadow-indigo-500/20 cursor-pointer transition-all text-xs"
          >
            <Printer size={15} />
            <span>Generar y Guardar PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
}
