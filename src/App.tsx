import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Database, ShieldCheck, Terminal, Hash, Award, CheckCircle2, RefreshCw, Cpu, Layers } from 'lucide-react';

interface BotState {
  currentNumber: number;
  highestNumber: number;
  numberChannelId: string;
  numberLeaderboardChannelId?: string;
  lastNumberUserId?: string | null;
  lastNumberUsername?: string | null;
  topNumberPlayer?: { username: string; count: number } | null;
  botStatus: 'online' | 'simulated';
  botUser?: { username: string; tag: string };
}

export default function App() {
  const [botState, setBotState] = useState<BotState>({
    currentNumber: 0,
    highestNumber: 0,
    numberChannelId: '1542148410084171826',
    numberLeaderboardChannelId: '1542151072032755893',
    botStatus: 'simulated',
  });
  const [setCountInput, setSetCountInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBotState = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/state');
      if (res.ok) {
        const data = await res.json();
        setBotState(data);
      }
    } catch (err) {
      console.error('Failed to fetch bot state:', err);
    }
  }, []);

  useEffect(() => {
    fetchBotState();
    const interval = setInterval(fetchBotState, 3000);
    return () => clearInterval(interval);
  }, [fetchBotState]);

  const handleSetCount = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(setCountInput, 10);
    if (isNaN(num) || num < 0) {
      setStatusMessage({ text: 'Please enter a valid positive number.', type: 'error' });
      return;
    }

    setIsUpdating(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberChannelId: botState.numberChannelId }),
      });

      // Update count via simulated command API
      const cmdRes = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { id: 'admin_dashboard', username: 'Dashboard Admin' },
          content: `!setcount ${num}`,
          channelId: botState.numberChannelId,
        }),
      });

      if (cmdRes.ok) {
        setStatusMessage({ text: `Counter set to ${num}! Next required count is ${num + 1}.`, type: 'success' });
        setSetCountInput('');
        fetchBotState();
      } else {
        setStatusMessage({ text: 'Failed to update counter.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-100 font-sans antialiased flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0E1117] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                Discord Arcade & Counting Bot
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  botState.botStatus === 'online'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${botState.botStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {botState.botStatus === 'online' ? 'Bot Live in Discord' : 'Standalone Server Mode'}
                </span>
              </h1>
              <p className="text-xs text-slate-400">Pure Discord Bot Service • Powered by SQLite Database</p>
            </div>
          </div>
          <button
            onClick={fetchBotState}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh State
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Status Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>CURRENT SEQUENCE COUNT</span>
              <Hash className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {botState.currentNumber.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Next required number: <span className="text-emerald-400 font-semibold font-mono">{(botState.currentNumber + 1).toLocaleString()}</span>
            </p>
          </div>

          <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>ALL-TIME RECORD</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
              {botState.highestNumber.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Highest sequence reached by community
            </p>
          </div>

          <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>DATABASE STORAGE</span>
              <Database className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-base font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              SQLite Persistent DB
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Saved to <code className="text-indigo-300 font-mono">database.sqlite</code> on disk
            </p>
          </div>
        </div>

        {/* Manual Set Count Card */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Set Counting Number</h2>
              <p className="text-xs text-slate-400">
                If the bot was down or community advanced offline, set the current count here (or use <code className="text-emerald-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded">!setcount 1500</code> in Discord).
              </p>
            </div>
          </div>

          <form onSubmit={handleSetCount} className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              min="0"
              placeholder="e.g. 1500"
              value={setCountInput}
              onChange={(e) => setSetCountInput(e.target.value)}
              className="flex-1 bg-[#0A0C10] border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isUpdating}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Set Counter Number'}
            </button>
          </form>

          {statusMessage && (
            <div className={`mt-3 p-3 rounded-xl text-xs font-medium border ${
              statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {statusMessage.text}
            </div>
          )}
        </div>

        {/* Discord Commands Reference */}
        <div className="bg-[#121620] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Discord Bot Commands</h2>
              <p className="text-xs text-slate-400">All commands available in your Discord server</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">!setcount &lt;num&gt;</span>
              <div>
                <div className="text-white font-medium">Set Current Count</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Example: <code className="text-indigo-300 font-mono">!setcount 1500</code> (sets count to 1500, next is 1501)</div>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">/setcount &lt;num&gt;</span>
              <div>
                <div className="text-white font-medium">Slash Command: Set Count</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Updates SQLite database & clears last user lockout</div>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">/numberleaderboard</span>
              <div>
                <div className="text-white font-medium">View Leaderboard</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Displays Top 20 players & all-time stats</div>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">/tictactoe</span>
              <div>
                <div className="text-white font-medium">Minigames: Tic-Tac-Toe</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Play against Gemma AI or another server member</div>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">/rps & /trivia</span>
              <div>
                <div className="text-white font-medium">RPS & Gemini Trivia</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Interactive Rock-Paper-Scissors and AI Trivia Quizzes</div>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C10] border border-slate-800/80 rounded-xl flex items-start gap-3">
              <span className="font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">/setleaderboardchannel</span>
              <div>
                <div className="text-white font-medium">Auto-Updating Leaderboard Channel</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Posts & edits a live updating leaderboard embed</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0E1117] px-6 py-4 text-center text-xs text-slate-500">
        Discord Bot Backend • SQLite Database Persistence • Node.js Engine
      </footer>
    </div>
  );
}
