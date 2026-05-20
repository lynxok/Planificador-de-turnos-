import React, { useState } from 'react';
import { Area, Shift } from '../types';
import { formatHour, getHourRange, calculateCoverage } from '../utils';
import { TrendingUp, AlertTriangle, CheckCircle, Plus, Minus, Settings2 } from 'lucide-react';
import { AppTheme } from '../themes';

interface CoverageChartProps {
  shifts: Shift[];
  activeArea: Area;
  targetCount: number[]; // 24 numbers
  onUpdateTargets: (newTargets: number[]) => void;
  theme?: AppTheme;
}

export function CoverageChart({
  shifts,
  activeArea,
  targetCount,
  onUpdateTargets,
  theme,
}: CoverageChartProps) {
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const hourRange = getHourRange(0, 23, 1);
  const actualCoverage = calculateCoverage(shifts, activeArea, hourRange);

  // Stats
  let totalDeficitHours = 0;
  let totalSurplusHours = 0;
  let wellCoveredHours = 0;
  let activeWorkingHours = 0;

  hourRange.forEach((hour, idx) => {
    const target = targetCount[idx];
    const actual = actualCoverage[idx];
    
    if (target > 0 || actual > 0) {
      activeWorkingHours++;
      if (actual < target) {
        totalDeficitHours += (target - actual);
      } else if (actual > target) {
        totalSurplusHours += (actual - target);
      } else {
        wellCoveredHours++;
      }
    }
  });

  const percentHealthy = activeWorkingHours > 0 
    ? Math.round((wellCoveredHours / activeWorkingHours) * 100) 
    : 100;

  const handleIncrementTarget = (hourIdx: number) => {
    const updated = [...targetCount];
    updated[hourIdx] = Math.min(20, updated[hourIdx] + 1);
    onUpdateTargets(updated);
  };

  const handleDecrementTarget = (hourIdx: number) => {
    const updated = [...targetCount];
    updated[hourIdx] = Math.max(0, updated[hourIdx] - 1);
    onUpdateTargets(updated);
  };

  return (
    <div className={`${theme?.cardBg || 'bg-slate-900'} ${theme?.cardText || 'text-white'} border ${theme?.cardBorder || 'border-slate-800'} rounded-xl p-5 shadow-md transition-all duration-305`}>
      {/* Header Summary */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b ${theme?.cardHeaderBorder || 'border-slate-800'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className={`text-sm font-bold tracking-tight ${theme?.cardText || 'text-slate-100'} font-sans uppercase`}>
              Monitor de Cobertura de Personal — {activeArea}
            </h3>
          </div>
          <p className={`text-xs ${theme?.cardTextMuted || 'text-slate-400'}`}>
            Compara el personal asignado vs. el objetivo requerido por hora para optimizar el servicio.
          </p>
        </div>

        {/* Coverage stats block */}
        <div className="flex items-center gap-3">
          <div className={`${theme?.cardHeaderBg || 'bg-slate-800/80'} rounded-lg px-2.5 py-1.5 border ${theme?.cardHeaderBorder || 'border-slate-700/50'} flex flex-col items-center`}>
            <span className={`text-[10px] uppercase tracking-wider ${theme?.cardTextMuted || 'text-slate-400'} font-medium`}>Estado</span>
            {totalDeficitHours > 0 ? (
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1 mt-0.5">
                <AlertTriangle size={12} /> {totalDeficitHours} h descubiertas
              </span>
            ) : (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle size={12} /> Cobertura Completa
              </span>
            )}
          </div>
          <div className={`${theme?.cardHeaderBg || 'bg-slate-800/80'} rounded-lg px-2.5 py-1.5 border ${theme?.cardHeaderBorder || 'border-slate-700/50'} flex flex-col items-center`}>
            <span className={`text-[10px] uppercase tracking-wider ${theme?.cardTextMuted || 'text-slate-400'} font-medium`}>Salud</span>
            <span className={`text-xs font-semibold mt-0.5 ${percentHealthy > 75 ? 'text-emerald-400' : percentHealthy > 40 ? 'text-amber-400' : 'text-rose-400'}`}>
              {percentHealthy}% Horas Óptimas
            </span>
          </div>

          <button
            onClick={() => setIsEditingTargets(!isEditingTargets)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
              isEditingTargets 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
                : `${theme?.cardHeaderBg || 'bg-slate-800'} ${theme?.cardHeaderBorder || 'border-slate-700'} ${theme?.cardText || 'text-slate-300'} hover:opacity-85`
            }`}
          >
            <Settings2 size={13} />
            {isEditingTargets ? 'Guardar Objetivos' : 'Ajustar Requisitos'}
          </button>
        </div>
      </div>

      {/* Bar Chart Grid */}
      <div className="relative">
        {/* Background gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between py-5 pointer-events-none opacity-10">
          {[0, 1, 2, 3, 4].map((v) => (
            <div key={v} className="border-b border-dashed border-white w-full text-[10px]" />
          ))}
        </div>

        {/* Chart columns */}
        <div className="grid grid-cols-24 gap-1.5 pt-4 pb-2 items-end min-h-[140px] px-1 relative z-10 overflow-x-auto overflow-y-hidden select-none custom-scrollbar">
          {hourRange.map((hour, idx) => {
            const actual = actualCoverage[idx];
            const target = targetCount[idx];
            const maxVal = Math.max(1, ...actualCoverage, ...targetCount);
            
            // Normalize heights as a percentage of maximum
            const actualPct = (actual / maxVal) * 100;
            const targetPct = (target / maxVal) * 100;

            const isUnderstaffed = actual < target;
            const isOverstaffed = actual > target;
            const isPerfect = actual === target && target > 0;

            let actualBarColor = 'bg-slate-500';
            if (isUnderstaffed) actualBarColor = 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]';
            if (isOverstaffed) actualBarColor = 'bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]';
            if (isPerfect) actualBarColor = 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]';

            return (
              <div key={hour} className="flex flex-col items-center h-full group min-w-[34px]">
                {/* Target tuning buttons */}
                {isEditingTargets ? (
                  <div className="flex flex-col items-center gap-0.5 mb-1.5">
                    <button
                      onClick={() => handleIncrementTarget(idx)}
                      className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer hover:text-white"
                    >
                      <Plus size={10} />
                    </button>
                    <span className="text-[10px] font-bold text-amber-400 font-mono">{target}</span>
                    <button
                      onClick={() => handleDecrementTarget(idx)}
                      className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer hover:text-white"
                      disabled={target === 0}
                    >
                      <Minus size={10} />
                    </button>
                  </div>
                ) : (
                  // Normal hovered stats tooltip
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-slate-800 border border-slate-700 text-slate-100 text-[10px] rounded p-1.5 shadow-xl transition-all pointer-events-none z-50 flex flex-col gap-0.5 whitespace-nowrap">
                    <span className="font-semibold text-slate-300">Hora: {formatHour(hour)}</span>
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${actualBarColor}`} />
                      Asignados: <strong className="text-white">{actual}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Objetivo: <strong className="text-gray-200">{target}</strong>
                    </span>
                    {isUnderstaffed && <span className="text-rose-400 font-semibold">⚠️ Faltan {target - actual} personas</span>}
                    {isOverstaffed && <span className="text-indigo-400 font-semibold">ℹ️ Sobran {actual - target} personas</span>}
                    {isPerfect && <span className="text-emerald-400 font-semibold">✓ Cobertura óptima</span>}
                  </div>
                )}

                {/* Graph bars container */}
                <div className="relative w-full h-[100px] flex items-end justify-center rounded bg-slate-850/40 p-0.5 border border-slate-800/10">
                  {/* Goal layer line/box backdrop */}
                  {target > 0 && (
                    <div
                      style={{ height: `${targetPct}%` }}
                      className="absolute bottom-0 w-full border-t-2 border-slate-400/60 bg-slate-400/5 duration-300 transition-all pointer-events-none rounded-t"
                      title={`Objetivo: ${target} personas`}
                    />
                  )}

                  {/* Actual staffed count bar block */}
                  {actual > 0 && (
                    <div
                      style={{ height: `${actualPct}%` }}
                      className={`w-full ${actualBarColor} rounded-t transition-all duration-500 ease-out z-10 flex items-center justify-center text-[9px] font-bold select-none cursor-default`}
                    >
                      {actual}
                    </div>
                  )}
                </div>

                {/* Hour label */}
                <span className="text-[10px] font-mono text-slate-400 mt-2 font-medium">
                  {hour.toString().padStart(2, '0')}h
                </span>
                
                {/* Difference badge */}
                {!isEditingTargets && (
                  <span className={`text-[9px] font-semibold tracking-tighter mt-1 font-mono px-1 rounded ${
                    isUnderstaffed ? 'text-rose-400 bg-rose-500/10' :
                    isOverstaffed ? 'text-sky-300 bg-indigo-500/10' :
                    target > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600'
                  }`}>
                    {isUnderstaffed ? `-${target - actual}` :
                     isOverstaffed ? `+${actual - target}` :
                     target > 0 ? 'OK' : '-'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 border-t border-slate-800/50 pt-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm" /> Deficiente (Bajo cobertura)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm" /> Óptimo (Cubre requisito)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-indigo-500 shadow-sm" /> Exceso beneficioso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 border-t border-slate-400" /> Línea Requisito Objetivo
        </span>
      </div>
    </div>
  );
}
