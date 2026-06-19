import { toISODate, parseCalendarDate } from '@/lib/utils'
import type { JobRow } from '@/lib/jobs/jobs'

export interface DayGroup {
  label: string
  date: string   // ISO date string, or 'unscheduled' sentinel
  jobs: JobRow[]
}

export function groupJobsByDay(rows: JobRow[], todayISO: string): DayGroup[] {
  const today = parseCalendarDate(todayISO)
  if (!today) return []

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = toISODate(tomorrow)

  const map = new Map<string, DayGroup>()
  const unscheduled: JobRow[] = []

  for (const row of rows) {
    const date = row.startDate ? parseCalendarDate(row.startDate) : null
    const dateISO = date ? toISODate(date) : null

    if (!dateISO) {
      unscheduled.push(row)
      continue
    }

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

  const groups = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, group]) => group)

  if (unscheduled.length > 0) {
    groups.push({ label: 'Unscheduled', date: 'unscheduled', jobs: unscheduled })
  }

  return groups
}

export interface SplitGroups {
  upcoming: DayGroup[]
  past: DayGroup[]
}

/**
 * Splits pre-grouped day groups into upcoming (today + future + unscheduled)
 * and past (strictly before today). Past groups are returned newest-first.
 */
export function splitGroupsByTime(groups: DayGroup[], todayISO: string): SplitGroups {
  const upcoming: DayGroup[] = []
  const past: DayGroup[] = []

  for (const group of groups) {
    if (group.date === 'unscheduled' || group.date >= todayISO) {
      upcoming.push(group)
    } else {
      past.push(group)
    }
  }

  // Reverse past so the most-recent past day appears at the top.
  past.sort((a, b) => b.date.localeCompare(a.date))

  return { upcoming, past }
}
