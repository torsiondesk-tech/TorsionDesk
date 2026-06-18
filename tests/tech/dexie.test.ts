import { createTechDb, OUTBOX_TYPES, type OutboxItem, type CachedJob } from '@/app/(tech)/lib/dexie'

describe('TechSyncDb', () => {
  let db: ReturnType<typeof createTechDb>

  afterEach(async () => {
    if (db) {
      await db.delete()
    }
  })

  it('embeds org id in the database name for tenant partitioning', () => {
    db = createTechDb('org_A')
    expect(db.name).toBe('TechSyncDb-org_A')
  })

  it('creates a different database name for each org', () => {
    const dbA = createTechDb('org_A')
    const dbB = createTechDb('org_B')
    expect(dbA.name).not.toBe(dbB.name)
    db = dbA
  })

  it('round-trips a pending outbox item', async () => {
    db = createTechDb('org_A')
    await db.open()

    const item: OutboxItem = {
      id: crypto.randomUUID(),
      type: 'job_status_update',
      payload: { jobId: 'job-1', toStatus: 'on_site' },
      createdAt: Date.now(),
      retryCount: 0,
      syncStatus: 'pending',
    }

    await db.outbox.add(item)
    const pending = await db.outbox.where('syncStatus').equals('pending').toArray()

    expect(pending).toHaveLength(1)
    expect(pending[0]?.id).toBe(item.id)
    expect(pending[0]?.type).toBe('job_status_update')
  })

  it('queries cached jobs by status', async () => {
    db = createTechDb('org_A')
    await db.open()

    const job: CachedJob = {
      id: 'job-1',
      tenantId: 'org_A',
      jobNo: 1001,
      customerId: 'cust-1',
      contactId: null,
      serviceLocationId: null,
      status: 'on_site',
      description: 'Repair spring',
      startDate: '2026-06-17',
      arrivalWindowStart: null,
      arrivalWindowEnd: null,
      notesForTechs: null,
      completionNotes: null,
      assigneeUserIds: ['user-1'],
    }

    await db.jobs.add(job)
    const onSite = await db.jobs.where('status').equals('on_site').toArray()

    expect(onSite).toHaveLength(1)
    expect(onSite[0]?.id).toBe('job-1')
  })

  it('includes job_signature and manual_payment in OUTBOX_TYPES', () => {
    expect(OUTBOX_TYPES).toContain('job_signature')
    expect(OUTBOX_TYPES).toContain('manual_payment')
    expect(OUTBOX_TYPES).toHaveLength(9)
  })
})
