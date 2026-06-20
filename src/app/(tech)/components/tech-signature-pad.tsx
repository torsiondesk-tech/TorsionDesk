'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import SignaturePad from 'signature_pad'
import { Eraser, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb, type CachedSignatureMeta } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type SignaturePayload } from '@/app/(tech)/lib/sync'
import { getJobSignedSignaturesAction } from '@/app/(app)/jobs/actions'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { toast } from 'sonner'

interface ServerSignature {
  id: string
  url: string
  signatureType: 'start' | 'complete' | null
  signedBy: string | null
  capturedBy: string | null
  createdAt: Date | null
}

interface TechSignaturePadProps {
  orgId: string
  jobId: string
  userId: string
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

interface SignatureSectionProps {
  label: string
  description: string
  signatureType: 'start' | 'complete'
  orgId: string
  jobId: string
  userId: string
  online: boolean
  savedSignature: ServerSignature | undefined
  pendingSignedBy: string | undefined
  /** Name from cached server-confirmed metadata — shown offline when no URL is available. */
  cachedSignedBy: string | undefined
}

function SignatureSection({
  label,
  description,
  signatureType,
  orgId,
  jobId,
  userId,
  online,
  savedSignature,
  pendingSignedBy,
  cachedSignedBy,
}: SignatureSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [signedBy, setSignedBy] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(rect.width, 320)
    const height = Math.max(rect.height, 192)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: 'rgb(0,0,0)',
    })

    const updateEmpty = () => setIsEmpty(pad.isEmpty())
    pad.addEventListener('endStroke', updateEmpty)
    pad.addEventListener('beginStroke', () => setIsEmpty(false))

    padRef.current = pad
    setIsEmpty(pad.isEmpty())

    return () => {
      pad.removeEventListener('endStroke', updateEmpty)
      pad.off()
      padRef.current = null
    }
  }, [])

  async function handleSave() {
    const pad = padRef.current
    if (!pad || pad.isEmpty() || !signedBy.trim()) {
      toast.error('Please sign and enter the customer name.')
      return
    }

    const dataUrl = pad.toDataURL('image/png')
    const blob = dataUrlToBlob(dataUrl)

    await enqueueOutboxItem(orgId, {
      type: 'job_signature',
      payload: {
        jobId,
        filename: `signature-${signatureType}.png`,
        fileSize: blob.size,
        blob,
        signedBy: signedBy.trim(),
        signatureType,
      } satisfies SignaturePayload,
    })

    if (online) {
      void flushOutbox(orgId, userId)
    }

    pad.clear()
    setSignedBy('')
    setIsEmpty(true)
    toast.success('Signature saved')
  }

  function handleClear() {
    if (padRef.current) {
      padRef.current.clear()
    }
    setIsEmpty(true)
    setClearDialogOpen(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {savedSignature ? (
          <div className="flex flex-col gap-2">
            <img
              src={savedSignature.url}
              alt={`${label} signature by ${savedSignature.signedBy ?? 'customer'}`}
              className="w-full rounded-lg border bg-white"
            />
            {savedSignature.signedBy && (
              <p className="text-xs text-muted-foreground">Signed by: {savedSignature.signedBy}</p>
            )}
          </div>
        ) : pendingSignedBy ? (
          <div className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            Pending upload — signed by {pendingSignedBy}
          </div>
        ) : cachedSignedBy ? (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Captured — signed by {cachedSignedBy}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`signed-by-${signatureType}`}>Signed by</Label>
              <Input
                id={`signed-by-${signatureType}`}
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Customer name"
                className="text-base"
              />
            </div>

            <div className="rounded-xl border bg-white p-2">
              <canvas
                ref={canvasRef}
                aria-label={`${label} signature pad`}
                className="touch-none h-48 w-full rounded-lg border border-dashed border-muted-foreground/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setClearDialogOpen(true)}
                disabled={isEmpty}
              >
                <Eraser className="mr-2 size-4" />
                Clear
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isEmpty || !signedBy.trim()}
              >
                <Save className="mr-2 size-4" />
                Save
              </Button>
            </div>
          </>
        )}

        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear signature?</DialogTitle>
              <DialogDescription>This will erase the current signature from the pad.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleClear}>Clear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export function TechSignaturePad({ orgId, jobId, userId }: TechSignaturePadProps) {
  const online = useOnline()
  const db = useMemo(() => createTechDb(orgId), [orgId])

  const [serverSignatures, setServerSignatures] = useState<ServerSignature[]>([])

  const fetchServerSignatures = useCallback(async () => {
    const result = await getJobSignedSignaturesAction(jobId)
    if (result.signatures) {
      setServerSignatures(result.signatures)
      // Cache metadata in Dexie so the Sign tab doesn't show blank pads offline
      const metas: CachedSignatureMeta[] = result.signatures
        .filter((s): s is typeof s & { signatureType: 'start' | 'complete' } => s.signatureType === 'start' || s.signatureType === 'complete')
        .map((s) => ({
          id: s.id,
          jobId,
          signatureType: s.signatureType,
          signedBy: s.signedBy,
          capturedBy: s.capturedBy,
        }))
      if (metas.length > 0) await db.signatureMeta.bulkPut(metas)
    }
  }, [jobId, db])

  useEffect(() => {
    if (online) void fetchServerSignatures()
  }, [fetchServerSignatures, online])

  // Offline fallback: read cached server-confirmed signatures from Dexie
  const cachedSignatureMetas = useLiveQuery(
    () => db.signatureMeta.where('jobId').equals(jobId).toArray(),
    [db, jobId],
  )

  const allOutboxSignatures = useLiveQuery(
    () => db.outbox.where('type').equals('job_signature').sortBy('createdAt'),
    [db],
  )

  // Only show items that haven't been synced yet
  const pendingForJob = useMemo(
    () => (allOutboxSignatures ?? []).filter(
      (item) =>
        (item.payload as SignaturePayload).jobId === jobId &&
        item.syncStatus !== 'synced',
    ),
    [allOutboxSignatures, jobId],
  )

  // Re-fetch server signatures when a pending item finishes syncing
  const prevPendingCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (allOutboxSignatures === undefined) return
    const curr = pendingForJob.length
    const prev = prevPendingCountRef.current
    prevPendingCountRef.current = curr
    if (prev !== null && curr < prev) {
      void fetchServerSignatures()
    }
  }, [pendingForJob.length, allOutboxSignatures, fetchServerSignatures])

  const pendingStart = pendingForJob.find(
    (item) => (item.payload as SignaturePayload).signatureType === 'start',
  )
  const pendingComplete = pendingForJob.find(
    (item) => (item.payload as SignaturePayload).signatureType === 'complete',
  )

  const savedStart = serverSignatures.find((s) => s.signatureType === 'start')
  const savedComplete = serverSignatures.find((s) => s.signatureType === 'complete')

  // Offline fallback: use Dexie cache only when server state is absent
  const cachedStart = cachedSignatureMetas?.find((s) => s.signatureType === 'start')
  const cachedComplete = cachedSignatureMetas?.find((s) => s.signatureType === 'complete')

  return (
    <div className="flex flex-col gap-4">
      <SignatureSection
        label="Authorize Start"
        description="Customer authorizes the technician to begin work."
        signatureType="start"
        orgId={orgId}
        jobId={jobId}
        userId={userId}
        online={online}
        savedSignature={savedStart}
        pendingSignedBy={pendingStart ? (pendingStart.payload as SignaturePayload).signedBy : undefined}
        cachedSignedBy={!savedStart && !pendingStart ? (cachedStart?.signedBy ?? undefined) : undefined}
      />
      <SignatureSection
        label="Authorize Completion"
        description="Customer confirms the work has been completed satisfactorily."
        signatureType="complete"
        orgId={orgId}
        jobId={jobId}
        userId={userId}
        online={online}
        savedSignature={savedComplete}
        pendingSignedBy={pendingComplete ? (pendingComplete.payload as SignaturePayload).signedBy : undefined}
        cachedSignedBy={!savedComplete && !pendingComplete ? (cachedComplete?.signedBy ?? undefined) : undefined}
      />
    </div>
  )
}
