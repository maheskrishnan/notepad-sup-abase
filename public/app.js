const API_BASE = '/api';

let notes = [];
let currentNoteId = null;
let autoSaveTimeout = null;
let isSaving = false;
let accessToken = null;
let monacoEditor = null;
let monacoEditorReady = false;
let searchQuery = '';

// DOM Elements
const notesList = document.getElementById('notes-list');
const noNoteSelected = document.getElementById('no-note-selected');
const editor = document.getElementById('editor');
const noteTitle = document.getElementById('note-title');
const saveStatus = document.getElementById('save-status');
const deleteBtn = document.getElementById('delete-btn');
const newNoteBtn = document.getElementById('new-note-btn');
const lastSaved = document.getElementById('last-saved');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const changePasswordForm = document.getElementById('change-password-form');
const changeEmailForm = document.getElementById('change-email-form');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) {
    return;
  }
  initializeMonacoEditor();
  setupEventListeners();
});

// Cleanup Monaco Editor on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (monacoEditor) {
    monacoEditor.dispose();
    monacoEditor = null;
    monacoEditorReady = false;
  }
});

// Check authentication
function checkAuth() {
  accessToken = localStorage.getItem('access_token');

  if (!accessToken) {
    window.location.href = '/auth.html';
    return false;
  }

  // Display user email
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (userEmail && user.email) {
    userEmail.textContent = user.email;
  }

  return true;
}

// Initialize Monaco Editor
function initializeMonacoEditor() {
  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

  require(['vs/editor/editor.main'], function() {
    try {
      monacoEditor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: '',
        language: 'markdown',
        theme: 'vs',
        automaticLayout: true,
        wordWrap: 'on',
        lineNumbers: 'off',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 16,
        lineHeight: 24,
        padding: { top: 20, bottom: 20 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto'
        }
      });

      // Setup auto-save on content change
      monacoEditor.onDidChangeModelContent(() => {
        scheduleAutoSave();
      });

      monacoEditorReady = true;

      // Load notes after Monaco is ready
      loadNotes();
    } catch (error) {
      console.error('Error initializing Monaco Editor:', error);
      alert('Failed to load the editor. Please refresh the page.');
    }
  }, function(err) {
    console.error('Error loading Monaco Editor:', err);
    alert('Failed to load the editor. Please check your internet connection and refresh the page.');
  });
}

// Logout
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/auth.html';
}

// Get auth headers
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  };
}

// Event Listeners
function setupEventListeners() {
  newNoteBtn.addEventListener('click', createNewNote);
  deleteBtn.addEventListener('click', deleteCurrentNote);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Auto-save on input with debouncing (1 second after user stops typing)
  noteTitle.addEventListener('input', () => {
    scheduleAutoSave();
  });

  // Event delegation for note items - prevents memory leaks
  notesList.addEventListener('click', (e) => {
    const noteItem = e.target.closest('.note-item');
    if (noteItem && noteItem.dataset.id) {
      loadNote(noteItem.dataset.id);
    }
  });

  // Settings modal
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
  }
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', handlePasswordChange);
  }
  if (changeEmailForm) {
    changeEmailForm.addEventListener('submit', handleEmailChange);
  }

  // Settings navigation tabs
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const button = e.currentTarget;
      const tabName = button.dataset.tab;
      switchSettingsTab(tabName);
    });
  });

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderNotesList();

      // Show/hide clear button
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderNotesList();
      searchInput.focus();
    });
  }
}

// Schedule auto-save with debouncing
function scheduleAutoSave() {
  if (!currentNoteId) return;

  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Show "Unsaved changes" status
  updateSaveStatus('unsaved');

  // Schedule save after 1 second of no typing
  autoSaveTimeout = setTimeout(() => {
    saveCurrentNote();
  }, 1000);
}

// Update save status indicator
function updateSaveStatus(status) {
  if (status === 'saving') {
    saveStatus.textContent = 'Saving...';
    saveStatus.className = 'save-status saving';
  } else if (status === 'saved') {
    saveStatus.textContent = 'All changes saved';
    saveStatus.className = 'save-status saved';
  } else if (status === 'unsaved') {
    saveStatus.textContent = 'Unsaved changes';
    saveStatus.className = 'save-status unsaved';
  } else if (status === 'error') {
    saveStatus.textContent = 'Error saving';
    saveStatus.className = 'save-status error';
  } else {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }
}

