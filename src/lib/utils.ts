import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a raw digit string as (XXX) XXX-XXXX. Returns the original if not 10 digits. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return value
}

/** Strip all non-digit characters from a phone string. Returns null for empty.
 *  Use this server-side before storing phone numbers so downstream integrations
 *  (Twilio, Stripe) never have to parse parentheses or dashes.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits || null
}

/** Capitalize the first letter of every word, leaving the rest unchanged.
 *  Useful for name inputs where each word should start with a capital letter.
 */
export function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Format a raw string into (XXX) XXX-XXXX as the user types. Strips non-digits
 *  and caps at 10 digits.
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Extract YYYY-MM-DD calendar date. Uses local getters for Date objects so
 *  timezone offsets never shift the day (e.g. UTC+2 midnight → previous day in UTC).
 */
export function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Rehydrate a server-returned or client-constructed date into a local-midnight
 * Date that preserves the intended CALENDAR date.
 *
 * - String input (`YYYY-MM-DD...`) is parsed as a local-midnight calendar date.
 * - Date objects that are exactly UTC midnight are treated as server-returned
 *   UTC-midnight calendar dates (Kind 2 in the project date rules). We extract the
 *   ISO YYYY-MM-DD via UTC getters so US timezones don't shift the day.
 * - Any other Date (client-local midnight or wall-clock time) uses local getters,
 *   because its calendar day is defined by the viewer's local timezone.
 */
/** Return the Monday of the week containing the given date, at local midnight.
 *  Week starts on Monday; Sunday belongs to the previous Monday's week.
 */
export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function parseCalendarDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  if (d instanceof Date) {
    const isUtcMidnight =
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0 &&
      d.getUTCMilliseconds() === 0

    const iso = isUtcMidnight
      ? d.toISOString().slice(0, 10) // UTC midnight: read the UTC calendar day
      : toISODate(d)                 // local Date: read the local calendar day

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

/**
 * Arrival window inputs are time-only (HH:MM). Combine with the job's start
 * date to produce a full timestamp. If no start date is set, the arrival
 * window is stored as null — a time without a date is meaningless.
 *
 * Append 'Z' to force UTC interpretation so postgres-js doesn't shift the
 * stored value by the server's UTC offset on the way in, then shift it back
 * on the way out (double-shift bug on non-UTC machines / local dev).
 */
export function combineDateTime(date: string | null | undefined, time: string | null | undefined): Date | null {
  if (!time || time.trim() === '') return null
  if (!date || date.trim() === '') return null
  const combined = new Date(`${date}T${time}:00Z`)
  if (isNaN(combined.getTime())) return null
  return combined
}
