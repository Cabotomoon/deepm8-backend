/**
 * DeepM8 Backend Server
 * Stockfish Analysis + Multiplayer + Puzzle Generation
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { StockfishService } from './services/stockfish.service.js';
import { MultiplayerService } from './services/multiplayer.service.js';
import { PuzzleService } from './services/puzzle.service.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const stockfishService = new StockfishService();
const multiplayerService = new MultiplayerService(io);
const puzzleService = new PuzzleService(stockfishService);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'deepm8-backend',
    timestamp: new Date().toISOString()
  });
});

// API Routes

// 1. Stockfish Analysis
app.post('/api/analysis/position', async (req, res) => {
  try {
    const { fen, depth = 15 } = req.body;

    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    const analysis = await stockfishService.analyzePosition(fen, depth);
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// 2. Best Move Recommendation
app.post('/api/recommendations/best-move', async (req, res) => {
  try {
    const { fen, depth = 12 } = req.body;

    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    const bestMove = await stockfishService.getBestMove(fen, depth);
    res.json(bestMove);
  } catch (error) {
    console.error('Best move error:', error);
    res.status(500).json({ error: 'Best move calculation failed' });
  }
});

// 3. Validate Move
app.post('/api/analysis/validate-move', async (req, res) => {
  try {
    const { fen, move, depth = 10 } = req.body;

    if (!fen || !move) {
      return res.status(400).json({ error: 'FEN and move are required' });
    }

    const validation = await stockfishService.validateMove(fen, move, depth);
    res.json(validation);
  } catch (error) {
    console.error('Move validation error:', error);
    res.status(500).json({ error: 'Move validation failed' });
  }
});

// 4. Generate Puzzles
app.post('/api/puzzles/generate', async (req, res) => {
  try {
    const { category, count = 10, minDepth = 8 } = req.body;

    const validCategories = ['openings', 'tactics', 'endgames', 'middlegame'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const puzzles = await puzzleService.generatePuzzles(category, count, minDepth);
    res.json(puzzles);
  } catch (error) {
    console.error('Puzzle generation error:', error);
    res.status(500).json({ error: 'Puzzle generation failed' });
  }
});

// 5. Validate Puzzle Move
app.post('/api/puzzles/validate', async (req, res) => {
  try {
    const { fen, move, depth = 12 } = req.body;

    if (!fen || !move) {
      return res.status(400).json({ error: 'FEN and move are required' });
    }

    const isCorrect = await stockfishService.isBestMove(fen, move, depth);
    const analysis = await stockfishService.analyzePosition(fen, depth);

    res.json({
      isCorrect,
      bestMove: analysis.bestMove,
      evaluation: analysis.evaluation,
      feedback: isCorrect
        ? '¡Excelente! Has encontrado la mejor jugada.'
        : `La mejor jugada era ${analysis.bestMove}.`
    });
  } catch (error) {
    console.error('Puzzle validation error:', error);
    res.status(500).json({ error: 'Puzzle validation failed' });
  }
});

// Socket.io for Multiplayer
io.on('connection', (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);

  multiplayerService.handleConnection(socket);

  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    multiplayerService.handleDisconnection(socket);
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║         🚀 DeepM8 Backend Server Running                 ║
║                                                          ║
║  Port: ${PORT}                                        ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                          ║
║  Services:                                               ║
║  ✅ Stockfish Analysis                                   ║
║  ✅ Multiplayer (Socket.io)                              ║
║  ✅ Puzzle Generation                                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    stockfishService.shutdown();
  });
});
