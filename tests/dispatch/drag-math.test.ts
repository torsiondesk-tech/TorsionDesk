import { describe, it, expect } from 'vitest'

/** Mirror of board.tsx helpers to test drag math independently. */
function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseCalendarDate(d: unknown): Date | null {
  if (!d) return null
  if (d instanceof Date) {
    const iso = d.toISOString()
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    }
    return d
  }
  const str = d as string
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

function extractCellDate(id: string): string | null {
  const idx = id.lastIndexOf(':')
  return idx > 0 ? id.slice(idx + 1) : null
}

describe('Dispatch drag math', () => {
  function makeJob(startIso: string, endIso: string | null) {
    const rawJob = {
      id: 'j1',
      jobNo: 1001,
      status: 'scheduled',
      startDate: startIso as unknown as Date,
      endDate: endIso as unknown as Date,
      customerName: 'A',
      address: null,
      arrivalWindowStart: null,
      arrivalWindowEnd: null,
      description: null,
      techIds: ['u1'],
    }
    return {
      ...rawJob,
      startDate: parseCalendarDate(rawJob.startDate),
      endDate: parseCalendarDate(rawJob.endDate),
      arrivalWindowStart: null,
      arrivalWindowEnd: null,
    }
  }

  it('dragging FIRST day of multi-day job changes start only (end fixed)', () => {
    const job = makeJob('2026-06-15T00:00:00.000Z', '2026-06-20T00:00:00.000Z')
    const cellDate = extractCellDate(`${job.id}:2026-06-15`) // drag first day
    const targetDate = '2026-06-16'

    const dragged = new Date(`${cellDate}T00:00:00`)
    const target = new Date(`${targetDate}T00:00:00`)
    const offsetDays = Math.round((target.getTime() - dragged.getTime()) / 86_400_000)
    expect(offsetDays).toBe(1)

    const startStr = toISODate(job.startDate!)
    const endStr = toISODate(job.endDate!)
    expect(cellDate).toBe(startStr) // dragging first day

    const newStart = new Date(job.startDate!)
    newStart.setDate(newStart.getDate() + offsetDays)

    expect(toISODate(newStart)).toBe('2026-06-16')
    expect(endStr).toBe('2026-06-20') // end stays fixed
  })

  it('dragging LAST day of multi-day job changes end only (start fixed)', () => {
    const job = makeJob('2026-06-15T00:00:00.000Z', '2026-06-20T00:00:00.000Z')
    const cellDate = extractCellDate(`${job.id}:2026-06-20`) // drag last day
    const targetDate = '2026-06-18'

    const dragged = new Date(`${cellDate}T00:00:00`)
    const target = new Date(`${targetDate}T00:00:00`)
    const offsetDays = Math.round((target.getTime() - dragged.getTime()) / 86_400_000)
    expect(offsetDays).toBe(-2)

    const startStr = toISODate(job.startDate!)
    const endStr = toISODate(job.endDate!)
    expect(cellDate).toBe(endStr) // dragging last day

    const newEnd = new Date(job.endDate!)
    newEnd.setDate(newEnd.getDate() + offsetDays)

    expect(startStr).toBe('2026-06-15') // start stays fixed
    expect(toISODate(newEnd)).toBe('2026-06-18')
  })

  it('dragging MIDDLE day shifts the whole block rigidly', () => {
    const job = makeJob('2026-06-15T00:00:00.000Z', '2026-06-20T00:00:00.000Z')
    const cellDate = extractCellDate(`${job.id}:2026-06-18`) // drag middle day
    const targetDate = '2026-06-17'

    const dragged = new Date(`${cellDate}T00:00:00`)
    const target = new Date(`${targetDate}T00:00:00`)
    const offsetDays = Math.round((target.getTime() - dragged.getTime()) / 86_400_000)
    expect(offsetDays).toBe(-1)

    const startStr = toISODate(job.startDate!)
    const endStr = toISODate(job.endDate!)
    expect(cellDate).not.toBe(startStr)
    expect(cellDate).not.toBe(endStr)

    const newStart = new Date(job.startDate!)
    newStart.setDate(newStart.getDate() + offsetDays)

    const newEnd = new Date(job.endDate!)
    newEnd.setDate(newEnd.getDate() + offsetDays)

    expect(toISODate(newStart)).toBe('2026-06-14')
    expect(toISODate(newEnd)).toBe('2026-06-19')
  })

  it('preserves single-day job as single-day when dragged', () => {
    const job = makeJob('2026-06-15T00:00:00.000Z', null)
    const hasSpan =
      !!job.endDate && !!job.startDate && toISODate(job.endDate) !== toISODate(job.startDate)
    expect(hasSpan).toBe(false)

    const targetDate = new Date('2026-06-16T00:00:00')
    const movedStart = targetDate
    expect(toISODate(movedStart)).toBe('2026-06-16')
    expect(job.endDate).toBeNull()
  })
})
