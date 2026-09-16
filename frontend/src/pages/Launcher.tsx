import { useState } from 'react'
import { api } from '../api/client'
import type { Project, TaskType } from '../api/types'
import TaskCard from '../components/TaskCard'

export default function Launcher({ onProjectReady }: { onProjectReady: (project: Project) => void }) {
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null)
  const [dataDir, setDataDir] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleBrowse = async () => {
    const folder = await window.api.pickFolder()
    if (!folder) return
    setDataDir(folder)
    if (!name.trim()) {
      const parts = folder.split(/[\\/]/).filter(Boolean)
      setName(parts[parts.length - 1] ?? '')
    }
  }

  const handleSubmit = async () => {
    if (!selectedTask) {
      setError('Choose Image, Text, or Audio labeling first.')
      return
    }
    if (!dataDir) {
      setError('Choose a data folder first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      let project: Project
      try {
        project = await api.getProject(dataDir)
      } catch {
        project = await api.createProject(selectedTask, dataDir, name.trim() || undefined)
      }
      onProjectReady(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-app px-24 pt-20">
      <div
        className="pointer-events-none absolute -right-64 -top-80 h-[900px] w-[900px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(124,108,255,.28), transparent 68%)' }}
      />

      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#100F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="6" width="16" height="12" rx="1.5" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-ink-1">OpenLabeller</span>
        <span className="ml-2 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] text-ink-2">
          local-first &middot; v0.2
        </span>
      </div>

      <div className="relative z-10 mt-14">
        <h1 className="m-0 text-[56px] font-bold leading-[1.05] tracking-tight text-ink-1">OpenLabeller</h1>
        <p className="mt-3.5 max-w-lg text-base leading-relaxed text-ink-2">
          Open-source labeling for images, text, and audio.
        </p>
      </div>

      <div className="relative z-10 mt-12 flex flex-wrap gap-6">
        {(['image', 'text', 'audio'] as const).map((task) => (
          <TaskCard key={task} task={task} selected={selectedTask === task} onClick={() => setSelectedTask(task)} />
        ))}
      </div>

      <div className="relative z-10 mt-12 max-w-3xl">
        <h2 className="font-mono text-[11px] tracking-[.08em] text-ink-3">PROJECT FOLDER</h2>
        <div className="mt-2.5 flex gap-2.5">
          <input
            readOnly
            value={dataDir ?? ''}
            placeholder="Choose a folder with your images / texts / audio files..."
            className="h-12 flex-1 rounded-[10px] border border-line bg-surface-2 px-4 text-sm text-ink-1 placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={handleBrowse}
            className="flex h-12 items-center gap-2 rounded-[10px] border border-line-2 px-5 text-sm font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6.5A1.5 1.5 0 015.5 5h4l1.6 2H18.5A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z" />
            </svg>
            Browse&hellip;
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name (optional)"
          className="mt-3 h-12 w-[340px] rounded-[10px] border border-line bg-surface-2 px-4 text-sm text-ink-1 placeholder:text-ink-3"
        />

        {error && <p className="mt-3 text-sm text-[#FF6B5C]">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="mt-5 h-[52px] rounded-xl bg-accent px-7 text-[14.5px] font-semibold text-app shadow-[0_10px_28px_rgba(124,108,255,.32)] transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? 'Opening...' : 'Open / Create Project'}
        </button>
      </div>
    </div>
  )
}
