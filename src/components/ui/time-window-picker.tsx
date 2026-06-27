'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface TimeWindowPickerProps {
  startValue: string
  endValue: string
  onStartChange: (val: string) => void
  onEndChange: (val: string) => void
  startName?: string
  endName?: string
  startId?: string
  endId?: string
  error?: string | null
  className?: string
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = ['00', '15', '30', '45']

function to12h(h24: number): { h12: number; ampm: 'AM' | 'PM' } {
  if (h24 === 0) return { h12: 12, ampm: 'AM' }
  if (h24 < 12) return { h12: h24, ampm: 'AM' }
  if (h24 === 12) return { h12: 12, ampm: 'PM' }
  return { h12: h24 - 12, ampm: 'PM' }
}

function to24h(h12: number, ampm: 'AM' | 'PM'): number {
  if (ampm === 'AM') return h12 === 12 ? 0 : h12
  return h12 === 12 ? 12 : h12 + 12
}

function parseHM(val: string): { h24: number; m: string } {
  if (!val) return { h24: 8, m: '00' }
  const [hStr, mStr] = val.split(':')
  const h24 = parseInt(hStr, 10) || 8
  const mNum = parseInt(mStr, 10) || 0
  const mSnap = String(Math.round(mNum / 15) * 15 % 60).padStart(2, '0')
  return { h24, m: MINUTES.includes(mSnap) ? mSnap : '00' }
}

function fmtHM(h24: number, m: string) {
  return `${String(h24).padStart(2, '0')}:${m}`
}

const DEFAULT_TIME = fmtHM(8, '00') // '08:00'

const selectCls =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 dark:bg-input/30'

function TimeDropdowns({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { h24, m } = parseHM(value)
  const { h12, ampm } = to12h(h24)

  return (
    <div className="flex items-center gap-1">
      <select
        value={h12}
        onChange={(e) => onChange(fmtHM(to24h(parseInt(e.target.value), ampm), m))}
        className={selectCls}
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select
        value={m}
        onChange={(e) => onChange(fmtHM(h24, e.target.value))}
        className={selectCls}
      >
        {MINUTES.map((min) => (
          <option key={min} value={min}>:{min}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={(e) => onChange(fmtHM(to24h(h12, e.target.value as 'AM' | 'PM'), m))}
        className={selectCls}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
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
  // When the picker mounts with one side null (e.g. DB has end but no start),
  // sync the empty side to the displayed default so saves always write both.
  useEffect(() => {
    if (endValue && !startValue) onStartChange(DEFAULT_TIME)
    else if (startValue && !endValue) onEndChange(DEFAULT_TIME)
  }, [startValue, endValue, onStartChange, onEndChange])

  const handleStartChange = (val: string) => {
    onStartChange(val)
    if (!endValue) onEndChange(DEFAULT_TIME)
  }
  const handleEndChange = (val: string) => {
    onEndChange(val)
    if (!startValue) onStartChange(DEFAULT_TIME)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <TimeDropdowns value={startValue} onChange={handleStartChange} />
        <span className="text-sm text-muted-foreground">→</span>
        <TimeDropdowns value={endValue} onChange={handleEndChange} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {startName && <input type="hidden" id={startId} name={startName} value={startValue} />}
      {endName && <input type="hidden" id={endId} name={endName} value={endValue} />}
    </div>
  )
}
