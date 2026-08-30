import fs from 'fs';
import path from 'path';
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
  Message,
  Interaction,
  TextChannel,
} from 'discord.js';
import { getGemmaTicTacToeMove, getGemmaRPSMove, getGemmaTrivia, getGemmaConnect4Move } from './geminiService.js';
import {
  initDatabase,
  getGameStateFromDB,
  updateGameStateInDB,
  getUserStatsMapFromDB,
  saveUserStatToDB,
  getCooldownsMapFromDB,
  saveCooldownToDB,
  deleteCooldownFromDB,
  clearAllDBData,
  UserStatsRecord,
  CooldownRecord,
} from './db.js';

const STATE_FILE_PATH = path.join(process.cwd(), 'real_bot_state.json');

export interface UserStats {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalECount: number;
  highestStreakContribution: number;
  failedCount: number;
  lastActive: number;
  isBot?: boolean;
}

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
  bannedUntil: number;
}

export interface ProcessResult {
  success: boolean;
  type: 'valid_number' | 'invalid_number' | 'invalid_number_repeat' | 'timed_out' | 'wrong_channel';
  message: string;
  channelType: 'number' | 'unknown';
  currentNumber: number;
  highestNumber: number;
  topPlayer: { userId: string; username: string; count: number; avatarUrl?: string } | null;
  offendingUser?: { userId: string; username: string };
  cooldownUntil?: number;
  reactionEmoji?: string;
  embedData?: any;
}

export interface MinigameThread {
  id: string;
  title: string;
  gameType: 'tictactoe' | 'rps' | 'trivia' | 'connect4' | 'math' | 'wordle';
  challenger: { id: string; username: string; avatarUrl?: string };
  opponent: { id: string; username: string; avatarUrl?: string; isBot?: boolean };
  status: 'pending' | 'accepted' | 'declined' | 'in_progress' | 'won' | 'draw';
  currentTurnUserId?: string;
  winnerUserId?: string;
  createdAt: number;
  gameData?: any;
  messages: any[];
  lastCommentary?: string;
}

export class ECounterEngine {
  // Legacy / Compat property aliases
  public channelId: string = '1542148410084171826';
  public eChannelId: string = '1542148410084171826';
  public currentCount: number = 0;
  public highestCount: number = 0;
  public leaderboard: Map<string, any> = new Map();

  // Number Counting Channel (1542148410084171826) State
  public numberChannelId: string = '1542148410084171826';
  public numberLeaderboardChannelId: string | null = '1542151072032755893'; // Dedicated Auto-updating leaderboard channel
  public currentNumber: number = 0;
  public highestNumber: number = 0;
  public lastNumberUserId: string | null = null;
  public lastNumberUsername: string | null = null;
  public lastNumberAvatarUrl: string | null = null;
  public lastNumberTimestamp: number | null = null;
  public numberLeaderboard: Map<string, NumberUserStats> = new Map();
  public cooldowns: Map<string, CooldownEntry> = new Map();
  private liveLeaderboardMessageId: string | null = null;

  // Minigames & Threads State
  public threads: Map<string, MinigameThread> = new Map();
  public activeTicTacToe: Map<string, any> = new Map();
  public pendingChallenges: Map<string, any> = new Map();
  public activeRPS: Map<string, any> = new Map();
  public activeTrivia: Map<string, any> = new Map();
  public activeConnect4: Map<string, any> = new Map();

  // Logs
  public logs: Array<{ id: string; timestamp: number; type: string; message: string; details?: any }> = [];

  // Discord.js Client instance
  private client: Client | null = null;
  public isDiscordConnected: boolean = false;
  public discordBotUser: any = null;

  constructor(
    defaultNumberChannel: string = '1542148410084171826',
    defaultLeaderboardChannel: string = '1542151072032755893'
  ) {
    this.numberChannelId = defaultNumberChannel;
    this.numberLeaderboardChannelId = defaultLeaderboardChannel;
    this.channelId = defaultNumberChannel;
    this.eChannelId = defaultNumberChannel;
    this.loadStateFromDisk();
  }

  public async saveStateToDisk() {
    try {
      updateGameStateInDB({
        currentNumber: this.currentNumber,
        highestNumber: this.highestNumber,
        lastUserId: this.lastNumberUserId,
        lastUsername: this.lastNumberUsername,
        lastAvatarUrl: this.lastNumberAvatarUrl,
        lastTimestamp: this.lastNumberTimestamp,
        liveLeaderboardMessageId: this.liveLeaderboardMessageId,
        numberChannelId: this.numberChannelId,
        leaderboardChannelId: this.numberLeaderboardChannelId,
      });

      // Save user stats to SQLite
      for (const stat of this.numberLeaderboard.values()) {
        saveUserStatToDB({
          userId: stat.userId,
          username: stat.username,
          avatarUrl: stat.avatarUrl || null,
          totalNumbersCounted: stat.totalNumbersCounted,
          highestStreakContribution: stat.highestStreakContribution,
          failedCount: stat.failedCount,
          lastActive: stat.lastActive,
        });
      }

      // Save cooldowns to SQLite
      for (const cd of this.cooldowns.values()) {
        saveCooldownToDB({
          userId: cd.userId,
          username: cd.username,
          avatarUrl: cd.avatarUrl || null,
          reason: cd.reason,
          bannedAt: cd.bannedAt,
          bannedUntil: cd.bannedUntil,
        });
      }
    } catch (err: any) {
      console.error('Failed to save state to SQLite DB:', err.message);
    }
  }

  private async loadStateFromDisk() {
    try {
      await initDatabase();
      const dbState = getGameStateFromDB();

      this.currentNumber = dbState.currentNumber;
      this.highestNumber = dbState.highestNumber;
      this.lastNumberUserId = dbState.lastUserId;
      this.lastNumberUsername = dbState.lastUsername;
      this.lastNumberAvatarUrl = dbState.lastAvatarUrl;
      this.lastNumberTimestamp = dbState.lastTimestamp;
      this.liveLeaderboardMessageId = dbState.liveLeaderboardMessageId;
      this.numberChannelId = dbState.numberChannelId || this.numberChannelId;
      this.numberLeaderboardChannelId = dbState.leaderboardChannelId || this.numberLeaderboardChannelId;

      const userStatsMap = getUserStatsMapFromDB();
      for (const [uid, stat] of userStatsMap.entries()) {
        this.numberLeaderboard.set(uid, {
          userId: stat.userId,
          username: stat.username,
          avatarUrl: stat.avatarUrl || undefined,
          totalNumbersCounted: stat.totalNumbersCounted,
          highestStreakContribution: stat.highestStreakContribution,
          failedCount: stat.failedCount,
          lastActive: stat.lastActive,
        });
      }

      const cooldownsMap = getCooldownsMapFromDB();
      for (const [uid, cd] of cooldownsMap.entries()) {
        this.cooldowns.set(uid, {
          userId: cd.userId,
          username: cd.username,
          avatarUrl: cd.avatarUrl || undefined,
          reason: cd.reason,
          bannedAt: cd.bannedAt,
          bannedUntil: cd.bannedUntil,
        });
      }

      this.addLog('info', `💾 SQLite Database loaded cleanly! Current count: ${this.currentNumber} | All-Time Record: ${this.highestNumber} | Users in DB: ${this.numberLeaderboard.size}`);
    } catch (err: any) {
      this.addLog('warn', `SQLite initialization note: ${err.message}`);
    }
  }

  public setCount(newNumber: number, setByUsername: string = 'Admin'): { success: boolean; message: string; embedData: any } {
    const prevNumber = this.currentNumber;
    this.currentNumber = newNumber;
    this.lastNumberUserId = null;
    this.lastNumberUsername = null;
    this.lastNumberAvatarUrl = null;
    this.lastNumberTimestamp = Date.now();

    if (this.currentNumber > this.highestNumber) {
      this.highestNumber = this.currentNumber;
    }

    this.saveStateToDisk();
    this.triggerLiveLeaderboardUpdate();

    this.addLog('command', `Counting sequence manually set from ${prevNumber} to ${newNumber} by ${setByUsername}`);

    const embed = {
      title: '⚙️ Counter Updated Successfully!',
      description: `**${setByUsername}** set the current counting sequence to **\`${newNumber}\`**!\n\nAnyone can now continue the sequence by typing **\`${newNumber + 1}\`** in the channel.`,
      color: 0x5865F2,
      fields: [
        { name: 'Current Counter', value: `\`${this.currentNumber}\``, inline: true },
        { name: 'Next Required Number', value: `\`${this.currentNumber + 1}\``, inline: true },
        { name: 'All-Time Record', value: `\`${this.highestNumber}\``, inline: true },
      ],
      footer: { text: `Database: SQLite persistent (database.sqlite) • Channel: #${this.numberChannelId}` },
    };

    return {
      success: true,
      message: `Count updated to ${newNumber}. Next number is ${newNumber + 1}.`,
      embedData: embed,
    };
  }

