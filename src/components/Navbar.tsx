import React from 'react';
import { Activity, Radio, MessageSquare, Trophy, ShieldAlert, BookOpen, Terminal, Code2, Gamepad2, Hash } from 'lucide-react';
import { BotState } from '../types';

interface NavbarProps {
  activeTab: 'simulator' | 'leaderboard' | 'minigames' | 'penalties' | 'setup' | 'logs' | 'code';
  setActiveTab: (tab: 'simulator' | 'leaderboard' | 'minigames' | 'penalties' | 'setup' | 'logs' | 'code') => void;
  botState: BotState;
  onOpenConfig: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  botState,
  onOpenConfig,
}) => {
  const isOnline = botState.botStatus === 'online';

  return (
    <header className="bg-[#09090B]/90 backdrop-blur-md text-slate-200 border-b border-white/10 select-none sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-2xl text-emerald-400 italic shadow-inner">
              #1
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-white">
                  NUMBER & MINIGAMES <span className="text-emerald-500">ARCADE BOT</span>
                </h1>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v3.0 GEMMA
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                <button
                  id="navbar-channel-btn"
                  onClick={onOpenConfig}
                  className="font-mono text-[11px] text-emerald-400 hover:text-emerald-300 bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 transition flex items-center space-x-1.5"
                  title="Click to configure channels"
                >
                  <span>Number Channel: #{botState.numberChannelId || '1542148410084171826'}</span>
                  <span>•</span>
                  <span className="text-amber-400">Leaderboard: #{botState.numberLeaderboardChannelId || '1542151072032755893'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center Quick Stats Badges (Bento Style) */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center space-x-4 shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Number Streak:</span>
                <span className="text-base font-black text-emerald-400 font-mono italic">
                  {botState.currentNumber}
                </span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Record:</span>
                <span className="text-base font-black text-amber-400 font-mono italic">
                  {botState.highestNumber}
                </span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Threads:</span>
                <span className="text-xs font-semibold text-indigo-400 font-mono">
                  {Object.keys(botState.threads || {}).length} Active
                </span>
              </div>
            </div>
          </div>

          {/* Right Action & Connection Indicator */}
          <div className="flex items-center space-x-3">
            <button
              id="navbar-status-indicator-btn"
              onClick={onOpenConfig}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] tracking-widest">{isOnline ? 'Gateway Live' : 'Active (Sim)'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Bento Pills) */}
        <div className="flex space-x-2 overflow-x-auto py-2.5 border-t border-white/10 scrollbar-none text-xs font-medium">
          <button
            id="tab-simulator-btn"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'simulator'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live Discord Simulator</span>
          </button>

          <button
            id="tab-leaderboard-btn"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'leaderboard'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Top 20 Leaderboards</span>
          </button>

          <button
            id="tab-minigames-btn"
            onClick={() => setActiveTab('minigames')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'minigames'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gemma Minigames</span>
            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              NEW
            </span>
          </button>

          <button
            id="tab-penalties-btn"
            onClick={() => setActiveTab('penalties')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'penalties'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Cooldowns & Penalties</span>
            {Object.keys(botState.cooldowns).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold font-mono">
                {Object.keys(botState.cooldowns).length}
              </span>
            )}
          </button>

          <button
            id="tab-setup-btn"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'setup'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bot Setup & Invite</span>
          </button>

          <button
            id="tab-code-btn"
            onClick={() => setActiveTab('code')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'code'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Source Export</span>
          </button>

          <button
            id="tab-logs-btn"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl transition whitespace-nowrap border ${
              activeTab === 'logs'
                ? 'bg-white/10 text-white font-bold border-white/15 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Logs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
