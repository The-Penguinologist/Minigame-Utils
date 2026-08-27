import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { botEngine } from './server/botEngine.js';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Get full bot state (counts, leaderboard, timeouts, stats)
  app.get('/api/bot/state', (req, res) => {
    try {
      const state = botEngine.getState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get top 20 leaderboard (supports ?type=e or ?type=number)
  app.get('/api/bot/leaderboard', (req, res) => {
    try {
      const type = req.query.type === 'number' ? 'number' : 'e';
      if (type === 'number') {
        const top20 = botEngine.getTopNumberLeaderboard(20);
        const topPlayer = botEngine.getTopNumberPlayer();
        return res.json({
          type: 'number',
          top20,
          topPlayer,
          currentCount: botEngine.currentNumber,
          highestCount: botEngine.highestNumber,
          channelId: botEngine.numberChannelId,
          leaderboardChannelId: botEngine.numberLeaderboardChannelId,
        });
      }

      const top20 = botEngine.getTopLeaderboard(20);
      const topPlayer = botEngine.getTopPlayer();
      res.json({
        type: 'e',
        top20,
        topPlayer,
        currentCount: botEngine.currentCount,
        highestCount: botEngine.highestCount,
        channelId: botEngine.eChannelId,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get bot logs
  app.get('/api/bot/logs', (req, res) => {
    try {
      res.json({ logs: botEngine.logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Simulate or process an incoming message (Used by Live Discord Simulator or REST webhook)
  app.post('/api/bot/message', (req, res) => {
    try {
      const { user, content, channelId } = req.body;
      if (!user || !user.id || !user.username) {
        return res.status(400).json({ error: 'User object with id and username is required.' });
      }
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content string is required.' });
      }

      const result = botEngine.processMessage(
        {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
        content,
        channelId || botEngine.eChannelId
      );

      res.json({
        result,
        state: botEngine.getState(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Execute slash command simulation
  app.post('/api/bot/command', async (req, res) => {
    try {
      const { command, user, args } = req.body;
      if (command === 'leaderboard') {
        const embed = botEngine.getLeaderboardEmbed(20);
        botEngine.addLog('command', `Simulated /leaderboard by ${user?.username || 'User'}`);
        return res.json({ embed, type: 'leaderboard' });
      } else if (command === 'numberleaderboard') {
        const embed = botEngine.getNumberLeaderboardEmbed(20);
        botEngine.addLog('command', `Simulated /numberleaderboard by ${user?.username || 'User'}`);
        return res.json({ embed, type: 'numberleaderboard' });
      } else if (command === 'ecounter' || command === 'numbercounter' || command === 'status') {
        const embed = botEngine.getStatusEmbed();
        botEngine.addLog('command', `Simulated /${command} by ${user?.username || 'User'}`);
        return res.json({ embed, type: 'status' });
      } else if (command === 'rules') {
        const embed = botEngine.getRulesEmbed();
        botEngine.addLog('command', `Simulated /rules by ${user?.username || 'User'}`);
        return res.json({ embed, type: 'rules' });
      } else if (command === 'tictactoe') {
        if (args?.opponent) {
          const challenge = botEngine.createChallenge(
            'tictactoe',
            { id: user?.id || 'sim_user', username: user?.username || 'User' },
            { id: args.opponent.id || 'opponent_user', username: args.opponent.username || args.opponent },
            botEngine.eChannelId
          );
          return res.json({
            type: 'challenge',
            challenge,
            embed: {
              title: 'Tic-Tac-Toe Challenge!',
              description: `**${user?.username || 'User'}** has challenged **${args.opponent.username || args.opponent}** to a game of Tic-Tac-Toe!\n\nClick Accept to start playing!`,
              color: 0x5865F2,
            },
          });
        }
        const game = await botEngine.createTicTacToe(
          botEngine.eChannelId,
          { id: user?.id || 'sim_user', username: user?.username || 'User' },
          true
        );
        return res.json({
          type: 'tictactoe',
          game,
          embed: {
            title: 'Tic-Tac-Toe vs Gemma AI Bot',
            description: `**${user?.username || 'User'} [X]** vs **Gemma AI Bot [O]**\n\nClick an empty tile to make your move!`,
            color: 0x5865F2,
          },
        });
      } else if (command === 'rps') {
        const choice = (args?.choice || 'rock') as 'rock' | 'paper' | 'scissors';
        const result = await botEngine.playRPS(
          { id: user?.id || 'sim_user', username: user?.username || 'User' },
          choice,
          true
        );
        return res.json({ type: 'rps', result });
      } else if (command === 'trivia') {
        const trivia = await botEngine.getTrivia(args?.category);
        return res.json({ type: 'trivia', trivia });
      } else {
        return res.status(400).json({ error: `Unknown command: /${command}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Thread Minigame APIs
  app.post('/api/threads/create', (req, res) => {
    try {
      const { gameType, challenger, opponent, extraData } = req.body;
      if (!gameType || !challenger) {
        return res.status(400).json({ error: 'gameType and challenger are required.' });
      }
      const thread = botEngine.createMinigameThread(
        gameType,
        challenger,
        opponent || { id: 'bot_gemma', username: 'Gemma AI', isBot: true },
        extraData
      );
      res.json({ thread, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/threads/accept', (req, res) => {
    try {
      const { threadId, userId } = req.body;
      const result = botEngine.acceptThreadChallenge(threadId, userId);
      res.json({ ...result, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/threads/decline', (req, res) => {
    try {
      const { threadId, userId } = req.body;
      const result = botEngine.declineThreadChallenge(threadId, userId);
      res.json({ ...result, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/threads/move', async (req, res) => {
    try {
      const { threadId, userId, moveData } = req.body;
      const result = await botEngine.makeThreadMove(threadId, userId, moveData);
      res.json({ ...result, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Minigame direct APIs
  app.post('/api/minigames/challenge/create', (req, res) => {
    try {
      const { gameType, challenger, opponent } = req.body;
      const challenge = botEngine.createChallenge(
        gameType || 'tictactoe',
        challenger || { id: 'p1', username: 'Player 1' },
        opponent || { id: 'p2', username: 'Player 2' },
        botEngine.eChannelId
      );
      res.json({ challenge });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/challenge/accept', (req, res) => {
    try {
      const { challengeId, userId } = req.body;
      const result = botEngine.acceptChallenge(challengeId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/challenge/decline', (req, res) => {
    try {
      const { challengeId, userId } = req.body;
      const result = botEngine.declineChallenge(challengeId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/tictactoe/create', async (req, res) => {
    try {
      const { user, vsBot, player2 } = req.body;
      const game = await botEngine.createTicTacToe(
        botEngine.eChannelId,
        user || { id: 'p1', username: 'Player 1' },
        vsBot !== false,
        player2
      );
      res.json({ game });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/tictactoe/move', async (req, res) => {
    try {
      const { gameId, userId, cellIndex } = req.body;
      const result = await botEngine.makeTicTacToeMove(gameId, userId, cellIndex);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/rps', async (req, res) => {
    try {
      const { user, choice, vsBot, player2Choice } = req.body;
      const result = await botEngine.playRPS(
        user || { id: 'p1', username: 'Player' },
        choice || 'rock',
        vsBot !== false,
        player2Choice
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/trivia', async (req, res) => {
    try {
      const { category } = req.body;
      const trivia = await botEngine.getTrivia(category);
      res.json(trivia);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/minigames/connect4', async (req, res) => {
    try {
      const { board, column, playerPiece, vsBot } = req.body;
      const result = await botEngine.playConnect4Move(board, column, playerPiece || '🔴', vsBot !== false);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update target channel ID or config
  app.post('/api/bot/config', (req, res) => {
    try {
      const { eChannelId, numberChannelId, numberLeaderboardChannelId, botToken, clientId } = req.body;
      if (eChannelId && typeof eChannelId === 'string') {
        botEngine.eChannelId = eChannelId.trim();
        botEngine.channelId = botEngine.eChannelId;
        botEngine.addLog('info', `Target 'E' Channel ID updated to: ${botEngine.eChannelId}`);
      }
      if (numberChannelId && typeof numberChannelId === 'string') {
        botEngine.numberChannelId = numberChannelId.trim();
        botEngine.addLog('info', `Target Number Channel ID updated to: ${botEngine.numberChannelId}`);
      }
      if (numberLeaderboardChannelId !== undefined) {
        botEngine.numberLeaderboardChannelId = numberLeaderboardChannelId ? numberLeaderboardChannelId.trim() : null;
        botEngine.addLog('info', `Live Leaderboard Channel ID set to: ${botEngine.numberLeaderboardChannelId || 'None'}`);
        botEngine.triggerLiveLeaderboardUpdate();
      }

      if (botToken) {
        botEngine.startDiscordBot(botToken, clientId).then(startResult => {
          return res.json({
            success: true,
            eChannelId: botEngine.eChannelId,
            numberChannelId: botEngine.numberChannelId,
            numberLeaderboardChannelId: botEngine.numberLeaderboardChannelId,
            discordResult: startResult,
            state: botEngine.getState(),
          });
        }).catch(err => {
          return res.status(500).json({ error: err.message });
        });
        return;
      }

      res.json({
        success: true,
        eChannelId: botEngine.eChannelId,
        numberChannelId: botEngine.numberChannelId,
        numberLeaderboardChannelId: botEngine.numberLeaderboardChannelId,
        state: botEngine.getState(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset streak
  app.post('/api/bot/reset-streak', (req, res) => {
    try {
      const { channelType } = req.body;
      botEngine.resetStreak(channelType || 'e');
      res.json({ success: true, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear user timeout cooldown
  app.post('/api/bot/clear-cooldown', (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const cleared = botEngine.clearCooldown(userId);
      res.json({ success: cleared, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset all stats
  app.post('/api/bot/reset-all', (req, res) => {
    try {
      botEngine.resetAll();
      res.json({ success: true, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start / Stop real Discord connection
  app.post('/api/bot/connect', async (req, res) => {
    try {
      const { token, clientId } = req.body;
      const effectiveToken = token || process.env.DISCORD_BOT_TOKEN;
      const effectiveClientId = clientId || process.env.DISCORD_CLIENT_ID;

      if (!effectiveToken || effectiveToken === 'YOUR_DISCORD_BOT_TOKEN') {
        return res.status(400).json({
          error: 'Please provide a valid Discord Bot Token in the input field or DISCORD_BOT_TOKEN in .env'
        });
      }

      const result = await botEngine.startDiscordBot(effectiveToken, effectiveClientId);
      res.json({ result, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/bot/disconnect', async (req, res) => {
    try {
      await botEngine.stopDiscordBot();
      res.json({ success: true, state: botEngine.getState() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E Counter Bot Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
