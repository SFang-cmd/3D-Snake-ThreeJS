import { GameService } from './gameService.js';
import { v4 as uuidv4 } from 'uuid';

// Queue of players waiting for a match
const waitingPlayers: Array<{
  playerId: string;
  socketId: string;
  username?: string;
}> = [];

export class MatchmakingService {
  // Add player to matchmaking queue
  static findMatch(playerId: string, socketId: string, username?: string): string | null {
    // Check if player is already in queue
    const existingIndex = waitingPlayers.findIndex(p => p.playerId === playerId);
    if (existingIndex !== -1) {
      // Remove old entry
      waitingPlayers.splice(existingIndex, 1);
    }

    // If there's someone waiting, pair them up
    if (waitingPlayers.length > 0) {
      const opponent = waitingPlayers.shift()!;

      // Create a new game
      const gameId = uuidv4();
      const game = GameService.createGame(gameId);

      // Add both players to the game
      GameService.addPlayer(gameId, opponent.playerId, opponent.socketId, opponent.username);
      GameService.addPlayer(gameId, playerId, socketId, username);

      return gameId;
    } else {
      // No one waiting, add to queue
      waitingPlayers.push({ playerId, socketId, username: username ?? '' });
      return null;
    }
  }

  // Remove player from matchmaking queue
  static leaveQueue(playerId: string): void {
    const index = waitingPlayers.findIndex(p => p.playerId === playerId);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
  }

  // Get number of players waiting
  static getQueueSize(): number {
    return waitingPlayers.length;
  }

  // Check if player is in queue
  static isInQueue(playerId: string): boolean {
    return waitingPlayers.some(p => p.playerId === playerId);
  }
}
