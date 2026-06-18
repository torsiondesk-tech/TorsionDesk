import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TechSignaturePad } from '@/app/(tech)/components/tech-signature-pad'

vi.mock('@/app/(tech)/lib/use-online', () => ({
  useOnline: () => false,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/app/(tech)/lib/sync', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  enqueueOutboxItem: vi.fn(),
  flushOutbox: vi.fn(),
}))

import { enqueueOutboxItem, type SignaturePayload } from '@/app/(tech)/lib/sync'
import SignaturePad from 'signature_pad'

const dataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

vi.mock('signature_pad', () => ({
  default: class SignaturePad {
    private canvas: HTMLCanvasElement

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas
    }

    isEmpty(): boolean {
      return (SignaturePad.prototype as { isEmpty: () => boolean }).isEmpty()
    }

    toDataURL(_type?: string) {
      return dataUrl
    }

    clear() {}

    addEventListener(_event: string, _handler: () => void) {}
    removeEventListener(_event: string, _handler: () => void) {}
    off() {}
  },
}))

describe('TechSignaturePad', () => {
  beforeEach(() => {
    vi.mocked(enqueueOutboxItem).mockClear()
  })

  it('renders a touch-none canvas with the customer signature aria-label', () => {
    ;(SignaturePad.prototype as { isEmpty: () => boolean }).isEmpty = () => true
    render(
      <TechSignaturePad
        orgId="org_sig"
        jobId="job_sig"
        userId="user_sig"
        savedSignatures={[]}
      />,
    )

    const canvas = screen.getByLabelText('Customer signature pad')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveClass('touch-none')
  })

  it('does nothing when saving an empty pad', () => {
    ;(SignaturePad.prototype as { isEmpty: () => boolean }).isEmpty = () => true
    render(
      <TechSignaturePad
        orgId="org_sig"
        jobId="job_sig"
        userId="user_sig"
        savedSignatures={[]}
      />,
    )

    const saveButton = screen.getByRole('button', { name: /save signature/i })
    expect(saveButton).toBeDisabled()
    expect(enqueueOutboxItem).not.toHaveBeenCalled()
  })

  it('enqueues a job_signature item with a png blob and signedBy when signed', async () => {
    ;(SignaturePad.prototype as { isEmpty: () => boolean }).isEmpty = () => false
    render(
      <TechSignaturePad
        orgId="org_sig"
        jobId="job_sig"
        userId="user_sig"
        savedSignatures={[]}
      />,
    )

    await userEvent.type(screen.getByLabelText(/signed by/i), 'John Doe')
    await userEvent.click(screen.getByRole('button', { name: /save signature/i }))

    expect(enqueueOutboxItem).toHaveBeenCalledTimes(1)
    const call = vi.mocked(enqueueOutboxItem).mock.calls[0] as [string, { type: string; payload: unknown }]
    expect(call[0]).toBe('org_sig')
    expect(call[1].type).toBe('job_signature')

    const payload = call[1].payload as SignaturePayload
    expect(payload.jobId).toBe('job_sig')
    expect(payload.filename).toBe('signature.png')
    expect(payload.fileSize).toBeGreaterThan(0)
    expect(payload.blob.type).toBe('image/png')
    expect(payload.signedBy).toBe('John Doe')
  })
})
