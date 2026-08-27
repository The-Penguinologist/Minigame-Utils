import React, { useState } from 'react';
import {
  Gamepad2,
  Sparkles,
  Bot,
  User,
  Swords,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  ArrowLeft,
  Send,
  Plus,
  Flame,
  Award,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BotState, MinigameThread } from '../types';

interface MinigamesArcadeProps {
  botState: BotState;
  onRefreshState: () => void;
}

export const MinigamesArcade: React.FC<MinigamesArcadeProps> = ({ botState, onRefreshState }) => {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<'tictactoe' | 'rps' | 'trivia' | 'connect4' | 'math' | 'wordle'>('tictactoe');
  const [opponentType, setOpponentType] = useState<'ai' | 'player'>('ai');
  const [opponentUsername, setOpponentUsername] = useState('Alex');

  // Input states inside active thread
  const [threadInput, setThreadInput] = useState('');
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  const gameCatalog = [
    {
      id: 'tictactoe',
      title: 'Tic-Tac-Toe',
      description: '3-in-a-row classic grid battle against Gemma AI or players.',
      icon: '❌⭕',
      color: 'from-blue-600 to-indigo-600',
    },
    {
      id: 'rps',
      title: 'RPS Showdown',
      description: 'Rock, Paper, Scissors speed duel with instant commentary.',
      icon: '🪨📄✂️',
      color: 'from-purple-600 to-pink-600',
    },
    {
      id: 'trivia',
      title: 'AI Trivia Quiz',
      description: 'Test your knowledge across science, tech & gaming categories.',
      icon: '🧠❓',
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'connect4',
      title: 'Connect 4',
      description: 'Drop discs into 7 columns and connect 4 in a row to win.',
      icon: '🔴🟡',
      color: 'from-red-500 to-rose-600',
    },
    {
      id: 'math',
      title: 'Math Speed Duel',
      description: 'Solve multiplication and mental math fast under pressure.',
      icon: '⚡🔢',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'wordle',
      title: 'Wordle Guess',
      description: 'Guess the secret 5-letter word in 6 tries with color feedback.',
      icon: '🟩🟨⬛',
      color: 'from-cyan-600 to-blue-700',
    },
  ];

  const threadsList: MinigameThread[] = Object.values(botState.threads || {});
  const activeThread: MinigameThread | null = activeThreadId ? botState.threads?.[activeThreadId] || null : null;

  const handleOpenGameChallenge = (gameType: any) => {
    setSelectedGameType(gameType);
    setIsChallengeModalOpen(true);
  };

  const handleCreateThreadGame = async () => {
    try {
      const challenger = {
        id: 'user_player',
        username: 'You (Player)',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      };

      const opponent = opponentType === 'ai'
        ? { id: 'bot_gemma', username: 'Gemma AI', isBot: true }
        : {
            id: 'user_' + opponentUsername.toLowerCase().replace(/\s+/g, '_'),
            username: opponentUsername || 'ChallengedPlayer',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          };

      const res = await fetch('/api/threads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: selectedGameType,
          challenger,
          opponent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsChallengeModalOpen(false);
        onRefreshState();
        if (data.thread) {
          setActiveThreadId(data.thread.id);
        }
      }
    } catch (err) {
      console.error('Error creating minigame thread:', err);
    }
  };

  const handleAcceptChallenge = async (threadId: string) => {
    try {
      const res = await fetch('/api/threads/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, userId: 'user_player' }),
      });
      if (res.ok) {
        onRefreshState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineChallenge = async (threadId: string) => {
    try {
      const res = await fetch('/api/threads/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, userId: 'user_player' }),
      });
      if (res.ok) {
        onRefreshState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleThreadMove = async (threadId: string, moveData: any) => {
    setIsSubmittingMove(true);
    try {
      const res = await fetch('/api/threads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          userId: 'user_player',
          moveData,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onRefreshState();
        if (data.thread?.status === 'won') {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingMove(false);
    }
  };

  return (
    <div id="minigames-arcade-container" className="space-y-6">
      {/* Top Header */}
      <div id="arcade-header" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div id="arcade-badge" className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Gamepad2 className="w-3.5 h-3.5" /> Thread-Based Discord Arcade
          </div>
          <h1 id="arcade-title" className="text-2xl font-bold text-white flex items-center gap-2">
            Minigame Dashboard
          </h1>
          <p id="arcade-subtitle" className="text-sm text-slate-400 mt-1">
            Pick a game, challenge Gemma AI or another player, and battle inside live Discord threads!
          </p>
        </div>

        <div id="arcade-stats-pills" className="flex items-center gap-3">
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-center">
            <div className="text-xs text-slate-400 font-medium">Active Threads</div>
            <div className="text-lg font-bold text-indigo-400">{threadsList.length}</div>
          </div>
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-center">
            <div className="text-xs text-slate-400 font-medium">AI Opponent</div>
            <div className="text-lg font-bold text-emerald-400">Gemma AI</div>
          </div>
        </div>
      </div>

      {/* Main View: Thread View OR Dashboard Grid */}
      {activeThread ? (
        /* ================= THREAD GAME VIEW ================= */
        <div id="active-thread-view" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Thread Header Bar */}
          <div className="bg-slate-800/90 border-b border-slate-700/80 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                id="back-to-dashboard-btn"
                onClick={() => setActiveThreadId(null)}
                className="p-2 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Hash className="w-5 h-5 text-indigo-400" />
                  {activeThread.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>Challenger: <strong className="text-slate-200">{activeThread.challenger.username}</strong></span>
                  <span>•</span>
                  <span>Opponent: <strong className="text-indigo-300">{activeThread.opponent.username}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                activeThread.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                activeThread.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                activeThread.status === 'won' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {activeThread.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 min-h-[500px]">
            {/* Left/Middle: Game Interface & Thread Board */}
            <div className="lg:col-span-2 p-6 space-y-6 flex flex-col justify-between">
              {/* Challenge Pending Acceptance Box */}
              {activeThread.status === 'pending' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center space-y-4">
                  <Swords className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Game Request Sent to {activeThread.opponent.username}!
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">
                      Would you like to simulate acceptance as {activeThread.opponent.username}?
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      id="accept-challenge-btn"
                      onClick={() => handleAcceptChallenge(activeThread.id)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept Challenge & Start Game
                    </button>
                    <button
                      id="decline-challenge-btn"
                      onClick={() => handleDeclineChallenge(activeThread.id)}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Game Active Board Rendering */}
              {(activeThread.status === 'in_progress' || activeThread.status === 'won' || activeThread.status === 'draw') && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <div className="text-sm text-slate-200 font-medium">
                        {activeThread.lastCommentary}
                      </div>
                    </div>
                  </div>

                  {/* 1. TIC-TAC-TOE BOARD */}
                  {activeThread.gameType === 'tictactoe' && (
                    <div className="max-w-xs mx-auto">
                      <div className="grid grid-cols-3 gap-2 bg-slate-800 p-3 rounded-2xl border border-slate-700 shadow-inner">
                        {activeThread.gameData.board.map((cell: string | null, idx: number) => (
                          <button
                            key={idx}
                            id={`ttt-thread-cell-${idx}`}
                            disabled={cell !== null || activeThread.status !== 'in_progress' || isSubmittingMove}
                            onClick={() => handleThreadMove(activeThread.id, { cellIndex: idx })}
                            className={`h-24 rounded-xl font-black text-3xl flex items-center justify-center transition-all ${
                              cell === 'X'
                                ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50'
                                : cell === 'O'
                                ? 'bg-pink-600/30 text-pink-400 border border-pink-500/50'
                                : 'bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/50 text-transparent'
                            }`}
                          >
                            {cell}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. ROCK PAPER SCISSORS */}
                  {activeThread.gameType === 'rps' && activeThread.status === 'in_progress' && (
                    <div className="text-center space-y-4 py-4">
                      <div className="text-sm text-slate-400 font-medium">Select your choice:</div>
                      <div className="flex justify-center gap-4">
                        {[
                          { id: 'rock', name: 'Rock', icon: '🪨' },
                          { id: 'paper', name: 'Paper', icon: '📄' },
                          { id: 'scissors', name: 'Scissors', icon: '✂️' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            id={`rps-thread-btn-${item.id}`}
                            disabled={isSubmittingMove}
                            onClick={() => handleThreadMove(activeThread.id, { choice: item.id })}
                            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-800 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500/50 text-3xl transition"
                          >
                            <span>{item.icon}</span>
                            <span className="text-xs font-semibold text-slate-300">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. TRIVIA */}
                  {activeThread.gameType === 'trivia' && activeThread.status === 'in_progress' && (
                    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4">
                      <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {activeThread.gameData.category}
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        {activeThread.gameData.question}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {activeThread.gameData.options.map((opt: string, idx: number) => (
                          <button
                            key={idx}
                            id={`trivia-thread-opt-${idx}`}
                            disabled={isSubmittingMove}
                            onClick={() => handleThreadMove(activeThread.id, { selectedIndex: idx })}
                            className="p-4 rounded-xl bg-slate-900/80 hover:bg-indigo-600/20 border border-slate-700 hover:border-indigo-500 text-left text-sm font-medium text-slate-200 transition"
                          >
                            <strong className="text-indigo-400 mr-2">{String.fromCharCode(65 + idx)}.</strong> {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. CONNECT 4 */}
                  {activeThread.gameType === 'connect4' && (
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="grid grid-cols-7 gap-1 bg-slate-800/80 p-2 rounded-t-xl border-x border-t border-slate-700">
                        {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                          <button
                            key={col}
                            id={`c4-thread-col-${col}`}
                            disabled={activeThread.status !== 'in_progress' || isSubmittingMove}
                            onClick={() => handleThreadMove(activeThread.id, { column: col })}
                            className="py-1.5 rounded bg-slate-700 hover:bg-indigo-600 text-xs font-bold text-white transition"
                          >
                            #{col + 1}
                          </button>
                        ))}
                      </div>
                      <div className="bg-slate-900 border border-slate-700 p-3 rounded-b-xl grid grid-rows-6 gap-1">
                        {activeThread.gameData.board.map((row: (string | null)[], rIdx: number) => (
                          <div key={rIdx} className="grid grid-cols-7 gap-1">
                            {row.map((cell: string | null, cIdx: number) => (
                              <div
                                key={cIdx}
                                className={`h-9 w-9 rounded-full mx-auto border flex items-center justify-center text-sm font-bold ${
                                  cell === '🔴' ? 'bg-red-600/80 border-red-500 text-white' :
                                  cell === '🟡' ? 'bg-amber-500/80 border-amber-400 text-slate-950' :
                                  'bg-slate-800/80 border-slate-700/60'
                                }`}
                              >
                                {cell || ''}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. MATH SPEED DUEL */}
                  {activeThread.gameType === 'math' && activeThread.status === 'in_progress' && (
                    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto">
                      <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Speed Calculation</div>
                      <div className="text-3xl font-black text-white">
                        {activeThread.gameData.num1} {activeThread.gameData.op} {activeThread.gameData.num2} = ?
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (threadInput.trim()) {
                            handleThreadMove(activeThread.id, { userAnswer: threadInput });
                            setThreadInput('');
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="number"
                          value={threadInput}
                          onChange={(e) => setThreadInput(e.target.value)}
                          placeholder="Enter answer..."
                          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  )}

                  {/* 6. WORDLE */}
                  {activeThread.gameType === 'wordle' && (
                    <div className="space-y-4 max-w-sm mx-auto">
                      <div className="space-y-2">
                        {activeThread.gameData.guesses.map((g: any, idx: number) => (
                          <div key={idx} className="flex justify-center gap-1.5">
                            {g.word.split('').map((char: string, cIdx: number) => {
                              const evalState = g.evaluation[cIdx];
                              const bgClass =
                                evalState === 'correct' ? 'bg-emerald-600 border-emerald-500 text-white' :
                                evalState === 'present' ? 'bg-amber-600 border-amber-500 text-white' :
                                'bg-slate-800 border-slate-700 text-slate-400';
                              return (
                                <div key={cIdx} className={`w-10 h-10 border rounded-lg font-black text-lg flex items-center justify-center ${bgClass}`}>
                                  {char}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      {activeThread.status === 'in_progress' && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (threadInput.length === 5) {
                              handleThreadMove(activeThread.id, { word: threadInput });
                              setThreadInput('');
                            }
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            maxLength={5}
                            value={threadInput}
                            onChange={(e) => setThreadInput(e.target.value)}
                            placeholder="5-letter word..."
                            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white uppercase tracking-widest font-bold focus:outline-none focus:border-indigo-500"
                          />
                          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl">
                            Guess
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Discord Thread Log */}
            <div className="p-6 bg-slate-950/50 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  Discord Thread Log
                </h3>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {activeThread.messages.map((msg: any) => (
                    <div key={msg.id} className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <img src={msg.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full" />
                        <span className="font-bold text-indigo-300">{msg.username}</span>
                      </div>
                      {msg.botEmbed && (
                        <div className="bg-indigo-950/40 border-l-2 border-indigo-500 p-2.5 rounded text-slate-200 space-y-1">
                          <div className="font-semibold text-indigo-200">{msg.botEmbed.title}</div>
                          <div className="text-slate-300 whitespace-pre-line">{msg.botEmbed.description}</div>
                        </div>
                      )}
                      {msg.content && <p className="text-slate-300">{msg.content}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <div className="text-xs text-slate-500 text-center">
                  Game synchronized directly with Discord Thread ID: <br />
                  <code className="text-slate-400 font-mono text-[10px]">{activeThread.id}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= UNIFIED DASHBOARD GRID ================= */
        <div className="space-y-8">
          {/* Active Threads Bar */}
          {threadsList.length > 0 && (
            <div id="active-threads-bar" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Your Ongoing Minigame Threads ({threadsList.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {threadsList.map((thread) => (
                  <button
                    key={thread.id}
                    id={`open-thread-btn-${thread.id}`}
                    onClick={() => setActiveThreadId(thread.id)}
                    className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-indigo-500/50 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-indigo-400" />
                        {thread.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 truncate max-w-[200px]">
                        {thread.lastCommentary}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      thread.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' :
                      thread.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {thread.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Minigames Grid */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Choose a Minigame
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gameCatalog.map((game) => (
                <div
                  key={game.id}
                  id={`game-card-${game.id}`}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition group hover:-translate-y-1"
                >
                  <div>
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-2xl shadow-lg mb-4`}>
                      {game.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition">
                      {game.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  <button
                    id={`play-game-btn-${game.id}`}
                    onClick={() => handleOpenGameChallenge(game.id)}
                    className="mt-6 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" /> Start Game Thread
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Challenge / Opponent Selection Modal */}
      {isChallengeModalOpen && (
        <div id="challenge-modal-overlay" className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div id="challenge-modal" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-indigo-400" /> Start Minigame Thread
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Select who you want to play against in this new thread.
              </p>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Opponent Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="select-vs-ai-btn"
                  onClick={() => setOpponentType('ai')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    opponentType === 'ai'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-6 h-6 text-emerald-400" />
                  <span className="text-sm">Gemma AI</span>
                </button>

                <button
                  type="button"
                  id="select-vs-player-btn"
                  onClick={() => setOpponentType('player')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    opponentType === 'player'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-6 h-6 text-purple-400" />
                  <span className="text-sm">Another Player</span>
                </button>
              </div>
            </div>

            {/* If player chosen, enter opponent username */}
            {opponentType === 'player' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Opponent Username</label>
                <input
                  type="text"
                  id="opponent-username-input"
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  placeholder="e.g. Alex, Jordan, Sam"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-modal-btn"
                onClick={() => setIsChallengeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                id="create-thread-submit-btn"
                onClick={handleCreateThreadGame}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <MessageSquare className="w-4 h-4" /> Open Thread & Challenge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
