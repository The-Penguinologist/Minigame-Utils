export interface NumberUserStats {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalNumbersCounted: number;
  highestStreakContribution: number;
  failedCount: number;
  lastActive: number;
  isBot?: boolean;
}

export interface CooldownEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  reason: string;
  bannedAt: number;
  bannedUntil: number; // timestamp in ms (1 hour from bannedAt)
}

export interface BotLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error' | 'number_count' | 'streak_break' | 'timeout' | 'command' | 'game';
  message: string;
  userId?: string;
  username?: string;
  details?: Record<string, any>;
}

export interface DiscordChatMessage {
  id: string;
  channelId?: string;
  userId: string;
  username: string;
  avatarUrl: string;
  content: string;
  timestamp: number;
  isBot?: boolean;
  botEmbed?: {
    title?: string;
    description?: string;
    color?: number; // hex integer
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: { text: string; iconURL?: string };
    author?: { name: string; iconURL?: string };
  };
  components?: any[];
  status?: 'valid_number' | 'invalid_number' | 'timed_out' | 'command_response' | 'minigame';
  reactionEmoji?: string;
}

export interface MinigameThread {
  id: string; // e.g. 'thread_123456'
  title: string;
  gameType: 'tictactoe' | 'rps' | 'trivia' | 'connect4' | 'math' | 'wordle';
  challenger: { id: string; username: string; avatarUrl?: string };
  opponent: { id: string; username: string; avatarUrl?: string; isBot?: boolean };
  status: 'pending' | 'accepted' | 'declined' | 'in_progress' | 'won' | 'draw';
  currentTurnUserId?: string;
  winnerUserId?: string;
  createdAt: number;
  gameData?: any; // Board state, questions, etc.
  messages: DiscordChatMessage[];
  lastCommentary?: string;
}

export interface BotState {
  // Number Counting Channel (1542148410084171826)
  channelId: string;
  numberChannelId: string;
  numberLeaderboardChannelId?: string; // Channel ID for auto-updating leaderboard embed
  currentNumber: number;
  highestNumber: number;
  lastNumberUserId: string | null;
  lastNumberUsername: string | null;
  lastNumberAvatarUrl?: string;
  lastNumberTimestamp: number | null;
  topNumberPlayer: {
    userId: string;
    username: string;
    avatarUrl?: string;
    count: number;
  } | null;
  numberLeaderboard: Record<string, NumberUserStats>;

  // Threads & Active Minigames
  threads: Record<string, MinigameThread>;

  // General & Gateway
  cooldowns: Record<string, CooldownEntry>;
  botStatus: 'online' | 'offline' | 'connecting' | 'simulated';
  botUser?: {
    id: string;
    username: string;
    tag: string;
    avatarUrl?: string;
    guildCount: number;
  };
}

export interface BotConfig {
  numberChannelId: string;
  numberLeaderboardChannelId?: string;
  cooldownDurationMs: number;
  botToken?: string;
  clientId?: string;
}

// Minigames Types
export interface TicTacToeGame {
  id: string;
  channelId: string;
  player1: { id: string; username: string };
  player2: { id: string; username: string; isBot?: boolean };
  currentTurn: string; // userId
  board: (string | null)[]; // 9 cells
  status: 'waiting' | 'in_progress' | 'won' | 'draw';
  winner?: string; // userId or 'draw'
  lastCommentary?: string;
}

export interface RPSGame {
  id: string;
  player1: { id: string; username: string; choice?: 'rock' | 'paper' | 'scissors' };
  player2: { id: string; username: string; isBot?: boolean; choice?: 'rock' | 'paper' | 'scissors' };
  winner?: string; // userId or 'tie'
  status: 'waiting_choices' | 'finished';
  commentary?: string;
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
}


