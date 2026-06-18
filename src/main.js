// SRE Notepad - Core Application Logic

// --- Application State ---
let tabs = [];
let activeTabId = "";

let activeTheme = "dark";
let wordWrapEnabled = true;
let lineNumbersEnabled = true;
let editorFontSize = 15; // px

let findPanelOpen = false;
let searchQuery = "";
let replaceQuery = "";
let matchCase = false;
let useRegex = false;

let matches = []; // Array of { index, length }
let activeMatchIndex = -1;

// Global document state variables (represent active tab references for compatibility)
let currentFileHandle = null;
let currentFilename = "untitled.txt";
let isDirty = false;

// --- DOM Cache ---
const elements = {
  textarea: document.getElementById("editor-textarea"),
  highlightLayer: document.getElementById("highlight-layer"),
  lineNumbersContainer: document.getElementById("line-numbers-container"),
  editorOuterContainer: document.getElementById("editor-outer-container"),
  editorViewport: document.getElementById("editor-viewport"),
  
  // Header Info
  currentFilenameBadge: document.getElementById("current-filename-badge"),
  wordCountHeader: document.getElementById("word-count-header"),
  charCountHeader: document.getElementById("char-count-header"),
  
  // Toolbar buttons
  newFileBtn: document.getElementById("new-file-btn"),
  openFileBtn: document.getElementById("open-file-btn"),
  saveFileBtn: document.getElementById("save-file-btn"),
  toggleFindBtn: document.getElementById("toggle-find-btn"),
  toggleWrapBtn: document.getElementById("toggle-wrap-btn"),
  toggleLinesBtn: document.getElementById("toggle-lines-btn"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  themeSunIcon: document.getElementById("theme-sun-icon"),
  themeMoonIcon: document.getElementById("theme-moon-icon"),
  
  // Find & Replace Panel
  findReplacePanel: document.getElementById("find-replace-panel"),
  findInput: document.getElementById("find-input"),
  replaceInput: document.getElementById("replace-input"),
  matchCaseBtn: document.getElementById("match-case-btn"),
  regexBtn: document.getElementById("regex-btn"),
  findPrevBtn: document.getElementById("find-prev-btn"),
  findNextBtn: document.getElementById("find-next-btn"),
  replaceBtn: document.getElementById("replace-btn"),
  replaceAllBtn: document.getElementById("replace-all-btn"),
  matchStatusLabel: document.getElementById("match-status-label"),
  
  // Status Bar
  statusMessage: document.getElementById("status-message"),
  zoomOutBtn: document.getElementById("zoom-out-btn"),
  zoomInBtn: document.getElementById("zoom-in-btn"),
  zoomLabel: document.getElementById("zoom-label"),
  cursorPosLabel: document.getElementById("cursor-pos-label"),
  
  // Hidden inputs
  fallbackFileInput: document.getElementById("fallback-file-input"),

  // SRE Tools dropdown and items
  sreToolsBtn: document.getElementById("sre-tools-btn"),
  sreToolsMenu: document.getElementById("sre-tools-menu"),
  sreJsonBtn: document.getElementById("sre-json-btn"),
  sreB64decodeBtn: document.getElementById("sre-b64decode-btn"),
  sreB64encodeBtn: document.getElementById("sre-b64encode-btn"),
  sreHexdecodeBtn: document.getElementById("sre-hexdecode-btn"),
  sreHexencodeBtn: document.getElementById("sre-hexencode-btn"),
  sreEpochToDateBtn: document.getElementById("sre-epoch-to-date-btn"),
  sreDateToEpochBtn: document.getElementById("sre-date-to-epoch-btn"),

  // Multi-Tab Elements
  tabsContainer: document.getElementById("tabs-container"),
  addTabBtn: document.getElementById("add-tab-btn")
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  loadSettingsFromStorage();
  setupEventListeners();
  
  // Initial sync
  syncEditor();
  
  // Restore editor position states after sync
  restoreEditorScrollAndCursor();
});

// --- State Persistence (Local Storage) ---
function loadSettingsFromStorage() {
  // Theme
  activeTheme = localStorage.getItem("notepad_theme") || "dark";
  document.documentElement.setAttribute("data-theme", activeTheme);
  updateThemeIcons();

  // Word Wrap
  const storedWrap = localStorage.getItem("notepad_wrap");
  wordWrapEnabled = storedWrap !== null ? storedWrap === "true" : true;
  updateWordWrapUI();

  // Line Numbers
  const storedLines = localStorage.getItem("notepad_lines");
  lineNumbersEnabled = storedLines !== null ? storedLines === "true" : true;
  updateLineNumbersUI();

  // Font Size
  const storedFontSize = localStorage.getItem("notepad_font_size");
  if (storedFontSize) {
    editorFontSize = parseInt(storedFontSize, 10);
    updateFontSizeUI();
  }

  // Find Panel Inputs
  searchQuery = localStorage.getItem("notepad_find_query") || "";
  elements.findInput.value = searchQuery;
  replaceQuery = localStorage.getItem("notepad_replace_query") || "";
  elements.replaceInput.value = replaceQuery;
  
  matchCase = localStorage.getItem("notepad_match_case") === "true";
  if (matchCase) elements.matchCaseBtn.classList.add("active");
  
  useRegex = localStorage.getItem("notepad_use_regex") === "true";
  if (useRegex) elements.regexBtn.classList.add("active");

  // Load Tabs
  const storedTabs = localStorage.getItem("notepad_tabs_data");
  activeTabId = localStorage.getItem("notepad_active_tab_id") || "";
  
  if (storedTabs) {
    try {
      tabs = JSON.parse(storedTabs);
      // Ensure fileHandle references are initialized to null (non-serializable)
      tabs.forEach(t => {
        t.fileHandle = null;
      });
    } catch (e) {
      tabs = [];
    }
  }

  if (tabs.length === 0) {
    // Spawn default tab
    createNewTab("untitled.txt", "", null, false);
  }

  if (!activeTabId || !tabs.some(t => t.id === activeTabId)) {
    activeTabId = tabs[0].id;
  }

  // Populate active tab state into editor
  const activeTab = getActiveTab();
  elements.textarea.value = activeTab.text;
  currentFilename = activeTab.filename;
  currentFileHandle = activeTab.fileHandle;
  isDirty = activeTab.isDirty;
  
  elements.currentFilenameBadge.textContent = currentFilename;
  
  // Render tabs in the DOM
  renderTabs();
}

