'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PenLine, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateJobSignatureAction,
  deleteJobSignatureAction,
} from '../../actions'
import { logger } from '@/lib/logger'

interface Signature {
  id: string
  url: string
  signatureType: 'start' | 'complete' | null
  signedBy: string | null
  capturedBy: string | null
  createdAt: Date | null
}

interface SignTabProps {
  jobId: string
  signatures: Signature[]
}

const TYPE_LABEL: Record<string, string> = {
  start: 'Authorize Start',
  complete: 'Authorize Completion',
}

const TYPE_OPTIONS: { value: 'start' | 'complete'; label: string }[] = [
  { value: 'start', label: 'Authorize Start' },
  { value: 'complete', label: 'Authorize Completion' },
]

export function SignTab({ jobId, signatures }: SignTabProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editType, setEditType] = useState<'start' | 'complete'>('start')
  const [editSignedBy, setEditSignedBy] = useState('')

  function startEdit(sig: Signature) {
    setEditType(sig.signatureType ?? 'start')
    setEditSignedBy(sig.signedBy ?? '')
    setEditingId(sig.id)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function handleSave(sig: Signature) {
    const trimmed = editSignedBy.trim()
    if (!trimmed) {
      setError('Signed-by name is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await updateJobSignatureAction(jobId, sig.id, {
        signatureType: editType,
        signedBy: trimmed,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setEditingId(null)
        router.refresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('updateSignature', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(signatureId: string) {
    setError(null)
    try {
      const result = await deleteJobSignatureAction(jobId, signatureId)
      if (result.error) {
        setError(result.error)
      } else {
        setDeletingId(null)
        router.refresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('deleteSignature', err)
    }
  }

  if (signatures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 gap-3">
        <PenLine className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No signatures captured yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {signatures.map((sig) => {
          const isEditing = editingId === sig.id

          return (
            <div
              key={sig.id}
              className="rounded-xl border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                {isEditing ? (
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`sig-type-${sig.id}`} className="text-xs">
                      Signature type
                    </Label>
                    <Select
                      value={editType}
                      onValueChange={(value) =>
                        setEditType(value as 'start' | 'complete')
                      }
                    >
                      <SelectTrigger
                        id={`sig-type-${sig.id}`}
                        size="sm"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm font-semibold">
                    {sig.signatureType
                      ? TYPE_LABEL[sig.signatureType] ?? sig.signatureType
                      : 'Signature'}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                      >
                        <X className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleSave(sig)}
                        disabled={saving}
                        aria-label="Save"
                      >
                        <Check className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => startEdit(sig)}
                        aria-label="Edit signature"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(sig.id)}
                        aria-label="Delete signature"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <img
                src={sig.url}
                alt={`${sig.signatureType ?? 'signature'} signed by ${sig.signedBy ?? 'customer'}`}
                className="w-full rounded-lg border bg-white object-contain p-2"
                style={{ maxHeight: '180px' }}
              />

              {isEditing ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sig-signed-by-${sig.id}`} className="text-xs">
                    Signed by
                  </Label>
                  <Input
                    id={`sig-signed-by-${sig.id}`}
                    value={editSignedBy}
                    onChange={(e) => setEditSignedBy(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  {sig.signedBy ? (
                    <p className="text-xs text-muted-foreground">
                      Signed by: {sig.signedBy}
                    </p>
                  ) : (
                    <span />
                  )}
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
              )}
            </div>
          )
        })}
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this signature?</DialogTitle>
            <DialogDescription>
              This removes the signature image from the job and from storage.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) handleDelete(deletingId)
              }}
            >
              Delete Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
