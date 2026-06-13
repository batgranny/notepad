# SRE Notepad

A modern, high-performance, and visually stunning browser-based notepad application. Built with **Vite + Vanilla JavaScript** and served via **Nginx** inside a lightweight Docker container, it offers a premium desktop-class text editing experience directly in the browser.

![Notepad Preview](https://raw.githubusercontent.com/batgranny/notepad/main/public/favicon.svg)

## Features

- 🎨 **Premium Aesthetic**: Sleek dark and light modes with smooth transitions and glassmorphic overlay dialogs.
- 🔍 **Advanced Find & Replace**:
  - Full-text search with highlighting on the page.
  - Case-sensitivity toggle.
  - **Regular Expression (Regex)** support with live compilation validation.
  - Match cycling ("X of Y matches") with auto-scrolling to active matches.
  - Single replace and global replace-all.
- 📑 **Line Numbers**: Optional side gutter numbers that dynamically highlight the active line.
- 🔀 **Word Wrap Toggle**: Switch between wrapped paragraphs and long-scrolling code-friendly lines.
- 💾 **Local File Operations**:
  - Native **File System Access API** integration (allows direct saving/updating to disk in supported browsers).
  - Robust traditional download/input fallbacks for older/mobile browsers.
- ⏱️ **Instant Session Recovery**: Automatically persists text content, cursor position, scroll offsets, find panel inputs, and setting preferences in `localStorage`.
- 📊 **Live Stats**: Real-time word and character counts in the header.
- 🔍 **Editor Zoom**: Simple footer font-size adjustments.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + N` | Create New Document |
| `Alt + O` | Open Local File |
| `Alt + S` | Save File (Saves directly if opened from disk) |
| `Alt + F` | Toggle Find & Replace Panel |
| `Enter` (inside Search) | Move to Next Match |
| `Shift + Enter` (inside Search) | Move to Previous Match |
| `Escape` (inside Search) | Close Find Panel |

## Local Development

Ensure you have [Node.js](https://nodejs.org/) installed, then follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/batgranny/notepad.git
   cd notepad
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Build the production bundle**:
   ```bash
   npm run build
   ```
   The compiled assets will be outputted to the `dist/` directory.

## Docker Deployment

To build and run the application locally inside a container:

1. **Build the image**:
   ```bash
   docker compose build
   ```

2. **Start the container**:
   ```bash
   docker compose up -d
   ```

3. **Access the application**:
   Open `http://localhost:8085` in your web browser.

4. **Stop the container**:
   ```bash
   docker compose down
   ```

## Technical Architecture

The application is structured for maximum performance and a lightweight footprint:

- **Dual-Layer Editor Viewport**: To achieve search result highlighting without using heavy external rendering engines, a transparent, high-performance `<textarea>` is overlaid precisely on top of a customized HTML highlight layer. Carets, selections, and scrolling are native, while the background layer provides pixel-perfect highlights.
- **Unified Event Registry**: Syncs scroll positions, input changes, and line numbers dynamically on keyboard and mouse events.
- **XSS Protection**: Dynamic HTML generation escapes all input values before placing them in the highlight layer, preventing malicious script executions.
- **Responsive Layout**: Designed using modern CSS grids, flexbox, and HSL custom variables for full screen-size responsiveness.

## License

This project is open-source and available under the [MIT License](LICENSE).
