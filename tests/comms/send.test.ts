/**
 * COMM-01/02 + D-07/10 — sendCommunication trigger gate and dual-table logging.
 *
 * Contract:
 *   1. Disabled trigger makes no provider call and writes no log.
 *   2. Successful send writes communication_logs (status='sent') and customer_events (kind='email').
 *   3. Failed send writes communication_logs only (status='failed').
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mockResendSend, mockTwilioMessageCreate, resetProviderMocks, buildWithTenantMock } from './mocks/providers'

beforeAll(() => {
  process.env.RESEND_API_KEY = 're_test'
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'auth_test'
})

beforeEach(() => {
  resetProviderMocks()
})

vi.mock('@/db/with-tenant', () => ({
  withTenant: buildWithTenantMock(),
}))

import { sendCommunication } from '@/lib/comms/send'

describe('sendCommunication', () => {
  it('returns skipped without provider call when trigger is disabled', async () => {
    const { withTenant } = await import('@/db/with-tenant')
    vi.mocked(withTenant).mockImplementationOnce(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => [{ enabled: false, subject: null, footerText: null }]),
          })),
        })),
      }
      return fn(tx)
    })

    const result = await sendCommunication('org_test', {
      triggerType: 'job_confirmation',
      channel: 'email',
      refKind: 'job',
      refId: 'job_1',
      customerId: 'cust_1',
    })

    expect(result.skipped).toBe(true)
    expect(mockResendSend).not.toHaveBeenCalled()
    expect(mockTwilioMessageCreate).not.toHaveBeenCalled()
  })

  it('writes both communication_logs and customer_events on successful email send', async () => {
    const { withTenant } = await import('@/db/with-tenant')
    const inserted: unknown[] = []

    vi.mocked(withTenant).mockImplementationOnce(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => [
              { enabled: true, subject: 'Appointment confirmed', footerText: 'Thanks!' },
            ]),
            limit: vi.fn(() => [{ companyName: "Infantino's" }]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((vals: unknown) => {
            inserted.push(vals)
            return { returning: vi.fn(async () => [{ id: 'log_1' }]) }
          }),
        })),
      }
      return fn(tx)
    })

    await sendCommunication('org_test', {
      triggerType: 'job_confirmation',
      channel: 'email',
      refKind: 'job',
      refId: 'job_1',
      customerId: 'cust_1',
      to: 'customer@example.com',
    })

    expect(mockResendSend).toHaveBeenCalled()
    const logInsert = inserted.find(
      (i: any) => i && (Array.isArray(i) ? i[0]?.status : i.status),
    ) as any
    expect(logInsert).toBeDefined()
    expect(Array.isArray(logInsert) ? logInsert[0].status : logInsert.status).toBe('sent')

    const eventInsert = inserted.find((i: any) => i && (Array.isArray(i) ? i[0]?.kind === 'email' : i.kind === 'email'),
    ) as any
    expect(eventInsert).toBeDefined()
  })

  it('writes only communication_logs (status=failed) on provider error', async () => {
    mockResendSend.mockRejectedValueOnce(new Error('Resend outage'))
    const { withTenant } = await import('@/db/with-tenant')
    const inserted: unknown[] = []

    vi.mocked(withTenant).mockImplementationOnce(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => [
              { enabled: true, subject: 'Appointment confirmed', footerText: null },
            ]),
            limit: vi.fn(() => [{ companyName: "Infantino's" }]),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((vals: unknown) => {
            inserted.push(vals)
            return { returning: vi.fn(async () => [{ id: 'log_1' }]) }
          }),
        })),
      }
      return fn(tx)
    })

    await sendCommunication('org_test', {
      triggerType: 'job_confirmation',
      channel: 'email',
      refKind: 'job',
      refId: 'job_1',
      customerId: 'cust_1',
      to: 'customer@example.com',
    })

    const logInsert = inserted.find((i: any) => i && (Array.isArray(i) ? i[0]?.status : i.status),
    ) as any
    expect(logInsert).toBeDefined()
    expect(Array.isArray(logInsert) ? logInsert[0].status : logInsert.status).toBe('failed')

    const eventInsert = inserted.find((i: any) => i && (Array.isArray(i) ? i[0]?.kind === 'email' : i.kind === 'email'),
    ) as any
    expect(eventInsert).toBeUndefined()
  })
})
