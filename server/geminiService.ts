import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * TicTacToe AI Move using Gemma / Gemini reasoning with minimax fallback
 */
export async function getGemmaTicTacToeMove(
  board: (string | null)[],
  botSymbol: 'O' | 'X' = 'O'
): Promise<{ move: number; commentary: string }> {
  const humanSymbol = botSymbol === 'O' ? 'X' : 'O';
  const availableMoves = board
    .map((val, idx) => (val === null ? idx : null))
    .filter((v): v is number => v !== null);

  if (availableMoves.length === 0) {
    return { move: -1, commentary: 'The board is full! Good game.' };
  }

  // Quick win/block check (Minimax heuristic)
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6],           // Diagonals
  ];

  // Check if bot can win immediately
  for (const [a, b, c] of winningLines) {
    if (board[a] === botSymbol && board[b] === botSymbol && board[c] === null) return { move: c, commentary: 'Checkmate! I see the victory.' };
    if (board[a] === botSymbol && board[c] === botSymbol && board[b] === null) return { move: b, commentary: 'Victory line completed!' };
    if (board[b] === botSymbol && board[c] === botSymbol && board[a] === null) return { move: a, commentary: 'Connecting three in a row!' };
  }

  // Check if bot must block human win
  for (const [a, b, c] of winningLines) {
    if (board[a] === humanSymbol && board[b] === humanSymbol && board[c] === null) return { move: c, commentary: 'Nice try! Blocking your line.' };
    if (board[a] === humanSymbol && board[c] === humanSymbol && board[b] === null) return { move: b, commentary: 'Not so fast! Denied.' };
    if (board[b] === humanSymbol && board[c] === humanSymbol && board[a] === null) return { move: a, commentary: 'Blocked your path!' };
  }

  // Try calling Gemma/Gemini for creative strategic move & witty banter
  const ai = getAIClient();
  if (ai) {
    try {
      const prompt = `You are Gemma, an intelligent and playful Tic-Tac-Toe gaming bot.
Current board state (indices 0 to 8, 3x3 grid):
${board.map((v, i) => `[${i}: ${v || 'Empty'}]`).join(', ')}
Available empty slot indices: ${availableMoves.join(', ')}
You play as '${botSymbol}'. The human plays as '${humanSymbol}'.

Choose the best next index from the available indices (${availableMoves.join(', ')}) and provide a 1-sentence witty trash-talk or friendly commentary.
Respond strictly in JSON format:
{
  "move": number,
  "commentary": "short witty string"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (typeof parsed.move === 'number' && availableMoves.includes(parsed.move)) {
        return {
          move: parsed.move,
          commentary: parsed.commentary || 'Gemma calculated this move with precision!',
        };
      }
    } catch (err) {
      console.warn('Gemma TicTacToe generation fallback:', err);
    }
  }

  // Strategic fallback: center -> corners -> random
  if (availableMoves.includes(4)) {
    return { move: 4, commentary: 'Taking control of the center stage!' };
  }
  const corners = [0, 2, 6, 8].filter((i) => availableMoves.includes(i));
  if (corners.length > 0) {
    const chosen = corners[Math.floor(Math.random() * corners.length)];
    return { move: chosen, commentary: 'Securing a key corner position!' };
  }

  const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
  return { move: randomMove, commentary: 'Calculated and placed!' };
}

/**
 * Rock Paper Scissors Gemma AI move & commentary
 */
export async function getGemmaRPSMove(
  userChoice?: 'rock' | 'paper' | 'scissors',
  history: { user: string; bot: string; result: string }[] = []
): Promise<{ botChoice: 'rock' | 'paper' | 'scissors'; commentary: string }> {
  const choices: ('rock' | 'paper' | 'scissors')[] = ['rock', 'paper', 'scissors'];
  const fallbackChoice = choices[Math.floor(Math.random() * choices.length)];

  const ai = getAIClient();
  if (ai) {
    try {
      const prompt = `You are Gemma, a competitive Rock-Paper-Scissors AI champion.
Recent match history: ${JSON.stringify(history.slice(-5))}
Choose your move ("rock", "paper", or "scissors") and give a 1-sentence confident commentary anticipating the player's psychology.
Respond strictly in JSON format:
{
  "botChoice": "rock" | "paper" | "scissors",
  "commentary": "string"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (choices.includes(parsed.botChoice)) {
        return {
          botChoice: parsed.botChoice,
          commentary: parsed.commentary || 'Gemma predicted your move!',
        };
      }
    } catch (err) {
      console.warn('Gemma RPS generation fallback:', err);
    }
  }

  const commentaryList = [
    'I analyzed your psychological tendencies and chose my weapon!',
    'Predictable or bold? Let us reveal the showdown!',
    'Gemma throws with calculated precision!',
    'The classic duel of minds and hands!',
  ];
  return {
    botChoice: fallbackChoice,
    commentary: commentaryList[Math.floor(Math.random() * commentaryList.length)],
  };
}

/**
 * Generate Trivia Quiz Questions using Gemma
 */
export async function getGemmaTrivia(category: string = 'General Knowledge'): Promise<{
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
}> {
  const fallbackTrivia = {
    question: 'In computer science, what does the letter "E" stand for in "E-commerce"?',
    options: ['Electronic', 'Engineered', 'Enterprise', 'Encrypted'],
    correctIndex: 0,
    explanation: 'E-commerce stands for Electronic Commerce, referring to commercial transactions conducted electronically over the Internet.',
    category: 'Tech & Gaming',
  };

  const ai = getAIClient();
  if (ai) {
    try {
      const prompt = `You are Gemma, the discord quizmaster. Generate a fun, engaging, high-quality multiple choice trivia question in category: "${category}".
Ensure there are exactly 4 distinct options, with exactly one correct answer (index 0 to 3).
Respond strictly in JSON:
{
  "question": "string",
  "options": ["option 1", "option 2", "option 3", "option 4"],
  "correctIndex": 0 | 1 | 2 | 3,
  "explanation": "1-2 sentence explanation of why the answer is correct",
  "category": "${category}"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (
        parsed.question &&
        Array.isArray(parsed.options) &&
        parsed.options.length === 4 &&
        typeof parsed.correctIndex === 'number' &&
        parsed.correctIndex >= 0 &&
        parsed.correctIndex <= 3
      ) {
        return parsed;
      }
    } catch (err) {
      console.warn('Gemma Trivia generation fallback:', err);
    }
  }

  return fallbackTrivia;
}

/**
 * Connect 4 AI Move
 */
export async function getGemmaConnect4Move(
  board: (string | null)[][], // 6 rows x 7 cols
  botPiece: '🟡' | '🔴' = '🟡'
): Promise<{ column: number; commentary: string }> {
  // Find all valid columns (top row not full)
  const validColumns: number[] = [];
  for (let c = 0; c < 7; c++) {
    if (board[0][c] === null) {
      validColumns.push(c);
    }
  }

  if (validColumns.length === 0) {
    return { column: 0, commentary: 'Board is completely full!' };
  }

  // Prefer middle columns (3, 2, 4)
  const centerPref = [3, 2, 4, 1, 5, 0, 6].filter((c) => validColumns.includes(c));
  const chosenCol = centerPref[0] ?? validColumns[0];

  return {
    column: chosenCol,
    commentary: 'Gemma strategically dropped a disc down column ' + (chosenCol + 1) + '!',
  };
}
