const API_BASE = '/api';

let notes = [];
let currentNoteId = null;
let autoSaveTimeout = null;
let tocUpdateTimeout = null;
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
const deletedNoteView = document.getElementById('deleted-note-view');
const deletedNoteTitle = document.getElementById('deleted-note-title');
const recoverNoteBtn = document.getElementById('recover-note-btn');
const viewAllNotesBtn = document.getElementById('view-all-notes-btn');
const saveVersionBtn = document.getElementById('save-version-btn');
const togglePanelBtn = document.getElementById('toggle-panel-btn');
const closePanelBtn = document.getElementById('close-panel-btn');
const sidePanel = document.getElementById('side-panel');
const versionsList = document.getElementById('versions-list');
const tocList = document.getElementById('toc-list');
const editModeBtn = document.getElementById('edit-mode-btn');
const previewModeBtn = document.getElementById('preview-mode-btn');
const monacoEditorContainer = document.getElementById('monaco-editor-container');
const previewContainer = document.getElementById('preview-container');

let currentVersionId = null; // Track if we're viewing a past version
let noteVersions = []; // Store versions for current note
let currentMode = 'edit'; // Track current mode: 'edit' or 'preview'

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) {
    return;
  }
  loadTheme();
  initializeMonacoEditor();
  setupEventListeners();
});

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
  loadNoteFromURL();
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
        },
        // Disable IntelliSense/autocomplete
        wordBasedSuggestions: false,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        acceptSuggestionOnEnter: 'off'
      });

      // Setup auto-save on content change
      monacoEditor.onDidChangeModelContent(() => {
        scheduleAutoSave();
        scheduleTOCUpdate();
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

  // Deleted note recovery buttons
  if (recoverNoteBtn) {
    recoverNoteBtn.addEventListener('click', recoverDeletedNote);
  }
  if (viewAllNotesBtn) {
    viewAllNotesBtn.addEventListener('click', () => {
      hideDeletedNoteView();
      updateURL(null);
    });
  }

  // Version and panel buttons
  if (saveVersionBtn) {
    saveVersionBtn.addEventListener('click', createVersion);
  }
  if (togglePanelBtn) {
    togglePanelBtn.addEventListener('click', toggleSidePanel);
  }
  if (closePanelBtn) {
    closePanelBtn.addEventListener('click', () => {
      sidePanel.classList.add('hidden');
    });
  }

  // Panel tab switching
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchPanelTab(tabName);
    });
  });

  // Mode toggle (Edit/Preview)
  if (editModeBtn) {
    editModeBtn.addEventListener('click', () => switchMode('edit'));
  }
  if (previewModeBtn) {
    previewModeBtn.addEventListener('click', () => switchMode('preview'));
  }

  // Theme selection
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', (e) => {
      const theme = e.currentTarget.dataset.theme;
      setTheme(theme);
    });
  });
}

// URL / Deeplinking Functions
function updateURL(noteId) {
  if (noteId) {
    window.history.pushState(null, '', `#note/${noteId}`);
  } else {
    window.history.pushState(null, '', '#');
  }
}

