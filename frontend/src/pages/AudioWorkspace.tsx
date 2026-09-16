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
  const [converting, setConverting] = useState(false)
  const [convertMessage, setConvertMessage] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const dir = project.output_dir
  const mp3Count = items.filter((it) => it.id.toLowerCase().endsWith('.mp3')).length

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

  async function handleConvertMp3ToWav() {
    setConverting(true)
    setConvertMessage(null)
    try {
      const result = await api.convertAudioToWav(dir)
      const parts: string[] = []
      if (result.converted.length > 0) parts.push(`Converted ${result.converted.length} file(s) to .wav`)
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} already had a .wav`)
      if (result.errors.length > 0) parts.push(`${result.errors.length} failed`)
      setConvertMessage(parts.length > 0 ? parts.join(', ') + '.' : 'No .mp3 files found to convert.')
      if (result.converted.length > 0) {
        setItems(await api.listAudioItems(dir))
      }
    } catch (err) {
      setConvertMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setConverting(false)
    }
  }

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
        {mp3Count > 0 && (
          <>
            <div className="mx-2.5 h-5 w-px bg-line-2" />
            <button
              type="button"
              onClick={() => void handleConvertMp3ToWav()}
              disabled={converting}
              className="flex items-center gap-2 rounded-lg border border-line-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1 disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h13" />
                <path d="M14 4l3 4-3 4" />
                <path d="M20 16H7" />
                <path d="M10 12l-3 4 3 4" />
              </svg>
              {converting ? 'Converting...' : 'Convert MP3 → WAV'}
              <span className="rounded-md bg-[#FF6B5C]/18 px-1.5 py-0.5 font-mono text-[10.5px] text-[#FF6B5C]">
                {mp3Count}
              </span>
            </button>
          </>
        )}
        {convertMessage && <span className="ml-2.5 text-[12.5px] text-ink-2">{convertMessage}</span>}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-60 shrink-0 overflow-y-auto border-r border-line bg-surface-1 p-2.5">
          <h3 className="px-2 pb-2.5 font-mono text-[11px] tracking-[.08em] text-ink-3">
            AUDIO FILES &middot; {items.length}
          </h3>
          <div className="flex flex-col gap-0.5">
            {items.map((it, i) => {
              const ext = it.id.slice(it.id.lastIndexOf('.') + 1).toLowerCase()
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors hover:bg-white/5 ${
                    i === currentIndex ? 'bg-accent-soft font-semibold text-ink-1' : 'text-ink-2'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={
                      it.labels.length > 0
                        ? { background: 'var(--color-accent)' }
                        : { border: '1.4px solid #4A4856' }
                    }
                  />
                  <span className="flex-1 truncate">{it.id}</span>
                  <span
                    className={`rounded font-mono text-[9.5px] ${
                      ext === 'wav' ? 'bg-[#4FD1F7]/14 text-[#4FD1F7]' : 'bg-[#FF6B5C]/14 text-[#FF6B5C]'
                    } px-1 py-0.5`}
                  >
                    {ext}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 p-12">
          <h3 className="font-mono text-[11px] tracking-[.08em] text-ink-3">PLAYBACK</h3>
          <Waveform peaks={peaks} progress={progress} onSeek={handleSeek} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent shadow-[0_8px_22px_rgba(124,108,255,.35)] transition-colors hover:bg-accent-hover"
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#100F17" stroke="none">
                  <rect x="5" y="4" width="5" height="16" rx="1" />
                  <rect x="14" y="4" width="5" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#100F17" stroke="none">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
              )}
            </button>
            <span className="font-mono text-[13px] text-ink-2">
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
          className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport('jsonl')}
          className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
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
