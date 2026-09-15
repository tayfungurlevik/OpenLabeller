import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Project, TextItem, WorkspaceProps } from '../api/types'
import LabelPanel from '../components/LabelPanel'
import NavBar from '../components/NavBar'

export default function TextWorkspace({ project: initialProject, onBack }: WorkspaceProps) {
  const [project, setProject] = useState<Project>(initialProject)
  const [items, setItems] = useState<TextItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const dir = project.output_dir

  useEffect(() => {
    api.listTextItems(dir).then((list) => {
      setItems(list)
      if (list.length > 0) setCurrentIndex(0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir])

  const current = currentIndex >= 0 ? items[currentIndex] : null

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
    await api.saveTextLabels(dir, current.id, nextLabels)

    if (!project.multi_label && nextLabels.length > 0 && idx + 1 < items.length) {
      setCurrentIndex(idx + 1)
    }
  }

  async function handleExport(format: 'csv' | 'jsonl') {
    const folder = await window.api.pickFolder()
    if (!folder) return
    await api.exportText(dir, format, `${folder}\\openlabeller_export.${format}`)
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
          <h3 className="px-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Items</h3>
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
                {it.labels.length > 0 ? '●' : '○'} {it.id} — {it.text.slice(0, 40)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Text</h3>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{current?.text}</p>
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