  public resetAllData() {
    this.currentNumber = 0;
    this.highestNumber = 0;
    this.lastNumberUserId = null;
    this.lastNumberUsername = null;
    this.lastNumberAvatarUrl = null;
    this.lastNumberTimestamp = null;
    this.numberLeaderboard.clear();
    this.threads.clear();
    this.cooldowns.clear();

    this.saveStateToDisk();
    this.triggerLiveLeaderboardUpdate();
    this.addLog('info', 'All active streaks and leaderboard records have been reset to 0.');
  }

  public addLog(type: string, message: string, details?: any) {
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      type,
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
  }

  public getTopPlayer(): { userId: string; username: string; count: number; avatarUrl?: string } | null {
    return this.getTopNumberPlayer();
  }

  public getTopNumberPlayer(): { userId: string; username: string; count: number; avatarUrl?: string } | null {
    let top: NumberUserStats | null = null;
    for (const user of this.numberLeaderboard.values()) {
      if (!top || user.totalNumbersCounted > top.totalNumbersCounted) {
        top = user;
      }
    }
    if (!top) return null;
    return {
      userId: top.userId,
      username: top.username,
      count: top.totalNumbersCounted,
      avatarUrl: top.avatarUrl,
    };
  }

  public getTopLeaderboard(limit: number = 20): any[] {
    return this.getTopNumberLeaderboard(limit);
  }

  public getTopNumberLeaderboard(limit: number = 20): NumberUserStats[] {
    return Array.from(this.numberLeaderboard.values())
      .sort((a, b) => b.totalNumbersCounted - a.totalNumbersCounted)
      .slice(0, limit);
  }

  public getState() {
    // Clean up expired cooldowns
    const now = Date.now();
    for (const [uid, cd] of this.cooldowns.entries()) {
      if (now >= cd.bannedUntil) {
        this.cooldowns.delete(uid);
      }
    }

    const cooldownObj: Record<string, CooldownEntry> = {};
    for (const [k, v] of this.cooldowns.entries()) {
      cooldownObj[k] = v;
    }

    const numberLeaderboardObj: Record<string, NumberUserStats> = {};
    for (const [k, v] of this.numberLeaderboard.entries()) {
      numberLeaderboardObj[k] = v;
    }

    const threadsObj: Record<string, MinigameThread> = {};
    for (const [k, v] of this.threads.entries()) {
      threadsObj[k] = v;
    }

    return {
      channelId: this.numberChannelId,
      eChannelId: this.numberChannelId,
      currentCount: this.currentNumber,
      highestCount: this.highestNumber,
      lastUserId: this.lastNumberUserId,
      lastUsername: this.lastNumberUsername,
      lastAvatarUrl: this.lastNumberAvatarUrl,
      lastCountTimestamp: this.lastNumberTimestamp,
      topPlayer: this.getTopNumberPlayer(),
      leaderboard: numberLeaderboardObj,

      // Number Counting (1542148410084171826)
      numberChannelId: this.numberChannelId,
      numberLeaderboardChannelId: this.numberLeaderboardChannelId || undefined,
      currentNumber: this.currentNumber,
      highestNumber: this.highestNumber,
      lastNumberUserId: this.lastNumberUserId,
      lastNumberUsername: this.lastNumberUsername,
      lastNumberAvatarUrl: this.lastNumberAvatarUrl,
      lastNumberTimestamp: this.lastNumberTimestamp,
      topNumberPlayer: this.getTopNumberPlayer(),
      numberLeaderboard: numberLeaderboardObj,

      // Threads
      threads: threadsObj,

      cooldowns: cooldownObj,
      botStatus: this.isDiscordConnected ? 'online' : 'simulated',
      botUser: this.discordBotUser || {
        id: 'bot_number_counter',
        username: 'Number & Minigames Bot',
        tag: 'ArcadeBot#0001',
        avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
        guildCount: 1,
      },
    };
  }

  /**
   * Process incoming message in the number counting channel
   */
  public processMessage(
    user: { id: string; username: string; avatarUrl?: string },
    rawContent: string,
    messageChannelId?: string
  ): ProcessResult {
    const channel = messageChannelId || this.numberChannelId;
    return this.processNumberMessage(user, rawContent, channel);
  }

  /**
   * Process sequential number message
   */
  private processNumberMessage(
    user: { id: string; username: string; avatarUrl?: string },
    rawContent: string,
    channelId: string
  ): ProcessResult {
    const now = Date.now();
    const content = rawContent.trim();
    const expectedNumber = this.currentNumber + 1;

    let parsedNumber: number | null = null;
    if (/^\d+$/.test(content)) {
      parsedNumber = parseInt(content, 10);
    }

    // 1. Check if user sent consecutive numbers in a row
    if (this.lastNumberUserId === user.id && this.currentNumber > 0) {
      const ruinedStreak = this.currentNumber;
      this.currentNumber = 0;
      this.lastNumberUserId = null;
      this.lastNumberUsername = null;
      this.lastNumberAvatarUrl = null;

      const stats = this.numberLeaderboard.get(user.id) || {
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        totalNumbersCounted: 0,
        highestStreakContribution: 0,
        failedCount: 0,
        lastActive: now,
      };
      stats.failedCount += 1;
      stats.lastActive = now;
      this.numberLeaderboard.set(user.id, stats);

      this.addLog('streak_break', `[Number Channel] ${user.username} tried to count twice consecutively! Streak reset from ${ruinedStreak} to 0.`);

      const embed = {
        title: 'NUMBER STREAK RUINED (Consecutive User)!',
        description: `**${user.username}** tried to count **twice in a row**!\n\n*Rule: A different person must submit each subsequent number in sequence.*\n\n**Streak Reset:** Reached **${ruinedStreak}** -> Reset to **0**.\nNext expected number: **\`1\`**`,
        color: 0xED4245,
        fields: [
          { name: 'Reset Count', value: '`0`', inline: true },
          { name: 'Highest Record', value: `\`${this.highestNumber}\``, inline: true },
          { name: 'Number Champion', value: this.getTopNumberPlayerSummary(), inline: true },
        ],
        footer: { text: `Number Counting • Channel: #${channelId}` },
      };

      this.saveStateToDisk();
      this.triggerLiveLeaderboardUpdate();

      return {
        success: false,
        type: 'invalid_number_repeat',
        channelType: 'number',
        message: `${user.username} counted twice in a row! Number counter reset to 0.`,
        currentNumber: 0,
        highestNumber: this.highestNumber,
        topPlayer: this.getTopNumberPlayer(),
        offendingUser: { userId: user.id, username: user.username },
        embedData: embed,
      };
    }

    // 2. Check if number is valid and matches expected next sequence number
    if (parsedNumber === null || parsedNumber !== expectedNumber) {
      const ruinedStreak = this.currentNumber;
      this.currentNumber = 0;
      this.lastNumberUserId = null;
      this.lastNumberUsername = null;
      this.lastNumberAvatarUrl = null;

      const stats = this.numberLeaderboard.get(user.id) || {
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        totalNumbersCounted: 0,
        highestStreakContribution: 0,
        failedCount: 0,
        lastActive: now,
      };
      stats.failedCount += 1;
      stats.lastActive = now;
      this.numberLeaderboard.set(user.id, stats);

      this.addLog('streak_break', `[Number Channel] STREAK BROKEN by ${user.username} (typed "${content}", expected "${expectedNumber}"). Streak was ${ruinedStreak}.`);

      const embed = {
        title: 'NUMBER STREAK BROKEN (Wrong Number)!',
        description: `**${user.username}** typed **"${content}"**, but the expected number was **\`${expectedNumber}\`**!\n\n**Streak Reset:** Current streak of **${ruinedStreak}** was broken -> **0**.\nNext person must restart from **\`1\`**!`,
        color: 0xED4245,
        fields: [
          { name: 'Counter Reset', value: '`0`', inline: true },
          { name: 'Highest Record', value: `\`${this.highestNumber}\``, inline: true },
          { name: 'Number Champion', value: this.getTopNumberPlayerSummary(), inline: true },
        ],
        footer: { text: `Number Counting • Channel: #${channelId}` },
      };

      this.saveStateToDisk();
      this.triggerLiveLeaderboardUpdate();

      return {
        success: false,
        type: 'invalid_number',
        channelType: 'number',
        message: `Streak ruined by ${user.username}! Typed "${content}", expected "${expectedNumber}".`,
        currentNumber: 0,
        highestNumber: this.highestNumber,
        topPlayer: this.getTopNumberPlayer(),
        offendingUser: { userId: user.id, username: user.username },
        embedData: embed,
      };
    }

    // 3. VALID NUMBER!
    const previousRecord = this.highestNumber;
    this.currentNumber = parsedNumber;
    let isNewRecord = false;
    if (this.currentNumber > this.highestNumber) {
      this.highestNumber = this.currentNumber;
      isNewRecord = true;
    }

    // Reaction rule: ✅ for numbers already counted (<= record), ☑️ for numbers above record (> record)
    const reactionEmoji = parsedNumber <= previousRecord ? '✅' : '☑️';

    this.lastNumberUserId = user.id;
    this.lastNumberUsername = user.username;
    this.lastNumberAvatarUrl = user.avatarUrl || null;
    this.lastNumberTimestamp = now;

    // Update user stats
    const stats = this.numberLeaderboard.get(user.id) || {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      totalNumbersCounted: 0,
      highestStreakContribution: 0,
      failedCount: 0,
      lastActive: now,
    };
    stats.totalNumbersCounted += 1;
    stats.username = user.username;
    if (user.avatarUrl) stats.avatarUrl = user.avatarUrl;
    stats.lastActive = now;
    if (this.currentNumber > stats.highestStreakContribution) {
      stats.highestStreakContribution = this.currentNumber;
    }
    this.numberLeaderboard.set(user.id, stats);

    const topNumberPlayer = this.getTopNumberPlayer();

    this.addLog('number_count', `[Number Channel] Valid count ${this.currentNumber} by ${user.username}! (Record: ${this.highestNumber})`, {
      number: this.currentNumber,
      user: user.username,
      isNewRecord,
    });

    const embed = {
      title: isNewRecord ? `NEW NUMBER RECORD! Count: ${this.currentNumber}` : `Count: ${this.currentNumber}`,
      description: `**${user.username}** counted **\`${this.currentNumber}\`**!\nNext number is **\`${this.currentNumber + 1}\`** (must be typed by someone else).`,
      color: isNewRecord ? 0x57F287 : 0x00D26A,
      fields: [
        { name: 'Current Streak', value: `\`${this.currentNumber}\``, inline: true },
        { name: 'All-Time Record', value: `\`${this.highestNumber}\``, inline: true },
        { name: 'Top Number Player', value: topNumberPlayer ? `**${topNumberPlayer.username}** (${topNumberPlayer.count} total)` : `**${user.username}** (1 total)`, inline: true },
      ],
      footer: { text: `Channel: #${channelId} • Live Leaderboard Updating` },
    };

    this.saveStateToDisk();
    this.triggerLiveLeaderboardUpdate();

    return {
      success: true,
      type: 'valid_number',
      channelType: 'number',
      message: `Number count successfully updated to ${this.currentNumber}!`,
      currentNumber: this.currentNumber,
      highestNumber: this.highestNumber,
      topPlayer: topNumberPlayer,
      reactionEmoji,
      embedData: embed,
    };
  }

