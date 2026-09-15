import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { AudioItem, Project, WorkspaceProps } from '../api/types'
import LabelPanel from '../components/LabelPanel'
import NavBar from '../components/NavBar'
import Waveform from '../components/Waveform'

export default function AudioWorkspace({ project: initialProject, onBack }: WorkspaceProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [items, setItems] = useState<AudioItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [peaks, setPeaks] = useState<[number, number][] | null>(null)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const dir = project.output_dir

  useEffect(() => {
    api.listAudioItems(dir).then((list) => {
      setItems(list)
      if (list.length > 0) setCurrentIndex(0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir])

  const current = currentIndex >= 0 ? items[currentIndex] : null

  useEffect(() => {
    if (!current) return
    setPeaks(null)
    setProgress(0)
    api.getAudioPeaks(dir, current.id).then((res) => setPeaks(res.peaks))
    if (audioRef.current) {
      audioRef.current.src = api.audioFileUrl(dir, current.id)
      audioRef.current.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  async function applyLabel(name: string) {
    if (!current) return
    let nextLabels: string[]
    if (project.multi_label) {
      nextLabels = current.labels.includes(name)
        ? current.labels.filter((l) => l !== name)
        : [...current.labels, name]
    } else {
      nextLabels = current.labels.length === 1 && current.labels[0] === name ? [] : [name]
    }
    const idx = currentIndex
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, labels: nextLabels } : it)))
    await api.saveAudioLabels(dir, current.id, nextLabels)
    if (!project.multi_label && nextLabels.length > 0 && idx + 1 < items.length) {
      setCurrentIndex(idx + 1)
    }
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  function handleSeek(fraction: number) {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = fraction * audio.duration
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleExport(format: 'csv' | 'jsonl') {
    const folder = await window.api.pickFolder()
    if (!folder) return
    await api.exportAudio(dir, format, `${folder}\\openlabeller_export.${format}`)
  }

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ← Projects
        </button>
        <span className="font-semibold">{project.name}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 p-2 dark:border-neutral-800">
          <h3 className="px-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Audio files</h3>
          <div className="mt-1 flex flex-col">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  i === currentIndex ? 'bg-blue-100 dark:bg-blue-950/60' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {it.labels.length > 0 ? '●' : '○'} {it.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Playback</h3>
          <Waveform peaks={peaks} progress={progress} onSeek={handleSeek} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {formatTime(progress * duration)} / {formatTime(duration)}
            </span>
          </div>
          <audio
            ref={audioRef}
            onTimeUpdate={(e) => {
              const audio = e.currentTarget
              if (audio.duration) setProgress(audio.currentTime / audio.duration)
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="hidden"
          />
        </div>

        <LabelPanel
          project={project}
          activeLabels={current?.labels ?? []}
          onLabelClick={applyLabel}
          onProjectUpdate={setProject}
        />
      </div>

      <NavBar
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
        canPrev={currentIndex > 0}
        canNext={currentIndex < items.length - 1}
        progressText={`${currentIndex + 1} / ${items.length}   (labeled: ${items.filter((i) => i.labels.length > 0).length})`}
      >
        <button
          type="button"
          onClick={() => handleExport('csv')}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport('jsonl')}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Export JSONL
        </button>
      </NavBar>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00'
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
