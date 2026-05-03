/**
 * Puzzle Service
 * Generates tactical puzzles using Stockfish analysis
 */

import { StockfishService } from './stockfish.service.js';

interface TacticalPuzzle {
  id: string;
  fen: string;
  theme: string;
  description: string;
  bestMove: string;
  alternatives: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'openings' | 'tactics' | 'endgames' | 'middlegame';
  evaluation: number;
}

export class PuzzleService {
  private stockfish: StockfishService;

  // Pre-defined starting positions for different categories
  private readonly startingPositions = {
    openings: [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
    ],
    tactics: [
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8',
      'r2qkb1r/ppp2ppp/2n2n2/3pp3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq d6 0 6'
    ],
    endgames: [
      '8/8/8/8/4k3/8/3K4/8 w - - 0 1',
      '8/8/8/3k4/8/3K4/3P4/8 w - - 0 1',
      '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
    ],
    middlegame: [
      'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8',
      'r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP1QPPP/R1B2RK1 w - - 0 10',
      'r1bq1rk1/ppp2ppp/2n2n2/3p4/1b1P4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 9'
    ]
  };

  constructor(stockfish: StockfishService) {
    this.stockfish = stockfish;
  }

  /**
   * Generate tactical puzzles using Stockfish
   */
  async generatePuzzles(
    category: 'openings' | 'tactics' | 'endgames' | 'middlegame',
    count: number,
    minDepth = 8
  ): Promise<TacticalPuzzle[]> {
    const puzzles: TacticalPuzzle[] = [];
    const positions = this.startingPositions[category];

    for (let i = 0; i < count; i++) {
      // Select random starting position
      const basePosition = positions[Math.floor(Math.random() * positions.length)];

      try {
        // Analyze position deeply
        const analysis = await this.stockfish.analyzePosition(basePosition, minDepth);

        // Determine difficulty based on evaluation complexity
        const difficulty = this.getDifficulty(analysis.evaluation, analysis.depth);

        // Generate alternatives (slightly worse moves)
        const alternatives = await this.generateAlternatives(basePosition, analysis.bestMove);

        // Create puzzle
        const puzzle: TacticalPuzzle = {
          id: `${category}_gen_${Date.now()}_${i}`,
          fen: basePosition,
          theme: this.identifyTheme(analysis, category),
          description: this.generateDescription(category, analysis),
          bestMove: analysis.bestMove,
          alternatives,
          explanation: this.generateExplanation(analysis, category),
          difficulty,
          category,
          evaluation: analysis.evaluation
        };

        puzzles.push(puzzle);
      } catch (error) {
        console.error(`Failed to generate puzzle ${i}:`, error);
      }
    }

    return puzzles;
  }

  /**
   * Determine puzzle difficulty based on analysis
   */
  private getDifficulty(evaluation: number, depth: number): 'easy' | 'medium' | 'hard' {
    const absEval = Math.abs(evaluation);

    if (depth < 10 || absEval > 5) return 'easy';
    if (depth < 15 || absEval > 2) return 'medium';
    return 'hard';
  }

  /**
   * Identify tactical theme from position
   */
  private identifyTheme(
    analysis: { evaluation: number; pv: string[] },
    category: string
  ): string {
    const themes: Record<string, string[]> = {
      openings: ['Control del Centro', 'Desarrollo Rápido', 'Gambito'],
      tactics: ['Clavada', 'Horquilla', 'Ataque Doble', 'Jaque Descubierto'],
      endgames: ['Oposición', 'Peón Pasado', 'Zugzwang'],
      middlegame: ['Ataque al Rey', 'Control de Columnas', 'Debilidades de Peones']
    };

    const categoryThemes = themes[category] || ['Táctica General'];
    return categoryThemes[Math.floor(Math.random() * categoryThemes.length)];
  }

  /**
   * Generate puzzle description
   */
  private generateDescription(
    category: string,
    analysis: { evaluation: number; mate?: number }
  ): string {
    if (analysis.mate) {
      return `Mate en ${Math.abs(analysis.mate)} jugadas`;
    }

    const descriptions: Record<string, string> = {
      openings: 'Encuentra la mejor jugada de desarrollo',
      tactics: 'Encuentra la táctica ganadora',
      endgames: 'Convierte la ventaja en victoria',
      middlegame: 'Encuentra el plan estratégico correcto'
    };

    return descriptions[category] || 'Encuentra la mejor jugada';
  }

  /**
   * Generate explanation for the solution
   */
  private generateExplanation(
    analysis: { bestMove: string; evaluation: number; mate?: number },
    category: string
  ): string {
    if (analysis.mate) {
      return `${analysis.bestMove} fuerza mate en ${Math.abs(analysis.mate)} jugadas.`;
    }

    const evalStr = analysis.evaluation > 0 ? `+${analysis.evaluation.toFixed(2)}` : analysis.evaluation.toFixed(2);
    return `${analysis.bestMove} es la mejor jugada con evaluación ${evalStr}.`;
  }

  /**
   * Generate alternative (incorrect) moves
   */
  private async generateAlternatives(fen: string, bestMove: string): Promise<string[]> {
    // In a real implementation, you would:
    // 1. Get all legal moves from the position
    // 2. Analyze each move with Stockfish
    // 3. Select moves that are worse but plausible

    // For now, return placeholder alternatives
    // This should be replaced with actual chess.js integration
    return [
      this.generatePlausibleMove(bestMove),
      this.generatePlausibleMove(bestMove),
      this.generatePlausibleMove(bestMove)
    ];
  }

  /**
   * Generate a plausible but incorrect move
   */
  private generatePlausibleMove(bestMove: string): string {
    // Simple variation: change destination square slightly
    const from = bestMove.substring(0, 2);
    const to = bestMove.substring(2, 4);

    // Generate variations
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    const toFile = to[0];
    const toRank = to[1];

    const fileIndex = files.indexOf(toFile);
    const rankIndex = ranks.indexOf(toRank);

    // Move to adjacent square
    const newFile = files[Math.max(0, Math.min(7, fileIndex + (Math.random() > 0.5 ? 1 : -1)))];
    const newRank = ranks[Math.max(0, Math.min(7, rankIndex + (Math.random() > 0.5 ? 1 : -1)))];

    return `${from}${newFile}${newRank}`;
  }
}
