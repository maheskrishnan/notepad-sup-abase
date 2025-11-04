const API_BASE = '/api';

let notes = [];
let currentNoteId = null;
let autoSaveTimeout = null;
let isSaving = false;
let accessToken = null;
let monacoEditor = null;

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) {
    return;
  }
  initializeMonacoEditor();
  loadNotes();
  setupEventListeners();
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

  // Auto-save on input with debouncing (2 seconds after user stops typing)
  noteTitle.addEventListener('input', () => {
    scheduleAutoSave();
  });
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

  // Schedule save after 2 seconds of no typing
  autoSaveTimeout = setTimeout(() => {
    saveCurrentNote();
  }, 2000);
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

  notesList.innerHTML = notes.map(note => {
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

  // Add click listeners to note items
  document.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', () => {
      const noteId = item.dataset.id;
      loadNote(noteId);
    });
  });
}

function loadNote(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  currentNoteId = noteId;
  noteTitle.value = note.title;

  if (monacoEditor) {
    monacoEditor.setValue(note.content);
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
  if (!currentNoteId || isSaving || !monacoEditor) return;

  isSaving = true;
  updateSaveStatus('saving');

  const title = noteTitle.value.trim() || 'Untitled';
  const content = monacoEditor.getValue();

  const updatedNote = await updateNote(currentNoteId, title, content);

  if (updatedNote) {
    const index = notes.findIndex(n => n.id === currentNoteId);
    if (index !== -1) {
      notes[index] = updatedNote;
    }

    updateLastSaved(updatedNote.updated_at);
    updateSaveStatus('saved');
    renderNotesList();
  } else {
    updateSaveStatus('error');
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
