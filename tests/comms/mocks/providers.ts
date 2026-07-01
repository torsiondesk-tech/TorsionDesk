import { vi } from 'vitest'

export const mockResendSend = vi.fn(async (_params: unknown) => ({
  data: { id: 'msg_test' },
  error: null,
}))

export const mockTwilioMessageCreate = vi.fn(async () => ({ sid: 'SM_test' }))

export const mockSvixVerify = vi.fn((payload: string, headers: Record<string, string>) => {
  const sig = headers['svix-signature'] ?? ''
  if (!sig || sig === 'bad_sig' || String(payload).includes('bad_sig')) {
    throw new Error('Invalid signature')
  }
  // Parse the payload and return it as the verified event
  return JSON.parse(payload)
})

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    }
  },
}))

vi.mock('twilio', () => ({
  default: (_sid: string, _token: string) => ({
    messages: {
      create: mockTwilioMessageCreate,
    },
  }),
}))

vi.mock('svix', () => ({
  Webhook: class MockWebhook {
    constructor(private _secret: string) {}
    verify(payload: string, headers: Record<string, string>) {
      return mockSvixVerify(payload, headers)
    }
  },
}))

export function resetProviderMocks() {
  mockResendSend.mockClear()
  mockTwilioMessageCreate.mockClear()
  mockSvixVerify.mockClear()
}

export function buildWithTenantMock() {
  return vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const inserted: unknown[] = []
    const tx = {
      select: vi.fn((_cols?: unknown) => ({
        from: vi.fn((_table?: unknown) => ({
          where: vi.fn((_cond?: unknown) => []),
          limit: vi.fn((_n?: number) => []),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: unknown) => {
          inserted.push(vals)
          return {
            returning: vi.fn(async () => []),
            onConflictDoNothing: vi.fn().mockReturnThis(),
            onConflictDoUpdate: vi.fn().mockReturnThis(),
          }
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
      query: { inserted },
    }
    const result = await fn(tx)
    return { result, inserted }
  })
}