function saveStateToStorage() {
  // Save current active tab text, selection, scroll to active tab object
  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.text = elements.textarea.value;
    activeTab.isDirty = isDirty;
    activeTab.filename = currentFilename;
    activeTab.cursorStart = elements.textarea.selectionStart;
    activeTab.cursorEnd = elements.textarea.selectionEnd;
    activeTab.scrollTop = elements.textarea.scrollTop;
    activeTab.scrollLeft = elements.textarea.scrollLeft;
  }

  // Serialize tabs (strip out fileHandle which is not serializable)
  const tabsCopy = tabs.map(t => ({
    id: t.id,
    filename: t.filename,
    text: t.text,
    isDirty: t.isDirty,
    cursorStart: t.cursorStart,
    cursorEnd: t.cursorEnd,
    scrollTop: t.scrollTop,
    scrollLeft: t.scrollLeft
  }));

  localStorage.setItem("notepad_tabs_data", JSON.stringify(tabsCopy));
  localStorage.setItem("notepad_active_tab_id", activeTabId);

  localStorage.setItem("notepad_theme", activeTheme);
  localStorage.setItem("notepad_wrap", wordWrapEnabled.toString());
  localStorage.setItem("notepad_lines", lineNumbersEnabled.toString());
  localStorage.setItem("notepad_font_size", editorFontSize.toString());
  
  // Search parameters
  localStorage.setItem("notepad_find_query", searchQuery);
  localStorage.setItem("notepad_replace_query", replaceQuery);
  localStorage.setItem("notepad_match_case", matchCase.toString());
  localStorage.setItem("notepad_use_regex", useRegex.toString());
}

