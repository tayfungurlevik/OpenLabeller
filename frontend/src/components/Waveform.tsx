import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

export default function Waveform({
  peaks,
  progress,
  onSeek,
}: {
  peaks: [number, number][] | null
  progress: number
  onSeek: (fraction: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    const handleResize = () => setResizeTick((t) => t + 1)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    ctx.fillStyle = isDark ? '#202020' : '#f3f3f3'
    ctx.fillRect(0, 0, rect.width, rect.height)

    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = '#888888'
      ctx.font = '13px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Waveform preview unavailable for this file', rect.width / 2, rect.height / 2)
    } else {
      const mid = rect.height / 2
      ctx.strokeStyle = '#3ddc97'
      ctx.beginPath()
      peaks.forEach(([min, max], i) => {
        const x = (rect.width * i) / peaks.length
        const y1 = mid - max * mid * 0.9
        const y2 = mid - min * mid * 0.9
        ctx.moveTo(x, y1)
        ctx.lineTo(x, Math.max(y2, y1 + 1))
      })
      ctx.stroke()
    }

    ctx.strokeStyle = isDark ? '#ffffff' : '#000000'
    ctx.lineWidth = 2
    const px = rect.width * progress
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px, rect.height)
    ctx.stroke()
  }, [peaks, progress, resizeTick])

  function handleClick(e: MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek((e.clientX - rect.left) / rect.width)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      data-testid="waveform"
      className="h-36 w-full cursor-pointer rounded-md"
    />
  )
}
