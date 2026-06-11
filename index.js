/**
 * DeepM8 Backend API Server
 * - OpenAI API proxy for secure token handling
 * - Socket.IO server for real-time multiplayer chess
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// 🔒 Secure OpenAI API key - NEVER expose to frontend
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ FATAL ERROR: OPENAI_API_KEY environment variable is not set');
  console.error('Please set OPENAI_API_KEY in Railway environment variables');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// CORS configuration
const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://*.seaverse.com',
  'https://deepm8-frontend.vercel.app',
  'https://*.vercel.app'
];

// Express middleware
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Socket.IO server with CORS
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ==================== MULTIPLAYER GAME STATE ====================
const matchmakingQueue = new Map(); // userId -> { socketId, userName, elo, timeControl, joinedAt }
const activeMatches = new Map();    // matchId -> { id, players: { white, black }, moves, startedAt }
const playerToMatch = new Map();    // socketId -> matchId

// ==================== SOCKET.IO EVENT HANDLERS ====================

io.on('connection', (socket) => {
  const { userId, userName } = socket.handshake.auth;
  console.log(`✅ Player connected: ${userName} (${socket.id})`);

  // Find Match
  socket.on('find-match', ({ playerElo, timeControl }, callback) => {
    console.log(`🔍 ${userName} searching for match (ELO: ${playerElo}, ${timeControl})`);

    // Check if already in a match
    if (playerToMatch.has(socket.id)) {
      callback({ success: false, error: 'Already in a match' });
      return;
    }

    // Try to find an opponent in queue
    let opponentEntry = null;
    for (const [opponentUserId, queueData] of matchmakingQueue.entries()) {
      if (queueData.timeControl === timeControl && Math.abs(queueData.elo - playerElo) <= 200) {
        opponentEntry = { userId: opponentUserId, ...queueData };
        matchmakingQueue.delete(opponentUserId);
        break;
      }
    }

    if (opponentEntry) {
      // Match found! Create game room
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const isWhite = Math.random() < 0.5;

      const match = {
        id: matchId,
        players: {
          white: isWhite ? { userId, userName, socketId: socket.id, elo: playerElo } : { userId: opponentEntry.userId, userName: opponentEntry.userName, socketId: opponentEntry.socketId, elo: opponentEntry.elo },
          black: isWhite ? { userId: opponentEntry.userId, userName: opponentEntry.userName, socketId: opponentEntry.socketId, elo: opponentEntry.elo } : { userId, userName, socketId: socket.id, elo: playerElo }
        },
        moves: [],
        startedAt: Date.now(),
        timeControl
      };

      activeMatches.set(matchId, match);
      playerToMatch.set(socket.id, matchId);
      playerToMatch.set(opponentEntry.socketId, matchId);

      // Join socket room
      socket.join(matchId);
      io.sockets.sockets.get(opponentEntry.socketId)?.join(matchId);

      console.log(`✨ Match created: ${matchId} (${match.players.white.userName} vs ${match.players.black.userName})`);

      // Notify both players
      io.to(matchId).emit('match-found', match);
      io.to(matchId).emit('game-start', match);

      callback({ success: true, match });
    } else {
      // No opponent found, add to queue
      matchmakingQueue.set(userId, {
        socketId: socket.id,
        userName,
        elo: playerElo,
        timeControl,
        joinedAt: Date.now()
      });

      console.log(`⏳ ${userName} added to queue. Queue size: ${matchmakingQueue.size}`);
      callback({ success: true, match: null });
    }
  });

  // Cancel Matchmaking
  socket.on('cancel-matchmaking', (callback) => {
    const { userId } = socket.handshake.auth;
    if (matchmakingQueue.has(userId)) {
      matchmakingQueue.delete(userId);
      console.log(`❌ ${userName} cancelled matchmaking`);
      callback({ success: true });
    } else {
      callback({ success: false, error: 'Not in matchmaking queue' });
    }
  });

  // Chess Move
  socket.on('chess-move', ({ matchId, move }) => {
    const match = activeMatches.get(matchId);
    if (!match) {
      console.error(`❌ Match ${matchId} not found`);
      return;
    }

    match.moves.push(move);
    console.log(`♟️  Move in ${matchId}: ${move.notation} (${match.moves.length} moves)`);

    // Broadcast to opponent only
    socket.to(matchId).emit('chess-move', move);
  });

  // Chat Message
  socket.on('chat-message', ({ matchId, message }) => {
    const match = activeMatches.get(matchId);
    if (!match) return;

    const chatMessage = {
      sender: userName,
      message,
      timestamp: Date.now()
    };

    io.to(matchId).emit('chat-message', chatMessage);
  });

  // Game End
  socket.on('game-end', ({ matchId, winner, reason }) => {
    const match = activeMatches.get(matchId);
    if (!match) return;

    console.log(`🏁 Game ended: ${matchId} - Winner: ${winner} (${reason})`);

    // Notify both players
    io.to(matchId).emit('game-end', { winner, reason });

    // Cleanup
    activeMatches.delete(matchId);
    playerToMatch.delete(socket.id);
    const opponentSocketId = winner === 'white' ? match.players.black.socketId : match.players.white.socketId;
    playerToMatch.delete(opponentSocketId);
  });

  // Leave Match
  socket.on('leave-match', ({ matchId }, callback) => {
    const match = activeMatches.get(matchId);
    if (!match) {
      callback({ success: false, error: 'Match not found' });
      return;
    }

    console.log(`👋 ${userName} left match ${matchId}`);

    // Notify opponent
    socket.to(matchId).emit('opponent-disconnected');

    // Cleanup
    socket.leave(matchId);
    playerToMatch.delete(socket.id);

    callback({ success: true });
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ ${userName} disconnected (${reason})`);

    // Remove from matchmaking queue
    const { userId } = socket.handshake.auth;
    matchmakingQueue.delete(userId);

    // Handle active match
    const matchId = playerToMatch.get(socket.id);
    if (matchId) {
      const match = activeMatches.get(matchId);
      if (match) {
        socket.to(matchId).emit('opponent-disconnected');
        console.log(`⚠️  ${userName} disconnected from active match ${matchId}`);
      }
      playerToMatch.delete(socket.id);
    }
  });
});

// ==================== HTTP ENDPOINTS ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DeepM8 Backend API',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/chat
 * Secure endpoint for OpenAI chat completions
 *
 * Body:
 * - messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
 * - model: string (optional, default: 'gpt-4o-mini')
 * - temperature: number (optional, default: 0.7)
 * - maxTokens: number (optional, default: 1000)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000
    } = req.body;

    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

    // Enhanced validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('❌ Validation failed: messages array is invalid');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'messages array is required and must not be empty'
      });
    }

    // Validate each message has required fields
    const invalidMessages = messages.filter((msg, index) => {
      const isValid = msg &&
                      typeof msg === 'object' &&
                      msg.role &&
                      typeof msg.content === 'string' &&
                      msg.content.trim().length > 0;
      if (!isValid) {
        console.error(`❌ Invalid message at index ${index}:`, msg);
      }
      return !isValid;
    });

    if (invalidMessages.length > 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'All messages must have role and content (non-empty string)',
        details: `${invalidMessages.length} invalid message(s) found`
      });
    }

    // Rate limiting check (simple example - implement proper rate limiting in production)
    const messageCount = messages.length;
    if (messageCount > 50) {
      return res.status(429).json({
        error: 'Too many messages',
        message: 'Conversation too long. Please start a new chat.'
      });
    }

    console.log('🤖 Processing chat request:', {
      model,
      messageCount,
      temperature,
      maxTokens,
      timestamp: new Date().toISOString()
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: String(msg.content).trim()
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const response = {
      content: completion.choices[0]?.message?.content || '',
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      }
    };

    console.log('✅ OpenAI response generated:', {
      contentLength: response.content.length,
      totalTokens: response.usage.totalTokens,
      timestamp: new Date().toISOString()
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);

    // Handle specific OpenAI errors
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    }

    if (error.status === 401) {
      return res.status(500).json({
        error: 'API configuration error',
        message: 'Invalid API key configuration.'
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request',
        message: error.message || 'Bad request to OpenAI API'
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process chat request',
      details: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server (use httpServer instead of app)
httpServer.listen(PORT, () => {
  console.log('🚀 DeepM8 Backend API Server');
  console.log(`📡 HTTP Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO Server ready for multiplayer`);
  console.log(`🔒 OpenAI API Key: ***${OPENAI_API_KEY.slice(-4)}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health       - Health check');
  console.log('  POST /api/chat     - Chat completions');
  console.log('  WS   /socket.io    - Multiplayer websocket');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
