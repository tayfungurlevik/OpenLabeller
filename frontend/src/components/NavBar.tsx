import type { ReactNode } from 'react'

export default function NavBar({
  onPrev,
  onNext,
  canPrev,
  canNext,
  progressText,
  children,
}: {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  progressText: string
  children?: ReactNode
}) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-t border-line bg-surface-1 px-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1 disabled:opacity-40"
      >
        &lt; Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="rounded-lg border border-line-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1 disabled:opacity-40"
      >
        Next &gt;
      </button>
      <div className="flex-1 text-center font-mono text-xs text-ink-2">{progressText}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
