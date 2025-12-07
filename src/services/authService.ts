import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

const SALT_ROUNDS = 10;

export interface AuthResult {
  success: boolean;
  userId?: number;
  username?: string;
  stats?: {
    wins: number;
    losses: number;
    winStreak: number;
  };
  message?: string;
}

async function registerUser(username: string, password: string): Promise<AuthResult> {
  try {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return {
        success: false,
        message: 'Username already exists'
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with initial stats
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        stats: {
          create: {
            wins: 0,
            losses: 0,
            winStreak: 0
          }
        }
      },
      include: {
        stats: true
      }
    });

    return {
      success: true,
      userId: user.id,
      username: user.username,
      stats: {
        wins: user.stats?.wins || 0,
        losses: user.stats?.losses || 0,
        winStreak: user.stats?.winStreak || 0
      }
    };
  } catch (error) {
    console.error('Error registering user:', error);
    return {
      success: false,
      message: 'Registration failed'
    };
  }
}

async function loginUser(username: string, password: string): Promise<AuthResult> {
  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      include: { stats: true }
    });

    if (!user) {
      return {
        success: false,
        message: 'Invalid username or password'
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid username or password'
      };
    }

    return {
      success: true,
      userId: user.id,
      username: user.username,
      stats: {
        wins: user.stats?.wins || 0,
        losses: user.stats?.losses || 0,
        winStreak: user.stats?.winStreak || 0
      }
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    return {
      success: false,
      message: 'Login failed'
    };
  }
}

async function getUserStats(userId: number) {
  try {
    const stats = await prisma.playerStats.findUnique({
      where: { userId }
    });

    return stats;
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}

async function updateUserStats(userId: number, isWin: boolean) {
  try {
    const currentStats = await prisma.playerStats.findUnique({
      where: { userId }
    });

    if (!currentStats) {
      return null;
    }

    const updatedStats = await prisma.playerStats.update({
      where: { userId },
      data: {
        wins: isWin ? currentStats.wins + 1 : currentStats.wins,
        losses: isWin ? currentStats.losses : currentStats.losses + 1,
        winStreak: isWin ? currentStats.winStreak + 1 : 0
      }
    });

    return updatedStats;
  } catch (error) {
    console.error('Error updating user stats:', error);
    return null;
  }
}

export { registerUser, loginUser, getUserStats, updateUserStats };