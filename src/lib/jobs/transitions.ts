/**
 * Job Status Finite State Machine (FSM)
 *
 * D-01: Status transitions are server-enforced. The only legal write path for
 * `jobs.status` is `transitionJobStatus()` in `transition-job-status.ts`.
 *
 * [ASSUMED] — owner must confirm exact SF-parity edges. The matrix below is
 * a conservative starting point based on typical service-business flow.
 */

export const STATUS_GROUPS = {
  open: ['unscheduled', 'scheduled', 'dispatched', 'cancelled'],
  in_progress: ['delayed', 'on_the_way', 'on_site', 'started', 'paused', 'resumed', 'partially_completed', 'completed'],
  closed: ['invoiced', 'paid_in_full', 'job_closed'],
} as const

/** All canonical job status values derived from STATUS_GROUPS. */
export type JobStatusValue =
  | (typeof STATUS_GROUPS.open)[number]
  | (typeof STATUS_GROUPS.in_progress)[number]
  | (typeof STATUS_GROUPS.closed)[number]

/**
 * [ASSUMED] — owner must confirm exact SF-parity edges.
 * Conservative transition matrix for a service-business FSM.
 * Terminal statuses (`job_closed`, `cancelled`) map to empty arrays.
 */
export const ALLOWED_TRANSITIONS: Record<JobStatusValue, JobStatusValue[]> = {
  unscheduled: ['scheduled', 'cancelled'],
  scheduled: ['dispatched', 'cancelled', 'delayed'],
  dispatched: ['on_the_way', 'cancelled', 'delayed'],
  delayed: ['on_the_way', 'cancelled'],
  on_the_way: ['on_site', 'cancelled'],
  on_site: ['started', 'cancelled'],
  started: ['paused', 'completed', 'partially_completed', 'cancelled'],
  paused: ['resumed', 'cancelled'],
  resumed: ['started', 'cancelled'],
  partially_completed: ['completed', 'cancelled'],
  completed: ['invoiced'],
  invoiced: ['paid_in_full'],
  paid_in_full: ['job_closed'],
  job_closed: [],
  cancelled: [],
}

/** Returns true if `to` is a legal next state from `from`. */
export function isLegalTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as keyof typeof ALLOWED_TRANSITIONS]
  if (!Array.isArray(allowed)) return false
  return allowed.includes(to as JobStatusValue)
}

/** Side-effect stub: SMS "On The Way" — Phase 8. */
export async function onOnTheWay(_jobId: string): Promise<void> {
  /* Phase 8 SMS */
}

/** Side-effect stub: create invoice on Close & Invoice — Phase 7. */
export async function onCloseAndInvoice(_jobId: string): Promise<void> {
  /* Phase 7 invoice */
}

/** Generic side-effect stub for every transition. */
export async function onTransition(_from: string, _to: string, _jobId: string): Promise<void> {
  /* generic — later */
}

/**
 * Dispatch named side effects for a status transition.
 * Routes to special handlers (`onOnTheWay`, `onCloseAndInvoice`) then
 * always calls the generic `onTransition` hook.
 */
export async function dispatchSideEffects(
  from: JobStatusValue,
  to: JobStatusValue,
  jobId: string,
): Promise<void> {
  if (to === 'on_the_way') await onOnTheWay(jobId)
  if (to === 'invoiced') await onCloseAndInvoice(jobId)
  await onTransition(from, to, jobId)
}