  public getTopPlayerSummary(): string {
    return this.getTopNumberPlayerSummary();
  }

  public getTopNumberPlayerSummary(): string {
    const top = this.getTopNumberPlayer();
    if (!top) return '`None`';
    return `**${top.username}** (\`${top.count}\` counts)`;
  }

  public getLeaderboardEmbed(topLimit: number = 20): any {
    return this.getNumberLeaderboardEmbed(topLimit);
  }

  public getNumberLeaderboardEmbed(topLimit: number = 20): any {
    const top20 = this.getTopNumberLeaderboard(topLimit);
    let desc = `**Live Updating Number Leaderboard for <#${this.numberChannelId}>**\n\n`;

    if (top20.length === 0) {
      desc += '*No numbers counted yet! Start the sequence with `1` in the channel.*';
    } else {
      top20.forEach((player, idx) => {
        let rankStr = `#${idx + 1}`;
        if (idx === 0) rankStr = '#1';
        else if (idx === 1) rankStr = '#2';
        else if (idx === 2) rankStr = '#3';

        desc += `**${rankStr}** • **${player.username}** — **${player.totalNumbersCounted}** numbers counted (Peak: ${player.highestStreakContribution})\n`;
      });
    }

    return {
      title: 'Live Number Counting Leaderboard (Top 20)',
      description: desc,
      color: 0x57F287,
      fields: [
        { name: 'Current Sequence', value: `\`${this.currentNumber}\``, inline: true },
        { name: 'Next Required Number', value: `\`${this.currentNumber + 1}\``, inline: true },
        { name: 'All-Time Number Record', value: `\`${this.highestNumber}\``, inline: true },
        { name: 'Top Number MVP', value: this.getTopNumberPlayerSummary(), inline: true },
        { name: 'Last Counted By', value: this.lastNumberUsername ? `**${this.lastNumberUsername}**` : 'None', inline: true },
        { name: 'Auto-Update Status', value: '`Active (Real-time)`', inline: true },
      ],
      footer: { text: `Target Channel: #${this.numberChannelId} • Auto-refreshes every count!` },
    };
  }

  /**
   * Real-time auto updater for dedicated leaderboard channel in Discord
   */
  public async triggerLiveLeaderboardUpdate() {
    if (!this.client || !this.isDiscordConnected || !this.numberLeaderboardChannelId) return;

    try {
      const channel = await this.client.channels.fetch(this.numberLeaderboardChannelId);
      if (!channel || !(channel instanceof TextChannel)) return;

      const embedData = this.getNumberLeaderboardEmbed(20);
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setColor(embedData.color);
      if (embedData.fields) embed.addFields(embedData.fields);
      if (embedData.footer) embed.setFooter({ text: embedData.footer.text });

      // 1. If we have a cached message ID, try editing it
      if (this.liveLeaderboardMessageId) {
        try {
          const msg = await channel.messages.fetch(this.liveLeaderboardMessageId);
          if (msg) {
            await msg.edit({ embeds: [embed] });
            return;
          }
        } catch {
          this.liveLeaderboardMessageId = null;
        }
      }

      // 2. Search recent messages in the leaderboard channel to find if an embed was already posted by the bot
      try {
        const recentMessages = await channel.messages.fetch({ limit: 15 });
        const existing = recentMessages.find(
          (m) => m.author.id === this.client?.user?.id && m.embeds && m.embeds.length > 0
        );
        if (existing) {
          this.liveLeaderboardMessageId = existing.id;
          await existing.edit({ embeds: [embed] });
          this.saveStateToDisk();
          return;
        }
      } catch {
        // Continue to sending initial embed
      }

      // 3. If no existing message was found, send the initial single embed
      const sentMsg = await channel.send({ embeds: [embed] });
      this.liveLeaderboardMessageId = sentMsg.id;
      this.saveStateToDisk();
      this.addLog('info', `Posted single live updating leaderboard embed in #${this.numberLeaderboardChannelId}`);
    } catch (err: any) {
      this.addLog('warn', `Could not update live leaderboard channel: ${err.message}`);
    }
  }

  public getStatusEmbed(): any {
    const topNum = this.getTopNumberPlayer();
    return {
      title: 'Number Counting & Minigame Arcade Bot Status',
      description: `Monitoring Number Counting (<#${this.numberChannelId}>) and Active Thread Games.`,
      color: 0x5865F2,
      fields: [
        { name: 'Number Current Streak', value: `\`${this.currentNumber}\``, inline: true },
        { name: 'Number All-Time Record', value: `\`${this.highestNumber}\``, inline: true },
        { name: 'Top Counting MVP', value: topNum ? `**${topNum.username}** (\`${topNum.count}\`)` : 'None', inline: true },
        { name: 'Active Minigame Threads', value: `\`${this.threads.size}\` Threads`, inline: true },
        { name: 'Rules Active', value: 'Instant Streak Reset on Duplicate/Wrong Number', inline: true },
        { name: 'Dashboard Minigames', value: 'Tic-Tac-Toe, RPS, Trivia, Connect 4, Math, Wordle', inline: true },
      ],
      footer: { text: `Slash commands: /numberleaderboard, /tictactoe, /rps, /trivia, /connect4, /math, /wordle` },
    };
  }

  public getRulesEmbed(): any {
    return {
      title: 'Rules of Number Counting & Minigames Arcade',
      description: `Official guidelines for number counting and thread minigames!`,
      color: 0x5865F2,
      fields: [
        {
          name: 'Number Counting Channel (<#' + this.numberChannelId + '>)',
          value: '• Count sequential numbers: `1`, `2`, `3`, `4`...\n• Alternate players each count.\n• Wrong number or duplicate consecutive entry = Streak instantly resets to `0`!',
        },
        {
          name: 'Thread Minigames Dashboard',
          value: '• Select any minigame from the dashboard.\n• Choose **Against AI (Gemma)** or **Against Another Player**.\n• Opens a dedicated thread channel where opponent accepts/declines and match is played live!',
        },
      ],
      footer: { text: `Have fun and aim for the top of the leaderboards!` },
    };
  }

