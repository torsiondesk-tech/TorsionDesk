'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const DEFAULT_TIME = fmtHM(8, '00')

function TimeDropdowns({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const { h24, m } = parseHM(value)
  const { h12, ampm } = to12h(h24)

  return (
    <div className="flex items-center gap-1">
      <Select
        value={String(h12)}
        onValueChange={(v) => { if (v) onChange(fmtHM(to24h(parseInt(v), ampm), m)) }}
      >
        <SelectTrigger className="w-14" aria-label={`${label} hour`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS_12.map((h) => (
            <SelectItem key={h} value={String(h)}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={m}
        onValueChange={(v) => { if (v) onChange(fmtHM(h24, v)) }}
      >
        <SelectTrigger className="w-16" aria-label={`${label} minute`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((min) => (
            <SelectItem key={min} value={min}>:{min}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={ampm}
        onValueChange={(v) => { if (v) onChange(fmtHM(to24h(h12, v as 'AM' | 'PM'), m)) }}
      >
        <SelectTrigger className="w-16" aria-label={`${label} AM or PM`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
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
        <TimeDropdowns value={startValue} onChange={handleStartChange} label="Start time" />
        <span className="text-sm text-muted-foreground">→</span>
        <TimeDropdowns value={endValue} onChange={handleEndChange} label="End time" />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {startName && <input type="hidden" id={startId} name={startName} value={startValue} />}
      {endName && <input type="hidden" id={endId} name={endName} value={endValue} />}
    </div>
  )
}
