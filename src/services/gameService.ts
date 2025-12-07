import type {
  GameState,
  Player,
  Snake,
  Position,
  Apple,
  SnakeSegment
} from '../types/game.js';
import { Direction, GameStatus } from '../types/game.js';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const TICK_RATE = 200; // milliseconds
const INITIAL_SNAKE_LENGTH = 4;

// Store all active games
const activeGames = new Map<string, GameState>();

export class GameService {
  // Create a new game
  static createGame(gameId: string): GameState {
    const game: GameState = {
      id: gameId,
      players: new Map(),
      apples: [],
      gridSize: {
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
      },
      status: GameStatus.WAITING,
      tickRate: TICK_RATE,
    };

    activeGames.set(gameId, game);
    return game;
  }

  // Get game by ID
  static getGame(gameId: string): GameState | undefined {
    return activeGames.get(gameId);
  }

  // Delete game
  static deleteGame(gameId: string): void {
    activeGames.delete(gameId);
  }

  // Add player to game
  static addPlayer(gameId: string, playerId: string, socketId: string, username?: string): Player | null {
    const game = activeGames.get(gameId);
    if (!game || game.players.size >= 2) {
      return null;
    }

    const playerNumber = game.players.size;
    const snake = this.createInitialSnake(playerNumber);

    const player: Player = {
      id: playerId,
      socketId: socketId,
      username: username ?? '',
      snake: snake,
      isReady: false,
    };

    game.players.set(playerId, player);
    return player;
  }

  // Remove player from game
  static removePlayer(gameId: string, playerId: string): void {
    const game = activeGames.get(gameId);
    if (game) {
      game.players.delete(playerId);
      if (game.players.size === 0) {
        this.deleteGame(gameId);
      }
    }
  }

