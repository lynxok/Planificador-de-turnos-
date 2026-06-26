import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Cloud, Monitor, Globe } from 'lucide-react';

interface SyncLog {
  id: string;
  created_at: string;
  status: string;
  source: string;
  details: {
    message?: string;
    [key: string]: any;
  };
}

interface SyncLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncLogsModal: React.FC<SyncLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('planning_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching sync logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-indigo-600 animate-pulse" size={18} />
            <h3 className="text-sm font-bold text-slate-800">Historial de Sincronizaciones</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchLogs} 
              disabled={isLoading}
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refrescar logs"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 min-h-[300px]">
          {isLoading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <RefreshCw className="text-indigo-600 animate-spin" size={24} />
              <span className="text-xs text-slate-500 font-medium">Cargando historial...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
              <RefreshCw size={36} className="opacity-30 mb-2" />
              <p className="text-xs font-semibold">No se encontraron registros de sincronización.</p>
              <p className="text-[10px] text-slate-400 max-w-[280px] mt-1">
                Los eventos de sincronización se registrarán aquí cuando ejecutes el actualizador de turnos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const date = new Date(log.created_at).toLocaleString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div 
                    key={log.id} 
                    className={`flex items-start gap-3 p-3.5 rounded-lg border text-xs transition-all hover:shadow-2xs ${
                      log.status === 'SUCCESS' 
                        ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/60' 
                        : 'bg-rose-50/40 border-rose-100 hover:bg-rose-50/60'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5">
                      {log.status === 'SUCCESS' ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : (
                        <AlertTriangle size={16} className="text-rose-600" />
                      )}
                    </div>

                    {/* Log Details */}
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700">{date}</span>
                        
                        {/* Badges */}
                        <div className="flex gap-1.5 items-center">
                          {/* Source badge */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                            log.source === 'GITHUB_ACTIONS' 
                              ? 'bg-purple-100 text-purple-700' 
                              : log.source === 'LOCAL_BACKEND'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {log.source === 'GITHUB_ACTIONS' && <Cloud size={10} />}
                            {log.source === 'LOCAL_BACKEND' && <Monitor size={10} />}
                            {log.source === 'BROWSER_MANUAL' && <Globe size={10} />}
                            {log.source === 'GITHUB_ACTIONS' ? 'NUBE (GITHUB)' : log.source === 'LOCAL_BACKEND' ? 'LOCAL' : 'MANUAL WEB'}
                          </span>
                          
                          {/* Status Badge */}
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                            log.status === 'SUCCESS' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status === 'SUCCESS' ? 'EXITOSO' : 'FALLIDO'}
                          </span>
                        </div>
                      </div>

                      <p className={`font-medium ${log.status === 'SUCCESS' ? 'text-slate-600' : 'text-rose-700 font-semibold'}`}>
                        {log.details?.message || JSON.stringify(log.details)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span>Registrando últimas 15 ejecuciones</span>
          <span>SFH ITEO Core</span>
        </div>
      </div>
    </div>
  );
};
