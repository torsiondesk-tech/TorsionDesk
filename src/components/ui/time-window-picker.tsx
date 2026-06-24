'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface TimeWindowPickerProps {
  startValue: string
  endValue: string
  onStartChange: (val: string) => void
  onEndChange: (val: string) => void
  /** Renders a hidden <input name={startName}> so FormData parents work without extra wiring. */
  startName?: string
  endName?: string
  startId?: string
  endId?: string
  error?: string | null
  className?: string
}

const PRESETS = [
  { label: '8–10 AM', start: '08:00', end: '10:00' },
  { label: '10–12 PM', start: '10:00', end: '12:00' },
  { label: '12–2 PM', start: '12:00', end: '14:00' },
  { label: '2–4 PM', start: '14:00', end: '16:00' },
  { label: '4–6 PM', start: '16:00', end: '18:00' },
]

// 7 AM through 8 PM
const HOURS_24 = Array.from({ length: 14 }, (_, i) => i + 7)
const MINUTES = ['00', '15', '30', '45']

function to12h(h: number) {
  return { display: `${h === 0 ? 12 : h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}` }
}

function parseHM(val: string): { h: number; m: string } {
  if (!val) return { h: 8, m: '00' }
  const [hStr, mStr] = val.split(':')
  const h = Math.max(7, Math.min(20, parseInt(hStr, 10) || 8))
  const mNum = parseInt(mStr, 10) || 0
  const mSnap = String(Math.round(mNum / 15) * 15 % 60).padStart(2, '0')
  const m = MINUTES.includes(mSnap) ? mSnap : '00'
  return { h, m }
}

function fmtHM(h: number, m: string) {
  return `${String(h).padStart(2, '0')}:${m}`
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { h, m } = parseHM(value)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <select
          value={h}
          onChange={(e) => onChange(fmtHM(parseInt(e.target.value), m))}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {HOURS_24.map((hour) => (
            <option key={hour} value={hour}>{to12h(hour).display}</option>
          ))}
        </select>
        <select
          value={m}
          onChange={(e) => onChange(fmtHM(h, e.target.value))}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {MINUTES.map((min) => (
            <option key={min} value={min}>:{min}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function TimeWindowPicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startName,
  endName,
  startId,
  endId,
  error,
  className,
}: TimeWindowPickerProps) {
  const activePreset = PRESETS.find((p) => p.start === startValue && p.end === endValue) ?? null
  const initialShowCustom = !activePreset && Boolean(startValue || endValue)
  const [showCustom, setShowCustom] = useState(initialShowCustom)

  function selectPreset(preset: (typeof PRESETS)[0]) {
    onStartChange(preset.start)
    onEndChange(preset.end)
    setShowCustom(false)
  }

  function openCustom() {
    if (!startValue) onStartChange('08:00')
    if (!endValue) onEndChange('10:00')
    setShowCustom(true)
  }

  const customActive = showCustom && !activePreset

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => selectPreset(preset)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activePreset?.label === preset.label
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={openCustom}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            customActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          Custom
        </button>
      </div>

      {(showCustom || initialShowCustom) && (
        <div className="flex items-end gap-3">
          <TimeSelect value={startValue} onChange={onStartChange} label="Start" />
          <span className="mb-2 text-sm text-muted-foreground">→</span>
          <TimeSelect value={endValue} onChange={onEndChange} label="End" />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {startName && (
        <input type="hidden" id={startId} name={startName} value={startValue} />
      )}
      {endName && (
        <input type="hidden" id={endId} name={endName} value={endValue} />
      )}
    </div>
  )
}
