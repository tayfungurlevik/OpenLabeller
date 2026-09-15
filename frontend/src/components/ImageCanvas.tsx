import Konva from 'konva'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import useImage from 'use-image'
import type { ShapeData, ShapeType } from '../api/types'

export type Tool = 'select' | ShapeType

const MIN_DRAG_SIZE = 3
const SCALE_STEP = 1.25

export interface ImageCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: () => void
}

interface Point {
  x: number
  y: number
}

function toPoints(flat: [number, number][]): Point[] {
  return flat.map(([x, y]) => ({ x, y }))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const ImageCanvas = forwardRef<
  ImageCanvasHandle,
  {
    imageUrl: string
    imageWidth: number
    imageHeight: number
    shapes: ShapeData[]
    tool: Tool
    selectedIndex: number | null
    labelColors: Record<string, string>
    onSelectIndex: (index: number | null) => void
    onShapeFinished: (draft: ShapeData) => void
    onShapeEdited: (index: number, points: [number, number][]) => void
    onShapeDelete: (index: number) => void
  }
>(function ImageCanvas(
  {
    imageUrl,
    imageWidth,
    imageHeight,
    shapes,
    tool,
    selectedIndex,
    labelColors,
    onSelectIndex,
    onShapeFinished,
    onShapeEdited,
    onShapeDelete,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [image] = useImage(imageUrl)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [stageScale, setStageScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })

  const [draft, setDraft] = useState<ShapeData | null>(null)
  const polygonCommitted = useRef<[number, number][]>([])
  const panning = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fitToWindow = () => {
    if (imageWidth <= 0 || imageHeight <= 0) return
    const scale = Math.min(containerSize.width / imageWidth, containerSize.height / imageHeight, 1) || 1
    setStageScale(scale)
    setStagePos({
      x: (containerSize.width - imageWidth * scale) / 2,
      y: (containerSize.height - imageHeight * scale) / 2,
    })
  }

  // biome-ignore lint: fit once container/image are known and when the image changes
  useEffect(() => {
    fitToWindow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, imageWidth, imageHeight, containerSize.width, containerSize.height])

  useImperativeHandle(ref, () => ({
    zoomIn: () => setStageScale((s) => s * SCALE_STEP),
    zoomOut: () => setStageScale((s) => s / SCALE_STEP),
    fitToWindow,
  }))

  const getPointerImagePos = (): Point | null => {
    const stage = stageRef.current
    if (!stage) return null
    const pos = stage.getRelativePointerPosition()
    if (!pos) return null
    return {
      x: clamp(pos.x, 0, imageWidth),
      y: clamp(pos.y, 0, imageHeight),
    }
  }

  const cancelDrawing = () => {
    setDraft(null)
    polygonCommitted.current = []
  }

  const finishPolygon = () => {
    const committed = polygonCommitted.current
    polygonCommitted.current = []
    setDraft(null)
    if (committed.length >= 3) {
      onShapeFinished({ shape_type: 'polygon', label: '', points: committed, group_id: null, flags: {} })
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cancelDrawing()
      } else if ((e.key === 'Enter' || e.key === 'Return') && tool === 'polygon' && draft) {
        finishPolygon()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, draft])

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      panning.current = { x: e.evt.clientX - stagePos.x, y: e.evt.clientY - stagePos.y }
      return
    }
    if (tool === 'select' || e.evt.button !== 0) return

    const pos = getPointerImagePos()
    if (!pos) return

    if (tool === 'point') {
      onShapeFinished({ shape_type: 'point', label: '', points: [[pos.x, pos.y]], group_id: null, flags: {} })
      return
    }

    if (tool === 'polygon') {
      if (!draft) {
        polygonCommitted.current = [[pos.x, pos.y]]
        setDraft({ shape_type: 'polygon', label: '', points: [[pos.x, pos.y], [pos.x, pos.y]], group_id: null, flags: {} })
      } else {
        polygonCommitted.current = [...polygonCommitted.current, [pos.x, pos.y]]
        setDraft({ ...draft, points: [...polygonCommitted.current, [pos.x, pos.y]] })
      }
      return
    }

    // rectangle / circle / line: drag from press to release
    setDraft({ shape_type: tool, label: '', points: [[pos.x, pos.y], [pos.x, pos.y]], group_id: null, flags: {} })
  }

  const handleStageMouseMove = () => {
    if (panning.current) return // handled by the native window mousemove listener below
    if (!draft) return
    const pos = getPointerImagePos()
    if (!pos) return

    if (tool === 'polygon') {
      setDraft((prev) => (prev ? { ...prev, points: [...polygonCommitted.current, [pos.x, pos.y]] } : prev))
    } else {
      setDraft((prev) => (prev ? { ...prev, points: [prev.points[0], [pos.x, pos.y]] } : prev))
    }
  }

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      panning.current = null
      return
    }
    if (tool === 'select' || tool === 'point' || tool === 'polygon' || !draft) return

    const [p0, p1] = draft.points
    const size = Math.max(Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]))
    setDraft(null)
    if (size >= MIN_DRAG_SIZE) {
      onShapeFinished(draft)
    }
  }

  const handleStageDoubleClick = () => {
    if (tool === 'polygon' && draft) {
      finishPolygon()
    }
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!e.evt.ctrlKey) return
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const oldScale = stageScale
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    }
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale / SCALE_STEP : oldScale * SCALE_STEP

    setStageScale(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  // Native listener for middle-button panning (needs raw client coords, not stage-relative).
  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!panning.current) return
      setStagePos({ x: e.clientX - panning.current.x, y: e.clientY - panning.current.y })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  const renderDraft = (data: ShapeData) => {
    const pts = toPoints(data.points)
    if (data.shape_type === 'rectangle') {
      const [a, b] = pts
      return (
        <Rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          stroke="#00c853"
          dash={[4, 4]}
          listening={false}
        />
      )
    }
    if (data.shape_type === 'circle') {
      const [c, r] = pts
      const radius = Math.hypot(r.x - c.x, r.y - c.y)
      return <Circle x={c.x} y={c.y} radius={radius} stroke="#00c853" dash={[4, 4]} listening={false} />
    }
    if (data.shape_type === 'line' || data.shape_type === 'polygon') {
      return (
        <Line
          points={pts.flatMap((p) => [p.x, p.y])}
          stroke="#00c853"
          dash={[4, 4]}
          closed={false}
          listening={false}
        />
      )
    }
    return null
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900" data-testid="image-canvas-container">
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleStageDoubleClick}
        onWheel={handleWheel}
        onClick={(e) => {
          if (tool === 'select' && e.target === e.target.getStage()) onSelectIndex(null)
        }}
      >
        <Layer>
          {image && <KonvaImage image={image} x={0} y={0} width={imageWidth} height={imageHeight} listening={false} />}

          {shapes.map((shape, index) => (
            <EditableShape
              key={index}
              shape={shape}
              color={labelColors[shape.label] ?? LABEL_COLOR_FALLBACK}
              selected={selectedIndex === index}
              interactive={tool === 'select'}
              onSelect={() => onSelectIndex(index)}
              onChange={(points) => onShapeEdited(index, points)}
              onDelete={() => onShapeDelete(index)}
            />
          ))}

          {draft && renderDraft(draft)}
        </Layer>
      </Stage>
    </div>
  )
})