async function loadNoteFromURL() {
  const hash = window.location.hash;

  // No hash or just '#' - don't load any note
  if (!hash || hash === '#') {
    return;
  }

  // Parse hash format: #note/{noteId}
  const noteMatch = hash.match(/^#note\/(.+)$/);
  if (noteMatch && noteMatch[1]) {
    const noteId = noteMatch[1];

    // Check if note exists in loaded notes (active notes only)
    const note = notes.find(n => n.id === noteId);
    if (note) {
      // Only load if not already the current note (prevents unnecessary reloads)
      if (currentNoteId !== noteId) {
        loadNote(noteId, false); // false = don't update URL (already in URL)
      }
    } else {
      // Note not in active list - fetch from server to check if it's deleted
      try {
        const response = await fetch(`${API_BASE}/notes/${noteId}`, {
          headers: getAuthHeaders()
        });

        if (response.status === 401) {
          logout();
          return;
        }

        if (response.status === 404) {
          // Note doesn't exist at all - clear the hash
          console.warn('Note not found:', noteId);
          window.history.replaceState(null, '', '#');
          return;
        }

        const result = await response.json();
        if (result.success && result.data) {
          const fetchedNote = result.data;

          // Check if note is deleted
          if (fetchedNote.is_deleted) {
            showDeletedNoteView(fetchedNote);
          } else {
            // Note exists but not in our list (shouldn't happen normally)
            console.warn('Note exists but not in local list:', noteId);
            window.history.replaceState(null, '', '#');
          }
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        window.history.replaceState(null, '', '#');
      }
    }
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

// Schedule TOC update with debouncing
function scheduleTOCUpdate() {
  if (!currentNoteId) return;

  // Clear existing timeout
  if (tocUpdateTimeout) {
    clearTimeout(tocUpdateTimeout);
  }

  // Update TOC after 500ms of no typing (faster than save for responsiveness)
  tocUpdateTimeout = setTimeout(() => {
    updateTableOfContents();
  }, 500);
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
  } else {
    // Try to load note from URL hash if present
    loadNoteFromURL();
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
    const relativeTime = getRelativeTime(note.updated_at);
    return `
      <div class="note-item ${note.id === currentNoteId ? 'active' : ''}" data-id="${note.id}">
        <div class="note-item-title">${escapeHtml(note.title)}</div>
        <div class="note-item-date">${relativeTime}</div>
      </div>
    `;
  }).join('');
}

function loadNote(noteId, updateUrl = true) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  // Don't load note if Monaco isn't ready yet
  if (!monacoEditorReady || !monacoEditor) {
    console.warn('Monaco editor not ready yet, deferring note load');
    // Retry after a short delay
    setTimeout(() => loadNote(noteId, updateUrl), 100);
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

  // Re-enable editing (in case we were viewing a past version)
  monacoEditor.updateOptions({ readOnly: false });
  noteTitle.readOnly = false;

  // Hide all other views and show editor
  noNoteSelected.style.display = 'none';
  deletedNoteView.style.display = 'none';
  editor.style.display = 'flex';

  updateLastSaved(note.updated_at);
  updateSaveStatus('saved');
  renderNotesList();

  // Reset version view state
  currentVersionId = null;

  // Reset to edit mode when loading a note
  switchMode('edit');

  // Load versions and update TOC
  loadVersions(noteId);
  updateTableOfContents();

  // Show side panel with TOC tab by default
  sidePanel.classList.remove('hidden');
  switchPanelTab('toc');

  // Update URL to reflect current note
  if (updateUrl) {
    updateURL(noteId);
  }
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

  // Store the note info before deleting for the recovery view
  const deletedNote = notes.find(n => n.id === currentNoteId);
  if (!deletedNote) return;

  const success = await deleteNote(currentNoteId);
  if (success) {
    // Remove from notes array
    notes = notes.filter(n => n.id !== currentNoteId);

    renderNotesList();

    // Keep the URL as is (don't clear it) so user stays on the same page
    // Show deleted note view with recovery option
    showDeletedNoteView(deletedNote);

    // Keep currentNoteId set so the URL stays the same
    // It will be cleared when user recovers or navigates away
  }
}

// Deleted Note Functions
function showDeletedNoteView(note) {
  // Hide other views
  noNoteSelected.style.display = 'none';
  editor.style.display = 'none';

  // Show deleted note view with XSS protection (using textContent, not innerHTML)
  deletedNoteView.style.display = 'flex';
  deletedNoteTitle.textContent = note.title || 'Untitled';

  // Store note ID for recovery (safe - dataset attributes are automatically escaped)
  deletedNoteView.dataset.noteId = note.id;
}

function hideDeletedNoteView() {
  deletedNoteView.style.display = 'none';
  delete deletedNoteView.dataset.noteId;

  // Show empty state
  showEmptyState();
}

async function recoverDeletedNote() {
  const noteId = deletedNoteView.dataset.noteId;
  if (!noteId) {
    console.error('No note ID found for recovery');
    alert('Cannot recover note: Note ID is missing');
    return;
  }

  // Disable button during recovery to prevent double-clicks
  const recoverBtn = document.getElementById('recover-note-btn');
  if (recoverBtn) {
    recoverBtn.disabled = true;
    recoverBtn.textContent = 'Recovering...';
  }

  try {
    const response = await fetch(`${API_BASE}/notes/${noteId}/restore`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const result = await response.json();

    if (result.success && result.data) {
      // Add recovered note back to notes array
      notes.unshift(result.data);

      // Hide deleted view and load the recovered note
      deletedNoteView.style.display = 'none';
      delete deletedNoteView.dataset.noteId;

      // Refresh the notes list and load the recovered note
      renderNotesList();
      loadNote(noteId);

      // Show success message briefly
      alert('Note recovered successfully!');
    } else {
      alert(result.error || 'Failed to recover note');
      // Re-enable button on error
      if (recoverBtn) {
        recoverBtn.disabled = false;
        recoverBtn.textContent = 'Recover This Note';
      }
    }
  } catch (error) {
    console.error('Error recovering note:', error);
    alert('Failed to recover note. Please try again.');
    // Re-enable button on error
    if (recoverBtn) {
      recoverBtn.disabled = false;
      recoverBtn.textContent = 'Recover This Note';
    }
  }
}

function showEmptyState() {
  // Hide all views except the empty state
  noNoteSelected.style.display = 'flex';
  editor.style.display = 'none';
  deletedNoteView.style.display = 'none';
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

function getRelativeTime(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}

// Version Functions
async function createVersion() {
  if (!currentNoteId || currentVersionId) {
    alert('Cannot save a version while viewing a past version');
    return;
  }

  const annotation = prompt('Enter version annotation (describe this version):');
  if (!annotation || annotation.trim().length === 0) return;

  if (annotation.length > 500) {
    alert('Annotation must not exceed 500 characters');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/versions/note/${currentNoteId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ annotation: annotation.trim() })
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const result = await response.json();

    if (result.success) {
      alert(`${result.message}`);
      loadVersions(currentNoteId);
      sidePanel.classList.remove('hidden');
      // Switch to versions tab
      switchPanelTab('versions');
    } else {
      alert(result.error || 'Failed to create version');
    }
  } catch (error) {
    console.error('Error creating version:', error);
    alert('Failed to create version. Please try again.');
  }
}

async function loadVersions(noteId) {
  try {
    const response = await fetch(`${API_BASE}/versions/note/${noteId}`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const result = await response.json();

    if (result.success) {
      noteVersions = result.data || [];
      updateVersionsList();
    }
  } catch (error) {
    console.error('Error loading versions:', error);
  }
}

function updateVersionsList() {
  if (noteVersions.length === 0) {
    versionsList.innerHTML = '<p class="versions-empty">No versions yet. Click "💾 Save Version" to create one.</p>';
    return;
  }

  const html = noteVersions.map(version => {
    const date = new Date(version.created_at).toLocaleString();
    const isCurrent = !currentVersionId; // Current version when not viewing a past one
    const isThisVersion = currentVersionId === version.id;

    return `
      <div class="version-item ${(isCurrent && noteVersions.indexOf(version) === 0) || isThisVersion ? 'current' : ''}"
           data-version-id="${version.id}">
        <div class="version-number">v${version.version_number}</div>
        <div class="version-annotation">${escapeHtml(version.annotation)}</div>
        <div class="version-timestamp">${date}</div>
        <div class="version-actions">
          <button class="version-delete-btn" data-version-id="${version.id}" title="Delete this version">×</button>
        </div>
      </div>
    `;
  }).join('');

  versionsList.innerHTML = html;

  // Add click handlers to view versions
  versionsList.querySelectorAll('.version-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking delete button
      if (e.target.classList.contains('version-delete-btn')) return;

      const versionId = item.dataset.versionId;
      viewVersion(versionId);
    });
  });

  // Add delete handlers
  versionsList.querySelectorAll('.version-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const versionId = btn.dataset.versionId;
      await deleteVersion(versionId);
    });
  });
}

