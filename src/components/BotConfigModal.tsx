import React, { useState } from 'react';
import { X, Hash, Radio, Check, Key, ExternalLink, Sparkles, Trophy } from 'lucide-react';
import { BotState } from '../types';

interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  botState: BotState;
  onRefreshState: () => void;
}

export const BotConfigModal: React.FC<BotConfigModalProps> = ({
  isOpen,
  onClose,
  botState,
  onRefreshState,
}) => {
  const [eChannelId, setEChannelId] = useState(botState.eChannelId || '1542084929171492955');
  const [numberChannelId, setNumberChannelId] = useState(botState.numberChannelId || '1542148410084171826');
  const [leaderboardChannelId, setLeaderboardChannelId] = useState(botState.numberLeaderboardChannelId || '1542151072032755893');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eChannelId: eChannelId.trim(),
          numberChannelId: numberChannelId.trim(),
          numberLeaderboardChannelId: leaderboardChannelId.trim() || null,
          botToken: token.trim() || undefined,
          clientId: clientId.trim() || undefined,
        }),
      });

      if (res.ok) {
        setMsg({ type: 'success', text: 'Multi-channel configuration saved successfully!' });
        onRefreshState();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const d = await res.json();
        setMsg({ type: 'error', text: d.error || 'Failed to save.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111113] rounded-3xl border border-white/10 w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Hash className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Channel & Bot Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {msg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold ${
                msg.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Number Counting Channel ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono flex items-center justify-between">
              <span>Target Number Counting Channel ID</span>
              <span className="text-[10px] text-emerald-400 font-bold">1, 2, 3... Sequence</span>
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={numberChannelId}
                onChange={(e) => setNumberChannelId(e.target.value)}
                placeholder="1542148410084171826"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* E Counting Channel ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono flex items-center justify-between">
              <span>Target 'E' Counting Channel ID</span>
              <span className="text-[10px] text-sky-400 font-bold">Strict 'e' Only</span>
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={eChannelId}
                onChange={(e) => setEChannelId(e.target.value)}
                placeholder="1542084929171492955"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Dedicated Live Auto-Updating Leaderboard Channel ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono flex items-center justify-between">
              <span>Live Auto-Updating Leaderboard Channel ID (Optional)</span>
              <span className="text-[10px] text-amber-400 font-bold">Embed Real-Time Hub</span>
            </label>
            <div className="relative">
              <Trophy className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={leaderboardChannelId}
                onChange={(e) => setLeaderboardChannelId(e.target.value)}
                placeholder="Paste channel ID for live auto-updating leaderboard embed..."
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              The bot will automatically refresh an embed in this channel after every single count!
            </p>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
              Discord Bot Token (Optional if using web simulator)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token to connect live bot..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
              Application / Client ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Application ID for slash commands (/leaderboard, /tictactoe)..."
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