function restoreEditorScrollAndCursor() {
  const activeTab = getActiveTab();
  if (!activeTab) return;

  const start = activeTab.cursorStart || 0;
  const end = activeTab.cursorEnd || 0;
  const scrollTop = activeTab.scrollTop || 0;
  const scrollLeft = activeTab.scrollLeft || 0;

  // Restore cursor selection
  if (start <= elements.textarea.value.length && end <= elements.textarea.value.length) {
    elements.textarea.setSelectionRange(start, end);
  }

  // Restore scroll positions
  elements.textarea.scrollTop = scrollTop;
  elements.textarea.scrollLeft = scrollLeft;
  elements.highlightLayer.scrollTop = scrollTop;
  elements.highlightLayer.scrollLeft = scrollLeft;
  elements.lineNumbersContainer.scrollTop = scrollTop;
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  const tx = elements.textarea;

  // Textarea changes
  tx.addEventListener("input", () => {
    isDirty = true;
    syncEditor();
    if (findPanelOpen && searchQuery) {
      performSearch(false, false); // Refilter highlights without shifting index or stealing focus
    }
  });

  tx.addEventListener("scroll", () => {
    elements.highlightLayer.scrollTop = tx.scrollTop;
    elements.highlightLayer.scrollLeft = tx.scrollLeft;
    elements.lineNumbersContainer.scrollTop = tx.scrollTop;
    saveStateToStorage();
  });

  // Cursor Selection Tracking
  tx.addEventListener("keyup", () => {
    updateCursorPosition();
    highlightActiveLineNumber();
    saveStateToStorage();
  });
  tx.addEventListener("click", () => {
    updateCursorPosition();
    highlightActiveLineNumber();
    saveStateToStorage();
  });
  tx.addEventListener("focus", () => {
    highlightActiveLineNumber();
  });

  // Hotkeys
  window.addEventListener("keydown", (e) => {
    // Save: Alt+S
    if (e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveFile();
    }
    // Open: Alt+O
    if (e.altKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      openFile();
    }
    // New Tab: Alt+N
    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      createNewTab("untitled.txt", "", null, true);
    }
    // Find: Alt+F
    if (e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleFindPanel();
    }
    // Close Tab: Alt+W
    if (e.altKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      closeTab(activeTabId);
    }
    // Add Tab: Alt+T
    if (e.altKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      createNewTab("untitled.txt", "", null, true);
    }
  });

  // Toolbar Actions
  elements.newFileBtn.addEventListener("click", () => createNewTab("untitled.txt", "", null, true));
  elements.openFileBtn.addEventListener("click", openFile);
  elements.saveFileBtn.addEventListener("click", saveFile);
  elements.toggleFindBtn.addEventListener("click", toggleFindPanel);
  elements.toggleWrapBtn.addEventListener("click", toggleWordWrap);
  elements.toggleLinesBtn.addEventListener("click", toggleLineNumbers);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);

  // Tab Add Button Action
  elements.addTabBtn.addEventListener("click", () => createNewTab("untitled.txt", "", null, true));

  // SRE Tools dropdown toggle
  elements.sreToolsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const container = elements.sreToolsBtn.closest(".dropdown-container");
    container.classList.toggle("active");
    elements.sreToolsMenu.classList.toggle("show");
  });

  // Close dropdown menu when clicking anywhere else
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown-container")) {
      const container = elements.sreToolsBtn.closest(".dropdown-container");
      if (container) container.classList.remove("active");
      elements.sreToolsMenu.classList.remove("show");
    }
  });

  // SRE Tool Actions
  elements.sreJsonBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    prettifyJSON();
  });
  elements.sreB64decodeBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    base64Decode();
  });
  elements.sreB64encodeBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    base64Encode();
  });
  elements.sreHexdecodeBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    hexDecode();
  });
  elements.sreHexencodeBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    hexEncode();
  });
  elements.sreEpochToDateBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    convertEpochToDate();
  });
  elements.sreDateToEpochBtn.addEventListener("click", () => {
    closeSreToolsMenu();
    convertDateToEpoch();
  });

  // Fallback file input
  elements.fallbackFileInput.addEventListener("change", handleFallbackFileOpen);

  // Find & Replace Inputs & Controls
  elements.findInput.addEventListener("input", () => {
    searchQuery = elements.findInput.value;
    performSearch(true, false); // Reset to index 0 on search term changes, do NOT steal focus
  });

  elements.replaceInput.addEventListener("input", () => {
    replaceQuery = elements.replaceInput.value;
    saveStateToStorage();
  });

  elements.matchCaseBtn.addEventListener("click", () => {
    matchCase = !matchCase;
    elements.matchCaseBtn.classList.toggle("active", matchCase);
    performSearch(true, false);
  });

  elements.regexBtn.addEventListener("click", () => {
    useRegex = !useRegex;
    elements.regexBtn.classList.toggle("active", useRegex);
    performSearch(true, false);
  });

  elements.findNextBtn.addEventListener("click", navigateNextMatch);
  elements.findPrevBtn.addEventListener("click", navigatePrevMatch);

  // Key navigation inside find input
  elements.findInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrevMatch();
      } else {
        navigateNextMatch();
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeFindPanel();
    }
  });

  elements.replaceBtn.addEventListener("click", replaceCurrentMatch);
  elements.replaceAllBtn.addEventListener("click", replaceAllMatches);

  elements.findReplacePanel.addEventListener("close", () => {
    findPanelOpen = false;
    elements.toggleFindBtn.classList.remove("active");
    elements.editorOuterContainer.classList.remove("find-open");
    elements.textarea.classList.remove("searching");
    elements.textarea.focus();
    syncEditor();
  });

  // Zoom Settings
  elements.zoomInBtn.addEventListener("click", () => adjustFontSize(1));
  elements.zoomOutBtn.addEventListener("click", () => adjustFontSize(-1));

  // Listen to window resizing to ensure scroll offsets align perfectly
  window.addEventListener("resize", () => {
    elements.highlightLayer.scrollTop = tx.scrollTop;
    elements.highlightLayer.scrollLeft = tx.scrollLeft;
  });
}

// --- Sync Editor and Visual Components ---
function syncEditor() {
  const text = elements.textarea.value;
  
  // Update state values on active tab object
  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.text = text;
    activeTab.isDirty = isDirty;
    activeTab.filename = currentFilename;
    activeTab.fileHandle = currentFileHandle;
  }

  // Word & Character count
  const charCount = text.length;
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  
  elements.wordCountHeader.textContent = wordCount.toLocaleString();
  elements.charCountHeader.textContent = charCount.toLocaleString();

  // Render Line Numbers
  renderLineNumbers();

  // Highlight matches overlay
  if (findPanelOpen && searchQuery) {
    elements.textarea.classList.add("searching");
    renderSearchHighlights();
  } else {
    elements.textarea.classList.remove("searching");
    elements.highlightLayer.textContent = "";
  }

  updateCursorPosition();
  highlightActiveLineNumber();
  
  // Render tabs in tabs bar to reflect changes
  renderTabs();
  
  saveStateToStorage();
}

// --- Multi-Tab Helpers ---

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId);
}

function createNewTab(filename = "untitled.txt", text = "", fileHandle = null, switchImmediately = true) {
  const newTab = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    filename: filename,
    text: text,
    isDirty: false,
    fileHandle: fileHandle,
    cursorStart: 0,
    cursorEnd: 0,
    scrollTop: 0,
    scrollLeft: 0
  };

  tabs.push(newTab);

  if (switchImmediately) {
    switchTab(newTab.id);
  } else {
    renderTabs();
    saveStateToStorage();
  }
  return newTab;
}

