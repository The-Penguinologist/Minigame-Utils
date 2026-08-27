import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, AlertTriangle, Sparkles, Hash, Users, ShieldAlert, CheckCircle2, RotateCcw, HelpCircle, TerminalSquare, Swords, Gamepad2, Brain, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BotState, DiscordChatMessage } from '../types';
import { SIMULATED_USERS, SimulatorUser, BOT_USER_PROFILE } from '../data/mockUsers';

interface SimulatorChatProps {
  botState: BotState;
  onRefreshState: () => void;
}

export const SimulatorChat: React.FC<SimulatorChatProps> = ({ botState, onRefreshState }) => {
  const [activeChannelId, setActiveChannelId] = useState<string>(botState.numberChannelId || '1542148410084171826');
  const [currentUser, setCurrentUser] = useState<SimulatorUser>(SIMULATED_USERS[0]);
  const [customUsername, setCustomUsername] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<DiscordChatMessage[]>([
    {
      id: 'welcome_number',
      userId: BOT_USER_PROFILE.id,
      username: BOT_USER_PROFILE.username,
      avatarUrl: BOT_USER_PROFILE.avatar,
      content: '',
      timestamp: Date.now() - 120000,
      isBot: true,
      botEmbed: {
        title: '🔢 Number Counting Active in #' + (botState.numberChannelId || '1542148410084171826'),
        description: `Welcome to the sequential **Number Counting Channel**!\n\n**Rules:**\n• Count sequentially: **1, 2, 3, 4...**\n• Next number must be typed by a **different person**.\n• Typing the wrong number or consecutive double count resets streak to **0**!\n• Live Leaderboard updates every time something is counted!\n• Play minigames anytime with \`/tictactoe\`, \`/rps\`, \`/trivia\`.`,
        color: 0x57F287,
        fields: [
          { name: '🔢 Current Number', value: `\`${botState.currentNumber}\``, inline: true },
          { name: '➡️ Next Required', value: `\`${botState.currentNumber + 1}\``, inline: true },
          { name: '🏆 Highest Record', value: `\`${botState.highestNumber}\``, inline: true },
        ],
        footer: { text: `Target Channel ID: ${botState.numberChannelId || '1542148410084171826'}` },
      },
    },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isNumberChannel = activeChannelId === (botState.numberChannelId || '1542148410084171826');

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getEffectiveUser = () => {
    if (isCustom && customUsername.trim()) {
      return {
        id: 'user_custom_' + customUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
        username: customUsername.trim(),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        roleColor: '#00AFF4',
      };
    }
    return currentUser;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputValue;
    if (!rawText.trim() || isProcessing) return;

    const user = getEffectiveUser();
    const content = rawText.trim();
    setInputValue('');
    setIsProcessing(true);

    // 1. Slash command
    if (content.startsWith('/')) {
      const command = content.substring(1).trim().toLowerCase();
      const userMsg: DiscordChatMessage = {
        id: 'msg_' + Date.now(),
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatar,
        content: `/${command}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch('/api/bot/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command,
            user: { id: user.id, username: user.username },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const botMsg: DiscordChatMessage = {
            id: 'bot_' + Date.now(),
            userId: BOT_USER_PROFILE.id,
            username: BOT_USER_PROFILE.username,
            avatarUrl: BOT_USER_PROFILE.avatar,
            content: '',
            timestamp: Date.now(),
            isBot: true,
            botEmbed: data.embed,
            status: 'command_response',
          };
          setMessages((prev) => [...prev, botMsg]);
        } else {
          const errorData = await res.json();
          const errorMsg: DiscordChatMessage = {
            id: 'bot_err_' + Date.now(),
            userId: BOT_USER_PROFILE.id,
            username: BOT_USER_PROFILE.username,
            avatarUrl: BOT_USER_PROFILE.avatar,
            content: `❌ ${errorData.error || 'Unknown command.'} Available commands: \`/numberleaderboard\`, \`/leaderboard\`, \`/tictactoe\`, \`/rps\`, \`/trivia\`, \`/rules\``,
            timestamp: Date.now(),
            isBot: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } catch (err) {
        console.error('Command failed:', err);
      } finally {
        setIsProcessing(false);
        onRefreshState();
      }
      return;
    }

    // 2. Regular message in active channel
    const userMsg: DiscordChatMessage = {
      id: 'msg_' + Date.now(),
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatar,
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatar,
          },
          content,
          channelId: activeChannelId,
        }),
      });

      if (res.ok) {
        const { result } = await res.json();

        // Attach tick reaction to user's message if count was valid
        if (result.reactionEmoji) {
          setMessages((prev) =>
            prev.map((m) => (m.id === userMsg.id ? { ...m, reactionEmoji: result.reactionEmoji } : m))
          );
        }

        // Confetti if new record
        if (result.success) {
          if (
            (isNumberChannel && result.currentNumber > botState.highestNumber && result.currentNumber > 1) ||
            (!isNumberChannel && result.currentCount > botState.highestCount && result.currentCount > 1)
          ) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        }

        if (result.embedData) {
          const botMsg: DiscordChatMessage = {
            id: 'bot_' + Date.now(),
            userId: BOT_USER_PROFILE.id,
            username: BOT_USER_PROFILE.username,
            avatarUrl: BOT_USER_PROFILE.avatar,
            content: '',
            timestamp: Date.now(),
            isBot: true,
            botEmbed: result.embedData,
            status: result.type,
          };
          setMessages((prev) => [...prev, botMsg]);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsProcessing(false);
      onRefreshState();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeUser = getEffectiveUser();

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Bento Grid Top Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Active Streak Bento Card */}
        <div className="md:col-span-5 lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden min-h-[220px]">
          <div className="relative z-10">
            <p className="text-xs uppercase font-bold text-emerald-500 tracking-widest mb-1">
              {isNumberChannel ? 'Current Sequence' : 'Current E Streak'}
            </p>
            <h2 className="text-7xl sm:text-8xl font-black tracking-tighter text-white italic">
              {isNumberChannel ? botState.currentNumber : botState.currentCount}
            </h2>
          </div>

          <div className="absolute -right-6 -bottom-6 opacity-5 select-none pointer-events-none">
            <span className="text-[170px] font-black text-white font-serif">
              {isNumberChannel ? '#' : 'e'}
            </span>
          </div>

          <div className="z-10 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/5 mt-4">
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mb-1">
              {isNumberChannel ? `Next Required Number: ${botState.currentNumber + 1}` : 'Last Entry'}
            </p>
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-white truncate max-w-[140px]">
                {isNumberChannel
                  ? botState.lastNumberUsername ? `@${botState.lastNumberUsername}` : 'None yet'
                  : botState.lastUsername ? `@${botState.lastUsername}` : 'None yet'}
              </span>
              <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {isNumberChannel ? `+1 count` : '+1 e'}
              </span>
            </div>
          </div>
        </div>

        {/* Record Card */}
        <div className="md:col-span-7 lg:col-span-4 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden min-h-[220px]">
          <div>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-1">
              All-Time Record
            </p>
            <h2 className="text-5xl sm:text-6xl font-black text-white italic tracking-tight mt-1">
              {isNumberChannel
                ? botState.highestNumber.toLocaleString()
                : botState.highestCount.toLocaleString()}
            </h2>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              Channel #{activeChannelId}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-2xl border border-white/5">
            <span className="text-xs text-slate-400">
              {isNumberChannel ? 'Leaderboard Auto-Updates' : "Total 'e's Spoken"}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {isNumberChannel ? 'Active in Real-time' : 'Tracked'}
            </span>
          </div>
        </div>

        {/* Channel Switcher Card */}
        <div className="md:col-span-12 lg:col-span-4 bg-[#111113] border border-white/10 rounded-3xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                ACTIVE SIMULATION CHANNEL
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setActiveChannelId(botState.numberChannelId || '1542148410084171826')}
                className={`w-full p-3 rounded-2xl text-left border transition flex items-center justify-between ${
                  isNumberChannel
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-white font-bold'
                    : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs">#number-counting</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID: {botState.numberChannelId || '1542148410084171826'}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-400">Streak: {botState.currentNumber}</span>
              </button>

              <button
                onClick={() => setActiveChannelId(botState.eChannelId || '1542084929171492955')}
                className={`w-full p-3 rounded-2xl text-left border transition flex items-center justify-between ${
                  activeChannelId === (botState.eChannelId || '1542084929171492955')
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-white font-bold'
                    : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm text-sky-400">"e"</span>
                  <div>
                    <div className="text-xs">#e-counting</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID: {botState.eChannelId || '1542084929171492955'}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-sky-400">Streak: {botState.currentCount}</span>
              </button>

              <button
                onClick={() => setActiveChannelId(botState.numberLeaderboardChannelId || '1542151072032755893')}
                className={`w-full p-3 rounded-2xl text-left border transition flex items-center justify-between ${
                  activeChannelId === (botState.numberLeaderboardChannelId || '1542151072032755893')
                    ? 'bg-amber-500/15 border-amber-500/40 text-white font-bold'
                    : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-xs">#leaderboards</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID: {botState.numberLeaderboardChannelId || '1542151072032755893'}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-amber-400">Live Hub</span>
              </button>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Next expected:</span>
            <strong className="text-emerald-400">
              {isNumberChannel ? `"${botState.currentNumber + 1}"` : `"e"`}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Interactive Discord Simulator Frame */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[640px]">
        {/* Discord Simulator Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">
                  {activeChannelId === (botState.numberLeaderboardChannelId || '1542151072032755893')
                    ? 'live-leaderboards'
                    : isNumberChannel
                    ? 'number-counting'
                    : 'e-counting'}
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400 font-mono">
                  Channel ID: {activeChannelId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeChannelId === (botState.numberLeaderboardChannelId || '1542151072032755893')
                  ? 'Real-time auto-updating leaderboard embed hub for both Number & E count channels'
                  : isNumberChannel
                  ? 'Sequential counting • Alternate players • Real-time auto-updating leaderboard'
                  : "Strict 'e' sequence • Alternate players • 1h Timeout on fouls"}
              </p>
            </div>
          </div>

          {/* User Persona Switcher */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">Active Persona:</span>
            <div className="flex items-center bg-black/60 border border-white/10 rounded-2xl p-1">
              {SIMULATED_USERS.slice(0, 4).map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setIsCustom(false);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs flex items-center space-x-1.5 transition ${
                    !isCustom && currentUser.id === u.id
                      ? 'bg-emerald-500 text-black font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <img src={u.avatar} alt={u.username} className="w-4 h-4 rounded-full object-cover" />
                  <span className="hidden md:inline">{u.username.split('_')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans">
          {messages.map((msg) => {
            const isBotMsg = msg.isBot;
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 group animate-in fade-in slide-in-from-bottom-1 duration-150 ${
                  isBotMsg ? 'bg-white/[0.02] -mx-4 px-4 py-2 rounded-2xl' : ''
                }`}
              >
                <img
                  src={
                    msg.avatarUrl ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={msg.username}
                  className="w-9 h-9 rounded-2xl object-cover shrink-0 border border-white/10 mt-0.5"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        isBotMsg ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {msg.username}
                    </span>
                    {isBotMsg && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded">
                        BOT
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {msg.content && (
                    <p className="text-sm text-slate-200 break-words font-mono bg-black/30 inline-block px-3 py-1.5 rounded-xl border border-white/5">
                      {msg.content}
                    </p>
                  )}

                  {/* Reaction Badge */}
                  {msg.reactionEmoji && (
                    <div className="mt-1 flex items-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono shadow-sm">
                        <span className="text-sm">{msg.reactionEmoji}</span>
                        <span className="text-[10px] text-slate-400 font-extrabold font-mono ml-0.5">1</span>
                      </span>
                    </div>
                  )}

                  {/* Discord Embed Rendering */}
                  {msg.botEmbed && (
                    <div
                      className={`mt-2 border-l-4 rounded-2xl p-4 bg-black/40 border border-white/10 max-w-xl shadow-lg ${
                        msg.botEmbed.color === 0xED4245
                          ? 'border-l-red-500'
                          : msg.botEmbed.color === 0xFEE75C
                          ? 'border-l-amber-400'
                          : msg.botEmbed.color === 0x57F287
                          ? 'border-l-emerald-400'
                          : 'border-l-indigo-500'
                      }`}
                    >
                      {msg.botEmbed.title && (
                        <h4 className="font-bold text-white text-sm tracking-tight mb-2">
                          {msg.botEmbed.title}
                        </h4>
                      )}

                      {msg.botEmbed.description && (
                        <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed mb-3">
                          {msg.botEmbed.description}
                        </div>
                      )}

                      {msg.botEmbed.fields && msg.botEmbed.fields.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3 pt-2 border-t border-white/5 text-xs">
                          {msg.botEmbed.fields.map((f: any, i: number) => (
                            <div key={i} className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">
                                {f.name}
                              </span>
                              <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                                {f.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.botEmbed.footer && (
                        <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5 flex items-center justify-between">
                          <span>{msg.botEmbed.footer.text}</span>
                          <span className="text-emerald-400">⚡ Live Stream</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Action Test Pills Bar */}
        <div className="px-6 py-2 bg-black/60 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mr-1">
            Quick Actions:
          </span>

          {isNumberChannel ? (
            <>
              <button
                onClick={() => handleSendMessage(String(botState.currentNumber + 1))}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-mono font-bold transition flex items-center space-x-1"
              >
                <span>Valid:</span>
                <strong className="text-white">"{botState.currentNumber + 1}"</strong>
              </button>

              <button
                onClick={() => handleSendMessage(String(botState.currentNumber + 99))}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-xl font-mono transition"
                title="Test wrong number streak reset"
              >
                Test Wrong #{botState.currentNumber + 99}
              </button>

              <button
                onClick={() => handleSendMessage(String(botState.currentNumber))}
                className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-xl font-mono transition"
                title="Test consecutive repeat streak reset"
              >
                Test Repeat #{botState.currentNumber}
              </button>

              <button
                onClick={() => handleSendMessage('/numberleaderboard')}
                className="bg-white/5 hover:bg-white/10 text-slate-300 px-2.5 py-1 rounded-xl font-mono transition"
              >
                /numberleaderboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSendMessage('e')}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl font-mono font-bold transition flex items-center space-x-1"
              >
                <span>Send</span>
                <strong className="text-white">"e"</strong>
              </button>

              <button
                onClick={() => handleSendMessage('E')}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl font-mono transition"
              >
                Send "E"
              </button>

              <button
                onClick={() => handleSendMessage('hello world')}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/20 px-2.5 py-1 rounded-xl font-mono transition"
                title="Test non-e penalty & reset"
              >
                Test Foul ("hello")
              </button>

              <button
                onClick={() => handleSendMessage('/leaderboard')}
                className="bg-white/5 hover:bg-white/10 text-slate-300 px-2.5 py-1 rounded-xl font-mono transition"
              >
                /leaderboard
              </button>
            </>
          )}

          {/* Minigames quick commands */}
          <button
            onClick={() => handleSendMessage('/tictactoe')}
            className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-xl font-mono transition"
          >
            /tictactoe
          </button>
          <button
            onClick={() => handleSendMessage('/rps')}
            className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-xl font-mono transition"
          >
            /rps
          </button>
          <button
            onClick={() => handleSendMessage('/trivia')}
            className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-xl font-mono transition"
          >
            /trivia
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/50 flex items-center space-x-3">
          <input
            type="text"
            placeholder={
              isNumberChannel
                ? `Type "${botState.currentNumber + 1}" or a command (/numberleaderboard, /tictactoe)...`
                : `Type "e" or a slash command (/leaderboard, /rules)...`
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isProcessing}
            className="p-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-black font-bold rounded-2xl transition shadow-lg shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
