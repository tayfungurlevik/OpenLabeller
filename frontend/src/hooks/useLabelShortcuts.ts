import { useEffect } from 'react'
import type { LabelClass } from '../api/types'

/** Fires onTrigger(label.name) when a label's 1-9 shortcut key is pressed,
 * unless the user is typing into a text input. */
export function useLabelShortcuts(labels: LabelClass[], onTrigger: (name: string) => void): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const label = labels.find((l) => l.shortcut === e.key)
      if (label) {
        e.preventDefault()
        onTrigger(label.name)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [labels, onTrigger])
}