async function viewVersion(versionId) {
  try {
    const response = await fetch(`${API_BASE}/versions/${versionId}`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const result = await response.json();

    if (result.success && result.data) {
      const version = result.data;

      // Set the version content in the editor
      noteTitle.value = version.title;
      monacoEditor.setValue(version.content);

      // Mark as viewing a past version
      currentVersionId = versionId;

      // Update save status to indicate viewing old version
      updateSaveStatus('viewing-version');
      saveStatus.textContent = `Viewing v${version.version_number}`;
      saveStatus.className = 'save-status viewing-version';

      // Disable editing
      monacoEditor.updateOptions({ readOnly: true });
      noteTitle.readOnly = true;

      // Switch to edit mode to show the read-only version content
      switchMode('edit');

      // Update versions list to highlight current
      updateVersionsList();
      updateTableOfContents();
    }
  } catch (error) {
    console.error('Error viewing version:', error);
    alert('Failed to load version');
  }
}

async function deleteVersion(versionId) {
  if (!confirm('Are you sure you want to delete this version?')) return;

  try {
    const response = await fetch(`${API_BASE}/versions/${versionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      logout();
      return;
    }

    const result = await response.json();

    if (result.success) {
      loadVersions(currentNoteId);
    } else {
      alert(result.error || 'Failed to delete version');
    }
  } catch (error) {
    console.error('Error deleting version:', error);
    alert('Failed to delete version');
  }
}

function toggleSidePanel() {
  sidePanel.classList.toggle('hidden');

  // Update content when opening
  if (!sidePanel.classList.contains('hidden')) {
    updateVersionsList();
    updateTableOfContents();
  }
}

function switchPanelTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.panel-tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update tab content
  if (tabName === 'versions') {
    document.getElementById('versions-tab-content').classList.add('active');
    document.getElementById('toc-tab-content').classList.remove('active');
    updateVersionsList();
  } else if (tabName === 'toc') {
    document.getElementById('versions-tab-content').classList.remove('active');
    document.getElementById('toc-tab-content').classList.add('active');
    updateTableOfContents();
  }
}

function parseTableOfContents() {
  if (!monacoEditor || !monacoEditorReady) return [];

  const content = monacoEditor.getValue();
  const lines = content.split('\n');
  const headers = [];

  // Regex to match markdown headers: # Header, ## Header, etc.
  const headerRegex = /^(#{1,6})\s+(.+)$/;

  lines.forEach((line, index) => {
    const match = line.match(headerRegex);
    if (match) {
      const level = match[1].length; // Number of # symbols
      const text = match[2].trim();
      headers.push({
        lineNumber: index + 1,
        level: level,
        text: text
      });
    }
  });

  return headers;
}

function updateTableOfContents() {
  if (!monacoEditor || !monacoEditorReady) {
    return;
  }

  const headers = parseTableOfContents();

  if (headers.length === 0) {
    tocList.innerHTML = '<p class="toc-empty">No headers found. Add headers using # syntax.</p>';
    return;
  }

  // Create TOC items
  const html = headers.map(header => `
    <div class="toc-item level-${header.level}" data-line="${header.lineNumber}">
      ${escapeHtml(header.text)}
    </div>
  `).join('');

  tocList.innerHTML = html;

  // Add click handlers to navigate to headers
  tocList.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      const lineNumber = parseInt(item.dataset.line);
      navigateToLine(lineNumber);
    });
  });
}

function navigateToLine(lineNumber) {
  if (!monacoEditor || !monacoEditorReady) return;

  // Scroll to the line and highlight it
  monacoEditor.revealLineInCenter(lineNumber);
  monacoEditor.setPosition({ lineNumber, column: 1 });
  monacoEditor.focus();

  // Highlight the line briefly
  const decorations = monacoEditor.deltaDecorations([], [
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'checkpoint-highlight'
      }
    }
  ]);

  // Remove highlight after 2 seconds
  setTimeout(() => {
    monacoEditor.deltaDecorations(decorations, []);
  }, 2000);
}

// Mode Switching Functions
function switchMode(mode) {
  if (currentMode === mode) return;

  currentMode = mode;

  // Update button active states
  if (mode === 'edit') {
    editModeBtn.classList.add('active');
    previewModeBtn.classList.remove('active');
    monacoEditorContainer.style.display = 'block';
    previewContainer.style.display = 'none';
  } else {
    editModeBtn.classList.remove('active');
    previewModeBtn.classList.add('active');
    monacoEditorContainer.style.display = 'none';
    previewContainer.style.display = 'block';

    renderPreview();
  }
}

function renderPreview() {
  if (!monacoEditor || !monacoEditorReady) {
    return;
  }

  const markdown = monacoEditor.getValue();

  try {
    // If content is empty, show a message
    if (!markdown.trim()) {
      previewContainer.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No content to preview. Start typing in edit mode!</p>';
      return;
    }

    // Check if marked library is loaded
    if (typeof marked === 'undefined') {
      previewContainer.innerHTML = '<p style="color: red; padding: 20px;">Markdown library not loaded. Please refresh the page.</p>';
      console.error('marked library not available');
      return;
    }

    // Configure marked for GitHub-style markdown
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    // Parse markdown to HTML using marked library
    const html = marked.parse(markdown);
    previewContainer.innerHTML = html;
  } catch (error) {
    console.error('Error rendering preview:', error);
    previewContainer.innerHTML = '<p style="color: red; padding: 20px;">Error rendering preview: ' + error.message + '</p>';
  }
}

// Theme Functions
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'default';
  setTheme(savedTheme);
}

function setTheme(theme) {
  // Update document attribute
  document.documentElement.setAttribute('data-theme', theme);

  // Save to localStorage
  localStorage.setItem('theme', theme);

  // Update active state in theme selector
  document.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === theme) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });

  // Update Monaco Editor theme
  if (monacoEditor && monacoEditorReady) {
    const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
    monaco.editor.setTheme(monacoTheme);
  }
}
