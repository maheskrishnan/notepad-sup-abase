const API_BASE = '/api';

// DOM Elements
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const authTabs = document.querySelectorAll('.auth-tab');
const signinError = document.getElementById('signin-error');
const signupError = document.getElementById('signup-error');
const signupSuccess = document.getElementById('signup-success');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const token = localStorage.getItem('access_token');
  if (token) {
    window.location.href = '/';
    return;
  }

  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  signinForm.addEventListener('submit', handleSignIn);
  signupForm.addEventListener('submit', handleSignUp);
}

// Switch between sign in and sign up tabs
function switchTab(tabName) {
  authTabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (tabName === 'signin') {
    signinForm.style.display = 'block';
    signupForm.style.display = 'none';
    clearErrors();
  } else {
    signinForm.style.display = 'none';
    signupForm.style.display = 'block';
    clearErrors();
  }
}

// Clear error messages
function clearErrors() {
  signinError.textContent = '';
  signupError.textContent = '';
  signupSuccess.textContent = '';
}

// Handle sign in
async function handleSignIn(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;

  try {
    const response = await fetch(`${API_BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!result.success) {
      signinError.textContent = result.error || 'Failed to sign in';
      return;
    }

    // Store authentication data
    localStorage.setItem('access_token', result.data.session.access_token);
    localStorage.setItem('refresh_token', result.data.session.refresh_token);
    localStorage.setItem('user', JSON.stringify(result.data.user));

    // Redirect to main app
    window.location.href = '/';
  } catch (error) {
    console.error('Sign in error:', error);
    signinError.textContent = 'An error occurred. Please try again.';
  }
}

// Handle sign up
async function handleSignUp(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;

  if (password !== confirmPassword) {
    signupError.textContent = 'Passwords do not match';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!result.success) {
      signupError.textContent = result.error || 'Failed to sign up';
      return;
    }

    // Check if email confirmation is required
    if (result.data.session) {
      // Auto sign-in if email confirmation is disabled
      localStorage.setItem('access_token', result.data.session.access_token);
      localStorage.setItem('refresh_token', result.data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      window.location.href = '/';
    } else {
      // Email confirmation required
      signupSuccess.textContent = 'Account created! Please check your email to confirm your account, then sign in.';
      setTimeout(() => {
        switchTab('signin');
      }, 3000);
    }
  } catch (error) {
    console.error('Sign up error:', error);
    signupError.textContent = 'An error occurred. Please try again.';
  }
}
