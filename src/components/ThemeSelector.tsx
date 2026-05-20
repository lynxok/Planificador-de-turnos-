import React from 'react';
import { Palette } from 'lucide-react';
import { THEMES, AppTheme } from '../themes';

interface ThemeSelectorProps {
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

export function ThemeSelector({ activeThemeId, onSelectTheme }: ThemeSelectorProps) {
  const activeTheme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#d4af37]/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden font-sans text-slate-100 select-none">
      {/* Decorative dark grid backdrop */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="flex items-center gap-2 mb-3 relative z-10">
        <Palette className="text-[#d4af37] w-6 h-6 animate-pulse" />
      </div>

      <h2 className="text-sm font-extrabold tracking-wider text-[#d4af37] uppercase mb-4 relative z-10" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>
        THEME SELECTOR
      </h2>

      {/* Grid container for 8 themes, matches screenshot style with segmented board layout */}
      <div className="border border-slate-350 bg-white grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 rounded-md overflow-hidden shadow-md relative z-10 text-slate-800">
        {THEMES.map((theme, idx) => {
          const isSelected = theme.id === activeThemeId;
          return (
            <button
              key={theme.id}
              onClick={() => onSelectTheme(theme.id)}
              className={`flex flex-col items-center justify-between text-center p-3 transition-colors cursor-pointer border-b md:border-b-0 ${
                idx < THEMES.length - 1 ? 'border-r border-slate-300' : ''
              } ${
                isSelected 
                  ? 'bg-amber-50/70 hover:bg-amber-100/60' 
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              {/* Icon/Emoji */}
              <div className="text-xl mb-1 flex items-center justify-center min-h-[28px]">
                {theme.emoji === '⚡' ? (
                  <span className="text-amber-500 font-bold">⚡</span>
                ) : (
                  <span>{theme.emoji}</span>
                )}
              </div>

              {/* Title */}
              <div className="font-extrabold text-xs text-slate-900 tracking-tight mb-1">
                {theme.name}
              </div>

              {/* Description */}
              <div className="text-[10px] text-slate-500 leading-tight">
                {theme.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* ACTIVE THEME indicators at the bottom */}
      <div className="mt-4 pt-1 relative z-10">
        <div className="text-[11px] font-extrabold uppercase text-slate-400 tracking-widest">
          ACTIVE THEME
        </div>
        <div 
          className="text-base font-extrabold mt-1 tracking-wider transition-all"
          style={{ 
            color: activeTheme.id === 'minimal' ? '#4f46e5' : activeTheme.textPrimary.includes('#') ? activeTheme.textPrimary.match(/#\w+/)?.[0] : '#ffff00',
            fontFamily: activeTheme.fontClass === 'font-potter' ? 'Cinzel, serif' : 'inherit'
          }}
        >
          {activeTheme.name}
        </div>
      </div>
    </div>
  );
}
