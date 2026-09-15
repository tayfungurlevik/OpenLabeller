import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

const __dirname = import.meta.dirname
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PYTHON = path.join(REPO_ROOT, 'backend', '.venv', 'Scripts', 'python.exe')
const MAIN_JS = path.join(__dirname, '..', 'dist-electron', 'main.js')

test('drawing a rectangle with real mouse events saves it to the annotation file', async () => {
  test.setTimeout(60000)

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabeller-e2e-'))
  const imagePath = path.join(dataDir, 'sample.png')
  execFileSync(PYTHON, [
    '-c',
    `from PIL import Image; Image.new("RGB", (300, 200), (10, 20, 30)).save(r"${imagePath}")`,
  ])

  const app = await electron.launch({
    args: [MAIN_JS],
    env: { ...process.env, OPENLABELLER_PORT: '8799' },
  })
  app.process().stdout?.on('data', (d) => console.log('[app stdout]', d.toString()))
  app.process().stderr?.on('data', (d) => console.log('[app stderr]', d.toString()))
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // The native folder-picker dialog can't be driven by Playwright, and the
  // contextBridge-exposed window.api is deep-frozen so it can't be stubbed
  // from the renderer either. Instead, override dialog.showOpenDialog in the
  // real Electron main process, which our IPC handler actually calls.
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog
  }, dataDir)

  await window.getByText('Image labeling').click()
  await window.getByText('Browse...').click()
  await window.getByRole('button', { name: 'Open / Create Project' }).click()

  await window.waitForSelector('[data-testid="tool-rectangle"]')
  await window.click('[data-testid="tool-rectangle"]')

  const canvas = window.locator('[data-testid="image-canvas-container"]')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas container has no bounding box')

  const startX = box.x + box.width * 0.3
  const startY = box.y + box.height * 0.3
  const endX = box.x + box.width * 0.6
  const endY = box.y + box.height * 0.6

  // A genuine mouse-driven drag: down, move in steps, then up -- this is the
  // exact interaction the user reported as broken in the previous Qt app.
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 5 })
  await window.mouse.move(endX, endY, { steps: 5 })
  await window.mouse.up()

  await window.waitForSelector('[data-testid="confirm-label"]')
  await window.fill('input[list="image-label-options"]', 'cat')
  await window.click('[data-testid="confirm-label"]')

  await window.click('[data-testid="save-button"]')

  const annotationPath = path.join(dataDir, 'sample.json')
  await expect.poll(() => fs.existsSync(annotationPath), { timeout: 8000 }).toBe(true)

  const data = JSON.parse(fs.readFileSync(annotationPath, 'utf-8'))
  expect(data.shapes).toHaveLength(1)
  expect(data.shapes[0].shape_type).toBe('rectangle')
  expect(data.shapes[0].label).toBe('cat')

  const [p0, p1] = data.shapes[0].points
  expect(Math.abs(p1[0] - p0[0])).toBeGreaterThan(10)
  expect(Math.abs(p1[1] - p0[1])).toBeGreaterThan(10)

  await app.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})
