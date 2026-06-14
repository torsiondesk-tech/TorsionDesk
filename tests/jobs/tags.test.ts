/**
 * JOB-13 — per-tag job counts (RED until src/lib/jobs/jobs.ts countJobsByTag exists).
 *
 * Contract: countJobsByTag(orgId) returns an array of { tagId, count }
 * scoped to the tenant. Used by the jobs dashboard sidebar bucket nav.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory store simulating job_tags rows.
const jobTagStore: Array<{
  tenantId: string
  jobId: string
  tagId: string
}> = [
  { tenantId: ORG_A, jobId: 'job_1', tagId: 'tag_a' },
  { tenantId: ORG_A, jobId: 'job_2', tagId: 'tag_a' },
  { tenantId: ORG_A, jobId: 'job_3', tagId: 'tag_b' },
  { tenantId: 'org_bbbb', jobId: 'job_4', tagId: 'tag_a' }, // cross-tenant
]

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(() => ({
              then: vi.fn(async (resolve: (v: unknown) => void) => {
                const rows = jobTagStore
                  .filter((r) => r.tenantId === orgId)
                  .reduce(
                    (acc, r) => {
                      acc[r.tagId] = (acc[r.tagId] || 0) + 1
                      return acc
                    },
                    {} as Record<string, number>,
                  )
                resolve(
                  Object.entries(rows).map(([tagId, count]) => ({ tagId, count })),
                )
              }),
            })),
          })),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { countJobsByTag } from '@/lib/jobs/jobs'

describe('countJobsByTag', () => {
  it('returns per-tag counts scoped to the tenant', async () => {
    const result = await countJobsByTag(ORG_A)

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)

    const tagA = result.find((r: any) => r.tagId === 'tag_a')
    const tagB = result.find((r: any) => r.tagId === 'tag_b')

    expect(tagA).toBeDefined()
    expect(tagA.count).toBe(2)

    expect(tagB).toBeDefined()
    expect(tagB.count).toBe(1)
  })

  it('does not include counts from other tenants', async () => {
    const result = await countJobsByTag(ORG_A)
    const crossTenant = result.find((r: any) => r.tagId === 'tag_a' && r.count > 2)
    expect(crossTenant).toBeUndefined()
  })
})
