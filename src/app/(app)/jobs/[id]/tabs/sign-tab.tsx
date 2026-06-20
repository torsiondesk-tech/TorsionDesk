import { PenLine } from 'lucide-react'

interface Signature {
  id: string
  url: string
  signatureType: 'start' | 'complete' | null
  signedBy: string | null
  capturedBy: string | null
  createdAt: Date | null
}

interface SignTabProps {
  signatures: Signature[]
}

const TYPE_LABEL: Record<string, string> = {
  start: 'Authorize Start',
  complete: 'Authorize Completion',
}

export function SignTab({ signatures }: SignTabProps) {
  if (signatures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 gap-3">
        <PenLine className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No signatures captured yet.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {signatures.map((sig) => (
        <div key={sig.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              {sig.signatureType ? TYPE_LABEL[sig.signatureType] ?? sig.signatureType : 'Signature'}
            </span>
            {sig.createdAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(sig.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
          <img
            src={sig.url}
            alt={`${sig.signatureType ?? 'signature'} signed by ${sig.signedBy ?? 'customer'}`}
            className="w-full rounded-lg border bg-white object-contain p-2"
            style={{ maxHeight: '180px' }}
          />
          {sig.signedBy && (
            <p className="text-xs text-muted-foreground">Signed by: {sig.signedBy}</p>
          )}
        </div>
      ))}
    </div>
  )
}
