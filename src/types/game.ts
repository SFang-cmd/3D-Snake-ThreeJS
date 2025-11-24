// 2D position in the game grid
export interface Position {
  x: number;
  y: number;
}

// Direction the snake can move
export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

// Snake cell
export interface SnakeSegment extends Position {}

// Snake state
export interface Snake {
  segments: SnakeSegment[];
  direction: Direction;
  nextDirection: Direction; // Prevent 180 degree turns
  isAlive: boolean;
}

// Apple position
export interface Apple extends Position {}

// Player in a game
export interface Player {
  id: string;
  socketId: string;
  username?: string;
  snake: Snake;
  isReady: boolean;
}

// Game state
export interface GameState {
  id: string;
  players: Map<string, Player>;
  apples: Apple[];
  gridSize: {
    width: number;
    height: number;
  };
  status: GameStatus;
  tickRate: number; // milliseconds per game tick
  winnerId?: string;
}

// Game status
export enum GameStatus {
  WAITING = 'WAITING', 
  READY = 'READY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

// Socket event payloads
export interface JoinGamePayload {
  username?: string;
}

export interface PlayerReadyPayload {
  ready: boolean;
}

export interface DirectionChangePayload {
  direction: Direction;
}

export interface GameStateUpdate {
  gameId: string;
  players: {
    id: string;
    username?: string;
    snake: Snake;
    isAlive: boolean;
  }[];
  apples: Apple[];
  status: GameStatus;
  winnerId?: string;
}
