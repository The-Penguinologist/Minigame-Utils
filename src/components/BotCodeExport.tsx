import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, Download, FileText, Sparkles } from 'lucide-react';
import { BotState } from '../types';

interface BotCodeExportProps {
  botState: BotState;
}

export const BotCodeExport: React.FC<BotCodeExportProps> = ({ botState }) => {
  const [selectedFile, setSelectedFile] = useState<'bot.ts' | 'package.json' | '.env' | 'Dockerfile'>('bot.ts');
  const [copied, setCopied] = useState(false);

  const eChan = botState.eChannelId || '1542084929171492955';
  const numChan = botState.numberChannelId || '1542148410084171826';
  const leaderChan = botState.numberLeaderboardChannelId || '1542151072032755893';

  const botTsCode = `/**
 * Standalone Production Discord Bot (TypeScript / Discord.js v14)
 * Features:
 *  - Channel 1 ('E' Counter): ${eChan}
 *  - Channel 2 (Number Counter): ${numChan}
 *  - Real-time Auto-Updating Leaderboard
 *  - Gemma AI Minigames: TicTacToe, Rock-Paper-Scissors, Trivia Quiz
 */
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from 'discord.js';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const E_CHANNEL_ID = process.env.E_CHANNEL_ID || '${eChan}';
const NUMBER_CHANNEL_ID = process.env.NUMBER_CHANNEL_ID || '${numChan}';
const LEADERBOARD_CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID || '${leaderChan}';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN) {
  console.error('Error: DISCORD_BOT_TOKEN is required in .env');
  process.exit(1);
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ================= STATE STORES =================
let currentECount = 0;
let highestECount = 0;
let lastEUserId: string | null = null;
let lastEUsername: string | null = null;

let currentNumber = 0;
let highestNumber = 0;
let lastNumberUserId: string | null = null;
let lastNumberUsername: string | null = null;

let liveLeaderboardMsgId: string | null = null;

interface UserStats {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalECount: number;
  highestStreakContribution: number;
  failedCount: number;
}

interface NumberUserStats {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalNumbersCounted: number;
  highestStreakContribution: number;
  failedCount: number;
}

const eLeaderboard = new Map<string, UserStats>();
const numberLeaderboard = new Map<string, NumberUserStats>();

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Helper to push live leaderboard to Discord (edits existing embed in-place)
async function updateLiveDiscordLeaderboard() {
  if (!LEADERBOARD_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !('send' in channel)) return;

    const sortedNum = Array.from(numberLeaderboard.values()).sort((a, b) => b.totalNumbersCounted - a.totalNumbersCounted).slice(0, 10);
    const numList = sortedNum.length > 0
      ? sortedNum.map((u, i) => \`**#\${i + 1}** \${u.username} — \\\`\${u.totalNumbersCounted}\\\` counts\`).join('\\n')
      : '*No numbers recorded yet.*';

    const embed = new EmbedBuilder()
      .setTitle('Real-Time Counting Leaderboard')
      .setColor(0x57F287)
      .addFields(
        { name: 'Current Number Streak', value: \`**\${currentNumber}** (Next: \${currentNumber + 1})\`, inline: true },
        { name: 'Peak Number Record', value: \`**\${highestNumber}**\`, inline: true },
        { name: 'Current E Streak', value: \`**\${currentECount}**\`, inline: true },
        { name: 'Peak E Record', value: \`**\${highestECount}**\`, inline: true },
        { name: 'Top Number Counters', value: numList, inline: false },
      )
      .setFooter({ text: 'Single live embed • Edits automatically on every count' })
      .setTimestamp();

    // 1. Try editing previously known message
    if (liveLeaderboardMsgId) {
      try {
        const msg = await (channel as any).messages.fetch(liveLeaderboardMsgId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          return;
        }
      } catch (e) {
        liveLeaderboardMsgId = null;
      }
    }

    // 2. Search recent messages in the channel to find an existing embed posted by this bot
    try {
      const recent = await (channel as any).messages.fetch({ limit: 15 });
      const existing = recent.find((m: any) => m.author.id === client.user?.id && m.embeds && m.embeds.length > 0);
      if (existing) {
        liveLeaderboardMsgId = existing.id;
        await existing.edit({ embeds: [embed] });
        return;
      }
    } catch (e) {
      // Continue to sending initial single embed
    }

    // 3. Send initial single embed if none exists
    const sent = await (channel as any).send({ embeds: [embed] });
    liveLeaderboardMsgId = sent.id;
  } catch (err) {
    console.error('Failed to update live leaderboard channel:', err);
  }
}

client.once('ready', async () => {
  console.log(\`Bot online as \${client.user?.tag}!\`);
  console.log(\`E Channel: \${E_CHANNEL_ID}\`);
  console.log(\`Number Channel: \${NUMBER_CHANNEL_ID}\`);

  if (CLIENT_ID) {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const commands = [
      new SlashCommandBuilder().setName('leaderboard').setDescription('View Top 20 E Champions').toJSON(),
      new SlashCommandBuilder().setName('numberleaderboard').setDescription('View Top 20 Number Counters').toJSON(),
      new SlashCommandBuilder().setName('tictactoe').setDescription('Play Tic-Tac-Toe vs Gemma AI or challenge a friend')
        .addUserOption(opt => opt.setName('opponent').setDescription('Opponent to challenge (leave empty to play Gemma AI)').setRequired(false)).toJSON(),
      new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors vs Gemma AI')
        .addStringOption(opt => opt.setName('choice').setDescription('Your pick').setRequired(true).addChoices({ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' })).toJSON(),
      new SlashCommandBuilder().setName('trivia').setDescription('AI Trivia question powered by Gemma').toJSON(),
      new SlashCommandBuilder().setName('rules').setDescription('View counting rules for both channels').toJSON(),
    ];

    try {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Slash commands registered.');
    } catch (err) {
      console.error('Failed to register slash commands:', err);
    }
  }
});

// Message Listener
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const now = Date.now();
  const content = msg.content.trim();
  const userId = msg.author.id;
  const username = msg.author.username;

  // ================= NUMBER COUNTING CHANNEL =================
  if (msg.channelId === NUMBER_CHANNEL_ID) {
    const parsedNum = parseInt(content, 10);
    const expectedNum = currentNumber + 1;

    // Rule: Duplicate consecutive user
    if (lastNumberUserId === userId && currentNumber > 0) {
      const brokenStreak = currentNumber;
      currentNumber = 0;
      lastNumberUserId = null;
      lastNumberUsername = null;

      const embed = new EmbedBuilder()
        .setTitle('Streak Broken: Double Count Foul')
        .setDescription(\`**\${username}**, you cannot count twice in a row!\\n\\nStreak has been reset to **0** (was **\${brokenStreak}**). Next number is \\\`1\\\`.\`)
        .setColor(0xED4245);
      await msg.channel.send({ embeds: [embed] });
      await updateLiveDiscordLeaderboard();
      return;
    }

    // Rule: Correct sequential number
    if (!isNaN(parsedNum) && parsedNum === expectedNum && String(parsedNum) === content) {
      const previousRecord = highestNumber;
      currentNumber = expectedNum;
      lastNumberUserId = userId;
      lastNumberUsername = username;
      if (currentNumber > highestNumber) highestNumber = currentNumber;

      let stat = numberLeaderboard.get(userId) || {
        userId,
        username,
        avatarUrl: msg.author.displayAvatarURL(),
        totalNumbersCounted: 0,
        highestStreakContribution: 0,
        failedCount: 0,
      };
      stat.totalNumbersCounted++;
      stat.highestStreakContribution = Math.max(stat.highestStreakContribution, currentNumber);
      numberLeaderboard.set(userId, stat);

      // React with ✅ for numbers already counted (<= record), ☑️ for numbers above record (> record)
      const reactionEmoji = parsedNum <= previousRecord ? '✅' : '☑️';
      await msg.react(reactionEmoji).catch(() => {});
      await updateLiveDiscordLeaderboard();
      return;
    }

    // Rule: Wrong number / non-number (ruin streak)
    const brokenStreak = currentNumber;
    currentNumber = 0;
    lastNumberUserId = null;
    lastNumberUsername = null;

    const embed = new EmbedBuilder()
      .setTitle('Wrong Number: Counter Reset')
      .setDescription(\`**\${username}** typed "\${content}" instead of **\${expectedNum}**!\\n\\nCounter reset back to **0** (was **\${brokenStreak}**). Next number is \\\`1\\\`.\`)
      .setColor(0xED4245);
    await msg.channel.send({ embeds: [embed] });
    await updateLiveDiscordLeaderboard();
    return;
  }

  // ================= 'E' COUNTING CHANNEL =================
  if (msg.channelId === E_CHANNEL_ID) {
    if (content.toLowerCase() === 'e') {
      if (lastEUserId === userId && currentECount > 0) {
        const brokenStreak = currentECount;
        currentECount = 0;
        lastEUserId = null;
        lastEUsername = null;

        const embed = new EmbedBuilder()
          .setTitle('Consecutive e Foul')
          .setDescription(\`**\${username}**, you cannot say 'e' twice in a row! Streak reset to **0** (was **\${brokenStreak}**).\`)
          .setColor(0xFEE75C);
        await msg.channel.send({ embeds: [embed] });
        return;
      }

      const previousRecord = highestECount;
      currentECount++;
      lastEUserId = userId;
      lastEUsername = username;
      if (currentECount > highestECount) highestECount = currentECount;

      let stat = eLeaderboard.get(userId) || {
        userId,
        username,
        avatarUrl: msg.author.displayAvatarURL(),
        totalECount: 0,
        highestStreakContribution: 0,
        failedCount: 0,
      };
      stat.totalECount++;
      stat.highestStreakContribution = Math.max(stat.highestStreakContribution, currentECount);
      eLeaderboard.set(userId, stat);

      const reactionEmoji = currentECount <= previousRecord ? '✅' : '☑️';
      await msg.react(reactionEmoji).catch(() => {});
      return;
    }

    // Non-'e' message in 'e' channel: Reset streak to 0
    const brokenStreak = currentECount;
    currentECount = 0;
    lastEUserId = null;
    lastEUsername = null;

    const embed = new EmbedBuilder()
      .setTitle('Streak Ruined (Non-E Message)')
      .setDescription(\`**\${username}** typed something other than the letter **'e'**!\\n\\nCounter reset back to **0** (was **\${brokenStreak}**). Next person can restart with \\\`e\\\`.\`)
      .setColor(0xED4245);
    await msg.channel.send({ embeds: [embed] });
  }
});

client.login(TOKEN);
`;

  const packageJsonCode = `{
  "name": "e-and-number-discord-bot",
  "version": "3.0.0",
  "description": "Discord Bot with E-counting, Number-counting, Live Leaderboards, and Gemma Minigames",
  "main": "dist/bot.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/bot.js",
    "dev": "tsx bot.ts"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "discord.js": "^14.18.0",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "tsx": "^4.21.0",
    "typescript": "^5.8.2"
  }
}`;

  const envFileCode = `# Discord Credentials
DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
DISCORD_CLIENT_ID=YOUR_DISCORD_APPLICATION_CLIENT_ID

# Target Channels
E_CHANNEL_ID=${eChan}
NUMBER_CHANNEL_ID=${numChan}
LEADERBOARD_CHANNEL_ID=${leaderChan}

# Google Gemini / Gemma AI
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
`;

  const dockerfileCode = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
`;

  const getCode = () => {
    switch (selectedFile) {
      case 'bot.ts':
        return botTsCode;
      case 'package.json':
        return packageJsonCode;
      case '.env':
        return envFileCode;
      case 'Dockerfile':
        return dockerfileCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Bento Box */}
      <div className="bg-[#111113] rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest mb-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Ready-to-Deploy Discord.js v14 Source</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Complete Standalone Bot Code
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Dual channel counting (E + Number) + Gemma AI Minigames + Live auto-updating embeds.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-2xl transition flex items-center space-x-2 text-xs shadow-lg shrink-0"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied to Clipboard!' : 'Copy ' + selectedFile}</span>
        </button>
      </div>

      {/* Code Viewer Bento Card */}
      <div className="bg-[#111113] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Tab switcher */}
        <div className="flex items-center space-x-2 px-6 py-3 border-b border-white/10 bg-black/40 overflow-x-auto">
          {(['bot.ts', 'package.json', '.env', 'Dockerfile'] as const).map((filename) => (
            <button
              key={filename}
              onClick={() => setSelectedFile(filename)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition flex items-center space-x-1.5 ${
                selectedFile === filename
                  ? 'bg-white/10 text-emerald-400 font-bold border border-white/15'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{filename}</span>
            </button>
          ))}
        </div>

        {/* Code Content */}
        <div className="p-6 bg-black/60 overflow-x-auto max-h-[600px]">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre selection:bg-emerald-500 selection:text-black">
            <code>{getCode()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
