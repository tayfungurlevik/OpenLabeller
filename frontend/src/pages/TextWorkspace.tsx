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
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-line bg-surface-1 p-2.5">
          <h3 className="px-2 pb-2.5 font-mono text-[11px] tracking-[.08em] text-ink-3">ITEMS &middot; {items.length}</h3>
          <div className="flex flex-col gap-0.5">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`flex items-center gap-2.5 truncate rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors hover:bg-white/5 ${
                  i === currentIndex ? 'bg-accent-soft font-semibold text-ink-1' : 'text-ink-2'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={
                    it.labels.length > 0 ? { background: 'var(--color-accent)' } : { border: '1.4px solid #4A4856' }
                  }
                />
                <span className="truncate">
                  {it.id} — {it.text.slice(0, 40)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto p-10">
          <h3 className="font-mono text-[11px] tracking-[.08em] text-ink-3">TEXT</h3>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-ink-1">{current?.text}</p>
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
