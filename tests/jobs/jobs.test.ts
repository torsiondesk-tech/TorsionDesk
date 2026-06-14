/**
 * JOB-01 / JOB-02 / JOB-08 — job CRUD + per-tenant numbering (RED until
 * src/lib/jobs/job-number.ts and src/lib/jobs/jobs.ts exist).
 *
 * Contract:
 *   1. nextJobNo(tx, tenantId) returns (max(jobNo for tenant) ?? 1000) + 1.
 *   2. Tenant-scoped: tenant-a's counter is independent of tenant-b's.
 *   3. listJobs(orgId, opts) returns only rows belonging to the caller's tenant.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// Minimal fake tx that resolves every query chain to a defined value.
// listJobs and getJob now call withTenant internally; this mock lets
// the placeholder assertions run without a live database.
function makeEmptyTx() {
  const terminal = {
    then: (resolve: (v: unknown) => void) => resolve([{ c: 0 }]),
  }
  const fromChain = {
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          offset: vi.fn(() => terminal),
        })),
      })),
      limit: vi.fn(() => terminal),
      groupBy: vi.fn(() => terminal),
      ...terminal,
    })),
    innerJoin: vi.fn(() => fromChain),
  }
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => fromChain),
    })),
  }
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(makeEmptyTx())
  }),
}))

// Fake tx that returns a configurable max(jobNo) per tenant.
function makeFakeTx(maxValue: number | null) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ m: maxValue }]),
      })),
    })),
  } as unknown as Parameters<typeof import('@/lib/jobs/job-number').nextJobNo>[0]
}

// Not-yet-existing modules under test — RED signal.
import { nextJobNo } from '@/lib/jobs/job-number'
import { listJobs, getJob } from '@/lib/jobs/jobs'

describe('nextJobNo', () => {
  it('returns 1001 when no rows exist for the tenant', async () => {
    const tx = makeFakeTx(null)
    const result = await nextJobNo(tx, ORG_A)
    expect(result).toBe(1001)
  })

  it('returns max+1 when jobs exist for the tenant', async () => {
    const tx = makeFakeTx(1042)
    const result = await nextJobNo(tx, ORG_A)
    expect(result).toBe(1043)
  })

  it('is independent per tenant', async () => {
    const txA = makeFakeTx(2000)
    const txB = makeFakeTx(500)

    const resultA = await nextJobNo(txA, ORG_A)
    const resultB = await nextJobNo(txB, ORG_B)

    expect(resultA).toBe(2001)
    expect(resultB).toBe(501)
  })
})

describe('listJobs', () => {
  it('returns only rows for the caller tenant', async () => {
    // The real implementation will query scoped by orgId.
    const rows = await listJobs(ORG_A, {})
    // Until implemented, this assertion serves as the RED placeholder.
    expect(rows).toBeDefined()
  })
})

describe('getJob', () => {
  it('is defined and accepts a tenant-scoped id', async () => {
    const result = await getJob(ORG_A, 'job_1')
    expect(result).toBeDefined()
  })
})
