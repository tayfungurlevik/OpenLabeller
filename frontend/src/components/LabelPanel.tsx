import { useState } from 'react'
import { api } from '../api/client'
import type { Project } from '../api/types'
import { useLabelShortcuts } from '../hooks/useLabelShortcuts'

/** Shared classification sidebar for the Text and Audio workspaces: a
 * multi-label toggle, label-class management, and clickable/shortcut
 * label buttons whose highlighted state reflects the current item. */
export default function LabelPanel({
  project,
  activeLabels,
  onLabelClick,
  onProjectUpdate,
}: {
  project: Project
  activeLabels: string[]
  onLabelClick: (name: string) => void
  onProjectUpdate: (project: Project) => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useLabelShortcuts(project.labels, onLabelClick)

  const handleAdd = async () => {
    const name = newLabel.trim()
    if (!name) return
    if (project.labels.some((l) => l.name === name)) {
      setError(`'${name}' is already a label class.`)
      return
    }
    setError(null)
    const updated = await api.addLabel(project.output_dir, name)
    onProjectUpdate(updated)
    setNewLabel('')
  }

  const handleMultiToggle = async () => {
    const updated = await api.updateProject(project.output_dir, { multi_label: !project.multi_label })
    onProjectUpdate(updated)
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-neutral-200 p-4 dark:border-neutral-800">
      <label className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
        <span>Allow multiple labels</span>
        <input
          type="checkbox"
          checked={project.multi_label}
          onChange={handleMultiToggle}
          className="h-4 w-4 accent-blue-600"
        />
      </label>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Labels</h3>
        <div className="mt-2 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New label name"
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        {project.labels.map((label) => {
          const active = activeLabels.includes(label.name)
          return (
            <button
              key={label.name}
              type="button"
              onClick={() => onLabelClick(label.name)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
              }`}
              style={active ? { backgroundColor: label.color, borderColor: label.color } : undefined}
            >
              <span>{label.name}</span>
              {label.shortcut && <span className="text-xs opacity-70">{label.shortcut}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