export default ImageCanvas

function EditableShape({
  shape,
  color,
  selected,
  interactive,
  onSelect,
  onChange,
  onDelete,
}: {
  shape: ShapeData
  color: string
  selected: boolean
  interactive: boolean
  onSelect: () => void
  onChange: (points: [number, number][]) => void
  onDelete: () => void
}) {
  // biome-ignore lint/suspicious/noExplicitAny: Konva ref types don't unify cleanly across Rect/Circle/Line
  const shapeRef = useRef<any>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (selected && trRef.current && shapeRef.current && (shape.shape_type === 'rectangle' || shape.shape_type === 'circle')) {
      trRef.current.nodes([shapeRef.current as unknown as Konva.Node])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selected, shape.shape_type])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selected) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'Delete' || e.key === 'Backspace') onDelete()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, onDelete])

  const commonProps = {
    stroke: color,
    strokeWidth: 2,
    listening: interactive,
    draggable: interactive,
    onClick: onSelect,
    onTap: onSelect,
  }

  if (shape.shape_type === 'rectangle') {
    const [a, b] = shape.points
    const x = Math.min(a[0], b[0])
    const y = Math.min(a[1], b[1])
    const width = Math.abs(b[0] - a[0])
    const height = Math.abs(b[1] - a[1])
    return (
      <>
        <Rect
          ref={shapeRef}
          x={x}
          y={y}
          width={width}
          height={height}
          fill={selected ? `${color}33` : undefined}
          {...commonProps}
          onDragEnd={(e) => {
            const node = e.target
            onChange([
              [node.x(), node.y()],
              [node.x() + width, node.y() + height],
            ])
          }}
          onTransformEnd={() => {
            const node = shapeRef.current
            if (!node) return
            const scaleX = node.scaleX()
            const scaleY = node.scaleY()
            const nx = node.x()
            const ny = node.y()
            const nw = node.width() * scaleX
            const nh = node.height() * scaleY
            node.scaleX(1)
            node.scaleY(1)
            onChange([
              [nx, ny],
              [nx + nw, ny + nh],
            ])
          }}
        />
        {selected && interactive && <Transformer ref={trRef} rotateEnabled={false} />}
      </>
    )
  }

  if (shape.shape_type === 'circle') {
    const [c, r] = shape.points
    const radius = Math.hypot(r[0] - c[0], r[1] - c[1])
    return (
      <>
        <Circle
          ref={shapeRef}
          x={c[0]}
          y={c[1]}
          radius={radius}
          fill={selected ? `${color}33` : undefined}
          {...commonProps}
          onDragEnd={(e) => {
            const node = e.target
            const dx = node.x() - c[0]
            const dy = node.y() - c[1]
            onChange([
              [node.x(), node.y()],
              [r[0] + dx, r[1] + dy],
            ])
          }}
          onTransformEnd={() => {
            const node = shapeRef.current
            if (!node) return
            const scale = node.scaleX()
            const newRadius = radius * scale
            node.scaleX(1)
            node.scaleY(1)
            onChange([
              [node.x(), node.y()],
              [node.x() + newRadius, node.y()],
            ])
          }}
        />
        {selected && interactive && <Transformer ref={trRef} rotateEnabled={false} keepRatio />}
      </>
    )
  }

  if (shape.shape_type === 'point') {
    const [p] = shape.points
    return (
      <Circle
        x={p[0]}
        y={p[1]}
        radius={5}
        fill={color}
        {...commonProps}
        onDragEnd={(e) => onChange([[e.target.x(), e.target.y()]])}
      />
    )
  }

  // polygon / line
  const flat = shape.points.flatMap((p) => p)
  return (
    <>
      <Line
        ref={shapeRef}
        points={flat}
        closed={shape.shape_type === 'polygon'}
        fill={shape.shape_type === 'polygon' && selected ? `${color}33` : undefined}
        {...commonProps}
        onDragEnd={(e) => {
          const node = e.target
          const dx = node.x()
          const dy = node.y()
          node.position({ x: 0, y: 0 })
          onChange(shape.points.map(([x, y]) => [x + dx, y + dy] as [number, number]))
        }}
      />
      {selected &&
        interactive &&
        shape.points.map(([x, y], i) => (
          <Circle
            key={i}
            x={x}
            y={y}
            radius={5}
            fill="#ffffff"
            stroke={color}
            strokeWidth={2}
            draggable
            onDragMove={(e) => {
              const next = [...shape.points] as [number, number][]
              next[i] = [e.target.x(), e.target.y()]
              onChange(next)
            }}
          />
        ))}
    </>
  )
}

const LABEL_COLOR_FALLBACK = '#00c853'
