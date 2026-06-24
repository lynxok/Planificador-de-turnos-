import { Area } from './types';

export interface AreaStyle {
  bg: string;
  text: string;
  ring: string;
  handle?: string;
  border?: string;
}

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  emoji: string;
  
  // Font
  fontClass: string;
  
  // Page outer shell
  bg: string;
  textPrimary: string;
  textSecondary: string;
  
  // Header
  headerBg: string;
  headerBorder: string;
  headerText: string;
  headerSubtext: string;
  
  // Buttons
  btnPrimaryBg: string;
  btnPrimaryHover: string;
  btnPrimaryText: string;
  btnPrimaryBorder?: string;

  btnSecondaryBg: string;
  btnSecondaryHover: string;
  btnSecondaryText: string;
  btnSecondaryBorder?: string;
  
  // Cards & Containment
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardTextMuted: string;
  cardHeaderBg: string;
  cardHeaderBorder: string;

  // Timeline Specific
  timelineBg: string;
  timelineHeaderBg: string;
  timelineHeaderBorder: string;
  timelineHeaderText: string;
  timelineCellBorder: string;
  timelineIndicatorBg: string;
  timelineDragOverBg: string;
  timelineRowHover: string;

  // Active theme selector highlight
  themeHighlightText: string;
  
  // Area styling inside timeline and scheduler
  areaColors: Record<Area, AreaStyle>;
}

