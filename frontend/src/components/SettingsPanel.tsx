import { useSettings } from '../hooks/useSettings'

const FONT_OPTIONS = [
  { value: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif', label: 'Space Grotesk' },
  { value: '"JetBrains Mono", ui-monospace, monospace', label: 'JetBrains Mono' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Georgia, serif', label: 'Georgia' },
]

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings()

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-96 rounded-2xl border border-line-2 bg-surface-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-ink-1">Labeling settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span className="flex items-center justify-between">
              <span>Line thickness</span>
              <span className="text-ink-3">{settings.lineWidth}px</span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.lineWidth}
              onChange={(e) => updateSettings({ lineWidth: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span className="flex items-center justify-between">
              <span>Region fill transparency</span>
              <span className="text-ink-3">{settings.fillOpacity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.fillOpacity}
              onChange={(e) => updateSettings({ fillOpacity: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span className="flex items-center justify-between">
              <span>Point / vertex size</span>
              <span className="text-ink-3">{settings.pointRadius}px</span>
            </span>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={settings.pointRadius}
              onChange={(e) => updateSettings({ pointRadius: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>

          <label className="flex items-center justify-between text-[13px] text-ink-2">
            <span>Show label text on image</span>
            <span
              onClick={() => updateSettings({ showLabelText: !settings.showLabelText })}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                settings.showLabelText ? 'bg-accent' : 'bg-surface-3'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink-1 transition-transform ${
                  settings.showLabelText ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span>Label font</span>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
              disabled={!settings.showLabelText}
              className="rounded-lg border border-line-2 bg-surface-1 px-2.5 py-1.5 text-[13px] text-ink-1 disabled:opacity-50"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span className="flex items-center justify-between">
              <span>Label font size</span>
              <span className="text-ink-3">{settings.fontSize}px</span>
            </span>
            <input
              type="range"
              min={8}
              max={28}
              step={1}
              value={settings.fontSize}
              disabled={!settings.showLabelText}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="accent-accent disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-between">
          <button
            type="button"
            onClick={resetSettings}
            className="rounded-lg px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink-1"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-1.5 text-[13px] font-semibold text-app transition-colors hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
