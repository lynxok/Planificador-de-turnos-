import React from 'react';
import { Person, Shift, AttendanceRecord, AttendanceStatus } from '../types';
import { getDayOfWeekFromDate, formatHour } from '../utils';
import { CheckCircle2, XCircle, Clock, HelpCircle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeDate: string;
  persons: Person[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  onSaveAttendance: (newAttendance: AttendanceRecord[]) => void;
}

export function AttendanceTrackerModal({
  isOpen, onClose, activeDate, persons, shifts, attendance, onSaveAttendance
}: Props) {
  if (!isOpen) return null;

  const currentDayOfWeek = getDayOfWeekFromDate(activeDate);

  // Find all shifts that belong to this day
  const todaysShifts = shifts.filter(s => s.date === activeDate);

  const getAttendanceStatus = (shiftId: string): AttendanceStatus => {
    const record = attendance.find(a => a.shiftId === shiftId && a.dateString === activeDate);
    return record ? record.status : 'pending';
  };

  const handleStatusChange = (shiftId: string, status: AttendanceStatus) => {
    const newAttendance = [...attendance];
    const index = newAttendance.findIndex(a => a.shiftId === shiftId && a.dateString === activeDate);
    if (index >= 0) {
      newAttendance[index].status = status;
    } else {
      newAttendance.push({ shiftId, dateString: activeDate, status });
    }
    onSaveAttendance(newAttendance);
  };

  // Sort shifts by start hour
  todaysShifts.sort((a, b) => a.startHour - b.startHour);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-150 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Control de Presentismo</h2>
              <p className="text-xs text-slate-500 font-medium">
                Lista del personal programado para la fecha: <span className="font-bold text-slate-700">{activeDate}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-0 flex-1 overflow-y-auto custom-scrollbar">
          {todaysShifts.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No hay turnos asignados para este día.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase">Colaborador</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase">Área</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase">Horario</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase">Estado de Asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todaysShifts.map(shift => {
                  const person = persons.find(p => p.id === shift.personId);
                  if (!person) return null;
                  
                  const status = getAttendanceStatus(shift.id);

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-${person.color}-100 text-${person.color}-700 flex items-center justify-center font-bold text-xs`}>
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{person.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{person.legajo || 'Sin legajo'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                          {shift.area}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-600 font-medium">
                        {formatHour(shift.startHour)} - {formatHour(shift.startHour + shift.duration)}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg inline-flex">
                          <button
                            onClick={() => handleStatusChange(shift.id, 'present')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              status === 'present' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 size={14} /> Presente
                          </button>
                          
                          <button
                            onClick={() => handleStatusChange(shift.id, 'late')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              status === 'late' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            <Clock size={14} /> Tarde
                          </button>

                          <button
                            onClick={() => handleStatusChange(shift.id, 'absent')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              status === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            <XCircle size={14} /> Ausente
                          </button>
                          
                          {status === 'pending' && (
                            <div className="px-3 py-1.5 text-xs font-bold text-slate-400 flex items-center gap-1">
                              <HelpCircle size={14} /> Pendiente
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
