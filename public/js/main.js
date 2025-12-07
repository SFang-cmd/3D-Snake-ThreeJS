import * as SocketClient from './socket.js';
import * as Renderer from './renderer.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';
import { initAuth, getCurrentUser, updateUserStatsAfterGame } from './auth.js';

// App state
const AppState = {
  HOME: 'home',
  SEARCHING: 'searching',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GAMEOVER: 'gameover'
};

let currentState = AppState.HOME;
let currentUsername = '';
let currentGameId = null;
let myPlayerId = null;
let players = [];

// re-enable auth buttons after canceling/finishing match
function resetAuthButtons() {
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const guestSubmitBtn = document.getElementById('guest-submit-btn');
  if (authSubmitBtn && guestSubmitBtn) {
    authSubmitBtn.disabled = false;
    guestSubmitBtn.disabled = false;
    const loginModeActive = document.getElementById('login-mode-btn')?.classList.contains('active');
    const registerModeActive = document.getElementById('register-mode-btn')?.classList.contains('active');
    if (loginModeActive) {
      authSubmitBtn.textContent = 'Login';
    } else if (registerModeActive) {
      authSubmitBtn.textContent = 'Register';
    }
    guestSubmitBtn.textContent = 'Find Match as Guest';
  }
}

// Initialize app
function init() {
  console.log('Initializing 3D Snake Game...');

  // Connect to server
  SocketClient.connect();

  // Setup authentication
  initAuth();

  // Setup socket event handlers
  setupSocketHandlers();

  // Setup DOM event handlers
  setupDOMHandlers();

  // Listen for successful authentication
  document.addEventListener('authSuccess', handleAuthSuccess);
}

function handleAuthSuccess(event) {
  const user = event.detail;
  currentUsername = user.username;

  console.log('Auth success:', user);

  // reset auth buttons
  resetAuthButtons();

  // show stats if not guest
  if (!user.isGuest && user.stats) {
    UI.updateStats(user.stats);
  }

  // start matchmaking
  SocketClient.findMatch(user.username);
  UI.showScreen('searching-screen');
}

function setupSocketHandlers() {
  SocketClient.onSearching(() => {
    console.log('Searching for opponent...');
    currentState = AppState.SEARCHING;
    UI.showScreen('searching-screen');
  });

  SocketClient.onMatchFound((data) => {
    console.log('Match found!', data);
    currentState = AppState.COUNTDOWN;
    currentGameId = data.gameId;
    players = data.players;
    myPlayerId = SocketClient.getSocketId();

    UI.showScreen('countdown-screen');
    UI.showMatchFound(players[0], players[1]);
  });

  SocketClient.onCountdown((data) => {
    console.log('Countdown:', data.count);
    UI.showCountdown(data.count);
  });

  SocketClient.onGameStarted((data) => {
    console.log('Game started!');
    currentState = AppState.PLAYING;
    UI.showScreen('game-screen');

    // Initialize renderer
    Renderer.init();

    // Setup HUD
    UI.setupGameHUD(players[0], players[1], myPlayerId);

    // Enable keyboard controls
    window.addEventListener('keydown', handleKeyPress);
  });

  SocketClient.onGameState((gameState) => {
    if (currentState === AppState.PLAYING) {
      Renderer.updateGameState(gameState);
    }
  });

  SocketClient.onGameOver(async (data) => {
    console.log('Game over!', data);
    currentState = AppState.GAMEOVER;

    // Determine if I won
    const iWon = data.winnerId === myPlayerId;
    const isDraw = !data.winnerId;

    // Update stats
    let updatedStats;
    const user = getCurrentUser();

    if (user && !user.isGuest) {
      const isWin = isDraw ? false : iWon;
      updatedStats = await updateUserStatsAfterGame(isWin);
    } else {
      // update local stats if guest
      updatedStats = isDraw
        ? Utils.updateStats(currentUsername, false)
        : Utils.updateStats(currentUsername, iWon);
    }

    // Disable keyboard controls
    window.removeEventListener('keydown', handleKeyPress);

    // Cleanup renderer
    Renderer.cleanup();

    // Show game over screen
    UI.showScreen('gameover-screen');
    UI.showGameOver(data.winnerId, myPlayerId, updatedStats);
  });

  SocketClient.onPlayerDisconnected(async () => {
    console.log('Opponent disconnected');

    // Treat as win - update stats
    let updatedStats;
    const user = getCurrentUser();

    if (user && !user.isGuest) {
      // Authenticated user - update in database
      updatedStats = await updateUserStatsAfterGame(true);
    } else {
      // Guest user - update in localStorage
      updatedStats = Utils.updateStats(currentUsername, true);
    }

    window.removeEventListener('keydown', handleKeyPress);
    Renderer.cleanup();

    currentState = AppState.GAMEOVER;
    UI.showScreen('gameover-screen');
    document.getElementById('result-message').textContent = 'Opponent Disconnected - You Win!';
    UI.showGameOver(myPlayerId, myPlayerId, updatedStats);
  });

  SocketClient.onMatchmakingCancelled(() => {
    console.log('Matchmaking cancelled');
    currentState = AppState.HOME;
    UI.showScreen('home-screen');
    UI.enableInput();
    resetAuthButtons();
  });
}

function setupDOMHandlers() {
  // Cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    SocketClient.cancelMatchmaking();
  });

  // Play Again button
  document.getElementById('play-again-btn').addEventListener('click', () => {
    currentState = AppState.HOME;
    currentGameId = null;
    myPlayerId = null;
    players = [];

    UI.showScreen('home-screen');
    resetAuthButtons();

    // Reload stats for authenticated users
    const user = getCurrentUser();
    if (user && !user.isGuest && user.stats) {
      UI.updateStats(user.stats);
    }
  });
}

function handleKeyPress(e) {
  if (currentState !== AppState.PLAYING) return;

  const direction = Utils.getDirectionFromKey(e.key);
  if (direction) {
    e.preventDefault();
    SocketClient.changeDirection(direction);
  }
}

// Start app when page loads
init();
