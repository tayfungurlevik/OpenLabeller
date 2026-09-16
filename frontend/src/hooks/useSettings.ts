import { createContext, useContext } from 'react'

export interface AppSettings {
  /** Stroke width (px) used for shape outlines on the image canvas. */
  lineWidth: number
  /** Fill opacity (%) used for a shape's highlighted/selected region. */
  fillOpacity: number
  /** Whether to draw each shape's label text on top of it. */
  showLabelText: boolean
  fontFamily: string
  fontSize: number
  /** Radius (px) of point markers and polygon/line vertex handles. */
  pointRadius: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  lineWidth: 3,
  fillOpacity: 20,
  showLabelText: true,
  fontFamily: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fontSize: 13,
  pointRadius: 5,
}

export const STORAGE_KEY = 'openlabeller.settings'

export const SettingsContext = createContext<{
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
} | null>(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
