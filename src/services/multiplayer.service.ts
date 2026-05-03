/**
 * Multiplayer Service
 * Handles Socket.io multiplayer chess games
 */

import { Server, Socket } from 'socket.io';

interface GameRoom {
  id: string;
  players: [string, string];
  currentPosition: string;
  whitePlayer: string;
  blackPlayer: string;
  currentTurn: 'white' | 'black';
  moveHistory: string[];
  timeControl?: {
    initial: number;
    increment: number;
  };
  startedAt?: Date;
}

interface PlayerQueue {
  socketId: string;
  rating?: number;
  timeControl?: {
    initial: number;
    increment: number;
  };
}

export class MultiplayerService {
  private io: Server;
  private gameRooms: Map<string, GameRoom> = new Map();
  private playerQueue: PlayerQueue[] = [];
  private playerToRoom: Map<string, string> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Handle new player connection
   */
  handleConnection(socket: Socket): void {
    // Join matchmaking queue
    socket.on('join-queue', (data: { rating?: number; timeControl?: any }) => {
      console.log(`🎮 Player ${socket.id} joined queue`);

      this.playerQueue.push({
        socketId: socket.id,
        rating: data.rating,
        timeControl: data.timeControl
      });

      // Try to match players
      this.tryMatchPlayers();

      socket.emit('queue-joined', {
        position: this.playerQueue.length,
        playersInQueue: this.playerQueue.length
      });
    });

    // Leave matchmaking queue
    socket.on('leave-queue', () => {
      this.playerQueue = this.playerQueue.filter(p => p.socketId !== socket.id);
      socket.emit('queue-left');
    });

    // Make a move
    socket.on('make-move', (data: { roomId: string; move: string; fen: string }) => {
      const room = this.gameRooms.get(data.roomId);
      if (!room) return;

      // Validate it's the player's turn
      const playerColor = room.whitePlayer === socket.id ? 'white' : 'black';
      if (room.currentTurn !== playerColor) {
        socket.emit('move-error', { error: 'Not your turn' });
        return;
      }

      // Update game state
      room.currentPosition = data.fen;
      room.moveHistory.push(data.move);
      room.currentTurn = room.currentTurn === 'white' ? 'black' : 'white';

      // Broadcast move to opponent
      const opponent = room.players.find(p => p !== socket.id);
      if (opponent) {
        this.io.to(opponent).emit('opponent-move', {
          move: data.move,
          fen: data.fen
        });
      }

      // Acknowledge move to sender
      socket.emit('move-accepted', {
        move: data.move,
        fen: data.fen
      });
    });

    // Resign game
    socket.on('resign', () => {
      const roomId = this.playerToRoom.get(socket.id);
      if (!roomId) return;

      const room = this.gameRooms.get(roomId);
      if (!room) return;

      const opponent = room.players.find(p => p !== socket.id);
      if (opponent) {
        this.io.to(opponent).emit('game-ended', {
          result: 'win',
          reason: 'opponent-resigned'
        });
      }

      socket.emit('game-ended', {
        result: 'loss',
        reason: 'resigned'
      });

      // Clean up room
      this.cleanupGame(roomId);
    });

    // Offer draw
    socket.on('offer-draw', () => {
      const roomId = this.playerToRoom.get(socket.id);
      if (!roomId) return;

      const room = this.gameRooms.get(roomId);
      if (!room) return;

      const opponent = room.players.find(p => p !== socket.id);
      if (opponent) {
        this.io.to(opponent).emit('draw-offered', { from: socket.id });
      }
    });

    // Accept/decline draw
    socket.on('draw-response', (data: { accept: boolean }) => {
      const roomId = this.playerToRoom.get(socket.id);
      if (!roomId) return;

      const room = this.gameRooms.get(roomId);
      if (!room) return;

      const opponent = room.players.find(p => p !== socket.id);
      if (!opponent) return;

      if (data.accept) {
        // Draw accepted
        this.io.to(room.id).emit('game-ended', {
          result: 'draw',
          reason: 'agreement'
        });
        this.cleanupGame(roomId);
      } else {
        // Draw declined
        this.io.to(opponent).emit('draw-declined');
      }
    });

    // Send chat message
    socket.on('chat-message', (data: { roomId: string; message: string }) => {
      const room = this.gameRooms.get(data.roomId);
      if (!room) return;

      const opponent = room.players.find(p => p !== socket.id);
      if (opponent) {
        this.io.to(opponent).emit('chat-message', {
          message: data.message,
          from: socket.id
        });
      }
    });
  }

  /**
   * Handle player disconnection
   */
  handleDisconnection(socket: Socket): void {
    // Remove from queue
    this.playerQueue = this.playerQueue.filter(p => p.socketId !== socket.id);

    // Handle game disconnection
    const roomId = this.playerToRoom.get(socket.id);
    if (roomId) {
      const room = this.gameRooms.get(roomId);
      if (room) {
        const opponent = room.players.find(p => p !== socket.id);
        if (opponent) {
          this.io.to(opponent).emit('opponent-disconnected');
          this.io.to(opponent).emit('game-ended', {
            result: 'win',
            reason: 'opponent-disconnected'
          });
        }
        this.cleanupGame(roomId);
      }
    }
  }

  /**
   * Try to match two players from queue
   */
  private tryMatchPlayers(): void {
    if (this.playerQueue.length < 2) return;

    // Simple FIFO matching (can be improved with ELO matching)
    const player1 = this.playerQueue.shift()!;
    const player2 = this.playerQueue.shift()!;

    const roomId = `game-${Date.now()}`;

    // Randomly assign colors
    const whitePlayer = Math.random() > 0.5 ? player1.socketId : player2.socketId;
    const blackPlayer = whitePlayer === player1.socketId ? player2.socketId : player1.socketId;

    const room: GameRoom = {
      id: roomId,
      players: [player1.socketId, player2.socketId],
      currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      whitePlayer,
      blackPlayer,
      currentTurn: 'white',
      moveHistory: [],
      timeControl: player1.timeControl,
      startedAt: new Date()
    };

    this.gameRooms.set(roomId, room);
    this.playerToRoom.set(player1.socketId, roomId);
    this.playerToRoom.set(player2.socketId, roomId);

    // Join both players to room
    this.io.sockets.sockets.get(player1.socketId)?.join(roomId);
    this.io.sockets.sockets.get(player2.socketId)?.join(roomId);

    // Notify players
    this.io.to(whitePlayer).emit('game-started', {
      roomId,
      color: 'white',
      opponent: blackPlayer,
      timeControl: room.timeControl
    });

    this.io.to(blackPlayer).emit('game-started', {
      roomId,
      color: 'black',
      opponent: whitePlayer,
      timeControl: room.timeControl
    });

    console.log(`✅ Game matched: ${roomId} (${player1.socketId} vs ${player2.socketId})`);
  }

  /**
   * Cleanup game room
   */
  private cleanupGame(roomId: string): void {
    const room = this.gameRooms.get(roomId);
    if (!room) return;

    // Remove player mappings
    room.players.forEach(playerId => {
      this.playerToRoom.delete(playerId);
    });

    // Remove room
    this.gameRooms.delete(roomId);

    console.log(`🗑️ Game room cleaned up: ${roomId}`);
  }
}
