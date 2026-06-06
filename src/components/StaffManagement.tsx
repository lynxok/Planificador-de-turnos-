import React, { useState } from 'react';
import { Person, Area } from '../types';
import { getInitials, formatHour } from '../utils';
import { Search, UserPlus, Edit2, Trash2, ShieldAlert, Award, Grid, Clock } from 'lucide-react';

interface StaffManagementProps {
  persons: Person[];
  areas: Area[];
  onAddPerson: () => void;
  onEditPerson: (person: Person) => void;
  onDeletePerson: (personId: string) => void;
  theme: any;
}

export function StaffManagement({
  persons,
  areas,
  onAddPerson,
  onEditPerson,
  onDeletePerson,
  theme,
}: StaffManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('Todas');

  const filteredPersons = persons.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.legajo && p.legajo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesArea = selectedArea === 'Todas' || p.area === selectedArea;
    return matchesSearch && matchesArea;
  });

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  };

  return (
    <div className="flex-1 w-full bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col animate-fade-in p-6">
      
      {/* Header controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 font-sans tracking-tight">
            Gestión y Alta de Personal
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Administra la base de datos de colaboradores conectada en tiempo real a Supabase ({persons.length} registros).
          </p>
        </div>
        
        <button
          onClick={onAddPerson}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-150 transition-all hover:scale-102 active:scale-98 text-xs cursor-pointer"
        >
          <UserPlus size={15} />
          <span>Alta de Colaborador</span>
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-150/60">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Buscar por nombre o número de legajo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-xs text-slate-800"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar Área:</span>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="border border-slate-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="Todas">Todas las Áreas</option>
            {areas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table grid container */}
      <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-250 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider">
              <th className="px-5 py-3.5">Colaborador</th>
              <th className="px-5 py-3.5">Legajo / ID</th>
              <th className="px-5 py-3.5">Área / Depto</th>
              <th className="px-5 py-3.5">Disp. Horaria</th>
              <th className="px-5 py-3.5">Límite Horario</th>
              <th className="px-5 py-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-slate-700 text-xs">
            {filteredPersons.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                  No se encontraron colaboradores que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredPersons.map(p => {
                const colorTheme = colorClasses[p.color] || colorClasses.indigo;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Colaborador */}
                    <td className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border} flex items-center justify-center font-bold text-xs`}>
                        {getInitials(p.name)}
                      </div>
                      <span className="font-bold text-slate-900 font-sans">{p.name}</span>
                    </td>
                    
                    {/* Legajo */}
                    <td className="px-5 py-3">
                      <span className="font-mono bg-slate-100 text-slate-650 px-2.5 py-1 rounded-md border border-slate-200/50 text-[11px] font-bold">
                        {p.legajo || 'Sin Legajo'}
                      </span>
                    </td>
                    
                    {/* Área */}
                    <td className="px-5 py-3 font-semibold flex-row items-center gap-1">
                      <span className="inline-flex items-center gap-1 bg-indigo-50/40 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100/40 font-semibold text-[11px]">
                        <Grid size={11} className="text-indigo-400" />
                        {p.area}
                      </span>
                    </td>
                    
                    {/* Disp. Horaria */}
                    <td className="px-5 py-3 font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {formatHour(p.availabilityStart)} a {formatHour(p.availabilityEnd)}
                      </span>
                    </td>
                    
                    {/* Límite Horario */}
                    <td className="px-5 py-3 font-medium text-slate-600">
                      {p.maxDailyHours} hs / día
                    </td>
                    
                    {/* Acciones */}
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => onEditPerson(p)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          title="Editar Ficha"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente a ${p.name}? Se borrarán todos sus turnos programados.`)) {
                              onDeletePerson(p.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                          title="Eliminar Colaborador"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
