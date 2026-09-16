import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { type AppSettings, DEFAULT_SETTINGS, SettingsContext, STORAGE_KEY } from '../hooks/useSettings'

function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // localStorage may be unavailable (e.g. private mode) -- settings just won't persist.
    }
  }, [settings])

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch }))
  const resetSettings = () => setSettings(DEFAULT_SETTINGS)

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
