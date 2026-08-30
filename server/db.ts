import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'database.sqlite');
let db: Database | null = null;

export interface GameStateRecord {
  currentNumber: number;
  highestNumber: number;
  lastUserId: string | null;
  lastUsername: string | null;
  lastAvatarUrl: string | null;
  lastTimestamp: number | null;
  liveLeaderboardMessageId: string | null;
  numberChannelId: string;
  leaderboardChannelId: string | null;
}

export interface UserStatsRecord {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalNumbersCounted: number;
  highestStreakContribution: number;
  failedCount: number;
  lastActive: number;
}

export interface CooldownRecord {
  userId: string;
  username: string;
  avatarUrl: string | null;
  reason: string;
  bannedAt: number;
  bannedUntil: number;
}

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const filebuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Create SQL Schema Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_number INTEGER DEFAULT 0,
      highest_number INTEGER DEFAULT 0,
      last_user_id TEXT,
      last_username TEXT,
      last_avatar_url TEXT,
      last_timestamp INTEGER,
      live_leaderboard_message_id TEXT,
      number_channel_id TEXT,
      leaderboard_channel_id TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      avatar_url TEXT,
      total_numbers_counted INTEGER DEFAULT 0,
      highest_streak_contribution INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      last_active INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cooldowns (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      avatar_url TEXT,
      reason TEXT,
      banned_at INTEGER,
      banned_until INTEGER
    );
  `);

  // Migrate or initialize default single row in game_state
  const checkState = db.exec("SELECT COUNT(*) FROM game_state");
  if (!checkState.length || checkState[0].values[0][0] === 0) {
    db.run(
      `INSERT INTO game_state (id, current_number, highest_number, number_channel_id, leaderboard_channel_id) 
       VALUES (1, 0, 0, '1542148410084171826', '1542151072032755893');`
    );
    saveDatabaseToDisk();
  }

  console.log("💾 SQLite Database (database.sqlite) connected & schema ready!");
  return db;
}

export function saveDatabaseToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err: any) {
    console.error("Failed to save SQLite DB to disk:", err.message);
  }
}

export function getGameStateFromDB(): GameStateRecord {
  if (!db) {
    return {
      currentNumber: 0,
      highestNumber: 0,
      lastUserId: null,
      lastUsername: null,
      lastAvatarUrl: null,
      lastTimestamp: null,
      liveLeaderboardMessageId: null,
      numberChannelId: '1542148410084171826',
      leaderboardChannelId: '1542151072032755893',
    };
  }

  const res = db.exec("SELECT * FROM game_state WHERE id = 1");
  if (!res.length || !res[0].values.length) {
    return {
      currentNumber: 0,
      highestNumber: 0,
      lastUserId: null,
      lastUsername: null,
      lastAvatarUrl: null,
      lastTimestamp: null,
      liveLeaderboardMessageId: null,
      numberChannelId: '1542148410084171826',
      leaderboardChannelId: '1542151072032755893',
    };
  }

  const columns = res[0].columns;
  const row = res[0].values[0];
  const obj: any = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });

  return {
    currentNumber: obj.current_number || 0,
    highestNumber: obj.highest_number || 0,
    lastUserId: obj.last_user_id || null,
    lastUsername: obj.last_username || null,
    lastAvatarUrl: obj.last_avatar_url || null,
    lastTimestamp: obj.last_timestamp || null,
    liveLeaderboardMessageId: obj.live_leaderboard_message_id || null,
    numberChannelId: obj.number_channel_id || '1542148410084171826',
    leaderboardChannelId: obj.leaderboard_channel_id || '1542151072032755893',
  };
}

export function updateGameStateInDB(update: Partial<GameStateRecord>) {
  if (!db) return;
  const state = getGameStateFromDB();
  const nextState = { ...state, ...update };

  db.run(
    `UPDATE game_state SET 
      current_number = ?,
      highest_number = ?,
      last_user_id = ?,
      last_username = ?,
      last_avatar_url = ?,
      last_timestamp = ?,
      live_leaderboard_message_id = ?,
      number_channel_id = ?,
      leaderboard_channel_id = ?
    WHERE id = 1`,
    [
      nextState.currentNumber,
      nextState.highestNumber,
      nextState.lastUserId,
      nextState.lastUsername,
      nextState.lastAvatarUrl,
      nextState.lastTimestamp,
      nextState.liveLeaderboardMessageId,
      nextState.numberChannelId,
      nextState.leaderboardChannelId,
    ]
  );
  saveDatabaseToDisk();
}

export function getUserStatsMapFromDB(): Map<string, UserStatsRecord> {
  const map = new Map<string, UserStatsRecord>();
  if (!db) return map;

  const res = db.exec("SELECT * FROM user_stats");
  if (!res.length) return map;

  const columns = res[0].columns;
  res[0].values.forEach(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    map.set(obj.user_id, {
      userId: obj.user_id,
      username: obj.username,
      avatarUrl: obj.avatar_url || null,
      totalNumbersCounted: obj.total_numbers_counted || 0,
      highestStreakContribution: obj.highest_streak_contribution || 0,
      failedCount: obj.failed_count || 0,
      lastActive: obj.last_active || Date.now(),
    });
  });

  return map;
}

export function saveUserStatToDB(stat: UserStatsRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO user_stats (user_id, username, avatar_url, total_numbers_counted, highest_streak_contribution, failed_count, last_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       avatar_url = excluded.avatar_url,
       total_numbers_counted = excluded.total_numbers_counted,
       highest_streak_contribution = excluded.highest_streak_contribution,
       failed_count = excluded.failed_count,
       last_active = excluded.last_active`,
    [
      stat.userId,
      stat.username,
      stat.avatarUrl || null,
      stat.totalNumbersCounted,
      stat.highestStreakContribution,
      stat.failedCount,
      stat.lastActive,
    ]
  );
  saveDatabaseToDisk();
}

export function getCooldownsMapFromDB(): Map<string, CooldownRecord> {
  const map = new Map<string, CooldownRecord>();
  if (!db) return map;

  const res = db.exec("SELECT * FROM cooldowns");
  if (!res.length) return map;

  const columns = res[0].columns;
  res[0].values.forEach(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    map.set(obj.user_id, {
      userId: obj.user_id,
      username: obj.username,
      avatarUrl: obj.avatar_url || null,
      reason: obj.reason,
      bannedAt: obj.banned_at,
      bannedUntil: obj.banned_until,
    });
  });

  return map;
}

export function saveCooldownToDB(cd: CooldownRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO cooldowns (user_id, username, avatar_url, reason, banned_at, banned_until)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       avatar_url = excluded.avatar_url,
       reason = excluded.reason,
       banned_at = excluded.banned_at,
       banned_until = excluded.banned_until`,
    [cd.userId, cd.username, cd.avatarUrl || null, cd.reason, cd.bannedAt, cd.bannedUntil]
  );
  saveDatabaseToDisk();
}

export function deleteCooldownFromDB(userId: string) {
  if (!db) return;
  db.run("DELETE FROM cooldowns WHERE user_id = ?", [userId]);
  saveDatabaseToDisk();
}

export function clearAllDBData() {
  if (!db) return;
  db.run("UPDATE game_state SET current_number = 0, highest_number = 0, last_user_id = NULL, last_username = NULL, last_avatar_url = NULL, last_timestamp = NULL WHERE id = 1;");
  db.run("DELETE FROM user_stats;");
  db.run("DELETE FROM cooldowns;");
  saveDatabaseToDisk();
}
