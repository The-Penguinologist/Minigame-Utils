import React, { useState } from 'react';
import { Radio, ExternalLink, Copy, Check, ShieldCheck, Key, Hash, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { BotState } from '../types';

interface SetupGuideProps {
  botState: BotState;
  onRefreshState: () => void;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ botState, onRefreshState }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [eChannelIdInput, setEChannelIdInput] = useState(botState.eChannelId || '1542084929171492955');
  const [numberChannelIdInput, setNumberChannelIdInput] = useState(botState.numberChannelId || '1542148410084171826');
  const [leaderboardChannelIdInput, setLeaderboardChannelIdInput] = useState(botState.numberLeaderboardChannelId || '1542151072032755893');
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const effectiveClientId = clientIdInput.trim() || '123456789012345678';
  // Standard Discord bot permissions: Send Messages, Send Messages in Threads, Embed Links, Attach Files, Read Message History, Use Slash Commands
  const botPermissions = '274877908992';
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${effectiveClientId}&permissions=${botPermissions}&scope=bot%20applications.commands`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleUpdateChannels = async () => {
    try {
      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eChannelId: eChannelIdInput.trim(),
          numberChannelId: numberChannelIdInput.trim(),
          numberLeaderboardChannelId: leaderboardChannelIdInput.trim(),
        }),
      });
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Channels configured: 'E' (#${eChannelIdInput}), Number (#${numberChannelIdInput}), Leaderboard (#${leaderboardChannelIdInput})`,
        });
        onRefreshState();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleConnectBot = async () => {
    if (!tokenInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Discord Bot Token first.' });
      return;
    }

    setIsConnecting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/bot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          clientId: clientIdInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.result?.success) {
        setStatusMessage({
          type: 'success',
          text: '🎉 Discord Bot connected successfully to Gateway and listening on channel #' + botState.channelId,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || data.result?.message || 'Failed to connect. Check token and Message Content Intent.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Connection failed: ' + err.message });
    } finally {
      setIsConnecting(false);
      onRefreshState();
    }
  };

  const handleDisconnectBot = async () => {
    try {
      await fetch('/api/bot/disconnect', { method: 'POST' });
      setStatusMessage({ type: 'success', text: 'Discord Bot disconnected.' });
      onRefreshState();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Bot Connection Card (Bento Container) */}
      <div className="bg-[#111113] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-6">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase font-mono tracking-widest mb-1.5">
              <Radio className="w-4 h-4" />
              <span>Live Gateway Protocol</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Discord Bot Integration & Setup</h2>
            <p className="text-xs text-slate-400 mt-1">
              Connect your Discord Bot token to run the bot in your actual server, or use the built-in simulator.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {botState.botStatus === 'online' ? (
              <button
                id="disconnect-bot-btn"
                onClick={handleDisconnectBot}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow"
              >
                <span>Disconnect Bot</span>
              </button>
            ) : (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Ready to Connect
              </span>
            )}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold mb-6 flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Token & Channel Credentials */}
          <div className="space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Bot Credentials & Channel Configuration</span>
            </h3>

            {/* Channel IDs */}
            <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center justify-between">
                  <span>Number Counting Channel</span>
                  <span className="text-[10px] text-emerald-400 font-bold">1, 2, 3...</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="setup-number-channel-id-input"
                    type="text"
                    value={numberChannelIdInput}
                    onChange={(e) => setNumberChannelIdInput(e.target.value)}
                    placeholder="1542148410084171826"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center justify-between">
                  <span>'E' Counting Channel</span>
                  <span className="text-[10px] text-sky-400 font-bold">Strict 'e'</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="setup-e-channel-id-input"
                    type="text"
                    value={eChannelIdInput}
                    onChange={(e) => setEChannelIdInput(e.target.value)}
                    placeholder="1542084929171492955"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono flex items-center justify-between">
                  <span>Live Leaderboard Channel</span>
                  <span className="text-[10px] text-amber-400 font-bold">Auto-Updates</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="setup-leaderboard-channel-id-input"
                    type="text"
                    value={leaderboardChannelIdInput}
                    onChange={(e) => setLeaderboardChannelIdInput(e.target.value)}
                    placeholder="1542151072032755893"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                id="save-channels-btn"
                onClick={handleUpdateChannels}
                className="w-full bg-white/5 hover:bg-white/10 text-white py-2 rounded-xl text-xs font-semibold border border-white/10 transition"
              >
                Save Channels Configuration
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                Discord Bot Token
              </label>
              <input
                id="setup-bot-token-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="MTE5... (Bot token from Discord Dev Portal)"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                Discord Client ID (Application ID)
              </label>
              <input
                id="setup-client-id-input"
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="e.g. 1542084929171492955"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              id="connect-gateway-btn"
              onClick={handleConnectBot}
              disabled={isConnecting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-2xl text-xs transition shadow-lg flex items-center justify-center space-x-2"
            >
              <Radio className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting to Discord Gateway...' : 'Start Discord Bot'}</span>
            </button>
          </div>

          {/* Right: One-Click Invite Link Generator */}
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center space-x-2 mb-2">
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>One-Click Bot Invite Generator</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Pre-configured with <code>applications.commands</code> slash command scope, Embed permissions, and Message history.
              </p>

              <div className="bg-black/50 p-3.5 rounded-2xl border border-white/10 break-all font-mono text-[11px] text-slate-300">
                {inviteUrl}
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                id="copy-invite-url-btn"
                onClick={handleCopyInvite}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/10 transition flex items-center justify-center space-x-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Invite URL'}</span>
              </button>

              <a
                id="open-invite-discord-btn"
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 text-center shadow"
              >
                <span>Authorize on Discord</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Discord Setup Tutorial (Bento Cards) */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-emerald-400" />
          <span>Step-by-Step Discord Developer Portal Guide</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2">
            <span className="w-7 h-7 rounded-xl bg-white/10 text-emerald-400 border border-white/10 font-black text-xs flex items-center justify-center">
              01
            </span>
            <h4 className="font-bold text-white text-xs">Create Application</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Visit <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-emerald-400 underline">discord.com/developers</a>, click <strong>"New Application"</strong>, and name it <strong>"E Counter"</strong>.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2">
            <span className="w-7 h-7 rounded-xl bg-white/10 text-emerald-400 border border-white/10 font-black text-xs flex items-center justify-center">
              02
            </span>
            <h4 className="font-bold text-white text-xs">Enable Message Content</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              In the <strong>Bot</strong> tab, scroll to <strong>Privileged Gateway Intents</strong> and enable <strong>"MESSAGE CONTENT INTENT"</strong>.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2">
            <span className="w-7 h-7 rounded-xl bg-white/10 text-emerald-400 border border-white/10 font-black text-xs flex items-center justify-center">
              03
            </span>
            <h4 className="font-bold text-white text-xs">Copy Token & Add Bot</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Click <strong>"Reset Token"</strong> in the Bot tab, copy the token, and use our <strong>Invite Link</strong> to add the bot to your Discord server.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-2">
            <span className="w-7 h-7 rounded-xl bg-emerald-500 text-black font-black text-xs flex items-center justify-center">
              04
            </span>
            <h4 className="font-bold text-white text-xs">Enjoy Counting 'e'</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              In channel <code className="text-emerald-400">#{botState.channelId}</code>, start typing <code className="text-emerald-400">e</code> or type <code>/leaderboard</code>!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
