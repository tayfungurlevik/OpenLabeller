# OpenLabeller

An open-source, [labelme](https://github.com/wkentaro/labelme)-inspired labeling tool that isn't limited to images: **OpenLabeller** also supports **text classification** and **audio classification** labeling, all in a single desktop app with a modern interface.

Built as an **Electron + React + TypeScript** desktop app backed by a local **Python (FastAPI)** service that handles all file I/O and annotation logic.

## Features

- **Image labeling** — rectangles, polygons, circles, lines, and points on a [Konva](https://konvajs.org/)-based canvas, with zoom/pan, undo/redo, and a labelme-compatible JSON format. Export to COCO, YOLO, or Pascal VOC.
- **Text classification** — label a folder of `.txt` files or a `.csv`/`.jsonl` file, single- or multi-label, with keyboard shortcuts and CSV/JSONL export.
- **Audio classification** — waveform view, HTML5 audio playback, single- or multi-label tagging, CSV/JSONL export.
- Shared project model, label-class management with auto-assigned colors and 1–9 keyboard shortcuts, and autosave.

## Architecture

```
OpenLabeller/
├── backend/     Python (FastAPI) service: project/label/annotation logic, served over a local REST API
└── frontend/    Electron + React + TypeScript + Vite + Tailwind desktop UI
```

The Electron main process starts the Python backend as a local child process (`http://127.0.0.1:8756`) and talks to it over HTTP from the renderer. Folder selection goes through Electron's native dialog via IPC, since a browser can't resolve real filesystem paths.

## Development setup

Requires Python 3.10+ and Node.js 20+.

```powershell
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

`npm run dev` starts Vite and launches Electron, which in turn spawns the backend automatically (pointing at `backend/.venv`) and waits for it to become healthy before loading the app.

## Usage

The app opens to a launcher where you pick a task type (Image / Text / Audio) and a data folder to create or open a project — the same project folder layout as before (an `openlabeller_project.json` plus per-item annotation files, so existing projects and labelme-format image annotations carry over unchanged).

- **Image**: pick a tool from the toolbar (Select/Edit, Rectangle, Polygon, Circle, Line, Point), draw, then choose or type a label. `Ctrl+S` saves, `Ctrl+Z`/`Ctrl+Y` undo/redo, `Delete` removes the selected shape, `Ctrl+Left`/`Ctrl+Right` change images. Use the Export menu for COCO/YOLO/Pascal VOC.
- **Text**: label items with the sidebar buttons or their number-key shortcuts; single-label mode auto-advances. Export to CSV/JSONL.
- **Audio**: click the waveform to seek, `Space` to play/pause, label the same way as text.

## Building a standalone Windows app

```powershell
python scripts/build_windows_exe.py --electron
```

This freezes the FastAPI backend with PyInstaller, bundles it into the Electron app as an extra resource, and runs `electron-builder` to produce a Windows installer under `frontend/release/`.

## Testing

```powershell
# Backend unit/API tests
cd backend && pytest

# Frontend type-check
cd frontend && npx tsc -b

# End-to-end (launches the real built app and drives it with real mouse events)
cd frontend && npm run build && npm run test:e2e
```

## License

MIT — see [LICENSE](LICENSE).
