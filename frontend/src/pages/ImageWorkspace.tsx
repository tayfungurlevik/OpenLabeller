import {
  Check,
  ChevronDown,
  Circle,
  Dot,
  MousePointer2,
  Pentagon,
  Settings as SettingsIcon,
  Slash,
  Square,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Project, ShapeData, WorkspaceProps } from '../api/types'
import ImageCanvas, { type ImageCanvasHandle, type Tool } from '../components/ImageCanvas'
import NavBar from '../components/NavBar'
import SettingsPanel from '../components/SettingsPanel'
import { useSettings } from '../hooks/useSettings'

const TOOLS: { key: Tool; label: string; icon: LucideIcon }[] = [
  { key: 'select', label: 'Select', icon: MousePointer2 },
  { key: 'rectangle', label: 'Rectangle', icon: Square },
  { key: 'polygon', label: 'Polygon', icon: Pentagon },
  { key: 'circle', label: 'Circle', icon: Circle },
  { key: 'line', label: 'Line', icon: Slash },
  { key: 'point', label: 'Point', icon: Dot },
]

export default function ImageWorkspace({ project: initialProject, onBack }: WorkspaceProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [files, setFiles] = useState<{ name: string; labeled: boolean }[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [shapes, setShapes] = useState<ShapeData[]>([])
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [tool, setTool] = useState<Tool>('select')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingShape, setPendingShape] = useState<ShapeData | null>(null)
  const [pendingLabelText, setPendingLabelText] = useState('')
  const [newLabelClassName, setNewLabelClassName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const { settings } = useSettings()

  const historyRef = useRef<ShapeData[][]>([])
  const historyIndexRef = useRef(-1)
  const canvasRef = useRef<ImageCanvasHandle>(null)
  const filesRef = useRef(files)
  const currentIndexRef = useRef(currentIndex)
  const shapesRef = useRef(shapes)
  filesRef.current = files
  currentIndexRef.current = currentIndex
  shapesRef.current = shapes

  const dir = project.output_dir
  const currentFile = currentIndex >= 0 ? files[currentIndex] : null

  useEffect(() => {
    api.listImages(dir).then(setFiles)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir])

  useEffect(() => {
    if (files.length > 0 && currentIndex === -1) {
      void goToIndex(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  async function goToIndex(index: number) {
    const list = filesRef.current
    if (index < 0 || index >= list.length) return
    const prevFile = currentIndexRef.current >= 0 ? list[currentIndexRef.current] : null
    if (prevFile) {
      await api.saveImageAnnotation(dir, prevFile.name, shapesRef.current)
    }
    const file = list[index]
    const ann = await api.getImageAnnotation(dir, file.name)
    setCurrentIndex(index)
    setShapes(ann.shapes)
    setImageSize({ width: ann.width, height: ann.height })
    setSelectedIndex(null)
    historyRef.current = [ann.shapes]
    historyIndexRef.current = 0
    const [updatedFiles, updatedProject] = await Promise.all([api.listImages(dir), api.getProject(dir)])
    setFiles(updatedFiles)
    setProject(updatedProject)
  }

  function pushHistory(next: ShapeData[]) {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(next)
    historyIndexRef.current = historyRef.current.length - 1
  }

  function commitShapes(next: ShapeData[]) {
    setShapes(next)
    pushHistory(next)
  }

  function handleShapeFinished(draft: ShapeData) {
    setPendingShape(draft)
    // Start empty rather than pre-filled with an existing label: the native
    // <datalist> dropdown filters its options by the current input text, so
    // pre-filling it (e.g. with the first label) hid every other label --
    // including ones just added -- until the field was manually cleared.
    setPendingLabelText('')
  }

  async function confirmPendingShape() {
    const label = pendingLabelText.trim()
    if (!pendingShape || !label) return
    let proj = project
    if (!proj.labels.some((l) => l.name === label)) {
      proj = await api.addLabel(dir, label)
      setProject(proj)
    }
    commitShapes([...shapesRef.current, { ...pendingShape, label }])
    setPendingShape(null)
    setTool('select')
  }

  function cancelPendingShape() {
    setPendingShape(null)
  }

  function handleShapeEdited(index: number, points: [number, number][]) {
    commitShapes(shapesRef.current.map((s, i) => (i === index ? { ...s, points } : s)))
  }

  function handleShapeDelete(index: number) {
    commitShapes(shapesRef.current.filter((_, i) => i !== index))
    setSelectedIndex(null)
  }

  function undo() {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1
      setShapes(historyRef.current[historyIndexRef.current])
    }
  }

  function redo() {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1
      setShapes(historyRef.current[historyIndexRef.current])
    }
  }

  async function saveCurrent() {
    if (!currentFile) return
    await api.saveImageAnnotation(dir, currentFile.name, shapesRef.current)
    setFiles(await api.listImages(dir))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (typing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveCurrent()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile])

  async function handleAddLabelClass() {
    const name = newLabelClassName.trim()
    if (!name || project.labels.some((l) => l.name === name)) return
    setProject(await api.addLabel(dir, name))
    setNewLabelClassName('')
  }

  async function handleRemoveLabelClass(name: string) {
    setProject(await api.removeLabel(dir, name))
  }

  async function handleExport(format: 'coco' | 'yolo' | 'voc') {
    const folder = await window.api.pickFolder()
    if (!folder) return
    const path = format === 'coco' ? `${folder}\\coco_annotations.json` : folder
    await api.exportImage(format, dir, path)
  }

  const labelColors = Object.fromEntries(project.labels.map((l) => [l.name, l.color]))

  return (
    <div className="flex h-screen flex-col bg-app text-ink-1">
      <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-surface-1 px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
        >
          ← Projects
        </button>
        <div className="mx-1.5 h-5 w-px bg-line-2" />
        <span className="text-[13.5px] font-semibold">{project.name}</span>
        <div className="mx-2.5 h-5 w-px bg-line-2" />
        <div className="flex gap-0.5 rounded-[10px] bg-surface-2 p-[3px]">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.label}
              data-testid={`tool-${t.key}`}
              onClick={() => setTool(t.key)}
              className={`flex h-[30px] w-[34px] items-center justify-center rounded-lg transition-colors ${
                tool === t.key ? 'bg-accent text-app' : 'text-ink-2 hover:bg-white/8 hover:text-ink-1'
              }`}
            >
              <t.icon size={16} strokeWidth={1.8} />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomOut()}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-white/8 hover:text-ink-1"
        >
          <ZoomOut size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomIn()}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-white/8 hover:text-ink-1"
        >
          <ZoomIn size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.fitToWindow()}
          className="ml-0.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/8 hover:text-ink-1"
        >
          Fit
        </button>
        <div className="mx-2.5 h-5 w-px bg-line-2" />
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          title="Labeling settings"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-white/8 hover:text-ink-1"
        >
          <SettingsIcon size={16} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          data-testid="save-button"
          onClick={() => void saveCurrent()}
          className="ml-2 flex h-[30px] items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-app shadow-[0_4px_16px_rgba(124,108,255,.35)] transition-colors hover:bg-accent-hover"
        >
          <Check size={13} strokeWidth={2.4} />
          Save
        </button>
        <div className="relative ml-1.5 group">
          <button
            type="button"
            className="flex h-[30px] items-center gap-1.5 rounded-lg border border-line-2 px-3 text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
          >
            Export
            <ChevronDown size={13} strokeWidth={1.9} />
          </button>
          <div className="absolute right-0 z-10 hidden w-48 flex-col rounded-lg border border-line-2 bg-surface-2 py-1 shadow-2xl group-hover:flex">
            <button
              type="button"
              onClick={() => handleExport('coco')}
              className="px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
            >
              Export as COCO JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('yolo')}
              className="px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
            >
              Export as YOLO
            </button>
            <button
              type="button"
              onClick={() => handleExport('voc')}
              className="px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
            >
              Export as Pascal VOC
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-60 shrink-0 overflow-y-auto border-r border-line bg-surface-1 p-2.5">
          <h3 className="px-2 pb-2.5 font-mono text-[11px] tracking-[.08em] text-ink-3">
            IMAGES &middot; {files.length}
          </h3>
          <div className="flex flex-col gap-0.5">
            {files.map((f, i) => (
              <button
                key={f.name}
                type="button"
                onClick={() => void goToIndex(i)}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors hover:bg-white/5 ${
                  i === currentIndex ? 'bg-accent-soft font-semibold text-ink-1' : 'text-ink-2'
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-[5px]"
                  style={{ background: 'linear-gradient(135deg, #3a4a63, #23303f)' }}
                />
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={f.labeled ? { background: 'var(--color-accent)' } : { border: '1.4px solid #4A4856' }}
                />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          {currentFile && imageSize.width > 0 ? (
            <ImageCanvas
              ref={canvasRef}
              imageUrl={api.imageFileUrl(dir, currentFile.name)}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              shapes={shapes}
              tool={tool}
              selectedIndex={selectedIndex}
              labelColors={labelColors}
              settings={settings}
              onSelectIndex={setSelectedIndex}
              onShapeFinished={handleShapeFinished}
              onShapeEdited={handleShapeEdited}
              onShapeDelete={handleShapeDelete}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#0e0e14] text-ink-3">
              {files.length === 0 ? 'No images found in this folder' : 'Loading...'}
            </div>
          )}

          {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

          {pendingShape && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-80 rounded-2xl border border-line-2 bg-surface-2 p-5 shadow-2xl">
                <h3 className="text-[13.5px] font-semibold text-ink-1">Choose a label</h3>
                <input
                  autoFocus
                  list="image-label-options"
                  value={pendingLabelText}
                  onChange={(e) => setPendingLabelText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmPendingShape()}
                  className="mt-3 w-full rounded-lg border border-line-2 bg-surface-1 px-3 py-2 text-sm text-ink-1"
                />
                <datalist id="image-label-options">
                  {project.labels.map((l) => (
                    <option key={l.name} value={l.name} />
                  ))}
                </datalist>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelPendingShape}
                    className="rounded-lg px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-label"
                    onClick={confirmPendingShape}
                    className="rounded-lg bg-accent px-4 py-1.5 text-[13px] font-semibold text-app transition-colors hover:bg-accent-hover"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface-1 p-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink-1">Labels</h3>
            <div className="mt-2.5 flex gap-2">
              <input
                value={newLabelClassName}
                onChange={(e) => setNewLabelClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLabelClass()}
                placeholder="New label name"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13.5px] text-ink-1 placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={handleAddLabelClass}
                className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
              >
                Add
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              {project.labels.map((l) => (
                <div key={l.name} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px]">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-ink-1">{l.name}</span>
                    {l.shortcut && (
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
                        {l.shortcut}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLabelClass(l.name)}
                    className="text-ink-3 transition-colors hover:text-[#FF6B5C]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-line" />

          <div>
            <h3 className="text-[13.5px] font-semibold text-ink-1">Shapes in this image</h3>
            <div className="mt-2.5 flex flex-col gap-0.5">
              {shapes.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-white/5 ${
                    selectedIndex === i ? 'bg-accent-soft text-ink-1' : 'text-ink-2'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: labelColors[s.label] ?? '#888' }}
                  />
                  {s.label} ({s.shape_type})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <NavBar
        onPrev={() => void goToIndex(currentIndex - 1)}
        onNext={() => void goToIndex(currentIndex + 1)}
        canPrev={currentIndex > 0}
        canNext={currentIndex < files.length - 1}
        progressText={`${currentIndex + 1} / ${files.length}   (labeled: ${files.filter((f) => f.labeled).length})`}
      />
    </div>
  )
}