  // Create initial snake for a player
  private static createInitialSnake(playerNumber: number): Snake {
    const segments: SnakeSegment[] = [];

    // Player 1 starts top-left, Player 2 starts bottom-right
    if (playerNumber === 0) {
      const startX = Math.floor(GRID_WIDTH / 4);
      const startY = Math.floor(GRID_HEIGHT / 4);
      for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        segments.push({ x: startX - i, y: startY });
      }
      return {
        segments,
        direction: Direction.RIGHT,
        nextDirection: Direction.RIGHT,
        isAlive: true,
      };
    } else {
      const startX = Math.floor((GRID_WIDTH * 3) / 4);
      const startY = Math.floor((GRID_HEIGHT * 3) / 4);
      for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        segments.push({ x: startX + i, y: startY });
      }
      return {
        segments,
        direction: Direction.LEFT,
        nextDirection: Direction.LEFT,
        isAlive: true,
      };
    }
  }


  // Start the game
  static startGame(gameId: string): void {
    const game = activeGames.get(gameId);
    if (!game || game.status !== GameStatus.WAITING) return;

    game.status = GameStatus.PLAYING;

    // Spawn initial apples
    this.spawnApple(gameId);
    this.spawnApple(gameId);
  }

  // Update player direction
  static changeDirection(gameId: string, playerId: string, newDirection: Direction): void {
    const game = activeGames.get(gameId);
    if (!game || game.status !== GameStatus.PLAYING) return;

    const player = game.players.get(playerId);
    if (!player || !player.snake.isAlive) return;

    // Prevent 180 degree turns
    if (this.isOppositeDirection(player.snake.direction, newDirection)) {
      return;
    }

    player.snake.nextDirection = newDirection;
  }

  // Check if two directions are opposite
  private static isOppositeDirection(dir1: Direction, dir2: Direction): boolean {
    return (
      (dir1 === Direction.UP && dir2 === Direction.DOWN) ||
      (dir1 === Direction.DOWN && dir2 === Direction.UP) ||
      (dir1 === Direction.LEFT && dir2 === Direction.RIGHT) ||
      (dir1 === Direction.RIGHT && dir2 === Direction.LEFT)
    );
  }

  // Game tick - update all game state
  static tick(gameId: string): boolean {
    const game = activeGames.get(gameId);
    if (!game || game.status !== GameStatus.PLAYING) return false;

    // Update each snake
    for (const player of game.players.values()) {
      if (!player.snake.isAlive) continue;

      // Apply queued direction
      player.snake.direction = player.snake.nextDirection;

      // Calculate new head position
      const head = player.snake.segments[0];
      if (!head) continue;

      const newHead = this.getNextPosition(head, player.snake.direction);

      // Check wall collision
      if (this.isOutOfBounds(newHead, game.gridSize)) {
        player.snake.isAlive = false;
        continue;
      }

      // Check self collision
      if (this.collidesWithSnake(newHead, player.snake.segments)) {
        player.snake.isAlive = false;
        continue;
      }

      // Check collision with other player
      for (const otherPlayer of game.players.values()) {
        if (otherPlayer.id !== player.id && otherPlayer.snake.isAlive) {
          if (this.collidesWithSnake(newHead, otherPlayer.snake.segments)) {
            player.snake.isAlive = false;
            break;
          }
        }
      }

      if (!player.snake.isAlive) continue;

      // Check apple collision
      const appleIndex = game.apples.findIndex(
        apple => apple.x === newHead.x && apple.y === newHead.y
      );

      if (appleIndex !== -1) {
        // Ate an apple!
        game.apples.splice(appleIndex, 1);
        this.spawnApple(gameId);

        // Add new head without removing tail (snake grows)
        player.snake.segments.unshift(newHead);
      } else {
        // Normal movement - add head, remove tail
        player.snake.segments.unshift(newHead);
        player.snake.segments.pop();
      }
    }

    // Check if game is over
    const alivePlayers = Array.from(game.players.values()).filter(p => p.snake.isAlive);

    if (alivePlayers.length === 0) {
      // Both died and tied
      game.status = GameStatus.FINISHED;
    } else if (alivePlayers.length === 1) {
      // One player left alive
      game.winnerId = alivePlayers[0]?.id ?? '';
      game.status = GameStatus.FINISHED;
    }

    return true;
  }

  // Get next position based on direction
  private static getNextPosition(pos: Position, direction: Direction): Position {
    switch (direction) {
      case Direction.UP:
        return { x: pos.x, y: pos.y - 1 };
      case Direction.DOWN:
        return { x: pos.x, y: pos.y + 1 };
      case Direction.LEFT:
        return { x: pos.x - 1, y: pos.y };
      case Direction.RIGHT:
        return { x: pos.x + 1, y: pos.y };
    }
  }

  // Check if position is out of bounds
  private static isOutOfBounds(pos: Position, gridSize: { width: number; height: number }): boolean {
    return pos.x < 0 || pos.x >= gridSize.width || pos.y < 0 || pos.y >= gridSize.height;
  }

  // Check if position collides with snake
  private static collidesWithSnake(pos: Position, segments: SnakeSegment[]): boolean {
    return segments.some(segment => segment.x === pos.x && segment.y === pos.y);
  }

  // Spawn an apple in a random empty position
  private static spawnApple(gameId: string): void {
    const game = activeGames.get(gameId);
    if (!game) return;

    const occupiedPositions = new Set<string>();

    // Mark all snake positions as occupied
    for (const player of game.players.values()) {
      for (const segment of player.snake.segments) {
        occupiedPositions.add(`${segment.x},${segment.y}`);
      }
    }

    // Mark existing apple positions as occupied
    for (const apple of game.apples) {
      occupiedPositions.add(`${apple.x},${apple.y}`);
    }

    // Find random empty position
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const x = Math.floor(Math.random() * game.gridSize.width);
      const y = Math.floor(Math.random() * game.gridSize.height);
      const key = `${x},${y}`;

      if (!occupiedPositions.has(key)) {
        game.apples.push({ x, y });
        return;
      }

      attempts++;
    }
  }

  // Get all active game IDs
  static getAllGameIds(): string[] {
    return Array.from(activeGames.keys());
  }

  // Get game count
  static getGameCount(): number {
    return activeGames.size;
  }
}
