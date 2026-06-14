/**
 * Stub — listJobs and getJob will be implemented in Wave 3.
 * Exists so Wave 1 RED tests can import the module and nextJobNo tests can run.
 */

export async function listJobs(_orgId: string, _opts: Record<string, unknown>): Promise<unknown[]> {
  return []
}

export async function getJob(_orgId: string, _id: string): Promise<unknown | null> {
  return null
}
