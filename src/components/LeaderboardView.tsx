import React, { useState } from 'react';
import { Trophy, Flame, RotateCcw, Search, Crown, Hash, Sparkles } from 'lucide-react';
import { BotState, NumberUserStats } from '../types';

interface LeaderboardViewProps {
  botState: BotState;
  onRefreshState: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ botState, onRefreshState }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Number Users
  const allNumberUsers: NumberUserStats[] = (Object.values(botState.numberLeaderboard || {}) as NumberUserStats[]).sort(
    (a, b) => b.totalNumbersCounted - a.totalNumbersCounted
  );
  const top20Number = allNumberUsers.slice(0, 20);
  const filteredNumberUsers = top20Number.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const topNumberPlayer = allNumberUsers.length > 0 ? allNumberUsers[0] : null;
  const totalNumbersAllPlayers = allNumberUsers.reduce((sum, u) => sum + u.totalNumbersCounted, 0);

  const handleResetStreak = async () => {
    if (window.confirm('Reset current Number Counter active streak back to 0?')) {
      try {
        await fetch('/api/bot/reset-streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelType: 'number' }),
        });
        onRefreshState();
      } catch (err) {
        console.error('Failed to reset streak:', err);
      }
    }
  };

  const handleResetAllData = async () => {
    if (window.confirm('Reset ALL leaderboard records, scores, and active streaks to 0? This clears all stored stats.')) {
      try {
        await fetch('/api/bot/reset-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        onRefreshState();
      } catch (err) {
        console.error('Failed to reset all data:', err);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Header & Channel Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111113] p-4 rounded-3xl border border-white/10">
        <div className="flex items-center space-x-2 bg-black/50 px-4 py-2 rounded-2xl border border-white/10">
          <Hash className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">
            Number Counting Leaderboard (Channel ID: {botState.numberChannelId || '1542148410084171826'})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboard Channel: #{botState.numberLeaderboardChannelId || '1542151072032755893'}</span>
          </div>

          <span className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live Auto-Update Active</span>
          </span>

          <button
            onClick={onRefreshState}
            className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition text-xs font-semibold"
            title="Refresh state"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Champion Spotlight & Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* All-Time Champion Card */}
        <div className="md:col-span-8 bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none select-none">
            <Trophy className="w-64 h-64 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase font-mono tracking-widest mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>All-Time #1 Number Counting Champion</span>
            </div>

            {topNumberPlayer ? (
              <div className="flex items-center space-x-5 mt-2">
                <div className="relative">
                  <img
                    src={
                      topNumberPlayer.avatarUrl ||
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                    }
                    alt={topNumberPlayer.username}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-emerald-500/80 object-cover shadow-lg"
                  />
                  <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-black font-black text-xs px-2 py-0.5 rounded-full shadow">
                    01
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    @{topNumberPlayer.username}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5 font-mono">
                    <span>
                      Total Numbers Counted:{' '}
                      <strong className="text-emerald-400 text-sm">{topNumberPlayer.totalNumbersCounted}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Peak Streak Contribution:{' '}
                      <strong className="text-sky-400">{topNumberPlayer.highestStreakContribution}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No numbers counted yet! Type `1` in #{botState.numberChannelId || '1542148410084171826'} to claim #1.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-white/10 text-xs">
            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Current Sequence</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono italic mt-0.5">
                {botState.currentNumber}{' '}
                <span className="text-xs font-bold not-italic text-emerald-500">
                  (Next: {botState.currentNumber + 1})
                </span>
              </div>
            </div>
            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Highest Record</span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono italic mt-0.5">
                {botState.highestNumber}{' '}
                <span className="text-xs font-bold not-italic text-amber-400">peak</span>
              </div>
            </div>
            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Total Volume</span>
              <div className="text-xl sm:text-2xl font-black text-sky-400 font-mono italic mt-0.5">
                {totalNumbersAllPlayers}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Rules & Actions */}
        <div className="md:col-span-4 bg-[#111113] rounded-3xl p-6 border border-white/10 flex flex-col justify-between space-y-4 shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Number Rules & Protocol</span>
              </h4>
              <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10">
                /numberleaderboard
              </span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Sequential numbers only: <strong>1, 2, 3, 4...</strong></span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Tick reactions: <strong>✅</strong> for counts ≤ record, <strong>☑️</strong> for counts surpassing record.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Each number must be from a <strong>different player</strong>.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-400 font-bold">✗</span>
                <span>Wrong number or consecutive duplicate resets counter to <strong>0</strong>.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetStreak}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/10 transition flex items-center justify-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Streak</span>
              </button>
              <button
                onClick={onRefreshState}
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition shadow"
              >
                Refresh
              </button>
            </div>
            <button
              onClick={handleResetAllData}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-medium border border-red-500/20 transition flex items-center justify-center space-x-1.5"
              title="Clear all stored statistics and reset to 0"
            >
              <span>Wipe / Reset All Stored Stats to 0</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 20 Table */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Header Bar with Search */}
        <div className="px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-white text-lg tracking-tight flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Top 20 Number Counting Leaders</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live data from Channel ID: {botState.numberChannelId || '1542148410084171826'}
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-56 font-sans"
            />
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/5 overflow-x-auto">
          {filteredNumberUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500 font-mono">
              No contributors match your search query.
            </div>
          ) : (
            filteredNumberUsers.map((user, index) => {
              const rank = index + 1;
              const rankFormatted = rank < 10 ? `0${rank}` : `${rank}`;
              const percent = totalNumbersAllPlayers > 0 ? ((user.totalNumbersCounted / totalNumbersAllPlayers) * 100).toFixed(1) : '0';

              return (
                <div
                  key={user.userId}
                  className={`px-6 py-4 flex items-center justify-between transition ${
                    rank === 1 ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-8 flex items-center justify-center font-bold font-mono text-sm shrink-0">
                      {rank === 1 ? (
                        <span className="text-emerald-400 font-black">{rankFormatted}</span>
                      ) : rank <= 3 ? (
                        <span className="text-slate-200 font-bold">{rankFormatted}</span>
                      ) : (
                        <span className="text-slate-500 font-medium">{rankFormatted}</span>
                      )}
                    </div>

                    <img
                      src={
                        user.avatarUrl ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-white/10"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white truncate">
                          {user.username}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Peak streak contribution: {user.highestStreakContribution} • {user.failedCount} foul(s)
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-white font-mono italic">
                      {user.totalNumbersCounted}{' '}
                      <span className="text-xs font-normal not-italic text-emerald-400">counts</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{percent}% of total</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Showing Top 20 Protocol Entries • Auto-Updates in Real-Time
          </p>
        </div>
      </div>
    </div>
  );
};