function switchTab(tabId) {
  if (activeTabId === tabId && tabs.some(t => t.id === tabId)) {
    restoreEditorScrollAndCursor();
    return;
  }

  // 1. Save state parameters of currently active tab
  const currentTab = getActiveTab();
  if (currentTab) {
    currentTab.text = elements.textarea.value;
    currentTab.isDirty = isDirty;
    currentTab.filename = currentFilename;
    currentTab.fileHandle = currentFileHandle;
    currentTab.cursorStart = elements.textarea.selectionStart;
    currentTab.cursorEnd = elements.textarea.selectionEnd;
    currentTab.scrollTop = elements.textarea.scrollTop;
    currentTab.scrollLeft = elements.textarea.scrollLeft;
  }

  // 2. Set new active tab
  activeTabId = tabId;
  const newTab = getActiveTab();

  if (newTab) {
    // 3. Load tab values into global state variables
    elements.textarea.value = newTab.text;
    currentFilename = newTab.filename;
    currentFileHandle = newTab.fileHandle;
    isDirty = newTab.isDirty;

    elements.currentFilenameBadge.textContent = currentFilename;

    // Reset search markers
    if (findPanelOpen) {
      performSearch(true, false);
    } else {
      syncEditor();
    }

    // 4. Restore scroll coordinates and selections
    restoreEditorScrollAndCursor();
  }
}

function closeTab(tabId) {
  const targetTab = tabs.find(t => t.id === tabId);
  if (!targetTab) return;

  if (targetTab.isDirty) {
    const confirmDiscard = confirm(`"${targetTab.filename}" has unsaved changes. Do you want to discard them?`);
    if (!confirmDiscard) return;
  }

  const tabIndex = tabs.findIndex(t => t.id === tabId);
  tabs.splice(tabIndex, 1);

  if (tabs.length === 0) {
    // Recreate single default tab
    createNewTab("untitled.txt", "", null, true);
  } else if (activeTabId === tabId) {
    // Switch active focus to neighbor tab
    const nextActiveIdx = Math.min(tabIndex, tabs.length - 1);
    switchTab(tabs[nextActiveIdx].id);
  } else {
    renderTabs();
    saveStateToStorage();
  }
}

