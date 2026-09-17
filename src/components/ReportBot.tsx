import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Key, Database, Table as TableIcon, Download, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any[];
  error?: boolean;
}

export const ReportBot: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [isKeyEditing, setIsKeyEditing] = useState(!localStorage.getItem('gemini_api_key'));
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de reportes con IA. Decime qué tabla o datos necesitás extraer de los turnos y yo me encargo de armarla. Por ejemplo: "Armame una tabla de turnos del Dr. Llanos agrupados por Obra Social".'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setIsKeyEditing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    
    try {
      const recentHistory = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/bot-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content, apiKey, history: recentHistory })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error procesando tu petición');
      }
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message || 'Acá tenés los datos que me pediste:',
        data: data.results
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Ups! Hubo un error: ${error.message}`,
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (data: any[]) => {
    if (!data || data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ReporteIA");
    XLSX.writeFile(workbook, `ReporteIA_${Date.now()}.xlsx`);
  };

  const renderTable = (data: any[]) => {
    if (!data) return null;
    if (data.length === 0) {
      return (
        <div className="mt-4 p-4 rounded-xl border border-slate-700/50 bg-slate-900/50 text-slate-400 text-sm italic">
          No se encontraron registros que coincidan con la búsqueda.
        </div>
      );
    }
    const columns = Object.keys(data[0]);
    
    return (
      <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden text-sm w-full">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-300">
            <TableIcon size={14} />
            <span className="font-semibold">{data.length} registros</span>
          </div>
          <button 
            onClick={() => handleExport(data)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors cursor-pointer"
          >
            <Download size={14} />
            Exportar Excel
          </button>
        </div>
        <div className="overflow-x-auto max-w-full scrollbar-thin scrollbar-thumb-slate-700">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-800/40 text-slate-400 uppercase text-[10px] tracking-wider">
                {columns.map(col => (
                  <th key={col} className="px-4 py-2.5 font-semibold whitespace-nowrap border-b border-slate-700/50">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  {columns.map(col => (
                    <td key={col} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                      {row[col] !== null ? String(row[col]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] rounded-2xl border border-slate-800/60 overflow-hidden relative shadow-2xl">
      {/* Header */}
      <div className="flex-none p-4 bg-[#0d1117] border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Bot Analista de Datos</h2>
            <p className="text-slate-400 text-xs">Pídele cualquier reporte en lenguaje natural</p>
          </div>
        </div>
        
        {/* API Key Config */}
        <div className="flex items-center gap-2">
          {isKeyEditing ? (
            <div className="flex items-center gap-2">
              <input 
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Pegá tu API Key de Gemini..."
                className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs w-64 focus:outline-none focus:border-indigo-500"
              />
              <button 
                onClick={saveApiKey}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Guardar
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsKeyEditing(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors cursor-pointer"
            >
              <Key size={14} />
              API Key Configurada
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {!apiKey && !isKeyEditing && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-amber-500 font-semibold text-sm">Falta configurar la API Key</h3>
              <p className="text-amber-400/80 text-xs mt-1">Para que el bot pueda procesar lenguaje natural, necesitás hacer clic en "Configurar API Key" arriba a la derecha y pegar tu clave de Google Gemini.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' : 'bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-sm'} p-4 shadow-md`}>
              <div className="flex items-center gap-2 mb-1.5 opacity-60 text-[10px] font-bold uppercase tracking-wider">
                {msg.role === 'assistant' ? (
                  <><Bot size={12} /> BOT</>
                ) : (
                  <>USUARIO</>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{msg.content}</p>
              {msg.data && renderTable(msg.data)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/60 border border-slate-700/50 text-slate-400 rounded-2xl rounded-tl-sm p-4 shadow-md flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-sm">Generando consulta SQL interactiva...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-[#0d1117] border-t border-slate-800/80">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!apiKey || isLoading}
            placeholder={apiKey ? "Ej: Mostrame todos los turnos del Dr. Llanos que faltaron en el mes de Julio..." : "Configurá la API Key primero para escribir..."}
            className="w-full bg-[#0b0e14] border border-slate-700 text-slate-200 px-5 py-4 pr-14 rounded-2xl text-[14px] focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !apiKey || isLoading}
            className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl transition-colors cursor-pointer"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-3 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Database size={11} />
          <span>El bot tiene permisos de lectura sobre la tabla de turnos de Supabase.</span>
        </div>
      </div>
    </div>
  );
};