  // ==========================================
  // THREAD MINIGAMES ENGINE
  // ==========================================

  public createMinigameThread(
    gameType: 'tictactoe' | 'rps' | 'trivia' | 'connect4' | 'math' | 'wordle',
    challenger: { id: string; username: string; avatarUrl?: string },
    opponent: { id: string; username: string; avatarUrl?: string; isBot?: boolean },
    extraData?: any
  ): MinigameThread {
    const threadId = 'thread_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const isVsBot = !!opponent.isBot;
    const status = isVsBot ? 'in_progress' : 'pending';

    const gameTitles: Record<string, string> = {
      tictactoe: 'Tic-Tac-Toe',
      rps: 'RPS Showdown',
      trivia: 'AI Trivia Quiz',
      connect4: 'Connect 4',
      math: 'Math Speed Duel',
      wordle: 'Wordle Guess',
    };

    const gameTitle = gameTitles[gameType] || 'Minigame';
    const title = `🧵 ${gameTitle}: ${challenger.username} vs ${opponent.username}`;

    let gameData: any = {};
    if (gameType === 'tictactoe') {
      gameData = { board: Array(9).fill(null) };
    } else if (gameType === 'rps') {
      gameData = { p1Choice: null, p2Choice: null };
    } else if (gameType === 'trivia') {
      gameData = extraData || {
        question: 'What is the speed of light in vacuum?',
        options: ['299,792,458 m/s', '150,000,000 m/s', '3,000,000 m/s', '1,080,000,000 km/h'],
        correctIndex: 0,
        explanation: 'The speed of light in vacuum is defined to be exactly 299,792,458 m/s.',
        category: 'Science & Physics',
      };
    } else if (gameType === 'connect4') {
      gameData = { board: Array(6).fill(null).map(() => Array(7).fill(null)) };
    } else if (gameType === 'math') {
      const num1 = Math.floor(Math.random() * 20) + 5;
      const num2 = Math.floor(Math.random() * 12) + 2;
      gameData = { num1, num2, op: 'x', answer: num1 * num2, round: 1 };
    } else if (gameType === 'wordle') {
      const words = ['REACT', 'DISCORD', 'GEMMA', 'SMART', 'PULSE', 'ROBOT', 'LOGIC', 'GUESS', 'MATCH', 'POWER'];
      const target = words[Math.floor(Math.random() * words.length)];
      gameData = { targetWord: target, guesses: [] };
    }

    const initialMessages: any[] = [];

    if (!isVsBot) {
      initialMessages.push({
        id: 'msg_init_' + Date.now(),
        userId: 'bot_gemma',
        username: 'Gemma Arcade Bot',
        avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
        content: '',
        timestamp: Date.now(),
        isBot: true,
        botEmbed: {
          title: `⚔️ MINIGAME CHALLENGE: ${gameTitle}`,
          description: `**${challenger.username}** has challenged **${opponent.username}** to a game of **${gameTitle}** in this thread!\n\n**@${opponent.username}**, click **Accept Challenge** below to start playing!`,
          color: 0x5865F2,
          footer: { text: `Thread ID: ${threadId} • Status: Pending Acceptance` },
        },
        status: 'minigame',
      });
    } else {
      initialMessages.push({
        id: 'msg_init_' + Date.now(),
        userId: 'bot_gemma',
        username: 'Gemma Arcade Bot',
        avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
        content: '',
        timestamp: Date.now(),
        isBot: true,
        botEmbed: {
          title: `🤖 ${gameTitle} vs Gemma AI`,
          description: `Gemma AI has entered the match! Game on, **${challenger.username}**! Make your first move in this thread.`,
          color: 0x57F287,
          footer: { text: `Thread ID: ${threadId}` },
        },
        status: 'minigame',
      });
    }

    const thread: MinigameThread = {
      id: threadId,
      title,
      gameType,
      challenger,
      opponent,
      status,
      currentTurnUserId: challenger.id,
      createdAt: Date.now(),
      gameData,
      messages: initialMessages,
      lastCommentary: isVsBot ? 'Gemma AI is ready. Make your move!' : `Waiting for ${opponent.username} to accept challenge...`,
    };

    this.threads.set(threadId, thread);
    this.saveStateToDisk();
    this.addLog('game', `Created minigame thread "${title}" (${threadId})`);
    return thread;
  }

  public acceptThreadChallenge(threadId: string, userId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) return { error: 'Thread not found.' };
    if (thread.status !== 'pending') return { error: `Thread challenge is already ${thread.status}.` };

    thread.status = 'in_progress';
    thread.lastCommentary = `🎉 Challenge accepted! Match started between ${thread.challenger.username} and ${thread.opponent.username}!`;

    thread.messages.push({
      id: 'msg_accept_' + Date.now(),
      userId: 'bot_gemma',
      username: 'Gemma Arcade Bot',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      content: '',
      timestamp: Date.now(),
      isBot: true,
      botEmbed: {
        title: '🎉 Challenge Accepted!',
        description: `**${thread.opponent.username}** accepted the match request! **${thread.challenger.username}**'s turn to make the first move!`,
        color: 0x57F287,
      },
      status: 'minigame',
    });