function renderTabs() {
  let html = "";
  tabs.forEach(tab => {
    const isActive = tab.id === activeTabId;
    const activeClass = isActive ? "active" : "";
    const dirtyClass = tab.isDirty ? "dirty" : "";

    html += `
      <div class="tab-item ${activeClass} ${dirtyClass}" data-id="${tab.id}">
        <span class="tab-title" title="${tab.filename}">${tab.filename}</span>
        <button class="tab-close-btn" title="Close Tab (Alt+W)" data-id="${tab.id}">
          <svg class="tab-close-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
  });

  elements.tabsContainer.innerHTML = html;

  // Add click handlers
  const tabElements = elements.tabsContainer.querySelectorAll(".tab-item");
  tabElements.forEach(el => {
    el.addEventListener("click", (e) => {
      const tabId = el.getAttribute("data-id");
      if (e.target.closest(".tab-close-btn")) {
        e.stopPropagation();
        closeTab(tabId);
      } else {
        switchTab(tabId);
      }
    });

    // Double-click to rename tab
    const titleSpan = el.querySelector(".tab-title");
    titleSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      initiateTabRename(el, titleSpan);
    });
  });
}

function initiateTabRename(tabElement, titleSpan) {
  const tabId = tabElement.getAttribute("data-id");
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (tabElement.querySelector(".tab-rename-input")) return;

  const currentName = tab.filename;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tab-rename-input";
  input.value = currentName;

  titleSpan.replaceWith(input);
  input.focus();

  const lastDot = currentName.lastIndexOf(".");
  if (lastDot > 0) {
    input.setSelectionRange(0, lastDot);
  } else {
    input.select();
  }

  let finished = false;

  const finishRename = (cancel = false) => {
    if (finished) return;
    finished = true;

    if (!cancel) {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        tab.filename = newName;
        if (tabId === activeTabId) {
          currentFilename = newName;
          elements.currentFilenameBadge.textContent = newName;
        }
        showTemporaryStatus(`Renamed tab to "${newName}"`);
      }
    }

    renderTabs();
    saveStateToStorage();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishRename(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishRename(true);
    }
  });

  input.addEventListener("blur", () => {
    finishRename(false);
  });

  input.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  input.addEventListener("dblclick", (e) => {
    e.stopPropagation();
  });
}

// --- Line Numbers Rendering ---
function renderLineNumbers() {
  if (!lineNumbersEnabled) return;

  const text = elements.textarea.value;
  const lines = text.split("\n");
  const lineCount = lines.length;
  
  // Generate HTML for line numbers
  let html = "";
  for (let i = 1; i <= lineCount; i++) {
    html += `<div class="line-number" id="ln-${i}">${i}</div>`;
  }
  
  elements.lineNumbersContainer.innerHTML = html;
  highlightActiveLineNumber();
}

function highlightActiveLineNumber() {
  if (!lineNumbersEnabled) return;

  // Clear previous active line
  const activeLines = elements.lineNumbersContainer.querySelectorAll(".line-number.active");
  activeLines.forEach(el => el.classList.remove("active"));

  // Find active line based on cursor position
  const textUpToCursor = elements.textarea.value.substring(0, elements.textarea.selectionStart);
  const activeLineIdx = textUpToCursor.split("\n").length;
  
  const activeEl = document.getElementById(`ln-${activeLineIdx}`);
  if (activeEl) {
    activeEl.classList.add("active");
  }
}

// --- Cursor position indicator ---
function updateCursorPosition() {
  const tx = elements.textarea;
  const textUpToCursor = tx.value.substring(0, tx.selectionStart);
  const lines = textUpToCursor.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  
  elements.cursorPosLabel.textContent = `Ln ${line}, Col ${col}`;
}

// --- Theme Management ---
function toggleTheme() {
  activeTheme = activeTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", activeTheme);
  updateThemeIcons();
  saveStateToStorage();
  showTemporaryStatus(`Switched to ${activeTheme} theme`);
}

function updateThemeIcons() {
  if (activeTheme === "dark") {
    elements.themeSunIcon.classList.add("hide");
    elements.themeMoonIcon.classList.remove("hide");
  } else {
    elements.themeSunIcon.classList.remove("hide");
    elements.themeMoonIcon.classList.add("hide");
  }
}

// --- Word Wrap ---
function toggleWordWrap() {
  wordWrapEnabled = !wordWrapEnabled;
  updateWordWrapUI();
  saveStateToStorage();
  // Sync scrolling alignment
  elements.highlightLayer.scrollTop = elements.textarea.scrollTop;
  elements.highlightLayer.scrollLeft = elements.textarea.scrollLeft;
}

function updateWordWrapUI() {
  if (wordWrapEnabled) {
    elements.textarea.classList.remove("nowrap");
    elements.textarea.classList.add("wrap");
    elements.highlightLayer.classList.remove("nowrap");
    elements.highlightLayer.classList.add("wrap");
    elements.toggleWrapBtn.classList.add("active");
  } else {
    elements.textarea.classList.remove("wrap");
    elements.textarea.classList.add("nowrap");
    elements.highlightLayer.classList.remove("wrap");
    elements.highlightLayer.classList.add("nowrap");
    elements.toggleWrapBtn.classList.remove("active");
  }
}

// --- Line Numbers Toggle ---
function toggleLineNumbers() {
  lineNumbersEnabled = !lineNumbersEnabled;
  updateLineNumbersUI();
  saveStateToStorage();
}

function updateLineNumbersUI() {
  if (lineNumbersEnabled) {
    elements.editorOuterContainer.classList.add("show-lines");
    elements.toggleLinesBtn.classList.add("active");
    renderLineNumbers();
  } else {
    elements.editorOuterContainer.classList.remove("show-lines");
    elements.toggleLinesBtn.classList.remove("active");
    elements.lineNumbersContainer.innerHTML = "";
  }
}

// --- Zoom / Font Size Management ---
function adjustFontSize(delta) {
  const newSize = Math.max(10, Math.min(30, editorFontSize + delta));
  if (newSize !== editorFontSize) {
    editorFontSize = newSize;
    updateFontSizeUI();
    saveStateToStorage();
  }
}

function updateFontSizeUI() {
  elements.zoomLabel.textContent = `${Math.round((editorFontSize / 15) * 100)}%`;
  
  // Set custom style property for font sizes on elements
  elements.textarea.style.setProperty("--editor-font-size", `${editorFontSize}px`);
  elements.highlightLayer.style.setProperty("--editor-font-size", `${editorFontSize}px`);
  elements.lineNumbersContainer.style.setProperty("--editor-font-size", `${editorFontSize}px`);
}

// --- Status Message Helper ---
function showTemporaryStatus(message, duration = 3000) {
  elements.statusMessage.textContent = message;
  
  if (window.statusTimer) {
    clearTimeout(window.statusTimer);
  }
  
  window.statusTimer = setTimeout(() => {
    elements.statusMessage.textContent = "Ready";
  }, duration);
}

// --- Find & Replace Panel Toggle ---
function toggleFindPanel() {
  if (findPanelOpen) {
    closeFindPanel();
  } else {
    openFindPanel();
  }
}

// Open Find Panel
function openFindPanel() {
  findPanelOpen = true;
  elements.toggleFindBtn.classList.add("active");
  elements.editorOuterContainer.classList.add("find-open");
  elements.findReplacePanel.show(); // Show modeless dialog
  elements.findInput.focus();
  elements.findInput.select();
  performSearch(true, false);
}

function closeFindPanel() {
  elements.findReplacePanel.close();
}

// --- Search / Highlight Logic ---
function performSearch(resetIndex = true, shouldFocus = true) {
  const text = elements.textarea.value;
  matches = [];
  
  if (!searchQuery) {
    activeMatchIndex = -1;
    elements.matchStatusLabel.textContent = "No matches";
    syncEditor();
    return;
  }
  
  try {
    if (useRegex) {
      // Build regular expression safely
      let flags = "g";
      if (!matchCase) flags += "i";
      const regex = new RegExp(searchQuery, flags);
      
      let match;
      // Safety mechanism to avoid infinite loops with regexes matching empty strings
      let safetyCount = 0;
      while ((match = regex.exec(text)) !== null && safetyCount < 10000) {
        if (match[0].length === 0) {
          regex.lastIndex++; // Advance index if matching empty string
        } else {
          matches.push({
            index: match.index,
            length: match[0].length
          });
        }
        safetyCount++;
      }
    } else {
      // Literal Search
      const searchStr = matchCase ? searchQuery : searchQuery.toLowerCase();
      const sourceStr = matchCase ? text : text.toLowerCase();
      
      let index = sourceStr.indexOf(searchStr);
      let safetyCount = 0;
      while (index !== -1 && safetyCount < 10000) {
        matches.push({
          index: index,
          length: searchStr.length
        });
        index = sourceStr.indexOf(searchStr, index + searchStr.length);
        safetyCount++;
      }
    }
    
    // Status text formatting
    if (matches.length > 0) {
      if (resetIndex || activeMatchIndex >= matches.length || activeMatchIndex < 0) {
        // Find if cursor is already near a match and default to that one, otherwise index 0
        const cursorIdx = elements.textarea.selectionStart;
        const nearestIdx = matches.findIndex(m => m.index >= cursorIdx);
        activeMatchIndex = nearestIdx !== -1 ? nearestIdx : 0;
      }
      elements.matchStatusLabel.textContent = `${activeMatchIndex + 1} of ${matches.length}`;
      elements.findInput.classList.remove("error");
    } else {
      activeMatchIndex = -1;
      elements.matchStatusLabel.textContent = "No matches";
      elements.findInput.classList.remove("error");
    }
  } catch (err) {
    // Regex compile error
    activeMatchIndex = -1;
    elements.matchStatusLabel.textContent = "Invalid Regex";
    elements.findInput.classList.add("error");
  }
  
  syncEditor();
  
  // Highlight active match in textarea selection context if requested
  if (resetIndex && matches.length > 0 && shouldFocus) {
    scrollToActiveMatch();
  }
}

function renderSearchHighlights() {
  const text = elements.textarea.value;
  
  // Custom escape helper to avoid HTML injection
  const escapeHTML = (str) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  if (matches.length === 0) {
    elements.highlightLayer.textContent = text;
    return;
  }

  let resultHTML = "";
  let lastIdx = 0;

  matches.forEach((match, idx) => {
    // Add text preceding the match
    resultHTML += escapeHTML(text.substring(lastIdx, match.index));
    
    // Add wrapped match text
    const matchText = text.substring(match.index, match.index + match.length);
    const isActive = (idx === activeMatchIndex);
    const className = isActive ? "search-match active-match" : "search-match";
    
    resultHTML += `<mark class="${className}">${escapeHTML(matchText)}</mark>`;
    lastIdx = match.index + match.length;
  });

  // Append remaining text
  resultHTML += escapeHTML(text.substring(lastIdx));
  
  // Render in highlights container
  elements.highlightLayer.innerHTML = resultHTML;
}

function scrollToActiveMatch() {
  if (activeMatchIndex < 0 || activeMatchIndex >= matches.length) return;
  
  const activeMatch = matches[activeMatchIndex];
  
  // Select active match in textarea so user can start typing/replacing immediately
  elements.textarea.focus();
  elements.textarea.setSelectionRange(activeMatch.index, activeMatch.index + activeMatch.length);

  // Find highlighted mark element and scroll viewport to match
  setTimeout(() => {
    const activeEl = elements.highlightLayer.querySelector(".active-match");
    if (activeEl) {
      const offsetTop = activeEl.offsetTop;
      const offsetLeft = activeEl.offsetLeft;
      
      const vh = elements.textarea.clientHeight;
      const vw = elements.textarea.clientWidth;
      
      // Center scroll around active match
      elements.textarea.scrollTop = offsetTop - (vh / 2);
      elements.textarea.scrollLeft = offsetLeft - (vw / 2);
    }
  }, 10);
}

function navigateNextMatch() {
  if (matches.length === 0) return;
  activeMatchIndex = (activeMatchIndex + 1) % matches.length;
  elements.matchStatusLabel.textContent = `${activeMatchIndex + 1} of ${matches.length}`;
  syncEditor();
  scrollToActiveMatch();
}

function navigatePrevMatch() {
  if (matches.length === 0) return;
  activeMatchIndex = (activeMatchIndex - 1 + matches.length) % matches.length;
  elements.matchStatusLabel.textContent = `${activeMatchIndex + 1} of ${matches.length}`;
  syncEditor();
  scrollToActiveMatch();
}

// --- Replace Logic ---
function replaceCurrentMatch() {
  if (activeMatchIndex < 0 || activeMatchIndex >= matches.length) return;
  
  const text = elements.textarea.value;
  const match = matches[activeMatchIndex];
  const replaceStr = replaceQuery;
  
  // Perform replacement
  const newText = text.substring(0, match.index) + replaceStr + text.substring(match.index + match.length);
  elements.textarea.value = newText;
  isDirty = true;
  
  // Move selection cursor to end of replaced string
  const newCursorPos = match.index + replaceStr.length;
  elements.textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  showTemporaryStatus("Replaced 1 match");

  // Re-run search matching at current query
  performSearch(false, false);
  
  // If matches still exist, cycle/focus next one
  if (matches.length > 0) {
    if (activeMatchIndex >= matches.length) {
      activeMatchIndex = 0;
    }
    scrollToActiveMatch();
  }
}

function replaceAllMatches() {
  if (matches.length === 0) return;
  
  const text = elements.textarea.value;
  const replaceStr = replaceQuery;
  const count = matches.length;
  
  // Replace all matches from end-to-beginning to avoid shifting indices
  let newText = text;
  const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
  
  sortedMatches.forEach(m => {
    newText = newText.substring(0, m.index) + replaceStr + newText.substring(m.index + m.length);
  });
  
  elements.textarea.value = newText;
  isDirty = true;
  
  showTemporaryStatus(`Replaced all ${count} occurrences`);
  
  // Reset search state
  performSearch(true, false);
}

// --- File Operations ---

// 1. Open File
async function openFile() {
  const hasFileSystemAccess = "showOpenFilePicker" in window;
  
  if (hasFileSystemAccess) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: "Text Files",
          accept: {
            "text/plain": [".txt", ".js", ".css", ".html", ".md", ".json", ".py", ".rs", ".go", ".c", ".cpp", ".sh", ".yml", ".yaml"]
          }
        }]
      });
      
      const file = await handle.getFile();
      const text = await file.text();
      
      const activeTab = getActiveTab();
      // If current tab is clean & blank, open in-place. Otherwise open in a new tab.
      if (activeTab && elements.textarea.value === "" && !isDirty && activeTab.filename === "untitled.txt") {
        currentFileHandle = handle;
        currentFilename = file.name;
        elements.textarea.value = text;
        isDirty = false;
        
        elements.textarea.scrollTop = 0;
        elements.textarea.scrollLeft = 0;
        
        syncEditor();
        showTemporaryStatus(`Opened ${currentFilename}`);
      } else {
        createNewTab(file.name, text, handle, true);
        showTemporaryStatus(`Opened ${file.name} in new tab`);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        showTemporaryStatus("Failed to open file");
      }
    }
  } else {
    // Fallback trigger click
    elements.fallbackFileInput.click();
  }
}

// Fallback open parser
function handleFallbackFileOpen(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    const activeTab = getActiveTab();
    
    // If current tab is clean & blank, open in-place. Otherwise open in a new tab.
    if (activeTab && elements.textarea.value === "" && !isDirty && activeTab.filename === "untitled.txt") {
      elements.textarea.value = text;
      currentFilename = file.name;
      currentFileHandle = null; // No file handles in fallback
      isDirty = false;
      
      elements.textarea.scrollTop = 0;
      elements.textarea.scrollLeft = 0;
      
      syncEditor();
      showTemporaryStatus(`Opened ${currentFilename} (local load)`);
    } else {
      createNewTab(file.name, text, null, true);
      showTemporaryStatus(`Opened ${file.name} in new tab`);
    }
  };
  reader.onerror = function() {
    showTemporaryStatus("Failed to read file");
  };
  reader.readAsText(file);
}

// 2. Save File
async function saveFile() {
  const hasFileSystemAccess = "showSaveFilePicker" in window;
  
  if (hasFileSystemAccess) {
    if (currentFileHandle) {
      try {
        const writable = await currentFileHandle.createWritable();
        await writable.write(elements.textarea.value);
        await writable.close();
        
        isDirty = false;
        syncEditor();
        showTemporaryStatus(`Saved ${currentFilename}`);
      } catch (err) {
        console.error("Direct write failed, trying Save As...", err);
        await saveFileAs();
      }
    } else {
      await saveFileAs();
    }
  } else {
    // Fallback: trigger download link
    const text = elements.textarea.value;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    isDirty = false;
    syncEditor();
    showTemporaryStatus(`Downloaded ${currentFilename}`);
  }
}

async function saveFileAs() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: currentFilename,
      types: [{
        description: "Text Files",
        accept: {
          "text/plain": [".txt"]
        }
      }]
    });
    
    currentFileHandle = handle;
    const file = await handle.getFile();
    currentFilename = file.name;
    elements.currentFilenameBadge.textContent = currentFilename;
    
    const writable = await handle.createWritable();
    await writable.write(elements.textarea.value);
    await writable.close();
    
    isDirty = false;
    syncEditor();
    showTemporaryStatus(`Saved ${currentFilename}`);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      showTemporaryStatus("Failed to save file");
    }
  }
}

// --- SRE Utility Implementations ---

function closeSreToolsMenu() {
  const container = elements.sreToolsBtn.closest(".dropdown-container");
  if (container) container.classList.remove("active");
  elements.sreToolsMenu.classList.remove("show");
}

// 1. JSON Prettifier
function prettifyJSON() {
  const tx = elements.textarea;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const selectedText = tx.value.substring(start, end);
  
  if (start !== end && selectedText.trim().length > 0) {
    // Process selected text
    try {
      const parsed = JSON.parse(selectedText);
      const formatted = JSON.stringify(parsed, null, 2);
      tx.value = tx.value.substring(0, start) + formatted + tx.value.substring(end);
      tx.setSelectionRange(start, start + formatted.length);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Formatted selected JSON");
    } catch (e) {
      showTemporaryStatus("Error: Selected text is not valid JSON");
    }
  } else {
    // Process whole document
    if (tx.value.trim().length === 0) {
      showTemporaryStatus("Error: Document is empty");
      return;
    }
    try {
      const parsed = JSON.parse(tx.value);
      tx.value = JSON.stringify(parsed, null, 2);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Formatted JSON document");
    } catch (e) {
      showTemporaryStatus("Error: Document is not valid JSON");
    }
  }
}

// UTF-8 friendly Base64 helper methods
function utf8_to_b64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}

function b64_to_utf8(str) {
  return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

// 2. Base64 Decode
function base64Decode() {
  const tx = elements.textarea;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const selectedText = tx.value.substring(start, end);
  
  if (start !== end && selectedText.trim().length > 0) {
    try {
      const decoded = b64_to_utf8(selectedText.trim());
      tx.value = tx.value.substring(0, start) + decoded + tx.value.substring(end);
      tx.setSelectionRange(start, start + decoded.length);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Decoded selected Base64");
    } catch (e) {
      showTemporaryStatus("Error: Invalid Base64 selected");
    }
  } else {
    if (tx.value.trim().length === 0) {
      showTemporaryStatus("Error: Document is empty");
      return;
    }
    try {
      const decoded = b64_to_utf8(tx.value.trim());
      tx.value = decoded;
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Decoded Base64 document");
    } catch (e) {
      showTemporaryStatus("Error: Document is not valid Base64");
    }
  }
}

// 3. Base64 Encode
function base64Encode() {
  const tx = elements.textarea;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const selectedText = tx.value.substring(start, end);
  
  if (start !== end && selectedText.trim().length > 0) {
    try {
      const encoded = utf8_to_b64(selectedText);
      tx.value = tx.value.substring(0, start) + encoded + tx.value.substring(end);
      tx.setSelectionRange(start, start + encoded.length);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Encoded selected text to Base64");
    } catch (e) {
      showTemporaryStatus("Error during encoding");
    }
  } else {
    if (tx.value.length === 0) {
      showTemporaryStatus("Error: Document is empty");
      return;
    }
    try {
      const encoded = utf8_to_b64(tx.value);
      tx.value = encoded;
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Encoded document to Base64");
    } catch (e) {
      showTemporaryStatus("Error during encoding");
    }
  }
}

// UTF-8 friendly Hex helper methods
function stringToHex(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToString(hex) {
  const cleanHex = hex.replace(/0x/gi, '').replace(/[^0-9A-Fa-f]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return decoder.decode(bytes);
}

// 4. Hex Decode
function hexDecode() {
  const tx = elements.textarea;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const selectedText = tx.value.substring(start, end);
  
  if (start !== end && selectedText.trim().length > 0) {
    try {
      const decoded = hexToString(selectedText);
      tx.value = tx.value.substring(0, start) + decoded + tx.value.substring(end);
      tx.setSelectionRange(start, start + decoded.length);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Decoded selected Hex");
    } catch (e) {
      showTemporaryStatus("Error: Invalid Hex selected");
    }
  } else {
    if (tx.value.trim().length === 0) {
      showTemporaryStatus("Error: Document is empty");
      return;
    }
    try {
      const decoded = hexToString(tx.value);
      tx.value = decoded;
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Decoded Hex document");
    } catch (e) {
      showTemporaryStatus("Error: Document is not valid Hex");
    }
  }
}

// 5. Hex Encode
function hexEncode() {
  const tx = elements.textarea;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const selectedText = tx.value.substring(start, end);
  
  if (start !== end && selectedText.trim().length > 0) {
    try {
      const encoded = stringToHex(selectedText);
      tx.value = tx.value.substring(0, start) + encoded + tx.value.substring(end);
      tx.setSelectionRange(start, start + encoded.length);
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Encoded selected text to Hex");
    } catch (e) {
      showTemporaryStatus("Error during encoding");
    }
  } else {
    if (tx.value.length === 0) {
      showTemporaryStatus("Error: Document is empty");
      return;
    }
    try {
      const encoded = stringToHex(tx.value);
      tx.value = encoded;
      isDirty = true;
      syncEditor();
      showTemporaryStatus("Encoded document to Hex");
    } catch (e) {
      showTemporaryStatus("Error during encoding");
    }
  }
}

// Helper to get selected text or word under cursor
function getSelectionOrWordUnderCursor() {
  const tx = elements.textarea;
  let start = tx.selectionStart;
  let end = tx.selectionEnd;
  
  if (start === end) {
    const text = tx.value;
    // Expand selection to word boundaries (not whitespace, commas, brackets, etc.)
    while (start > 0 && /[^ \t\n\r,;()[\]{}"']/.test(text[start - 1])) start--;
    while (end < text.length && /[^ \t\n\r,;()[\]{}"']/.test(text[end])) end++;
    
    // Select it visually for feedback
    tx.setSelectionRange(start, end);
  }
  
  return {
    start,
    end,
    text: tx.value.substring(start, end).trim()
  };
}

// 4. Epoch ➔ ISO Date
function convertEpochToDate() {
  const tx = elements.textarea;
  const { start, end, text } = getSelectionOrWordUnderCursor();
  
  if (!text) {
    showTemporaryStatus("Error: No text selected/found under cursor");
    return;
  }
  
  // Clean text of common suffixes (e.g. L or ms)
  const cleanText = text.replace(/[Lms]$/i, "");
  const num = Number(cleanText);
  
  if (isNaN(num) || num <= 0) {
    showTemporaryStatus("Error: Not a valid numeric timestamp");
    return;
  }
  
  // Heuristic: seconds vs milliseconds
  const isSeconds = num < 5000000000;
  const dateVal = num * (isSeconds ? 1000 : 1);
  
  try {
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) {
      showTemporaryStatus("Error: Invalid date value");
      return;
    }
    
    const isoStr = date.toISOString();
    tx.value = tx.value.substring(0, start) + isoStr + tx.value.substring(end);
    tx.setSelectionRange(start, start + isoStr.length);
    isDirty = true;
    syncEditor();
    showTemporaryStatus(`Converted Timestamp ➔ ${isoStr}`);
  } catch (e) {
    showTemporaryStatus("Error converting timestamp");
  }
}

// 5. Date ➔ Epoch Seconds
function convertDateToEpoch() {
  const tx = elements.textarea;
  const { start, end, text } = getSelectionOrWordUnderCursor();
  
  if (!text) {
    showTemporaryStatus("Error: No text selected/found under cursor");
    return;
  }
  
  try {
    const parsedTime = Date.parse(text);
    if (isNaN(parsedTime)) {
      showTemporaryStatus("Error: Not a valid date string");
      return;
    }
    
    const epochSecs = Math.floor(parsedTime / 1000).toString();
    tx.value = tx.value.substring(0, start) + epochSecs + tx.value.substring(end);
    tx.setSelectionRange(start, start + epochSecs.length);
    isDirty = true;
    syncEditor();
    showTemporaryStatus(`Converted Date ➔ ${epochSecs} epoch seconds`);
  } catch (e) {
    showTemporaryStatus("Error converting date");
  }
}
