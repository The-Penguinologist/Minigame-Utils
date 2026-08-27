import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, CheckCircle2, UserX, AlertOctagon, RotateCcw } from 'lucide-react';
import { BotState, CooldownEntry } from '../types';

interface PenaltiesViewProps {
  botState: BotState;
  onRefreshState: () => void;
}

export const PenaltiesView: React.FC<PenaltiesViewProps> = ({ botState, onRefreshState }) => {
  const [now, setNow] = useState(Date.now());

  // Tick every second to update countdowns smoothly
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldownList: CooldownEntry[] = (Object.values(botState.cooldowns || {}) as CooldownEntry[]).filter(
    (cd) => now < cd.bannedUntil
  );

  const handleClearCooldown = async (userId: string) => {
    try {
      await fetch('/api/bot/clear-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      onRefreshState();
    } catch (err) {
      console.error('Failed to clear cooldown:', err);
    }
  };

  const handleClearAllCooldowns = async () => {
    for (const cd of cooldownList) {
      await fetch('/api/bot/clear-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cd.userId }),
      });
    }
    onRefreshState();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner (Bento Card) */}
      <div className="bg-[#111113] rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-red-400 font-bold text-xs uppercase font-mono tracking-widest mb-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>Rule Enforcement & Quarantine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">1-Hour Timeout Cooldown Chamber</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans leading-relaxed">
            When a user types anything other than <strong>'e'</strong> or attempts to send two consecutive 'e's, they are barred from sending any 'e' in #{botState.channelId} for exactly 1 hour.
          </p>
        </div>

        {cooldownList.length > 0 && (
          <button
            id="clear-all-cooldowns-btn"
            onClick={handleClearAllCooldowns}
            className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-5 py-3 rounded-2xl transition flex items-center space-x-2 shrink-0 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Clear All Timeouts ({cooldownList.length})</span>
          </button>
        )}
      </div>

      {/* Active Penalties Grid */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-6 sm:p-8">
        <h3 className="font-bold text-white text-base mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 text-red-400" />
            <span>Currently Serving 1-Hour Timeouts ({cooldownList.length})</span>
          </div>
        </h3>

        {cooldownList.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
            <p className="font-bold text-white text-base">No users currently penalized</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Everyone is in good standing. If someone breaks the streak in Discord channel #{botState.channelId}, their isolation countdown will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cooldownList.map((cd) => {
              const diffMs = Math.max(0, cd.bannedUntil - now);
              const minutes = Math.floor(diffMs / 60000);
              const seconds = Math.floor((diffMs % 60000) / 1000);

              const progressPercent = Math.min(
                100,
                Math.max(0, ((now - cd.bannedAt) / (3600 * 1000)) * 100)
              );

              return (
                <div
                  key={cd.userId}
                  className="bg-white/5 rounded-3xl p-5 border border-red-500/30 relative overflow-hidden shadow-lg"
                >
                  {/* Top Bar with user info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          cd.avatarUrl ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                        }
                        alt={cd.username}
                        className="w-11 h-11 rounded-2xl object-cover border-2 border-red-500/60"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-white">@{cd.username}</h4>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {cd.userId}</div>
                      </div>
                    </div>

                    {/* Countdown Clock */}
                    <div className="text-right">
                      <div className="text-lg font-black font-mono text-red-400 italic">
                        {minutes}:{seconds.toString().padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Remaining</div>
                    </div>
                  </div>

                  {/* Violation Reason */}
                  <div className="mt-3.5 bg-black/40 p-3 rounded-2xl text-xs text-slate-300 border border-white/5">
                    <span className="text-red-400 font-bold">Violation: </span>
                    <span>{cd.reason}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                      <span>Timeout Progress</span>
                      <span>{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                    <button
                      id={`unban-btn-${cd.userId}`}
                      onClick={() => handleClearCooldown(cd.userId)}
                      className="text-xs bg-white/10 hover:bg-red-500 text-white px-3.5 py-1.5 rounded-xl font-bold border border-white/10 transition flex items-center space-x-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Lift Penalty Early</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
