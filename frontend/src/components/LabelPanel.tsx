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
    <div className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line bg-surface-1 p-4">
      <label className="flex items-center justify-between text-[13px] text-ink-2">
        <span>Allow multiple labels</span>
        <span
          onClick={handleMultiToggle}
          className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
            project.multi_label ? 'bg-accent' : 'bg-surface-3'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink-1 transition-transform ${
              project.multi_label ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </label>

      <div>
        <h3 className="text-[13.5px] font-semibold text-ink-1">Labels</h3>
        <div className="mt-2.5 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New label name"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13.5px] text-ink-1 placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-[#FF6B5C]">{error}</p>}
      </div>

      <div className="flex flex-col gap-1">
        {project.labels.map((label) => {
          const active = activeLabels.includes(label.name)
          return (
            <button
              key={label.name}
              type="button"
              onClick={() => onLabelClick(label.name)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-white/5"
              style={active ? { background: 'var(--color-accent-soft)' } : undefined}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
              <span className={`flex-1 ${active ? 'font-semibold text-ink-1' : 'text-ink-2'}`}>{label.name}</span>
              {label.shortcut && (
                <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
                  {label.shortcut}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
