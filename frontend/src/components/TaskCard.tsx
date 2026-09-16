import { Image, Music, type LucideIcon, FileText } from 'lucide-react'
import type { TaskType } from '../api/types'

const TASK_INFO: Record<
  TaskType,
  { icon: LucideIcon; title: string; description: string; tint: string; solid: string }
> = {
  image: {
    icon: Image,
    title: 'Image labeling',
    description: 'Draw bounding boxes, polygons, circles, lines and points on images.',
    tint: 'bg-accent',
    solid: 'text-app',
  },
  text: {
    icon: FileText,
    title: 'Text classification',
    description: 'Assign categories to documents, sentences, or CSV/JSONL rows.',
    tint: 'bg-[#4FD1F7]/15',
    solid: 'text-[#4FD1F7]',
  },
  audio: {
    icon: Music,
    title: 'Audio classification',
    description: 'Listen to audio clips and assign categories with waveform playback.',
    tint: 'bg-[#FF6B5C]/15',
    solid: 'text-[#FF6B5C]',
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
  const { icon: Icon, title, description, tint, solid } = TASK_INFO[task]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[240px] flex-col gap-4 rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 ${
        selected
          ? 'border-accent bg-surface-2 shadow-[0_0_0_4px_var(--color-accent-soft)]'
          : 'border-line bg-surface-2 hover:border-line-2'
      }`}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
        <Icon size={22} className={solid} />
      </div>
      <div className="font-semibold text-ink-1">{title}</div>
      <div className="text-[13.5px] leading-relaxed text-ink-2">{description}</div>
    </button>
  )
}
