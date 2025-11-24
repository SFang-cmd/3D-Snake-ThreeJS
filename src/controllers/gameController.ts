import type { Socket, Server } from 'socket.io';
import { GameService } from '../services/gameService.js';
import { MatchmakingService } from '../services/matchmakingService.js';
import type {
  JoinGamePayload,
  PlayerReadyPayload,
  DirectionChangePayload,
  GameStateUpdate,
} from '../types/game.js';
import { GameStatus } from '../types/game.js';

// Map socket IDs to player IDs and game IDs
const socketToPlayer = new Map<string, { playerId: string; gameId?: string }>();

// Map game IDs to their interval timers
const gameIntervals = new Map<string, NodeJS.Timeout>();

export function setupGameHandlers(io: Server, socket: Socket) {
  const playerId = socket.id; // Use socket ID as player ID
  socketToPlayer.set(socket.id, { playerId });

  // Player joins matchmaking
  socket.on('findMatch', (payload: JoinGamePayload) => {
    console.log(`Player ${playerId} looking for match`);

    const gameId = MatchmakingService.findMatch(playerId, socket.id, payload.username);

    if (gameId) {
      // Match found!
      const playerData = socketToPlayer.get(socket.id);
      if (playerData) {
        playerData.gameId = gameId;
      }

      // Join the game room
      socket.join(gameId);

      // Find opponent's socket ID
      const game = GameService.getGame(gameId);
      if (game) {
        const players = Array.from(game.players.values());
        const opponent = players.find(p => p.id !== playerId);

        if (opponent) {
          // Both players found each other
          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          if (opponentSocket) {
            opponentSocket.join(gameId);

            const opponentData = socketToPlayer.get(opponent.socketId);
            if (opponentData) {
              opponentData.gameId = gameId;
            }
          }

          // Notify both players
          io.to(gameId).emit('matchFound', {
            gameId,
            players: players.map(p => ({
              id: p.id,
              username: p.username,
            })),
          });

          console.log(`Match created: ${gameId}`);
        }
      }
    } else {
      // Added to queue
      socket.emit('searching', { message: 'Searching for opponent...' });
      console.log(`Player ${playerId} added to queue`);
    }
  });

  // Player cancels matchmaking
  socket.on('cancelMatchmaking', () => {
    MatchmakingService.leaveQueue(playerId);
    socket.emit('matchmakingCancelled');
    console.log(`Player ${playerId} left queue`);
  });

  // Player marks themselves as ready
  socket.on('playerReady', (payload: PlayerReadyPayload) => {
    const playerData = socketToPlayer.get(socket.id);
    if (!playerData || !playerData.gameId) return;

    const { gameId } = playerData;
    GameService.setPlayerReady(gameId, playerId, payload.ready);

    const game = GameService.getGame(gameId);
    if (!game) return;

    // Broadcast ready status to all players
    io.to(gameId).emit('playerReadyUpdate', {
      playerId,
      ready: payload.ready,
    });

    // If game started, begin the game loop
    if (game.status === GameStatus.PLAYING) {
      startGameLoop(io, gameId);
      io.to(gameId).emit('gameStarted', { gameId });
      console.log(`Game ${gameId} started`);
    }
  });

  // Player changes direction
  socket.on('changeDirection', (payload: DirectionChangePayload) => {
    const playerData = socketToPlayer.get(socket.id);
    if (!playerData || !playerData.gameId) return;

    GameService.changeDirection(playerData.gameId, playerId, payload.direction);
  });

  // Player disconnects
  socket.on('disconnect', () => {
    console.log(`Player ${playerId} disconnected`);

    const playerData = socketToPlayer.get(socket.id);
    if (playerData) {
      // Remove from matchmaking queue
      MatchmakingService.leaveQueue(playerId);

      // Remove from game
      if (playerData.gameId) {
        const gameId = playerData.gameId;
        GameService.removePlayer(gameId, playerId);

        // Stop game loop
        stopGameLoop(gameId);

        // Notify other players
        io.to(gameId).emit('playerDisconnected', {
          playerId,
          message: 'Opponent disconnected',
        });

        console.log(`Player ${playerId} removed from game ${gameId}`);
      }

      socketToPlayer.delete(socket.id);
    }
  });
}

// Start the game loop for a specific game
function startGameLoop(io: Server, gameId: string) {
  // Clear existing interval if any
  stopGameLoop(gameId);

  const game = GameService.getGame(gameId);
  if (!game) return;

  const interval = setInterval(() => {
    const updated = GameService.tick(gameId);

    if (updated) {
      const game = GameService.getGame(gameId);
      if (!game) {
        stopGameLoop(gameId);
        return;
      }

      // Broadcast game state to all players
      const gameState: GameStateUpdate = {
        gameId,
        players: Array.from(game.players.values()).map(p => ({
          id: p.id,
          ...(p.username && { username: p.username }),
          snake: p.snake,
          isAlive: p.snake.isAlive,
        })),
        apples: game.apples,
        status: game.status,
        ...(game.winnerId && { winnerId: game.winnerId }),
      };

      io.to(gameId).emit('gameState', gameState);

      // If game finished, stop the loop
      if (game.status === GameStatus.FINISHED) {
        stopGameLoop(gameId);
        io.to(gameId).emit('gameOver', {
          winnerId: game.winnerId,
          players: gameState.players,
        });

        console.log(`Game ${gameId} finished. Winner: ${game.winnerId}`);

        // Clean up game after a delay
        setTimeout(() => {
          GameService.deleteGame(gameId);
        }, 5000);
      }
    }
  }, game.tickRate); // Use the game's tick rate directly

  gameIntervals.set(gameId, interval);
}

// Stop the game loop for a specific game
function stopGameLoop(gameId: string) {
  const interval = gameIntervals.get(gameId);
  if (interval) {
    clearInterval(interval);
    gameIntervals.delete(gameId);
  }
}