    this.saveStateToDisk();
    return { success: true, thread };
  }

  public declineThreadChallenge(threadId: string, userId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) return { error: 'Thread not found.' };
    if (thread.status !== 'pending') return { error: `Thread challenge is already ${thread.status}.` };

    thread.status = 'declined';
    thread.lastCommentary = `❌ Challenge declined by ${thread.opponent.username}.`;

    thread.messages.push({
      id: 'msg_decline_' + Date.now(),
      userId: 'bot_gemma',
      username: 'Gemma Arcade Bot',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      content: '',
      timestamp: Date.now(),
      isBot: true,
      botEmbed: {
        title: '❌ Challenge Declined',
        description: `**${thread.opponent.username}** declined the match request.`,
        color: 0xED4245,
      },
      status: 'minigame',
    });

    this.saveStateToDisk();
    return { success: true, thread };
  }

  public async makeThreadMove(threadId: string, userId: string, moveData: any) {
    const thread = this.threads.get(threadId);
    if (!thread) return { error: 'Thread not found.' };
    if (thread.status !== 'in_progress') return { error: `Game is currently ${thread.status}.` };

    const { gameType, challenger, opponent, gameData } = thread;
    const isP1 = userId === challenger.id;
    const isP2 = userId === opponent.id;
    const userObj = isP1 ? challenger : isP2 ? opponent : { id: userId, username: 'Player' };

    if (gameType === 'tictactoe') {
      const { cellIndex } = moveData;
      if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
        return { error: 'Invalid cell choice.' };
      }
      if (gameData.board[cellIndex] !== null) {
        return { error: 'Cell already occupied!' };
      }

      const symbol = isP1 ? 'X' : 'O';
      gameData.board[cellIndex] = symbol;

      const winSymbol = this.checkTicTacToeWin(gameData.board);
      if (winSymbol) {
        if (winSymbol === 'draw') {
          thread.status = 'draw';
          thread.lastCommentary = `🤝 Tic-Tac-Toe match ended in a draw!`;
        } else {
          thread.status = 'won';
          thread.winnerUserId = winSymbol === 'X' ? challenger.id : opponent.id;
          const winnerName = winSymbol === 'X' ? challenger.username : opponent.username;
          thread.lastCommentary = `🏆 Victory! ${winnerName} won the match!`;
        }
      } else if (opponent.isBot && !isP2) {
        const aiRes = await getGemmaTicTacToeMove(gameData.board, 'O');
        if (aiRes.move >= 0 && gameData.board[aiRes.move] === null) {
          gameData.board[aiRes.move] = 'O';
          const postAiWin = this.checkTicTacToeWin(gameData.board);
          if (postAiWin) {
            if (postAiWin === 'draw') {
              thread.status = 'draw';
              thread.lastCommentary = `🤝 Match ended in a draw with Gemma AI!`;
            } else {
              thread.status = 'won';
              thread.winnerUserId = opponent.id;
              thread.lastCommentary = `🤖 Gemma AI won the Tic-Tac-Toe match! "${aiRes.commentary}"`;
            }
          } else {
            thread.lastCommentary = `Gemma AI placed [O]. "${aiRes.commentary}"`;
          }
        }
      } else {
        thread.currentTurnUserId = isP1 ? opponent.id : challenger.id;
        thread.lastCommentary = `${userObj.username} placed [${symbol}]. Next turn: ${isP1 ? opponent.username : challenger.username}`;
      }
    } else if (gameType === 'rps') {
      const { choice } = moveData;
      if (isP1) gameData.p1Choice = choice;
      if (isP2 || opponent.isBot) {
        gameData.p2Choice = opponent.isBot ? ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] : choice;
      }

      if (opponent.isBot || (gameData.p1Choice && gameData.p2Choice)) {
        const c1 = gameData.p1Choice;
        const c2 = gameData.p2Choice;
        if (c1 === c2) {
          thread.status = 'draw';
          thread.lastCommentary = `🤝 Both players chose ${c1}! It's a tie!`;
        } else if (
          (c1 === 'rock' && c2 === 'scissors') ||
          (c1 === 'paper' && c2 === 'rock') ||
          (c1 === 'scissors' && c2 === 'paper')
        ) {
          thread.status = 'won';
          thread.winnerUserId = challenger.id;
          thread.lastCommentary = `🎉 ${challenger.username} (${c1}) beat ${opponent.username} (${c2})!`;
        } else {
          thread.status = 'won';
          thread.winnerUserId = opponent.id;
          thread.lastCommentary = `🎉 ${opponent.username} (${c2}) beat ${challenger.username} (${c1})!`;
        }
      } else {
        thread.lastCommentary = `${userObj.username} locked in RPS choice! Waiting for opponent...`;
      }
    } else if (gameType === 'trivia') {
      const { selectedIndex } = moveData;
      gameData.selectedIndex = selectedIndex;
      thread.status = 'won';
      const isCorrect = selectedIndex === gameData.correctIndex;
      if (isCorrect) {
        thread.winnerUserId = userId;
        thread.lastCommentary = `🎯 Correct! ${userObj.username} answered option ${selectedIndex + 1} correctly! ${gameData.explanation}`;
      } else {
        thread.lastCommentary = `❌ Wrong choice! Correct answer was option ${gameData.correctIndex + 1}. ${gameData.explanation}`;
      }
    } else if (gameType === 'connect4') {
      const { column } = moveData;
      const c4Res = await this.playConnect4Move(gameData.board, column, isP1 ? '🔴' : '🟡', opponent.isBot);
      gameData.board = c4Res.board;
      if (c4Res.winner) {
        thread.status = 'won';
        thread.winnerUserId = c4Res.winner === 'human' ? challenger.id : opponent.id;
        thread.lastCommentary = c4Res.commentary;
      } else {
        thread.lastCommentary = c4Res.commentary;
      }
    } else if (gameType === 'math') {
      const { userAnswer } = moveData;
      const parsed = parseInt(userAnswer, 10);
      if (!isNaN(parsed) && parsed === gameData.answer) {
        thread.status = 'won';
        thread.winnerUserId = userId;
        thread.lastCommentary = `⚡ MATH CHAMPION! ${userObj.username} solved ${gameData.num1} ${gameData.op} ${gameData.num2} = ${gameData.answer}!`;
      } else {
        thread.lastCommentary = `❌ Incorrect answer (${userAnswer}). ${gameData.num1} ${gameData.op} ${gameData.num2} = ${gameData.answer}.`;
      }
    } else if (gameType === 'wordle') {
      const { word } = moveData;
      const guessUpper = (word || '').toUpperCase().trim();
      if (guessUpper.length === 5) {
        const target = gameData.targetWord;
        const evaluation = guessUpper.split('').map((char, i) => {
          if (char === target[i]) return 'correct';
          if (target.includes(char)) return 'present';
          return 'absent';
        });
        gameData.guesses.push({ word: guessUpper, evaluation });
        if (guessUpper === target) {
          thread.status = 'won';
          thread.winnerUserId = userId;
          thread.lastCommentary = `🎉 SOLVED! ${userObj.username} guessed "${target}" in ${gameData.guesses.length} attempts!`;
        } else if (gameData.guesses.length >= 6) {
          thread.status = 'won';
          thread.lastCommentary = `❌ Game Over! The word was "${target}".`;
        } else {
          thread.lastCommentary = `Guess #${gameData.guesses.length}: ${guessUpper} recorded.`;
        }
      }
    }

    thread.messages.push({
      id: 'msg_' + Date.now(),
      userId: 'bot_gemma',
      username: 'Gemma Arcade Bot',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      content: '',
      timestamp: Date.now(),
      isBot: true,
      botEmbed: {
        title: `🎮 ${thread.title}`,
        description: thread.lastCommentary,
        color: thread.status === 'won' ? 0x57F287 : 0x5865F2,
      },
      status: 'minigame',
    });

    this.saveStateToDisk();
    return { success: true, thread };
  }

  // ==========================================
  // MINIGAMES ENGINE (TicTacToe, RPS, Trivia, Connect4)
  // ==========================================

  public createChallenge(
    gameType: 'tictactoe' | 'rps' | 'connect4',
    challenger: { id: string; username: string },
    opponent: { id: string; username: string },
    channelId: string
  ) {
    const challengeId = 'chal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const challenge = {
      id: challengeId,
      gameType,
      challenger,
      opponent,
      channelId,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.pendingChallenges.set(challengeId, challenge);
    this.addLog('game', `Created ${gameType} challenge from ${challenger.username} to ${opponent.username} (${challengeId})`);
    return challenge;
  }

  public acceptChallenge(challengeId: string, userId: string) {
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) {
      return { error: 'Challenge not found or has expired.' };
    }
    if (challenge.status !== 'pending') {
      return { error: `This challenge is already ${challenge.status}.` };
    }
    if (challenge.opponent.id !== userId) {
      return { error: 'Only the challenged user can accept this match request.' };
    }

    challenge.status = 'accepted';
    this.pendingChallenges.delete(challengeId);

    if (challenge.gameType === 'tictactoe') {
      const game = this.createTicTacToeMatch(
        challenge.channelId,
        challenge.challenger,
        challenge.opponent
      );
      return { success: true, game, challenge };
    }

    return { success: true, challenge };
  }

  public declineChallenge(challengeId: string, userId: string) {
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) {
      return { error: 'Challenge not found or has expired.' };
    }
    if (challenge.status !== 'pending') {
      return { error: `This challenge is already ${challenge.status}.` };
    }
    if (challenge.opponent.id !== userId && challenge.challenger.id !== userId) {
      return { error: 'You cannot decline this challenge.' };
    }

    challenge.status = 'declined';
    this.pendingChallenges.delete(challengeId);
    this.addLog('game', `Challenge ${challengeId} declined by ${userId}`);
    return { success: true, challenge };
  }

  public createTicTacToeMatch(
    channelId: string,
    player1: { id: string; username: string },
    player2: { id: string; username: string }
  ) {
    const gameId = 'ttt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const game = {
      id: gameId,
      channelId,
      player1,
      player2,
      currentTurn: player1.id,
      board: Array(9).fill(null),
      status: 'in_progress',
      lastCommentary: `Match started between ${player1.username} [X] and ${player2.username} [O]! ${player1.username}'s turn [X].`,
    };
    this.activeTicTacToe.set(gameId, game);
    this.addLog('game', `Started PvP TicTacToe match ${gameId} with ${player1.username} [X] vs ${player2.username} [O]`);
    return game;
  }

  public async createTicTacToe(
    channelId: string,
    player1: { id: string; username: string },
    vsBot: boolean = true,
    player2?: { id: string; username: string }
  ) {
    const gameId = 'ttt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const game = {
      id: gameId,
      channelId,
      player1,
      player2: vsBot ? { id: 'bot_gemma', username: 'Gemma AI Bot', isBot: true } : (player2 || { id: 'waiting', username: 'Waiting for Player 2...' }),
      currentTurn: player1.id,
      board: Array(9).fill(null),
      status: 'in_progress',
      lastCommentary: vsBot
        ? 'Gemma AI has entered the Tic-Tac-Toe arena! Make your first move as [X].'
        : `Match started between ${player1.username} [X] and ${(player2 || { username: 'Player 2' }).username} [O]!`,
    };
    this.activeTicTacToe.set(gameId, game);
    this.addLog('game', `Started TicTacToe game ${gameId} with ${player1.username} vs ${game.player2.username}`);
    return game;
  }

  public async makeTicTacToeMove(gameId: string, userId: string, cellIndex: number) {
    const game = this.activeTicTacToe.get(gameId);
    if (!game || game.status !== 'in_progress') {
      return { error: 'Game is not currently in progress or not found.' };
    }

    if (game.board[cellIndex] !== null) {
      return { error: 'Cell is already occupied!' };
    }

    const isP1 = userId === game.player1.id;
    const isP2 = userId === game.player2.id;
    if (!isP1 && !isP2 && game.player2.id !== 'waiting') {
      return { error: 'You are not a participant in this game.' };
    }

    if (game.currentTurn && game.currentTurn !== userId && !game.player2.isBot) {
      const currentTurnUser = game.currentTurn === game.player1.id ? game.player1.username : game.player2.username;
      return { error: `It is currently ${currentTurnUser}'s turn!` };
    }

    const symbol = isP1 ? 'X' : 'O';
    game.board[cellIndex] = symbol;

    // Check winner
    const winResult = this.checkTicTacToeWin(game.board);
    if (winResult) {
      game.status = winResult === 'draw' ? 'draw' : 'won';
      game.winner = winResult === 'draw' ? 'draw' : (winResult === 'X' ? game.player1.id : game.player2.id);
      const winnerName = winResult === 'X' ? game.player1.username : game.player2.username;
      game.lastCommentary = winResult === 'draw' ? "It's a draw! Well played by both sides." : `${winnerName} won the match!`;
      return { game, winner: game.winner };
    }

    // Bot move if playing against bot
    if (game.player2.isBot && game.status === 'in_progress') {
      const aiResponse = await getGemmaTicTacToeMove(game.board, 'O');
      if (aiResponse.move >= 0 && game.board[aiResponse.move] === null) {
        game.board[aiResponse.move] = 'O';
        game.lastCommentary = aiResponse.commentary;

        const botWin = this.checkTicTacToeWin(game.board);
        if (botWin) {
          game.status = botWin === 'draw' ? 'draw' : 'won';
          game.winner = botWin === 'draw' ? 'draw' : game.player2.id;
          game.lastCommentary = botWin === 'draw' ? "It's a draw!" : `Gemma AI won: "${aiResponse.commentary}"`;
        }
      }
    } else {
      game.currentTurn = isP1 ? game.player2.id : game.player1.id;
      const nextUserName = game.currentTurn === game.player1.id ? game.player1.username : game.player2.username;
      game.lastCommentary = `Move placed at cell ${cellIndex + 1}. Now it is ${nextUserName}'s turn [${isP1 ? 'O' : 'X'}].`;
    }

    return { game };
  }

  private checkTicTacToeWin(board: (string | null)[]): 'X' | 'O' | 'draw' | null {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] as 'X' | 'O';
      }
    }
    if (board.every((c) => c !== null)) return 'draw';
    return null;
  }

  public async playRPS(
    player1: { id: string; username: string },
    p1Choice: 'rock' | 'paper' | 'scissors',
    vsBot: boolean = true,
    player2Choice?: 'rock' | 'paper' | 'scissors'
  ) {
    let p2Choice = player2Choice;
    let commentary = '';

    if (vsBot || !p2Choice) {
      const aiRes = await getGemmaRPSMove(p1Choice);
      p2Choice = aiRes.botChoice;
      commentary = aiRes.commentary;
    }

    let result: 'win' | 'lose' | 'tie' = 'tie';
    if (p1Choice === p2Choice) {
      result = 'tie';
    } else if (
      (p1Choice === 'rock' && p2Choice === 'scissors') ||
      (p1Choice === 'paper' && p2Choice === 'rock') ||
      (p1Choice === 'scissors' && p2Choice === 'paper')
    ) {
      result = 'win';
    } else {
      result = 'lose';
    }

    return {
      player1,
      p1Choice,
      player2: vsBot ? { id: 'bot_gemma', username: 'Gemma AI' } : { id: 'p2', username: 'Opponent' },
      p2Choice,
      result,
      commentary,
    };
  }

  public async getTrivia(category?: string) {
    return await getGemmaTrivia(category || 'General Knowledge');
  }

  public async playConnect4Move(
    board: (string | null)[][], // 6 rows x 7 cols
    col: number,
    playerPiece: '🔴' | '🟡' = '🔴',
    vsBot: boolean = true
  ) {
    // Find bottom empty row in column
    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (board[r][col] === null) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return { error: 'Column is full!' };

    board[targetRow][col] = playerPiece;
    const humanWin = this.checkConnect4Win(board, playerPiece);
    if (humanWin) {
      return { board, winner: 'human', commentary: '🎉 You connected 4 discs and won!' };
    }

    if (vsBot) {
      const botPiece = playerPiece === '🔴' ? '🟡' : '🔴';
      const aiMove = await getGemmaConnect4Move(board, botPiece);
      let botRow = -1;
      for (let r = 5; r >= 0; r--) {
        if (board[r][aiMove.column] === null) {
          botRow = r;
          break;
        }
      }
      if (botRow !== -1) {
        board[botRow][aiMove.column] = botPiece;
        const botWin = this.checkConnect4Win(board, botPiece);
        if (botWin) {
          return { board, winner: 'bot', commentary: '🤖 Gemma AI connected 4 and won!' };
        }
      }
      return { board, commentary: aiMove.commentary };
    }

    return { board };
  }

  private checkConnect4Win(board: (string | null)[][], piece: string): boolean {
    // Horizontal
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === piece && board[r][c + 1] === piece && board[r][c + 2] === piece && board[r][c + 3] === piece) return true;
      }
    }
    // Vertical
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        if (board[r][c] === piece && board[r + 1][c] === piece && board[r + 2][c] === piece && board[r + 3][c] === piece) return true;
      }
    }
    // Diagonal down-right
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === piece && board[r + 1][c + 1] === piece && board[r + 2][c + 2] === piece && board[r + 3][c + 3] === piece) return true;
      }
    }
    // Diagonal down-left
    for (let r = 0; r < 3; r++) {
      for (let c = 3; c < 7; c++) {
        if (board[r][c] === piece && board[r + 1][c - 1] === piece && board[r + 2][c - 2] === piece && board[r + 3][c - 3] === piece) return true;
      }
    }
    return false;
  }

  /**
   * Start Discord Bot with slash commands, message listeners, and button interaction handlers
   */
  public async startDiscordBot(token: string, clientId?: string): Promise<{ success: boolean; message: string }> {
    if (!token || token.trim() === '' || token === 'YOUR_DISCORD_BOT_TOKEN') {
      return { success: false, message: 'Invalid or empty Discord bot token provided.' };
    }

    try {
      if (this.client) {
        await this.client.destroy().catch(() => {});
        this.client = null;
      }

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent, // Required for 'e' and numbers
        ],
      });

      this.client.on('ready', async () => {
        this.isDiscordConnected = true;
        this.discordBotUser = {
          id: this.client!.user?.id,
          username: this.client!.user?.username,
          tag: this.client!.user?.tag,
          avatarUrl: this.client!.user?.displayAvatarURL(),
          guildCount: this.client!.guilds.cache.size,
        };

        this.addLog('success', `Discord Bot logged in as ${this.client!.user?.tag}! Channels: E(#${this.eChannelId}), Num(#${this.numberChannelId})`);

        // Register slash commands
        try {
          const botId = clientId || this.client!.user?.id;
          if (botId) {
            const rest = new REST({ version: '10' }).setToken(token);

            const commands = [
              new SlashCommandBuilder()
                .setName('leaderboard')
                .setDescription('View the Top 20 players who have said the most e\'s')
                .toJSON(),
              new SlashCommandBuilder()
                .setName('numberleaderboard')
                .setDescription('View the live Top 20 players in the number counting channel')
                .toJSON(),
              new SlashCommandBuilder()
                .setName('ecounter')
                .setDescription('Check current streak, highest record, and live e counter status')
                .toJSON(),
              new SlashCommandBuilder()
                .setName('numbercounter')
                .setDescription('Check current sequence, record, and status of number counting')
                .toJSON(),
              new SlashCommandBuilder()
                .setName('tictactoe')
                .setDescription('Play Tic-Tac-Toe vs Gemma AI Bot or another player')
                .addUserOption(opt => opt.setName('opponent').setDescription('Challenge another user (leave empty to play vs Gemma AI)').setRequired(false))
                .toJSON(),
              new SlashCommandBuilder()
                .setName('rps')
                .setDescription('Play Rock-Paper-Scissors against Gemma AI Bot')
                .addStringOption(opt =>
                  opt.setName('choice')
                    .setDescription('Your move')
                    .setRequired(true)
                    .addChoices(
                      { name: '🪨 Rock', value: 'rock' },
                      { name: '📄 Paper', value: 'paper' },
                      { name: '✂️ Scissors', value: 'scissors' }
                    )
                )
                .toJSON(),
              new SlashCommandBuilder()
                .setName('trivia')
                .setDescription('Play an interactive Gemma AI-generated trivia quiz')
                .addStringOption(opt =>
                  opt.setName('category')
                    .setDescription('Trivia Category')
                    .setRequired(false)
                    .addChoices(
                      { name: 'Tech & Gaming', value: 'Tech & Gaming' },
                      { name: 'Science & Math', value: 'Science & Math' },
                      { name: 'Anime & Pop Culture', value: 'Anime & Pop Culture' },
                      { name: 'General Knowledge', value: 'General Knowledge' }
                    )
                )
                .toJSON(),
              new SlashCommandBuilder()
                .setName('setleaderboardchannel')
                .setDescription('Set the channel where the live number leaderboard will auto-update')
                .addChannelOption(opt => opt.setName('channel').setDescription('The target channel for auto-updating leaderboard').setRequired(true))
                .toJSON(),
              new SlashCommandBuilder()
                .setName('rules')
                .setDescription('View rules for E-counting, Number-counting, and Minigames')
                .toJSON(),
              new SlashCommandBuilder()
                .setName('setcount')
                .setDescription('Set the current counting sequence number (e.g. 1500 if bot went down)')
                .addIntegerOption(opt => opt.setName('number').setDescription('The number reached by the community').setRequired(true))
                .toJSON(),
            ];

            await rest.put(Routes.applicationCommands(botId), { body: commands });
            this.addLog('info', 'Successfully registered all slash commands (/leaderboard, /numberleaderboard, /tictactoe, /rps, /trivia, etc.)');
          }
        } catch (cmdErr: any) {
          this.addLog('warn', `Slash commands setup note: ${cmdErr.message}`);
        }

        // Initial live leaderboard update
        this.triggerLiveLeaderboardUpdate();
      });

      this.client.on('messageCreate', async (msg: Message) => {
        if (msg.author.bot) return;

        const trimmed = msg.content.trim();
        
        // Handle !setcount text command (e.g. !setcount 1500)
        if (trimmed.startsWith('!setcount')) {
          const parts = trimmed.split(/\s+/);
          const targetNum = parseInt(parts[1], 10);
          if (isNaN(targetNum) || targetNum < 0) {
            await msg.reply('⚠️ Please specify a valid non-negative number. Example: `!setcount 1500`');
            return;
          }
          const res = this.setCount(targetNum, msg.author.username);
          const embed = new EmbedBuilder()
            .setTitle(res.embedData.title)
            .setDescription(res.embedData.description)
            .setColor(res.embedData.color);
          if (res.embedData.fields) embed.addFields(res.embedData.fields);
          if (res.embedData.footer) embed.setFooter({ text: res.embedData.footer.text });
          await msg.reply({ embeds: [embed] });
          return;
        }

        // Process if in E channel or Number channel
        if (msg.channelId === this.eChannelId || msg.channelId === this.numberChannelId) {
          const user = {
            id: msg.author.id,
            username: msg.author.username,
            avatarUrl: msg.author.displayAvatarURL(),
          };

          const result = this.processMessage(user, msg.content, msg.channelId);

          if (result.reactionEmoji && 'react' in msg) {
            await (msg as any).react(result.reactionEmoji).catch((err: any) => {
              this.addLog('warn', `Failed to react to message in Discord: ${err.message}`);
            });
          }

          if (result.embedData && 'send' in msg.channel) {
            const embed = new EmbedBuilder()
              .setTitle(result.embedData.title || null)
              .setDescription(result.embedData.description || null)
              .setColor(result.embedData.color || 0x5865F2);

            if (result.embedData.fields) embed.addFields(result.embedData.fields);
            if (result.embedData.footer) embed.setFooter({ text: result.embedData.footer.text });

            await (msg.channel as any).send({ embeds: [embed] }).catch((err: any) => {
              this.addLog('error', `Failed to send embed response in Discord: ${err.message}`);
            });
          }
        }
      });

      // Handle Slash Commands and Button Clicks
      this.client.on('interactionCreate', async (interaction: Interaction) => {
        try {
          if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setcount') {
              const targetNum = interaction.options.getInteger('number', true);
              if (targetNum < 0) {
                await interaction.reply({ content: '⚠️ Please specify a non-negative number.', ephemeral: true });
                return;
              }
              const res = this.setCount(targetNum, interaction.user.username);
              const embed = new EmbedBuilder()
                .setTitle(res.embedData.title)
                .setDescription(res.embedData.description)
                .setColor(res.embedData.color);
              if (res.embedData.fields) embed.addFields(res.embedData.fields);
              if (res.embedData.footer) embed.setFooter({ text: res.embedData.footer.text });
              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'leaderboard') {
              const embedData = this.getLeaderboardEmbed(20);
              const embed = new EmbedBuilder().setTitle(embedData.title).setDescription(embedData.description).setColor(embedData.color);
              if (embedData.fields) embed.addFields(embedData.fields);
              if (embedData.footer) embed.setFooter({ text: embedData.footer.text });
              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'numberleaderboard') {
              const embedData = this.getNumberLeaderboardEmbed(20);
              const embed = new EmbedBuilder().setTitle(embedData.title).setDescription(embedData.description).setColor(embedData.color);
              if (embedData.fields) embed.addFields(embedData.fields);
              if (embedData.footer) embed.setFooter({ text: embedData.footer.text });
              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'ecounter' || interaction.commandName === 'numbercounter') {
              const embedData = this.getStatusEmbed();
              const embed = new EmbedBuilder().setTitle(embedData.title).setDescription(embedData.description).setColor(embedData.color);
              if (embedData.fields) embed.addFields(embedData.fields);
              if (embedData.footer) embed.setFooter({ text: embedData.footer.text });
              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'rules') {
              const embedData = this.getRulesEmbed();
              const embed = new EmbedBuilder().setTitle(embedData.title).setDescription(embedData.description).setColor(embedData.color);
              if (embedData.fields) embed.addFields(embedData.fields);
              if (embedData.footer) embed.setFooter({ text: embedData.footer.text });
              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'setleaderboardchannel') {
              const channel = interaction.options.getChannel('channel');
              if (channel) {
                this.numberLeaderboardChannelId = channel.id;
                this.liveLeaderboardMessageId = null;
                await interaction.reply({ content: `Live number leaderboard will now auto-update in <#${channel.id}>!`, ephemeral: true });
                this.triggerLiveLeaderboardUpdate();
              }
            } else if (interaction.commandName === 'rps') {
              const choice = interaction.options.getString('choice') as 'rock' | 'paper' | 'scissors';
              const result = await this.playRPS({ id: interaction.user.id, username: interaction.user.username }, choice, true);

              const moveLabels = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
              let title = "It's a Tie!";
              let color = 0xFEE75C;
              if (result.result === 'win') {
                title = 'You Won!';
                color = 0x57F287;
              } else if (result.result === 'lose') {
                title = 'Gemma AI Won!';
                color = 0xED4245;
              }

              const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`**${interaction.user.username}** chose **${moveLabels[choice]}**\n**Gemma AI** chose **${moveLabels[result.p2Choice]}**\n\n*"${result.commentary}"*`)
                .setColor(color)
                .setFooter({ text: 'Rock Paper Scissors • Gemma AI Powered' });

              await interaction.reply({ embeds: [embed] });
            } else if (interaction.commandName === 'tictactoe') {
              const opponent = interaction.options.getUser('opponent');

              // If user challenged another opponent, create a pending challenge & ping opponent with Accept/Decline buttons
              if (opponent) {
                if (opponent.id === interaction.user.id) {
                  await interaction.reply({ content: 'You cannot challenge yourself to a match!', ephemeral: true });
                  return;
                }
                if (opponent.bot) {
                  await interaction.reply({ content: 'To play against AI, run /tictactoe without selecting an opponent.', ephemeral: true });
                  return;
                }

                const challenge = this.createChallenge(
                  'tictactoe',
                  { id: interaction.user.id, username: interaction.user.username },
                  { id: opponent.id, username: opponent.username },
                  interaction.channelId
                );

                const challengeEmbed = new EmbedBuilder()
                  .setTitle('Tic-Tac-Toe Challenge!')
                  .setDescription(`**${interaction.user.username}** has challenged <@${opponent.id}> to a game of Tic-Tac-Toe!\n\n<@${opponent.id}>, click **Accept** to begin or **Decline** to forfeit.`)
                  .setColor(0x5865F2)
                  .setFooter({ text: 'Accept to start match • Only player vs player' });

                const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`chal_accept_${challenge.id}`)
                    .setLabel('Accept Challenge')
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId(`chal_decline_${challenge.id}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({
                  content: `<@${opponent.id}>`,
                  embeds: [challengeEmbed],
                  components: [challengeRow],
                });
                return;
              }

              // Play vs Gemma AI Bot
              const game = await this.createTicTacToe(
                interaction.channelId,
                { id: interaction.user.id, username: interaction.user.username },
                true
              );

              const embed = new EmbedBuilder()
                .setTitle('Tic-Tac-Toe Match')
                .setDescription(`**${game.player1.username} [X]** vs **${game.player2.username} [O]**\n\n${game.lastCommentary}`)
                .setColor(0x5865F2);

              // 3x3 Button grid
              const rows = [0, 1, 2].map((r) => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                [0, 1, 2].forEach((c) => {
                  const idx = r * 3 + c;
                  const label = game.board[idx] || '—';
                  const btn = new ButtonBuilder()
                    .setCustomId(`ttt_${game.id}_${idx}`)
                    .setLabel(label)
                    .setStyle(game.board[idx] === 'X' ? ButtonStyle.Primary : (game.board[idx] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary))
                    .setDisabled(game.board[idx] !== null || game.status !== 'in_progress');
                  row.addComponents(btn);
                });
                return row;
              });

              await interaction.reply({ embeds: [embed], components: rows });
            } else if (interaction.commandName === 'trivia') {
              const category = interaction.options.getString('category') || 'General Knowledge';
              await interaction.deferReply();
              const trivia = await this.getTrivia(category);
              const triviaId = 'trivia_' + Date.now();
              this.activeTrivia.set(triviaId, trivia);

              const embed = new EmbedBuilder()
                .setTitle(`Gemma Trivia: ${trivia.category}`)
                .setDescription(`**${trivia.question}**\n\nClick a button below to choose your answer!`)
                .setColor(0x5865F2);

              const row = new ActionRowBuilder<ButtonBuilder>();
              trivia.options.forEach((opt, idx) => {
                row.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`trivia_${triviaId}_${idx}`)
                    .setLabel(`${idx + 1}. ${opt.substring(0, 75)}`)
                    .setStyle(ButtonStyle.Primary)
                );
              });

              await interaction.editReply({ embeds: [embed], components: [row] });
            }
          }

          // Handle button clicks (Challenge accept/decline, TicTacToe moves & Trivia answers)
          if (interaction.isButton()) {
            const customId = interaction.customId;

            // Handle Challenge Accept / Decline
            if (customId.startsWith('chal_accept_')) {
              const challengeId = customId.replace('chal_accept_', '');
              const acceptRes = this.acceptChallenge(challengeId, interaction.user.id);
              if (acceptRes.error) {
                await interaction.reply({ content: acceptRes.error, ephemeral: true });
                return;
              }

              const game = acceptRes.game!;
              const matchEmbed = new EmbedBuilder()
                .setTitle('Tic-Tac-Toe Match')
                .setDescription(`**${game.player1.username} [X]** vs **${game.player2.username} [O]**\n\n${game.lastCommentary}`)
                .setColor(0x5865F2);

              const rows = [0, 1, 2].map((r) => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                [0, 1, 2].forEach((c) => {
                  const idx = r * 3 + c;
                  const label = game.board[idx] || '—';
                  const btn = new ButtonBuilder()
                    .setCustomId(`ttt_${game.id}_${idx}`)
                    .setLabel(label)
                    .setStyle(game.board[idx] === 'X' ? ButtonStyle.Primary : (game.board[idx] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary))
                    .setDisabled(game.board[idx] !== null || game.status !== 'in_progress');
                  row.addComponents(btn);
                });
                return row;
              });

              await interaction.update({
                content: `Challenge Accepted! Match between <@${game.player1.id}> [X] and <@${game.player2.id}> [O] has begun!`,
                embeds: [matchEmbed],
                components: rows,
              });
              return;
            } else if (customId.startsWith('chal_decline_')) {
              const challengeId = customId.replace('chal_decline_', '');
              const declineRes = this.declineChallenge(challengeId, interaction.user.id);
              if (declineRes.error) {
                await interaction.reply({ content: declineRes.error, ephemeral: true });
                return;
              }

              const challenge = declineRes.challenge!;
              const declineEmbed = new EmbedBuilder()
                .setTitle('Challenge Declined')
                .setDescription(`**${interaction.user.username}** declined the challenge from **${challenge.challenger.username}**.`)
                .setColor(0xED4245);

              await interaction.update({
                content: `Challenge was declined.`,
                embeds: [declineEmbed],
                components: [],
              });
              return;
            }

            if (customId.startsWith('ttt_')) {
              const parts = customId.split('_');
              const gameId = parts[0] + '_' + parts[1] + '_' + parts[2];
              const cellIdx = parseInt(parts[3], 10);

              const res = await this.makeTicTacToeMove(gameId, interaction.user.id, cellIdx);
              if (res.error) {
                await interaction.reply({ content: res.error, ephemeral: true });
                return;
              }

              const game = res.game!;
              const embed = new EmbedBuilder()
                .setTitle(game.status === 'in_progress' ? 'Tic-Tac-Toe Match' : (game.status === 'draw' ? "Match Ended in a Draw" : 'Match Result'))
                .setDescription(`**${game.player1.username} [X]** vs **${game.player2.username} [O]**\n\n${game.lastCommentary}`)
                .setColor(game.status === 'in_progress' ? 0x5865F2 : (game.winner === 'draw' ? 0xFEE75C : 0x57F287));

              const rows = [0, 1, 2].map((r) => {
                const row = new ActionRowBuilder<ButtonBuilder>();
                [0, 1, 2].forEach((c) => {
                  const idx = r * 3 + c;
                  const label = game.board[idx] || '—';
                  const btn = new ButtonBuilder()
                    .setCustomId(`ttt_${game.id}_${idx}`)
                    .setLabel(label)
                    .setStyle(game.board[idx] === 'X' ? ButtonStyle.Primary : (game.board[idx] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary))
                    .setDisabled(game.board[idx] !== null || game.status !== 'in_progress');
                  row.addComponents(btn);
                });
                return row;
              });

              await interaction.update({ embeds: [embed], components: rows });
            } else if (customId.startsWith('trivia_')) {
              const parts = customId.split('_');
              const triviaId = parts[0] + '_' + parts[1];
              const chosenIdx = parseInt(parts[2], 10);
              const trivia = this.activeTrivia.get(triviaId);

              if (!trivia) {
                await interaction.reply({ content: 'Trivia session expired!', ephemeral: true });
                return;
              }

              const isCorrect = chosenIdx === trivia.correctIndex;
              const resultEmbed = new EmbedBuilder()
                .setTitle(isCorrect ? 'Correct Answer' : 'Incorrect')
                .setDescription(`**${interaction.user.username}** answered **"${trivia.options[chosenIdx]}"**\n\n**Correct Answer:** ${trivia.options[trivia.correctIndex]}\n\n**Explanation:** ${trivia.explanation}`)
                .setColor(isCorrect ? 0x57F287 : 0xED4245);

              await interaction.update({ embeds: [resultEmbed], components: [] });
            }
          }
        } catch (interactErr: any) {
          this.addLog('error', `Interaction error: ${interactErr.message}`);
        }
      });

      this.client.on('error', (err) => {
        this.addLog('error', `Discord client error: ${err.message}`);
      });

      await this.client.login(token);
      return { success: true, message: 'Discord bot connected successfully!' };
    } catch (err: any) {
      this.isDiscordConnected = false;
      this.addLog('error', `Failed to login Discord bot: ${err.message}`);
      return { success: false, message: `Failed to login: ${err.message}` };
    }
  }

  public async stopDiscordBot() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.isDiscordConnected = false;
    this.discordBotUser = null;
    this.addLog('info', 'Discord Bot stopped.');
  }

  public resetStreak(channelType: 'e' | 'number' = 'e') {
    if (channelType === 'number') {
      const prev = this.currentNumber;
      this.currentNumber = 0;
      this.lastNumberUserId = null;
      this.lastNumberUsername = null;
      this.lastNumberAvatarUrl = null;
      this.addLog('info', `Number streak reset from ${prev} to 0 manually.`);
      this.saveStateToDisk();
      this.triggerLiveLeaderboardUpdate();
    } else {
      const prev = this.currentCount;
      this.currentCount = 0;
      this.addLog('info', `Streak reset from ${prev} to 0 manually.`);
      this.saveStateToDisk();
    }
  }

  public resetAll() {
    this.currentCount = 0;
    this.highestCount = 0;
    this.currentNumber = 0;
    this.highestNumber = 0;
    this.lastNumberUserId = null;
    this.lastNumberUsername = null;
    this.lastNumberAvatarUrl = null;
    this.leaderboard.clear();
    this.numberLeaderboard.clear();
    this.cooldowns.clear();
    this.saveStateToDisk();
    this.addLog('warn', `All counts and leaderboard data reset cleanly to 0.`);
    this.triggerLiveLeaderboardUpdate();
  }

  public clearCooldown(userId: string) {
    if (this.cooldowns.has(userId)) {
      const user = this.cooldowns.get(userId);
      this.cooldowns.delete(userId);
      this.saveStateToDisk();
      this.addLog('info', `Cleared 1-hour timeout penalty for ${user?.username || userId}`);
      return true;
    }
    return false;
  }
}

export const botEngine = new ECounterEngine(
  process.env.DISCORD_CHANNEL_ID || '1542084929171492955',
  process.env.DISCORD_NUMBER_CHANNEL_ID || '1542148410084171826'
);

// Auto-start Discord bot if valid token in environment
if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'YOUR_DISCORD_BOT_TOKEN') {
  botEngine.startDiscordBot(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_CLIENT_ID).catch((err) => {
    console.error('Auto-start Discord bot failed:', err);
  });
}
