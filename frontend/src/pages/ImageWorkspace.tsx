import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Project, ShapeData, WorkspaceProps } from '../api/types'
import ImageCanvas, { type ImageCanvasHandle, type Tool } from '../components/ImageCanvas'
import NavBar from '../components/NavBar'

const TOOLS: { key: Tool; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'polygon', label: 'Polygon' },
  { key: 'circle', label: 'Circle' },
  { key: 'line', label: 'Line' },
  { key: 'point', label: 'Point' },
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
    setPendingLabelText(project.labels[0]?.name ?? '')
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
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button type="button" onClick={onBack} className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          ← Projects
        </button>
        <span className="font-semibold">{project.name}</span>
        <div className="mx-3 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              data-testid={`tool-${t.key}`}
              onClick={() => setTool(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tool === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => canvasRef.current?.zoomOut()} className="rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          −
        </button>
        <button type="button" onClick={() => canvasRef.current?.zoomIn()} className="rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          +
        </button>
        <button type="button" onClick={() => canvasRef.current?.fitToWindow()} className="rounded-md px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Fit
        </button>
        <button
          type="button"
          data-testid="save-button"
          onClick={() => void saveCurrent()}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Save
        </button>
        <div className="relative group">
          <button type="button" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700">
            Export ▾
          </button>
          <div className="absolute right-0 z-10 hidden w-44 flex-col rounded-md border border-neutral-200 bg-white py-1 shadow-lg group-hover:flex dark:border-neutral-700 dark:bg-neutral-900">
            <button type="button" onClick={() => handleExport('coco')} className="px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Export as COCO JSON
            </button>
            <button type="button" onClick={() => handleExport('yolo')} className="px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Export as YOLO
            </button>
            <button type="button" onClick={() => handleExport('voc')} className="px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Export as Pascal VOC
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 p-2 dark:border-neutral-800">
          <h3 className="px-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Images</h3>
          <div className="mt-1 flex flex-col">
            {files.map((f, i) => (
              <button
                key={f.name}
                type="button"
                onClick={() => void goToIndex(i)}
                className={`truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  i === currentIndex
                    ? 'bg-blue-100 dark:bg-blue-950/60'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {f.labeled ? '●' : '○'} {f.name}
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
              onSelectIndex={setSelectedIndex}
              onShapeFinished={handleShapeFinished}
              onShapeEdited={handleShapeEdited}
              onShapeDelete={handleShapeDelete}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">
              {files.length === 0 ? 'No images found in this folder' : 'Loading...'}
            </div>
          )}

          {pendingShape && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-80 rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Choose a label</h3>
                <input
                  autoFocus
                  list="image-label-options"
                  value={pendingLabelText}
                  onChange={(e) => setPendingLabelText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmPendingShape()}
                  className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                />
                <datalist id="image-label-options">
                  {project.labels.map((l) => (
                    <option key={l.name} value={l.name} />
                  ))}
                </datalist>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={cancelPendingShape} className="rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-label"
                    onClick={confirmPendingShape}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-neutral-200 p-3 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Labels</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={newLabelClassName}
                onChange={(e) => setNewLabelClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLabelClass()}
                placeholder="New label name"
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <button type="button" onClick={handleAddLabelClass} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                Add
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {project.labels.map((l) => (
                <div key={l.name} className="flex items-center justify-between rounded-md px-2 py-1 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </span>
                  <button type="button" onClick={() => handleRemoveLabelClass(l.name)} className="text-neutral-400 hover:text-red-500">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Shapes in this image</h3>
            <div className="mt-2 flex flex-col gap-1">
              {shapes.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    selectedIndex === i ? 'bg-blue-100 dark:bg-blue-950/60' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: labelColors[s.label] ?? '#888' }} />
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
