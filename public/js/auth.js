const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : '';

let currentAuthMode = 'login';
let currentUser = null;

export function initAuth() {
  const loginModeBtn = document.getElementById('login-mode-btn');
  const registerModeBtn = document.getElementById('register-mode-btn');
  const guestModeBtn = document.getElementById('guest-mode-btn');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const guestSubmitBtn = document.getElementById('guest-submit-btn');

  loginModeBtn.addEventListener('click', () => switchAuthMode('login'));
  registerModeBtn.addEventListener('click', () => switchAuthMode('register'));
  guestModeBtn.addEventListener('click', () => switchAuthMode('guest'));

  authSubmitBtn.addEventListener('click', handleAuthSubmit);
  guestSubmitBtn.addEventListener('click', handleGuestSubmit);

  document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  document.getElementById('guest-username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGuestSubmit();
  });
}

function switchAuthMode(mode) {
  currentAuthMode = mode;

  const loginModeBtn = document.getElementById('login-mode-btn');
  const registerModeBtn = document.getElementById('register-mode-btn');
  const guestModeBtn = document.getElementById('guest-mode-btn');
  const authForm = document.getElementById('auth-form');
  const guestForm = document.getElementById('guest-form');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authError = document.getElementById('auth-error');
  const statsDisplay = document.getElementById('stats-display');

  loginModeBtn.classList.remove('active');
  registerModeBtn.classList.remove('active');
  guestModeBtn.classList.remove('active');

  authError.classList.add('hidden');

  if (mode === 'guest') {
    authForm.classList.add('hidden');
    guestForm.classList.remove('hidden');
    guestModeBtn.classList.add('active');
    // hide stats for guest mode
    statsDisplay.classList.add('hidden');
  } else {
    authForm.classList.remove('hidden');
    guestForm.classList.add('hidden');
    // show stats after successful login if user has stats

    if (mode === 'login') {
      loginModeBtn.classList.add('active');
      authSubmitBtn.textContent = 'Login';
    } else {
      registerModeBtn.classList.add('active');
      authSubmitBtn.textContent = 'Register';
    }
  }
}

async function handleAuthSubmit() {
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value;
  const authError = document.getElementById('auth-error');
  const authSubmitBtn = document.getElementById('auth-submit-btn');

  authError.classList.add('hidden');

  if (!username || !password) {
    showAuthError('Please enter both username and password');
    return;
  }

  if (username.length < 1 || username.length > 20) {
    showAuthError('Username must be 1-20 characters');
    return;
  }

  if (password.length < 3) {
    showAuthError('Password must be at least 3 characters');
    return;
  }

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = currentAuthMode === 'login' ? 'Logging in...' : 'Registering...';

  try {
    const endpoint = currentAuthMode === 'login' ? '/api/login' : '/api/register';
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      currentUser = {
        userId: data.userId,
        username: data.username,
        isGuest: false,
        stats: data.stats,
      };

      document.dispatchEvent(new CustomEvent('authSuccess', { detail: currentUser }));
    } else {
      showAuthError(data.message || 'Authentication failed');
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = currentAuthMode === 'login' ? 'Login' : 'Register';
    }
  } catch (error) {
    console.error('Auth error:', error);
    showAuthError('Network error. Please try again.');
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = currentAuthMode === 'login' ? 'Login' : 'Register';
  }
}

async function handleGuestSubmit() {
  const usernameInput = document.getElementById('guest-username-input').value.trim();
  const guestSubmitBtn = document.getElementById('guest-submit-btn');
  const guestError = document.getElementById('guest-error');

  guestError.classList.add('hidden');

  // If no username provided, generate random username
  if (!usernameInput) {
    const username = `Guest${Math.floor(Math.random() * 10000)}`;
    currentUser = {
      userId: null,
      username,
      isGuest: true,
      stats: null,
    };
    document.dispatchEvent(new CustomEvent('authSuccess', { detail: currentUser }));
    return;
  }

  if (usernameInput.length < 1 || usernameInput.length > 20) {
    showGuestError('Username must be 1-20 characters');
    return;
  }

  guestSubmitBtn.disabled = true;
  guestSubmitBtn.textContent = 'Checking username...';

  try {
    // Check if username already registered
    const response = await fetch(`${API_URL}/api/check-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: usernameInput }),
    });

    const data = await response.json();

    if (data.success && data.exists) {
      showGuestError('Username is already registered. Please choose a different username or login.');
      guestSubmitBtn.disabled = false;
      guestSubmitBtn.textContent = 'Find Match as Guest';
      return;
    }

    // Username available
    currentUser = {
      userId: null,
      username: usernameInput,
      isGuest: true,
      stats: null,
    };

    document.dispatchEvent(new CustomEvent('authSuccess', { detail: currentUser }));
  } catch (error) {
    console.error('Error checking username:', error);
    showGuestError('Network error. Please try again.');
    guestSubmitBtn.disabled = false;
    guestSubmitBtn.textContent = 'Find Match as Guest';
  }
}

function showAuthError(message) {
  const authError = document.getElementById('auth-error');
  authError.textContent = message;
  authError.classList.remove('hidden');
}

function showGuestError(message) {
  const guestError = document.getElementById('guest-error');
  guestError.textContent = message;
  guestError.classList.remove('hidden');
}

export function getCurrentUser() {
  return currentUser;
}

export async function updateUserStatsAfterGame(isWin) {
  if (!currentUser || currentUser.isGuest) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/stats/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: currentUser.userId,
        isWin
      }),
    });

    const data = await response.json();

    if (data.success && data.stats) {
      currentUser.stats = data.stats;
      return data.stats;
    }

    return null;
  } catch (error) {
    console.error('Error updating stats:', error);
    return null;
  }
}
