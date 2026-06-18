import { toISODate, parseCalendarDate } from '@/lib/utils'
import type { JobRow } from '@/lib/jobs/jobs'

export interface DayGroup {
  label: string
  date: string
  jobs: JobRow[]
}

export function groupJobsByDay(rows: JobRow[], todayISO: string): DayGroup[] {
  const today = parseCalendarDate(todayISO)
  if (!today) return []

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = toISODate(tomorrow)

  const map = new Map<string, DayGroup>()

  for (const row of rows) {
    const date = row.startDate ? parseCalendarDate(row.startDate) : null
    const dateISO = date ? toISODate(date) : null
    if (!dateISO) continue

    if (!map.has(dateISO)) {
      let label: string
      if (dateISO === todayISO) {
        label = 'Today'
      } else if (dateISO === tomorrowISO) {
        label = 'Tomorrow'
      } else {
        const d = parseCalendarDate(dateISO)!
        label = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      }
      map.set(dateISO, { label, date: dateISO, jobs: [] })
    }

    map.get(dateISO)!.jobs.push(row)
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, group]) => group)
}
