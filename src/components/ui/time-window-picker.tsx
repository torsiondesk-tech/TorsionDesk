'use client'

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

// 7 AM – 8 PM in 24h
const HOURS_24 = Array.from({ length: 14 }, (_, i) => i + 7)
const MINUTES = ['00', '15', '30', '45']

function hourLabel(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12} ${ampm}`
}

function parseHM(val: string): { h: number; m: string } {
  if (!val) return { h: 8, m: '00' }
  const [hStr, mStr] = val.split(':')
  const h = Math.max(7, Math.min(20, parseInt(hStr, 10) || 8))
  const mNum = parseInt(mStr, 10) || 0
  const mSnap = String(Math.round(mNum / 15) * 15 % 60).padStart(2, '0')
  return { h, m: MINUTES.includes(mSnap) ? mSnap : '00' }
}

function fmtHM(h: number, m: string) {
  return `${String(h).padStart(2, '0')}:${m}`
}

const selectCls =
  'rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

function TimeDropdowns({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { h, m } = parseHM(value)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <select
          value={h}
          onChange={(e) => onChange(fmtHM(parseInt(e.target.value), m))}
          className={selectCls}
        >
          {HOURS_24.map((hour) => (
            <option key={hour} value={hour}>{hourLabel(hour)}</option>
          ))}
        </select>
        <select
          value={m}
          onChange={(e) => onChange(fmtHM(h, e.target.value))}
          className={selectCls}
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
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <TimeDropdowns value={startValue} onChange={onStartChange} label="Start" />
        <span className="mb-2 text-sm text-muted-foreground">→</span>
        <TimeDropdowns value={endValue} onChange={onEndChange} label="End" />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {startName && <input type="hidden" id={startId} name={startName} value={startValue} />}
      {endName && <input type="hidden" id={endId} name={endName} value={endValue} />}
    </div>
  )
}
