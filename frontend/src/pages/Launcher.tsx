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
    <div className="min-h-screen bg-neutral-50 px-10 py-8 dark:bg-neutral-950">
      <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">OpenLabeller</h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
        Open-source labeling for images, text, and audio
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        {(['image', 'text', 'audio'] as const).map((task) => (
          <TaskCard key={task} task={task} selected={selectedTask === task} onClick={() => setSelectedTask(task)} />
        ))}
      </div>

      <div className="mt-10 max-w-xl">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Project folder</h2>
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={dataDir ?? ''}
            placeholder="Choose a folder with your images / texts / audio files..."
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          />
          <button
            type="button"
            onClick={handleBrowse}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Browse...
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name (optional)"
          className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        />

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="mt-4 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Opening...' : 'Open / Create Project'}
        </button>
      </div>
    </div>
  )
}
