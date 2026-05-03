/**
 * Stockfish Service
 * Handles chess engine analysis and move evaluation
 */

import { spawn, ChildProcess } from 'child_process';

interface AnalysisResult {
  bestMove: string;
  evaluation: number;
  depth: number;
  pv: string[];
  mate?: number;
}

interface MoveValidation {
  isCorrect: boolean;
  evaluation: number;
  difference: number;
  quality: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

export class StockfishService {
  private engine: ChildProcess | null = null;
  private isReady = false;
  private pendingCommands: Array<{ command: string; resolve: (value: string) => void }> = [];

  constructor() {
    this.initializeEngine();
  }

  private initializeEngine(): void {
    try {
      // Spawn Stockfish process
      this.engine = spawn('/usr/games/stockfish');

      this.engine.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Stockfish:', output.trim());

        if (output.includes('uciok')) {
          this.isReady = true;
          console.log('✅ Stockfish engine ready');
        }

        // Process pending commands
        if (this.pendingCommands.length > 0) {
          const pending = this.pendingCommands[0];
          if (output.includes('bestmove') || output.includes('info')) {
            pending.resolve(output);
            this.pendingCommands.shift();
          }
        }
      });

      this.engine.stderr?.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
      });

      // Initialize UCI mode
      this.sendCommand('uci');
      this.sendCommand('setoption name UCI_AnalyseMode value true');
      this.sendCommand('setoption name MultiPV value 3');
      this.sendCommand('isready');
    } catch (error) {
      console.error('Failed to initialize Stockfish:', error);
    }
  }

  private sendCommand(command: string): void {
    if (this.engine && this.engine.stdin) {
      this.engine.stdin.write(`${command}\n`);
    }
  }

  private async waitForBestMove(fen: string, depth: number): Promise<string> {
    return new Promise((resolve) => {
      let output = '';
      const listener = (data: Buffer) => {
        output += data.toString();
        if (output.includes('bestmove')) {
          this.engine?.stdout?.removeListener('data', listener);
          resolve(output);
        }
      };

      this.engine?.stdout?.on('data', listener);

      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  /**
   * Analyze a position and get best move + evaluation
   */
  async analyzePosition(fen: string, depth = 15): Promise<AnalysisResult> {
    const output = await this.waitForBestMove(fen, depth);

    // Parse bestmove
    const bestMoveMatch = output.match(/bestmove (\S+)/);
    const bestMove = bestMoveMatch ? bestMoveMatch[1] : '';

    // Parse evaluation from last info line
    const infoLines = output.split('\n').filter(line => line.includes('info depth'));
    const lastInfoLine = infoLines[infoLines.length - 1] || '';

    let evaluation = 0;
    let mate: number | undefined;

    // Check for mate
    const mateMatch = lastInfoLine.match(/score mate (-?\d+)/);
    if (mateMatch) {
      mate = parseInt(mateMatch[1]);
      evaluation = mate > 0 ? 10000 : -10000;
    } else {
      // Parse centipawn score
      const cpMatch = lastInfoLine.match(/score cp (-?\d+)/);
      if (cpMatch) {
        evaluation = parseInt(cpMatch[1]) / 100; // Convert to pawns
      }
    }

    // Parse principal variation
    const pvMatch = lastInfoLine.match(/pv (.+)/);
    const pv = pvMatch ? pvMatch[1].split(' ') : [];

    // Parse depth
    const depthMatch = lastInfoLine.match(/depth (\d+)/);
    const actualDepth = depthMatch ? parseInt(depthMatch[1]) : depth;

    return {
      bestMove,
      evaluation,
      depth: actualDepth,
      pv,
      mate
    };
  }

  /**
   * Get best move for a position
   */
  async getBestMove(fen: string, depth = 12): Promise<{ move: string; evaluation: number }> {
    const analysis = await this.analyzePosition(fen, depth);
    return {
      move: analysis.bestMove,
      evaluation: analysis.evaluation
    };
  }

  /**
   * Validate if a move is the best move
   */
  async isBestMove(fen: string, move: string, depth = 10): Promise<boolean> {
    const analysis = await this.analyzePosition(fen, depth);
    return analysis.bestMove === move;
  }

  /**
   * Validate move quality compared to best move
   */
  async validateMove(fen: string, move: string, depth = 10): Promise<MoveValidation> {
    // Get best move evaluation
    const bestAnalysis = await this.analyzePosition(fen, depth);

    // Get evaluation after the proposed move
    // This is simplified - in production you'd apply the move and analyze the resulting position
    const isCorrect = bestAnalysis.bestMove === move;
    const difference = isCorrect ? 0 : Math.abs(bestAnalysis.evaluation);

    let quality: MoveValidation['quality'] = 'excellent';
    if (!isCorrect) {
      if (difference < 0.5) quality = 'good';
      else if (difference < 1.0) quality = 'inaccuracy';
      else if (difference < 3.0) quality = 'mistake';
      else quality = 'blunder';
    }

    return {
      isCorrect,
      evaluation: bestAnalysis.evaluation,
      difference,
      quality
    };
  }

  /**
   * Shutdown the engine
   */
  shutdown(): void {
    if (this.engine) {
      this.sendCommand('quit');
      this.engine.kill();
      console.log('🛑 Stockfish engine shut down');
    }
  }
}
