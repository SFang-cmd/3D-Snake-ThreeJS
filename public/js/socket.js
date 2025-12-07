// Socket.io client wrapper
let socket = null;

export function connect() {
  // Auto-detect server URL: use current domain in production, localhost in dev
  const SERVER_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : window.location.origin;

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  return socket;
}

// Emit events
export function findMatch(username) {
  if (socket) {
    socket.emit('findMatch', { username });
  }
}

export function cancelMatchmaking() {
  if (socket) {
    socket.emit('cancelMatchmaking');
  }
}

export function changeDirection(direction) {
  if (socket) {
    socket.emit('changeDirection', { direction });
  }
}

// Register event callbacks
export function onSearching(callback) {
  if (socket) {
    socket.on('searching', callback);
  }
}

export function onMatchFound(callback) {
  if (socket) {
    socket.on('matchFound', callback);
  }
}

export function onCountdown(callback) {
  if (socket) {
    socket.on('countdown', callback);
  }
}

export function onGameStarted(callback) {
  if (socket) {
    socket.on('gameStarted', callback);
  }
}

export function onGameState(callback) {
  if (socket) {
    socket.on('gameState', callback);
  }
}

export function onGameOver(callback) {
  if (socket) {
    socket.on('gameOver', callback);
  }
}

export function onPlayerDisconnected(callback) {
  if (socket) {
    socket.on('playerDisconnected', callback);
  }
}

export function onMatchmakingCancelled(callback) {
  if (socket) {
    socket.on('matchmakingCancelled', callback);
  }
}

export function getSocketId() {
  return socket ? socket.id : null;
}