// API Functions
async function fetchNotes() {
  try {
    const response = await fetch(`${API_BASE}/notes`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return [];
    }

    const result = await response.json();
    if (result.success) {
      return result.data;
    }
    throw new Error('Failed to fetch notes');
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

async function createNote(title = 'Untitled', content = '') {
  try {
    const response = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, content })
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    const result = await response.json();
    console.log('Create note response:', result);

    if (result.success) {
      return result.data;
    }

    // Show the actual error message
    const errorMsg = result.error || 'Failed to create note';
    console.error('Create note failed:', errorMsg);
    alert('Failed to create note: ' + errorMsg);
    throw new Error(errorMsg);
  } catch (error) {
    console.error('Error creating note:', error);
    if (error.message && !error.message.includes('Failed to create note')) {
      alert('Failed to create note: ' + error.message);
    }
    return null;
  }
}

async function updateNote(id, title, content) {
  try {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, content })
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    const result = await response.json();
    if (result.success) {
      return result.data;
    }
    throw new Error('Failed to update note');
  } catch (error) {
    console.error('Error updating note:', error);
    return null;
  }
}

async function deleteNote(id) {
  try {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return false;
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error deleting note:', error);
    alert('Failed to delete note');
    return false;
  }
}

// UI Functions
async function loadNotes() {
  notes = await fetchNotes();
  renderNotesList();

  if (notes.length === 0) {
    showEmptyState();
  }
}

function renderNotesList() {
  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">No notes yet. Create one to get started!</div>';
    return;
  }

  // Filter notes based on search query
  let filteredNotes = notes;
  if (searchQuery) {
    filteredNotes = notes.filter(note => {
      const titleMatch = note.title.toLowerCase().includes(searchQuery);
      const contentMatch = note.content.toLowerCase().includes(searchQuery);
      return titleMatch || contentMatch;
    });
  }

  // Show message if no search results
  if (filteredNotes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">No notes found matching your search.</div>';
    return;
  }

  notesList.innerHTML = filteredNotes.map(note => {
    const preview = note.content.substring(0, 50) || 'No content';
    const date = new Date(note.updated_at).toLocaleDateString();
    return `
      <div class="note-item ${note.id === currentNoteId ? 'active' : ''}" data-id="${note.id}">
        <div class="note-item-title">${escapeHtml(note.title)}</div>
        <div class="note-item-preview">${escapeHtml(preview)}</div>
        <div class="note-item-date">${date}</div>
      </div>
    `;
  }).join('');
}

function loadNote(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  // Don't load note if Monaco isn't ready yet
  if (!monacoEditorReady || !monacoEditor) {
    console.warn('Monaco editor not ready yet, deferring note load');
    // Retry after a short delay
    setTimeout(() => loadNote(noteId), 100);
    return;
  }

  // Clear any pending auto-save when switching notes
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }

  currentNoteId = noteId;
  noteTitle.value = note.title;

  // Safely set the editor content
  try {
    monacoEditor.setValue(note.content);
  } catch (error) {
    console.error('Error setting editor content:', error);
  }

  noNoteSelected.style.display = 'none';
  editor.style.display = 'flex';

  updateLastSaved(note.updated_at);
  updateSaveStatus('saved');
  renderNotesList();
}

async function createNewNote() {
  const note = await createNote();
  if (note) {
    notes.unshift(note);
    loadNote(note.id);
    renderNotesList();
  }
}

async function saveCurrentNote() {
  if (!currentNoteId || isSaving || !monacoEditor || !monacoEditorReady) return;

  // Capture the note ID at the start - this won't change even if user switches notes
  const noteIdToSave = currentNoteId;

  isSaving = true;
  updateSaveStatus('saving');

  const title = noteTitle.value.trim() || 'Untitled';
  const content = monacoEditor.getValue();

  const updatedNote = await updateNote(noteIdToSave, title, content);

  if (updatedNote) {
    // Use the captured ID, not the global currentNoteId
    const index = notes.findIndex(n => n.id === noteIdToSave);
    if (index !== -1) {
      notes[index] = updatedNote;
    }

    // Only update UI if we're still on the same note
    if (currentNoteId === noteIdToSave) {
      updateLastSaved(updatedNote.updated_at);
      updateSaveStatus('saved');
    }

    renderNotesList();
  } else {
    // Only show error if we're still on the same note
    if (currentNoteId === noteIdToSave) {
      updateSaveStatus('error');
    }
  }

  isSaving = false;
}

