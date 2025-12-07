import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import { setupGameHandlers } from './controllers/gameController.js';
import { registerUser, loginUser, updateUserStats } from './services/authService.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// API routes
app.get('/api', (req, res) => {
  res.json({ message: '3D Snake Game API' });
});

// Authentication routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  if (username.length < 1 || username.length > 20) {
    return res.status(400).json({ success: false, message: 'Username must be 1-20 characters' });
  }

  if (password.length < 3) {
    return res.status(400).json({ success: false, message: 'Password must be at least 3 characters' });
  }

  const result = await registerUser(username, password);

  if (result.success) {
    return res.status(201).json(result);
  } else {
    return res.status(400).json(result);
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const result = await loginUser(username, password);

  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(401).json(result);
  }
});

app.post('/api/stats/update', async (req, res) => {
  const { userId, isWin } = req.body;

  if (!userId || typeof isWin !== 'boolean') {
    return res.status(400).json({ success: false, message: 'userId and isWin required' });
  }

  const stats = await updateUserStats(userId, isWin);

  if (stats) {
    return res.status(200).json({ success: true, stats });
  } else {
    return res.status(500).json({ success: false, message: 'Failed to update stats' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Setup game event handlers for this socket
  setupGameHandlers(io, socket);
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io, httpServer };
