import React, { useEffect, useRef } from 'react';
import { Palette, X } from 'lucide-react';
import { THEMES } from '../themes';

interface ThemeSelectorPopoverProps {
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSelectorPopover({
  activeThemeId,
  onSelectTheme,
  isOpen,
  onClose,
}: ThemeSelectorPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTheme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        ref={popoverRef}
        className="w-full max-w-xl bg-slate-900/90 border border-slate-700/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden font-sans text-slate-100 select-none animate-scale-in"
      >
        {/* Backdrop Grid Effect */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <Palette className="text-indigo-400 w-5 h-5 animate-pulse" />
            <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
              Temas de Personalización
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Cerrar Ajustes"
          >
            <X size={18} />
          </button>
        </div>

        {/* Themes Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
          {THEMES.map((theme) => {
            const isSelected = theme.id === activeThemeId;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
                className={`flex items-center gap-3 text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/25 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                    : 'bg-slate-850/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Emoji Indicator */}
                <div className="text-2xl w-10 h-10 rounded-lg bg-slate-900/80 flex items-center justify-center border border-slate-800">
                  {theme.emoji === '⚡' ? (
                    <span className="text-amber-400 font-bold">⚡</span>
                  ) : (
                    <span>{theme.emoji}</span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white truncate">
                    {theme.name}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {theme.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Theme Footer */}
        <div className="pt-3 border-t border-slate-800 relative z-10 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
              Tema Activo
            </div>
            <div
              className="text-xs font-black tracking-wide transition-all mt-0.5"
              style={{
                color: activeTheme.id === 'minimal' ? '#6366f1' : activeTheme.textPrimary.includes('#') ? activeTheme.textPrimary.match(/#\w+/)?.[0] : '#ffd700',
              }}
            >
              {activeTheme.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-lg transition-all cursor-pointer border border-slate-700"
          >
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
