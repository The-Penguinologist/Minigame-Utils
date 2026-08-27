import React, { useState, useEffect } from 'react';
import { Terminal, RotateCcw, Filter, CheckCircle2, ShieldAlert, Zap, MessageSquare } from 'lucide-react';
import { BotLogEntry } from '../types';

interface BotLogsProps {
  onRefreshState: () => void;
}

export const BotLogs: React.FC<BotLogsProps> = ({ onRefreshState }) => {
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'e_count' | 'streak_break' | 'timeout' | 'command'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/bot/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bento Box */}
      <div className="bg-[#111113] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase font-mono tracking-widest mb-1.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Real-Time Bot Console</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Live Execution Stream</h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Real-time event stream of every message processed, streak calculation, penalty trigger, and slash command.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter Pills */}
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
            {(['all', 'e_count', 'streak_break', 'timeout', 'command'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  filter === f ? 'bg-white/10 text-emerald-400 border border-white/10 shadow-inner' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLogs}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition"
            title="Refresh logs"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log Feed Bento Card */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 overflow-hidden shadow-2xl font-mono text-xs">
        <div className="p-4 sm:p-5 bg-black/40 border-b border-white/10 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Displaying {filteredLogs.length} events (Auto-refreshing every 3s)</span>
          <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>STREAMING</span>
          </span>
        </div>

        <div className="p-5 space-y-2.5 max-h-[600px] overflow-y-auto divide-y divide-white/5 bg-black/50">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-sans">No logs matching the selected filter.</div>
          ) : (
            filteredLogs.map((log) => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString();
              let badgeColor = 'bg-white/10 text-slate-300';
              if (log.type === 'e_count') badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
              if (log.type === 'streak_break') badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
              if (log.type === 'timeout') badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
              if (log.type === 'command') badgeColor = 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
              if (log.type === 'success') badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';

              return (
                <div key={log.id} className="pt-2.5 flex items-start space-x-3 group">
                  <span className="text-slate-500 shrink-0 text-[11px] select-none font-mono">[{timeStr}]</span>
                  <span className={`px-2 py-0.5 rounded-lg uppercase text-[10px] font-bold shrink-0 ${badgeColor}`}>
                    {log.type}
                  </span>
                  <span className="text-slate-300 flex-1 break-words">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