export const THEMES: AppTheme[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple',
    emoji: '🔲',
    fontClass: 'font-sans',
    bg: 'bg-slate-50',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-500',
    headerBg: 'bg-slate-900',
    headerBorder: 'border-slate-800',
    headerText: 'text-white',
    headerSubtext: 'text-slate-400',
    btnPrimaryBg: 'bg-indigo-600 hover:bg-indigo-700',
    btnPrimaryHover: 'hover:bg-indigo-700',
    btnPrimaryText: 'text-white',
    btnSecondaryBg: 'bg-slate-800 hover:bg-slate-705',
    btnSecondaryHover: 'hover:bg-slate-750',
    btnSecondaryText: 'text-slate-200',
    btnSecondaryBorder: 'border-slate-700/50',
    cardBg: 'bg-white',
    cardBorder: 'border-slate-200/80',
    cardText: 'text-slate-800',
    cardTextMuted: 'text-slate-500',
    cardHeaderBg: 'bg-indigo-50/60',
    cardHeaderBorder: 'border-indigo-100/50',
    timelineBg: 'bg-white',
    timelineHeaderBg: 'bg-slate-50/90',
    timelineHeaderBorder: 'border-slate-200',
    timelineHeaderText: 'text-slate-700',
    timelineCellBorder: 'border-slate-100/70',
    timelineIndicatorBg: 'bg-indigo-50',
    timelineDragOverBg: 'bg-indigo-50 border-r-indigo-300',
    timelineRowHover: 'hover:bg-slate-50/40',
    themeHighlightText: 'text-indigo-600',
    areaColors: {
      'Atención': {
        bg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        ring: 'focus:ring-indigo-300 border-indigo-700',
        text: 'text-indigo-200',
        handle: 'bg-indigo-300'
      },
      'Soporte': {
        bg: 'bg-sky-600 hover:bg-sky-700 text-white',
        ring: 'focus:ring-sky-300 border-sky-700',
        text: 'text-sky-200',
        handle: 'bg-sky-300'
      },
      'Ventas': {
        bg: 'bg-amber-600 hover:bg-amber-700 text-white',
        ring: 'focus:ring-amber-300 border-amber-700',
        text: 'text-amber-200',
        handle: 'bg-amber-300'
      },
      'Administración': {
        bg: 'bg-cyan-600 hover:bg-cyan-700 text-white',
        ring: 'focus:ring-cyan-300 border-cyan-700',
        text: 'text-cyan-200',
        handle: 'bg-cyan-300'
      }
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon and electric vibes',
    emoji: '⚡',
    fontClass: 'font-cyber',
    bg: 'bg-[#0a0712]',
    textPrimary: 'text-[#00ffff]',
    textSecondary: 'text-[#fe019a]',
    headerBg: 'bg-[#120a21]',
    headerBorder: 'border-t-2 border-b-2 border-[#fe019a]',
    headerText: 'text-[#00ffff] font-extrabold tracking-wider uppercase',
    headerSubtext: 'text-[#ffff00]',
    btnPrimaryBg: 'bg-[#fe019a] hover:bg-[#ff1baf]',
    btnPrimaryHover: 'hover:bg-[#ff1baf]',
    btnPrimaryText: 'text-black font-extrabold uppercase',
    btnPrimaryBorder: 'border border-[#ffff00]',
    btnSecondaryBg: 'bg-[#181236]',
    btnSecondaryHover: 'hover:bg-[#251b54]',
    btnSecondaryText: 'text-[#ffff00] font-bold',
    btnSecondaryBorder: 'border border-[#fe019a]/55',
    cardBg: 'bg-[#150f2b]',
    cardBorder: 'border-2 border-[#fe019a]/60 shadow-[0_0_10px_#fe019a20]',
    cardText: 'text-white',
    cardTextMuted: 'text-[#8c82b5]',
    cardHeaderBg: 'bg-[#1e133c]',
    cardHeaderBorder: 'border-b border-[#fe019a]/40',
    timelineBg: 'bg-[#0f0a21]',
    timelineHeaderBg: 'bg-[#1a1135]/80',
    timelineHeaderBorder: 'border-[#fe019a]/30',
    timelineHeaderText: 'text-[#00ffff] font-bold font-mono',
    timelineCellBorder: 'border-[#fe019a]/10',
    timelineIndicatorBg: 'bg-[#fe019a]/10',
    timelineDragOverBg: 'bg-[#00ffff]/10 border-r-[#00ffff]',
    timelineRowHover: 'hover:bg-[#fe019a]/5',
    themeHighlightText: 'text-[#fe019a] text-shadow-[0_0_8px_#fe019a]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#fe019a] text-black border-[#ff66cc] font-extrabold',
        ring: 'focus:ring-pink-400 border-pink-700',
        text: 'text-black',
        handle: 'bg-black'
      },
      'Soporte': {
        bg: 'bg-[#00ffff] text-black border-[#66ffff] font-extrabold',
        ring: 'focus:ring-cyan-400 border-cyan-700',
        text: 'text-black',
        handle: 'bg-black'
      },
      'Ventas': {
        bg: 'bg-[#ffff00] text-black border-[#ffff66] font-extrabold',
        ring: 'focus:ring-yellow-400 border-yellow-700',
        text: 'text-black',
        handle: 'bg-black'
      },
      'Administración': {
        bg: 'bg-[#bc13fe] text-white border-[#df80ff] font-extrabold',
        ring: 'focus:ring-purple-400 border-purple-700',
        text: 'text-white',
        handle: 'bg-white'
      }
    }
  },
  {
    id: 'matrix',
    name: 'Matrix',
    description: 'Green screen retro',
    emoji: '🟢',
    fontClass: 'font-matrix',
    bg: 'bg-black',
    textPrimary: 'text-[#00ff41]',
    textSecondary: 'text-[#00aa2a]',
    headerBg: 'bg-black',
    headerBorder: 'border-b-2 border-[#00ff41]',
    headerText: 'text-[#00ff41] font-mono uppercase tracking-widest',
    headerSubtext: 'text-[#00aa2a]',
    btnPrimaryBg: 'bg-[#00ff41] hover:bg-[#33ff67]',
    btnPrimaryHover: 'hover:bg-[#33ff67]',
    btnPrimaryText: 'text-black font-extrabold tracking-wide uppercase',
    btnPrimaryBorder: 'border border-black',
    btnSecondaryBg: 'bg-black',
    btnSecondaryHover: 'hover:bg-[#003b0f]',
    btnSecondaryText: 'text-[#00ff41]',
    btnSecondaryBorder: 'border border-[#00ff41]',
    cardBg: 'bg-[#020a03]',
    cardBorder: 'border border-[#00ff41]/50 shadow-[0_0_8px_rgba(0,255,65,0.15)]',
    cardText: 'text-[#00ff41]',
    cardTextMuted: 'text-[#00aa2a]',
    cardHeaderBg: 'bg-[#041506]',
    cardHeaderBorder: 'border-b border-[#00ff41]/40',
    timelineBg: 'bg-black',
    timelineHeaderBg: 'bg-[#020b03]',
    timelineHeaderBorder: 'border-[#00ff41]/30',
    timelineHeaderText: 'text-[#00ff41] font-mono',
    timelineCellBorder: 'border-[#00ff41]/20',
    timelineIndicatorBg: 'bg-[#00ff41]/10',
    timelineDragOverBg: 'bg-[#00ff41]/20 border-r-[#00ff41]',
    timelineRowHover: 'hover:bg-[#00ff41]/10',
    themeHighlightText: 'text-[#00ff41]',
    areaColors: {
      'Atención': {
        bg: 'bg-black text-[#00ff41] border-[#00ff41]',
        ring: 'focus:ring-green-400 border-[#00ff41]',
        text: 'text-[#00ff41]',
        handle: 'bg-[#00ff41]'
      },
      'Soporte': {
        bg: 'bg-[#005e19] text-[#00ff41] border-[#00ff41]',
        ring: 'focus:ring-green-300 border-[#00ff41]',
        text: 'text-[#00ff41]',
        handle: 'bg-[#00ff41]'
      },
      'Ventas': {
        bg: 'bg-[#022e0b] text-[#00ff41] border-[#00ff41]',
        ring: 'focus:ring-green-500 border-[#00ff41]',
        text: 'text-[#00ff41]',
        handle: 'bg-[#00ff41]'
      },
      'Administración': {
        bg: 'bg-[#00ff41] text-black border-[#00ff41] font-extrabold',
        ring: 'focus:ring-green-600 border-black',
        text: 'text-black',
        handle: 'bg-black'
      }
    }
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    description: 'Underwater serenity',
    emoji: '🌊',
    fontClass: 'font-sans',
    bg: 'bg-[#021526]',
    textPrimary: 'text-[#38bdf8]',
    textSecondary: 'text-[#0284c7]',
    headerBg: 'bg-[#032541]',
    headerBorder: 'border-b border-[#0284c7]/60 shadow-md',
    headerText: 'text-white font-bold',
    headerSubtext: 'text-[#0ea5e9]',
    btnPrimaryBg: 'bg-[#0284c7] hover:bg-[#0369a1]',
    btnPrimaryHover: 'hover:bg-[#0369a1]',
    btnPrimaryText: 'text-white font-semibold',
    btnPrimaryBorder: 'border border-[#0ea5e9]',
    btnSecondaryBg: 'bg-[#031e34]',
    btnSecondaryHover: 'hover:bg-[#052d4e]',
    btnSecondaryText: 'text-[#e0f2fe]',
    btnSecondaryBorder: 'border border-[#0284c7]/40',
    cardBg: 'bg-[#032a45]',
    cardBorder: 'border border-[#005c8a]/60 shadow-[0_4px_16px_rgba(2,132,199,0.1)]',
    cardText: 'text-[#e0f2fe]',
    cardTextMuted: 'text-[#7dd3fc]',
    cardHeaderBg: 'bg-[#02375a]',
    cardHeaderBorder: 'border-b border-[#0284c7]/50',
    timelineBg: 'bg-[#022137]',
    timelineHeaderBg: 'bg-[#032e4d]',
    timelineHeaderBorder: 'border-[#0284c7]/45',
    timelineHeaderText: 'text-[#bae6fd] font-semibold',
    timelineCellBorder: 'border-[#0284c7]/15',
    timelineIndicatorBg: 'bg-[#0284c7]/20',
    timelineDragOverBg: 'bg-[#0284c7]/30 border-r-[#38bdf8]',
    timelineRowHover: 'hover:bg-[#0284c7]/10',
    themeHighlightText: 'text-[#38bdf8]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#0891b2] text-white border-[#22d3ee]',
        ring: 'focus:ring-cyan-350 border-cyan-700',
        text: 'text-cyan-200',
        handle: 'bg-[#22d3ee]'
      },
      'Soporte': {
        bg: 'bg-[#0d9488] text-white border-[#2dd4bf]',
        ring: 'focus:ring-[#2dd4bf] border-teal-800',
        text: 'text-teal-200',
        handle: 'bg-[#2dd4bf]'
      },
      'Ventas': {
        bg: 'bg-[#0284c7] text-white border-[#38bdf8]',
        ring: 'focus:ring-[#38bdf8] border-sky-850',
        text: 'text-sky-200',
        handle: 'bg-[#38bdf8]'
      },
      'Administración': {
        bg: 'bg-[#075985] text-sky-100 border-[#0284c7]',
        ring: 'focus:ring-[#0284c7] border-sky-900',
        text: 'text-sky-300',
        handle: 'bg-[#0ea5e9]'
      }
    }
  },
  {
    id: 'harry-potter',
    name: 'Harry Potter',
    description: 'Magical gold theme',
    emoji: '✨',
    fontClass: 'font-potter',
    bg: 'bg-[#150e0e]',
    textPrimary: 'text-[#d4af37]',
    textSecondary: 'text-[#b8860b]',
    headerBg: 'bg-[#271515]',
    headerBorder: 'border-b-2 border-[#d4af37]',
    headerText: 'text-[#d4af37] font-bold tracking-widest',
    headerSubtext: 'text-[#ffdd66]',
    btnPrimaryBg: 'bg-[#8c1d1a] hover:bg-[#a62420]',
    btnPrimaryHover: 'hover:bg-[#a62420]',
    btnPrimaryText: 'text-[#d4af37] font-bold border border-[#d4af37]/70',
    btnSecondaryBg: 'bg-[#2e1d1d]',
    btnSecondaryHover: 'hover:bg-[#422a2a]',
    btnSecondaryText: 'text-[#ffdd6a]',
    btnSecondaryBorder: 'border border-[#d4af37]/35',
    cardBg: 'bg-[#1e1414]',
    cardBorder: 'border-2 border-[#8c6723]/60 shadow-[0_4px_12px_rgba(212,175,55,0.12)]',
    cardText: 'text-[#ffeedb]',
    cardTextMuted: 'text-[#cfa470]',
    cardHeaderBg: 'bg-[#2c1d1d]',
    cardHeaderBorder: 'border-b border-[#8c6723]/40',
    timelineBg: 'bg-[#1a1111]',
    timelineHeaderBg: 'bg-[#261919]',
    timelineHeaderBorder: 'border-[#8c6723]/35',
    timelineHeaderText: 'text-[#d4af37]',
    timelineCellBorder: 'border-[#8c6723]/15',
    timelineIndicatorBg: 'bg-[#8c6723]/15',
    timelineDragOverBg: 'bg-[#d4af37]/20 border-r-[#d4af37]',
    timelineRowHover: 'hover:bg-[#8c6723]/10',
    themeHighlightText: 'text-[#d4af37] [text-shadow:0_0_6px_rgba(212,175,55,0.5)]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#8c1d1a] text-[#d4af37] border-[#d4af37] font-extrabold',
        ring: 'focus:ring-[#d4af37] border-[#d4af37]',
        text: 'text-red-200',
        handle: 'bg-[#d4af37]'
      },
      'Soporte': {
        bg: 'bg-[#0f2444] text-[#c0c0c0] border-[#c0c0c0]',
        ring: 'focus:ring-blue-400 border-blue-800',
        text: 'text-blue-200',
        handle: 'bg-white'
      },
      'Ventas': {
        bg: 'bg-[#1b4332] text-[#aaaaaa] border-[#aaaaaa]',
        ring: 'focus:ring-emerald-400 border-emerald-800',
        text: 'text-emerald-200',
        handle: 'bg-gray-300'
      },
      'Administración': {
        bg: 'bg-[#ffcc00] text-black border-black font-extrabold',
        ring: 'focus:ring-black border-black',
        text: 'text-black',
        handle: 'bg-black'
      }
    }
  },
  {
    id: 'marvel',
    name: 'Marvel',
    description: 'Power and action',
    emoji: '🔴',
    fontClass: 'font-cyber',
    bg: 'bg-[#0f0f0f]',
    textPrimary: 'text-white',
    textSecondary: 'text-[#ed1d24]',
    headerBg: 'bg-[#ed1d24]',
    headerBorder: 'border-b-4 border-black',
    headerText: 'text-white uppercase font-black tracking-tighter text-xl italic',
    headerSubtext: 'text-yellow-300 font-bold',
    btnPrimaryBg: 'bg-[#ed1d24] hover:bg-[#c41419]',
    btnPrimaryHover: 'hover:bg-[#c41419]',
    btnPrimaryText: 'text-white font-black uppercase tracking-wider',
    btnPrimaryBorder: 'border-2 border-white',
    btnSecondaryBg: 'bg-[#222]',
    btnSecondaryHover: 'hover:bg-[#333]',
    btnSecondaryText: 'text-white font-bold',
    btnSecondaryBorder: 'border-2 border-[#ed1d24]',
    cardBg: 'bg-[#1c1c1c]',
    cardBorder: 'border-2 border-[#ed1d24] shadow-[0_4px_0px_#000]',
    cardText: 'text-white',
    cardTextMuted: 'text-[#aaaaaa]',
    cardHeaderBg: 'bg-[#2a2a2a]',
    cardHeaderBorder: 'border-b-2 border-[#ed1d24]',
    timelineBg: 'bg-[#141414]',
    timelineHeaderBg: 'bg-[#242424]',
    timelineHeaderBorder: 'border-black',
    timelineHeaderText: 'text-white font-black uppercase text-[10px]',
    timelineCellBorder: 'border-[#333]',
    timelineIndicatorBg: 'bg-[#ed1d24]/10',
    timelineDragOverBg: 'bg-[#ed1d24]/20 border-r-[#ed1d24]',
    timelineRowHover: 'hover:bg-[#ed1d24]/5',
    themeHighlightText: 'text-[#ed1d24] font-black',
    areaColors: {
      'Atención': {
        bg: 'bg-[#ed1d24] text-white border-[#fbd303] uppercase font-black shadow-md',
        ring: 'focus:ring-red-400 border-black',
        text: 'text-white',
        handle: 'bg-[#fbd303]'
      },
      'Soporte': {
        bg: 'bg-[#002d62] text-white border-[#ed1d24] uppercase font-black shadow-md',
        ring: 'focus:ring-blue-400 border-black',
        text: 'text-white',
        handle: 'bg-[#ed1d24]'
      },
      'Ventas': {
        bg: 'bg-[#fbd303] text-black border-black uppercase font-black shadow-md',
        ring: 'focus:ring-yellow-400 border-black',
        text: 'text-black',
        handle: 'bg-black'
      },
      'Administración': {
        bg: 'bg-[#4c9141] text-white border-black uppercase font-black shadow-md',
        ring: 'focus:ring-green-400 border-black',
        text: 'text-white',
        handle: 'bg-white'
      }
    }
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'TVA aesthetic',
    emoji: '🎭',
    fontClass: 'font-sans',
    bg: 'bg-[#181512]',
    textPrimary: 'text-[#ec9e59]',
    textSecondary: 'text-[#d48944]',
    headerBg: 'bg-[#29221c]',
    headerBorder: 'border-b-4 border-[#d45d00]',
    headerText: 'text-[#f5cbb0] font-sans font-bold uppercase tracking-wider',
    headerSubtext: 'text-[#ff8d21]',
    btnPrimaryBg: 'bg-[#d45d00] hover:bg-[#e06606]',
    btnPrimaryHover: 'hover:bg-[#e06606]',
    btnPrimaryText: 'text-white font-bold',
    btnPrimaryBorder: 'border border-[#ec9e59]/50',
    btnSecondaryBg: 'bg-[#231b15]',
    btnSecondaryHover: 'hover:bg-[#33271e]',
    btnSecondaryText: 'text-[#ec9e59]',
    btnSecondaryBorder: 'border border-[#d48944]/45',
    cardBg: 'bg-[#221b16]',
    cardBorder: 'border border-[#d48944]/35 shadow-md',
    cardText: 'text-[#fceeda]',
    cardTextMuted: 'text-[#c6a386]',
    cardHeaderBg: 'bg-[#2f251f]',
    cardHeaderBorder: 'border-b border-[#d48944]/40',
    timelineBg: 'bg-[#1c1612]',
    timelineHeaderBg: 'bg-[#2b211a]',
    timelineHeaderBorder: 'border-[#d48944]/30',
    timelineHeaderText: 'text-[#ec9e59] font-semibold',
    timelineCellBorder: 'border-[#d48944]/12',
    timelineIndicatorBg: 'bg-[#d45d00]/15',
    timelineDragOverBg: 'bg-[#ec9e59]/20 border-r-[#ec9e59]',
    timelineRowHover: 'hover:bg-[#d45d00]/8',
    themeHighlightText: 'text-[#ff8d00] font-bold',
    areaColors: {
      'Atención': {
        bg: 'bg-[#a3520d] text-[#fbebd0] border-[#f29f05]',
        ring: 'focus:ring-orange-400 border-transparent',
        text: 'text-[#fbebd0]',
        handle: 'bg-[#f29f05]'
      },
      'Soporte': {
        bg: 'bg-[#005f73] text-white border-[#e36414]',
        ring: 'focus:ring-cyan-400 border-transparent',
        text: 'text-cyan-200',
        handle: 'bg-[#e36414]'
      },
      'Ventas': {
        bg: 'bg-[#2d4a22] text-[#f9e9d2] border-[#d48944]',
        ring: 'focus:ring-green-400 border-transparent',
        text: 'text-green-200',
        handle: 'bg-[#d48944]'
      },
      'Administración': {
        bg: 'bg-[#6b5847] text-[#ffddaa] border-[#8a7051]',
        ring: 'focus:ring-stone-400 border-transparent',
        text: 'text-stone-200',
        handle: 'bg-[#ffddaa]'
      }
    }
  },
  {
    id: 'winamp',
    name: 'Winamp',
    description: 'Retro player classic',
    emoji: '🎵',
    fontClass: 'font-mono',
    bg: 'bg-[#1a1c22]',
    textPrimary: 'text-[#00e1ff]',
    textSecondary: 'text-[#33ff33]',
    headerBg: 'bg-[#0e1014]',
    headerBorder: 'border-b border-slate-700 shadow-md',
    headerText: 'text-[#33ff33] font-bold uppercase tracking-wide',
    headerSubtext: 'text-[#00e1ff]',
    btnPrimaryBg: 'bg-[#2a2d37] hover:bg-[#3c414f]',
    btnPrimaryHover: 'hover:bg-[#3c414f]',
    btnPrimaryText: 'text-[#33ff33] border border-slate-700 shadow-sm',
    btnSecondaryBg: 'bg-[#111216]',
    btnSecondaryHover: 'hover:bg-[#1a1c22]',
    btnSecondaryText: 'text-[#f2f2f2]',
    btnSecondaryBorder: 'border border-[#33ff33]',
    cardBg: 'bg-[#21242d]',
    cardBorder: 'border-2 border-slate-600 shadow-[inset_1px_1px_0_rgba(255,255,255,0.1),2px_2px_4px_rgba(0,0,0,0.5)]',
    cardText: 'text-[#d2d7df]',
    cardTextMuted: 'text-[#888e99]',
    cardHeaderBg: 'bg-[#14161d]',
    cardHeaderBorder: 'border-b-2 border-slate-600',
    timelineBg: 'bg-[#171920]',
    timelineHeaderBg: 'bg-[#242732]',
    timelineHeaderBorder: 'border-slate-700',
    timelineHeaderText: 'text-[#33ff33]',
    timelineCellBorder: 'border-slate-800',
    timelineIndicatorBg: 'bg-[#33ff33]/15',
    timelineDragOverBg: 'bg-[#00e1ff]/20 border-r-[#00e1ff]',
    timelineRowHover: 'hover:bg-slate-700/30',
    themeHighlightText: 'text-[#33ff33]',
    areaColors: {
      'Atención': {
        bg: 'bg-black text-[#33ff33] border-[#33ff33] font-bold font-mono',
        ring: 'focus:ring-green-400 border-slate-905',
        text: 'text-[#33ff33]',
        handle: 'bg-[#33ff33]'
      },
      'Soporte': {
        bg: 'bg-black text-[#00e1ff] border-[#00e1ff] font-bold font-mono',
        ring: 'focus:ring-cyan-400 border-slate-905',
        text: 'text-[#00e1ff]',
        handle: 'bg-[#00e1ff]'
      },
      'Ventas': {
        bg: 'bg-black text-[#ffaa00] border-[#ffaa00] font-bold font-mono',
        ring: 'focus:ring-yellow-400 border-slate-905',
        text: 'text-[#ffaa00]',
        handle: 'bg-[#ffaa00]'
      },
      'Administración': {
        bg: 'bg-black text-[#ff3333] border-[#ff3333] font-bold font-mono',
        ring: 'focus:ring-red-400 border-slate-905',
        text: 'text-[#ff3333]',
        handle: 'bg-[#ff3333]'
      }
    }
  },
  {
    id: 'vichy',
    name: 'Vichy',
    description: 'Teal and silver gray',
    emoji: '💎',
    fontClass: 'font-sans',
    bg: 'bg-[#0d0f0f]',
    textPrimary: 'text-white',
    textSecondary: 'text-[#05AD98]',
    headerBg: 'bg-[#161919]',
    headerBorder: 'border-b border-[#05AD98]/60 shadow-md',
    headerText: 'text-white font-bold',
    headerSubtext: 'text-[#05AD98]',
    btnPrimaryBg: 'bg-[#05AD98] hover:bg-[#048c7a]',
    btnPrimaryHover: 'hover:bg-[#048c7a]',
    btnPrimaryText: 'text-white font-semibold',
    btnPrimaryBorder: 'border border-[#BBBFBF]/30',
    btnSecondaryBg: 'bg-[#1a201f]',
    btnSecondaryHover: 'hover:bg-[#252e2c]',
    btnSecondaryText: 'text-[#BBBFBF]',
    btnSecondaryBorder: 'border border-[#05AD98]/40',
    cardBg: 'bg-[#161919]',
    cardBorder: 'border border-[#05AD98]/20 shadow-[0_4px_16px_rgba(5,173,152,0.1)]',
    cardText: 'text-white',
    cardTextMuted: 'text-[#BBBFBF]',
    cardHeaderBg: 'bg-[#1c2121]',
    cardHeaderBorder: 'border-b border-[#05AD98]/30',
    timelineBg: 'bg-[#0d0f0f]',
    timelineHeaderBg: 'bg-[#161919]',
    timelineHeaderBorder: 'border-[#05AD98]/45',
    timelineHeaderText: 'text-white font-semibold',
    timelineCellBorder: 'border-[#05AD98]/15',
    timelineIndicatorBg: 'bg-[#05AD98]/15',
    timelineDragOverBg: 'bg-[#05AD98]/25 border-r-[#05AD98]',
    timelineRowHover: 'hover:bg-[#05AD98]/10',
    themeHighlightText: 'text-[#05AD98]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#05AD98] text-white border-[#05AD98]',
        ring: 'focus:ring-[#05AD98] border-[#048c7a]',
        text: 'text-slate-100',
        handle: 'bg-white'
      },
      'Soporte': {
        bg: 'bg-[#1e4640] text-white border-[#05AD98]',
        ring: 'focus:ring-teal-400 border-teal-800',
        text: 'text-teal-200',
        handle: 'bg-[#05AD98]'
      },
      'Ventas': {
        bg: 'bg-[#122e2a] text-[#BBBFBF] border-[#05AD98]/50',
        ring: 'focus:ring-teal-500 border-teal-900',
        text: 'text-[#BBBFBF]',
        handle: 'bg-[#BBBFBF]'
      },
      'Administración': {
        bg: 'bg-white text-[#0d0f0f] border-[#05AD98] font-bold',
        ring: 'focus:ring-[#05AD98] border-black',
        text: 'text-[#0d0f0f]',
        handle: 'bg-[#0d0f0f]'
      }
    }
  },
  {
    id: 'sorbet',
    name: 'Sorbet',
    description: 'Sage and warm mauve',
    emoji: '🍧',
    fontClass: 'font-sans',
    bg: 'bg-[#141512]',
    textPrimary: 'text-[#FEFEFE]',
    textSecondary: 'text-[#B7C396]',
    headerBg: 'bg-[#1f211d]',
    headerBorder: 'border-b border-[#B7C396]/60 shadow-md',
    headerText: 'text-[#FEFEFE] font-bold',
    headerSubtext: 'text-[#BA9A91]',
    btnPrimaryBg: 'bg-[#B7C396] hover:bg-[#a1ad80]',
    btnPrimaryHover: 'hover:bg-[#a1ad80]',
    btnPrimaryText: 'text-slate-900 font-bold',
    btnPrimaryBorder: 'border border-[#EDECEC]/30',
    btnSecondaryBg: 'bg-[#21231f]',
    btnSecondaryHover: 'hover:bg-[#2d302a]',
    btnSecondaryText: 'text-[#BA9A91]',
    btnSecondaryBorder: 'border border-[#B7C396]/45',
    cardBg: 'bg-[#1f211d]',
    cardBorder: 'border border-[#B7C396]/20 shadow-[0_4px_16px_rgba(183,195,150,0.1)]',
    cardText: 'text-[#EDECEC]',
    cardTextMuted: 'text-[#CCCCCC]',
    cardHeaderBg: 'bg-[#282a25]',
    cardHeaderBorder: 'border-b border-[#B7C396]/30',
    timelineBg: 'bg-[#141512]',
    timelineHeaderBg: 'bg-[#1f211d]',
    timelineHeaderBorder: 'border-[#B7C396]/45',
    timelineHeaderText: 'text-[#FEFEFE] font-semibold',
    timelineCellBorder: 'border-[#B7C396]/15',
    timelineIndicatorBg: 'bg-[#B7C396]/15',
    timelineDragOverBg: 'bg-[#B7C396]/25 border-r-[#B7C396]',
    timelineRowHover: 'hover:bg-[#B7C396]/10',
    themeHighlightText: 'text-[#B7C396]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#B7C396] text-slate-900 border-[#B7C396] font-bold',
        ring: 'focus:ring-[#B7C396] border-[#a1ad80]',
        text: 'text-slate-800',
        handle: 'bg-slate-900'
      },
      'Soporte': {
        bg: 'bg-[#BA9A91] text-white border-[#BA9A91] font-bold',
        ring: 'focus:ring-[#BA9A91] border-[#a38077]',
        text: 'text-slate-100',
        handle: 'bg-white'
      },
      'Ventas': {
        bg: 'bg-[#383b32] text-[#B7C396] border-[#B7C396]/55',
        ring: 'focus:ring-green-400 border-green-800',
        text: 'text-[#B7C396]',
        handle: 'bg-[#B7C396]'
      },
      'Administración': {
        bg: 'bg-[#EDECEC] text-slate-900 border-[#CCCCCC] font-bold',
        ring: 'focus:ring-white border-[#CCCCCC]',
        text: 'text-slate-900',
        handle: 'bg-slate-900'
      }
    }
  },
  {
    id: 'frozen-mist',
    name: 'Frozen Mist',
    description: 'Vivid orange and olive',
    emoji: '❄️',
    fontClass: 'font-sans',
    bg: 'bg-[#151614]',
    textPrimary: 'text-[#FCF8D8]',
    textSecondary: 'text-[#DD700B]',
    headerBg: 'bg-[#21221f]',
    headerBorder: 'border-b border-[#DD700B]/60 shadow-md',
    headerText: 'text-[#FCF8D8] font-bold',
    headerSubtext: 'text-[#D9DADF]',
    btnPrimaryBg: 'bg-[#DD700B] hover:bg-[#b85c07]',
    btnPrimaryHover: 'hover:bg-[#b85c07]',
    btnPrimaryText: 'text-white font-bold',
    btnPrimaryBorder: 'border border-[#ADACA7]/30',
    btnSecondaryBg: 'bg-[#1f211f]',
    btnSecondaryHover: 'hover:bg-[#2b2e2b]',
    btnSecondaryText: 'text-[#D9DADF]',
    btnSecondaryBorder: 'border border-[#DD700B]/45',
    cardBg: 'bg-[#21221f]',
    cardBorder: 'border border-[#DD700B]/20 shadow-[0_4px_16px_rgba(221,112,11,0.1)]',
    cardText: 'text-[#FCF8D8]',
    cardTextMuted: 'text-[#ADACA7]',
    cardHeaderBg: 'bg-[#2d2f2b]',
    cardHeaderBorder: 'border-b border-[#DD700B]/30',
    timelineBg: 'bg-[#151614]',
    timelineHeaderBg: 'bg-[#21221f]',
    timelineHeaderBorder: 'border-[#DD700B]/45',
    timelineHeaderText: 'text-[#FCF8D8] font-semibold',
    timelineCellBorder: 'border-[#DD700B]/15',
    timelineIndicatorBg: 'bg-[#DD700B]/15',
    timelineDragOverBg: 'bg-[#DD700B]/25 border-r-[#DD700B]',
    timelineRowHover: 'hover:bg-[#DD700B]/10',
    themeHighlightText: 'text-[#DD700B]',
    areaColors: {
      'Atención': {
        bg: 'bg-[#DD700B] text-white border-[#DD700B] font-bold',
        ring: 'focus:ring-[#DD700B] border-[#b85c07]',
        text: 'text-slate-100',
        handle: 'bg-white'
      },
      'Soporte': {
        bg: 'bg-[#7C7D75] text-[#FCF8D8] border-[#7C7D75] font-bold',
        ring: 'focus:ring-[#7C7D75] border-[#5e5f59]',
        text: 'text-[#FCF8D8]',
        handle: 'bg-[#FCF8D8]'
      },
      'Ventas': {
        bg: 'bg-[#2d302d] text-[#DD700B] border-[#DD700B]/55',
        ring: 'focus:ring-orange-400 border-orange-850',
        text: 'text-[#DD700B]',
        handle: 'bg-[#DD700B]'
      },
      'Administración': {
        bg: 'bg-[#D9DADF] text-slate-900 border-[#ADACA7] font-bold',
        ring: 'focus:ring-white border-[#ADACA7]',
        text: 'text-slate-900',
        handle: 'bg-slate-900'
      }
    }
  }
];
