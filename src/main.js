// Antigravity Notepad - Core Application Logic

// --- Application State ---
let currentFileHandle = null;
let currentFilename = "untitled.txt";
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
  fallbackFileInput: document.getElementById("fallback-file-input")
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

  // File Name
  currentFilename = localStorage.getItem("notepad_filename") || "untitled.txt";
  elements.currentFilenameBadge.textContent = currentFilename;

  // Text Content
  elements.textarea.value = localStorage.getItem("notepad_text") || "";
  
  // Find Panel Inputs
  searchQuery = localStorage.getItem("notepad_find_query") || "";
  elements.findInput.value = searchQuery;
  replaceQuery = localStorage.getItem("notepad_replace_query") || "";
  elements.replaceInput.value = replaceQuery;
  
  matchCase = localStorage.getItem("notepad_match_case") === "true";
  if (matchCase) elements.matchCaseBtn.classList.add("active");
  
  useRegex = localStorage.getItem("notepad_use_regex") === "true";
  if (useRegex) elements.regexBtn.classList.add("active");
}

function saveStateToStorage() {
  localStorage.setItem("notepad_text", elements.textarea.value);
  localStorage.setItem("notepad_filename", currentFilename);
  localStorage.setItem("notepad_theme", activeTheme);
  localStorage.setItem("notepad_wrap", wordWrapEnabled.toString());
  localStorage.setItem("notepad_lines", lineNumbersEnabled.toString());
  localStorage.setItem("notepad_font_size", editorFontSize.toString());
  
  // Search parameters
  localStorage.setItem("notepad_find_query", searchQuery);
  localStorage.setItem("notepad_replace_query", replaceQuery);
  localStorage.setItem("notepad_match_case", matchCase.toString());
  localStorage.setItem("notepad_use_regex", useRegex.toString());
  
  // Scroll and Cursor Positions
  localStorage.setItem("notepad_cursor_start", elements.textarea.selectionStart.toString());
  localStorage.setItem("notepad_cursor_end", elements.textarea.selectionEnd.toString());
  localStorage.setItem("notepad_scroll_top", elements.textarea.scrollTop.toString());
  localStorage.setItem("notepad_scroll_left", elements.textarea.scrollLeft.toString());
}

function restoreEditorScrollAndCursor() {
  const start = parseInt(localStorage.getItem("notepad_cursor_start") || "0", 10);
  const end = parseInt(localStorage.getItem("notepad_cursor_end") || "0", 10);
  const scrollTop = parseInt(localStorage.getItem("notepad_scroll_top") || "0", 10);
  const scrollLeft = parseInt(localStorage.getItem("notepad_scroll_left") || "0", 10);

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
      performSearch(false); // Refilter highlights without shifting index
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
    // New: Alt+N
    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      newFile();
    }
    // Find: Alt+F
    if (e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleFindPanel();
    }
  });

  // Toolbar Actions
  elements.newFileBtn.addEventListener("click", newFile);
  elements.openFileBtn.addEventListener("click", openFile);
  elements.saveFileBtn.addEventListener("click", saveFile);
  elements.toggleFindBtn.addEventListener("click", toggleFindPanel);
  elements.toggleWrapBtn.addEventListener("click", toggleWordWrap);
  elements.toggleLinesBtn.addEventListener("click", toggleLineNumbers);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);

  // Fallback file input
  elements.fallbackFileInput.addEventListener("change", handleFallbackFileOpen);

  // Find & Replace Inputs & Controls
  elements.findInput.addEventListener("input", () => {
    searchQuery = elements.findInput.value;
    performSearch(true); // Reset to index 0 on search term changes
  });

  elements.replaceInput.addEventListener("input", () => {
    replaceQuery = elements.replaceInput.value;
    saveStateToStorage();
  });

  elements.matchCaseBtn.addEventListener("click", () => {
    matchCase = !matchCase;
    elements.matchCaseBtn.classList.toggle("active", matchCase);
    performSearch(true);
  });

  elements.regexBtn.addEventListener("click", () => {
    useRegex = !useRegex;
    elements.regexBtn.classList.toggle("active", useRegex);
    performSearch(true);
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

  // Close Find Panel
  elements.findReplacePanel.addEventListener("close", () => {
    findPanelOpen = false;
    elements.toggleFindBtn.classList.remove("active");
    elements.textarea.classList.remove("searching");
    elements.textarea.focus();
    saveStateToStorage();
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
  
  // Word & Character count
  const charCount = text.length;
  // Count words (matching letters/numbers)
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
    elements.highlightLayer.textContent = text;
  }

  updateCursorPosition();
  highlightActiveLineNumber();
  saveStateToStorage();
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
  elements.highlightLayer.setProperty = elements.highlightLayer.style.setProperty("--editor-font-size", `${editorFontSize}px`);
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

function openFindPanel() {
  findPanelOpen = true;
  elements.toggleFindBtn.classList.add("active");
  elements.findReplacePanel.show(); // Show modeless dialog
  elements.findInput.focus();
  elements.findInput.select();
  performSearch(true);
}

function closeFindPanel() {
  elements.findReplacePanel.close();
}

// --- Search / Highlight Logic ---
function performSearch(resetIndex = true) {
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
  if (resetIndex && matches.length > 0) {
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
  performSearch(false);
  
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
  performSearch(true);
}

// --- File Operations ---

// 1. New File
function newFile() {
  if (isDirty) {
    const confirmDiscard = confirm("You have unsaved changes. Do you want to discard them?");
    if (!confirmDiscard) return;
  }
  
  elements.textarea.value = "";
  currentFilename = "untitled.txt";
  currentFileHandle = null;
  elements.currentFilenameBadge.textContent = currentFilename;
  isDirty = false;
  
  // Reset scroll and selections
  elements.textarea.scrollTop = 0;
  elements.textarea.scrollLeft = 0;
  elements.textarea.setSelectionRange(0, 0);

  syncEditor();
  showTemporaryStatus("Created new file");
}

// 2. Open File
async function openFile() {
  if (isDirty) {
    const confirmDiscard = confirm("You have unsaved changes. Do you want to discard them?");
    if (!confirmDiscard) return;
  }

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
      
      currentFileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      
      elements.textarea.value = text;
      currentFilename = file.name;
      elements.currentFilenameBadge.textContent = currentFilename;
      isDirty = false;
      
      // Reset scroll
      elements.textarea.scrollTop = 0;
      elements.textarea.scrollLeft = 0;
      
      syncEditor();
      showTemporaryStatus(`Opened ${currentFilename}`);
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
    elements.textarea.value = evt.target.result;
    currentFilename = file.name;
    elements.currentFilenameBadge.textContent = currentFilename;
    currentFileHandle = null; // No file handles in fallback
    isDirty = false;
    
    elements.textarea.scrollTop = 0;
    elements.textarea.scrollLeft = 0;
    
    syncEditor();
    showTemporaryStatus(`Opened ${currentFilename} (local load)`);
  };
  reader.onerror = function() {
    showTemporaryStatus("Failed to read file");
  };
  reader.readAsText(file);
}

// 3. Save File
async function saveFile() {
  const hasFileSystemAccess = "showSaveFilePicker" in window;
  
  if (hasFileSystemAccess) {
    if (currentFileHandle) {
      try {
        const writable = await currentFileHandle.createWritable();
        await writable.write(elements.textarea.value);
        await writable.close();
        
        isDirty = false;
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
    showTemporaryStatus(`Saved ${currentFilename}`);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      showTemporaryStatus("Failed to save file");
    }
  }
}
