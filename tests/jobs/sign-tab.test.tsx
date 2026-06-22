import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignTab } from '@/app/(app)/jobs/[id]/tabs/sign-tab'
import {
  deleteJobSignatureAction,
  updateJobSignatureAction,
} from '@/app/(app)/jobs/actions'

const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('@/app/(app)/jobs/actions', () => ({
  updateJobSignatureAction: vi.fn(),
  deleteJobSignatureAction: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

const baseSignatures = [
  {
    id: 'sig-1',
    url: 'https://example.com/sig1.png',
    signatureType: 'start' as const,
    signedBy: 'John Doe',
    capturedBy: 'tech-1',
    createdAt: new Date('2026-06-20T12:00:00Z'),
  },
  {
    id: 'sig-2',
    url: 'https://example.com/sig2.png',
    signatureType: 'complete' as const,
    signedBy: 'Jane Smith',
    capturedBy: 'tech-1',
    createdAt: new Date('2026-06-21T12:00:00Z'),
  },
]

describe('SignTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateJobSignatureAction).mockResolvedValue({ success: true })
    vi.mocked(deleteJobSignatureAction).mockResolvedValue({ success: true })
  })

  it('renders empty state when no signatures', () => {
    render(<SignTab jobId="job-1" signatures={[]} />)
    expect(screen.getByText('No signatures captured yet.')).toBeInTheDocument()
  })

  it('renders signature type and signer', () => {
    render(<SignTab jobId="job-1" signatures={baseSignatures} />)
    expect(screen.getByText('Authorize Start')).toBeInTheDocument()
    expect(screen.getByText('Authorize Completion')).toBeInTheDocument()
    expect(screen.getByText('Signed by: John Doe')).toBeInTheDocument()
    expect(screen.getByText('Signed by: Jane Smith')).toBeInTheDocument()
  })

  it('deletes a signature after confirmation', async () => {
    render(<SignTab jobId="job-1" signatures={baseSignatures} />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete signature/i })
    await userEvent.click(deleteButtons[0])

    expect(screen.getByText('Delete this signature?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /delete signature/i }))

    expect(deleteJobSignatureAction).toHaveBeenCalledWith('job-1', 'sig-1')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('updates signature metadata', async () => {
    render(<SignTab jobId="job-1" signatures={baseSignatures} />)

    const editButtons = screen.getAllByRole('button', { name: /edit signature/i })
    await userEvent.click(editButtons[0])

    const signedByInput = screen.getByLabelText(/signed by/i)
    await userEvent.clear(signedByInput)
    await userEvent.type(signedByInput, 'Updated Name')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(updateJobSignatureAction).toHaveBeenCalledWith('job-1', 'sig-1', {
      signatureType: 'start',
      signedBy: 'Updated Name',
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows error when signed-by is empty during edit', async () => {
    render(<SignTab jobId="job-1" signatures={baseSignatures} />)

    const editButtons = screen.getAllByRole('button', { name: /edit signature/i })
    await userEvent.click(editButtons[0])

    const signedByInput = screen.getByLabelText(/signed by/i)
    await userEvent.clear(signedByInput)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText(/signed-by name is required/i)).toBeInTheDocument()
    expect(updateJobSignatureAction).not.toHaveBeenCalled()
  })
})
