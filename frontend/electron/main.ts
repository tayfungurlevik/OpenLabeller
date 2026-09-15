import { type ChildProcess, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserWindow as BrowserWindowType } from 'electron'

// Electron's main-process ESM bindings for the 'electron' module are
// incomplete in some versions (e.g. ipcMain ends up undefined), so we go
// through the classic CJS require, which reliably returns the full API.
const require = createRequire(import.meta.url)
const { app, BrowserWindow, dialog, ipcMain } = require('electron')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BACKEND_PORT = Number(process.env.OPENLABELLER_PORT ?? 8756)
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`

let backendProcess: ChildProcess | null = null
let mainWindow: BrowserWindowType | null = null

function resolveBackendCommand(): { command: string; args: string[]; cwd?: string } {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, 'backend', 'openlabeller-server.exe')
    return { command: exePath, args: ['--port', String(BACKEND_PORT)] }
  }
  const repoRoot = path.resolve(__dirname, '..', '..')
  const backendDir = path.join(repoRoot, 'backend')
  const pythonPath = path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  return {
    command: pythonPath,
    args: ['-m', 'openlabeller', '--port', String(BACKEND_PORT)],
    cwd: backendDir,
  }
}

function startBackend(): void {
  const { command, args, cwd } = resolveBackendCommand()
  backendProcess = spawn(command, args, { cwd, stdio: 'inherit' })
  backendProcess.on('error', (err) => {
    console.error('Failed to start OpenLabeller backend:', err)
  })
}

async function waitForBackend(timeoutMs = 20000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`)
      if (res.ok) return
    } catch {
      // backend not ready yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('OpenLabeller backend did not become ready in time')
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenLabeller',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow = win

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    win.loadURL(devServerUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('pick-folder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('get-backend-url', () => BACKEND_URL)

app.whenReady().then(async () => {
  startBackend()
  try {
    await waitForBackend()
  } catch (err) {
    console.error(err)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
})
