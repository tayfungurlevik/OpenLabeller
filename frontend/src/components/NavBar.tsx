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
    <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        &lt; Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Next &gt;
      </button>
      <div className="flex-1 text-center text-sm text-neutral-500 dark:text-neutral-400">{progressText}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
