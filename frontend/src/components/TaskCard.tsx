import { Image, Music, type LucideIcon, FileText } from 'lucide-react'
import type { TaskType } from '../api/types'

const TASK_INFO: Record<TaskType, { icon: LucideIcon; title: string; description: string }> = {
  image: {
    icon: Image,
    title: 'Image labeling',
    description: 'Draw bounding boxes, polygons, circles, lines and points on images.',
  },
  text: {
    icon: FileText,
    title: 'Text classification',
    description: 'Assign categories to documents, sentences, or CSV/JSONL rows.',
  },
  audio: {
    icon: Music,
    title: 'Audio classification',
    description: 'Listen to audio clips and assign categories with waveform playback.',
  },
}

export default function TaskCard({
  task,
  selected,
  onClick,
}: {
  task: TaskType
  selected: boolean
  onClick: () => void
}) {
  const { icon: Icon, title, description } = TASK_INFO[task]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-56 flex-col gap-3 rounded-xl border p-5 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
          : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
      }`}
    >
      <Icon
        size={28}
        className={selected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}
      />
      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{description}</div>
    </button>
  )
}