async function deleteCurrentNote() {
  if (!currentNoteId) return;

  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }

  const success = await deleteNote(currentNoteId);
  if (success) {
    notes = notes.filter(n => n.id !== currentNoteId);
    currentNoteId = null;

    noNoteSelected.style.display = 'flex';
    editor.style.display = 'none';

    renderNotesList();

    if (notes.length === 0) {
      showEmptyState();
    }
  }
}

function showEmptyState() {
  noNoteSelected.style.display = 'flex';
  editor.style.display = 'none';
}

function updateLastSaved(timestamp) {
  const date = new Date(timestamp);
  lastSaved.textContent = `Last saved: ${date.toLocaleString()}`;
}

// Settings Modal Functions
function openSettingsModal() {
  settingsModal.style.display = 'flex';
  // Clear previous messages
  document.getElementById('password-error').textContent = '';
  document.getElementById('password-success').textContent = '';
  document.getElementById('email-error').textContent = '';
  document.getElementById('email-success').textContent = '';
  // Clear form fields
  changePasswordForm.reset();
  changeEmailForm.reset();
  // Reset to password tab
  switchSettingsTab('password');
}

function closeSettingsModal() {
  settingsModal.style.display = 'none';
}

function switchSettingsTab(tabName) {
  // Remove active class from all nav items
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Add active class to clicked nav item
  const activeNavItem = document.querySelector(`.settings-nav-item[data-tab="${tabName}"]`);
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }

  // Hide all tab content
  document.querySelectorAll('.settings-section').forEach(section => {
    section.style.display = 'none';
    section.classList.remove('active');
  });

  // Show selected tab content
  const activeTab = document.getElementById(`${tabName}-tab`);
  if (activeTab) {
    activeTab.style.display = 'block';
    activeTab.classList.add('active');
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorEl = document.getElementById('password-error');
  const successEl = document.getElementById('password-success');

  // Clear previous messages
  errorEl.textContent = '';
  successEl.textContent = '';

  // Validate current password
  if (!currentPassword || currentPassword.trim() === '') {
    errorEl.textContent = 'Current password is required';
    return;
  }

  if (currentPassword.length > 128) {
    errorEl.textContent = 'Current password is too long';
    return;
  }

  // Validate new password length
  if (newPassword.length < 6) {
    errorEl.textContent = 'New password must be at least 6 characters';
    return;
  }

  if (newPassword.length > 128) {
    errorEl.textContent = 'New password must not exceed 128 characters';
    return;
  }

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'New passwords do not match';
    return;
  }

  // Check if new password is same as current
  if (currentPassword === newPassword) {
    errorEl.textContent = 'New password must be different from current password';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();

    if (response.status === 401) {
      logout();
      return;
    }

    if (!result.success) {
      errorEl.textContent = result.error || 'Failed to change password';
      return;
    }

    successEl.textContent = 'Password changed successfully!';
    changePasswordForm.reset();
  } catch (error) {
    console.error('Error changing password:', error);
    errorEl.textContent = 'Failed to change password. Please try again.';
  }
}

async function handleEmailChange(e) {
  e.preventDefault();

  const newEmail = document.getElementById('new-email').value.trim().toLowerCase();
  const confirmEmail = document.getElementById('confirm-email').value.trim().toLowerCase();
  const errorEl = document.getElementById('email-error');
  const successEl = document.getElementById('email-success');

  // Clear previous messages
  errorEl.textContent = '';
  successEl.textContent = '';

  // Validate email is not empty
  if (!newEmail || newEmail === '') {
    errorEl.textContent = 'Email is required';
    return;
  }

  // Validate email length
  if (newEmail.length < 3) {
    errorEl.textContent = 'Email is too short';
    return;
  }

  if (newEmail.length > 255) {
    errorEl.textContent = 'Email must not exceed 255 characters';
    return;
  }

  // Validate email format - use more strict regex matching backend
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(newEmail)) {
    errorEl.textContent = 'Invalid email format';
    return;
  }

  // Validate emails match
  if (newEmail !== confirmEmail) {
    errorEl.textContent = 'Email addresses do not match';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/email`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newEmail })
    });

    const result = await response.json();

    if (response.status === 401) {
      logout();
      return;
    }

    if (!result.success) {
      errorEl.textContent = result.error || 'Failed to change email';
      return;
    }

    successEl.textContent = result.message || 'Verification email sent. Please check your inbox.';
    changeEmailForm.reset();

    // Note: The email won't actually change until user clicks verification link in their inbox
    // The displayed email in the UI will remain unchanged until verification is complete
  } catch (error) {
    console.error('Error changing email:', error);
    errorEl.textContent = 'Failed to change email. Please try again.';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
