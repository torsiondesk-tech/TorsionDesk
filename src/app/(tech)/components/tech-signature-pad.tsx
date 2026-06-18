'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import SignaturePad from 'signature_pad'
import { Eraser, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type SignaturePayload } from '@/app/(tech)/lib/sync'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { toast } from 'sonner'

interface SavedSignature {
  id: string
  url: string
  signedBy: string | null
  capturedBy: string | null
  createdAt: Date | null
}

interface TechSignaturePadProps {
  orgId: string
  jobId: string
  userId: string
  savedSignatures: SavedSignature[]
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

export function TechSignaturePad({ orgId, jobId, userId, savedSignatures }: TechSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const online = useOnline()
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const [signedBy, setSignedBy] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const pendingSignatures = useLiveQuery(
    () => db.outbox.where('type').equals('job_signature').sortBy('createdAt'),
    [db],
  )

  const pendingForJob = (pendingSignatures ?? []).filter(
    (item) => (item.payload as SignaturePayload).jobId === jobId,
  )

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
        filename: 'signature.png',
        fileSize: blob.size,
        blob,
        signedBy: signedBy.trim(),
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="signed-by">Signed by</Label>
        <Input
          id="signed-by"
          value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)}
          placeholder="Customer name"
          className="text-base"
        />
      </div>

      <div className="rounded-xl border bg-white p-2">
        <canvas
          ref={canvasRef}
          aria-label="Customer signature pad"
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
          Save Signature
        </Button>
      </div>

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

      {pendingForJob.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Queued signatures</p>
          {pendingForJob.map((item) => (
            <span
              key={item.id}
              className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
            >
              {(item.payload as SignaturePayload).signedBy} — {item.syncStatus}
            </span>
          ))}
        </div>
      )}

      {savedSignatures.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Saved signatures</p>
          {savedSignatures.map((sig) => (
            <Card key={sig.id} className="overflow-hidden">
              <CardContent className="p-0">
                <img
                  src={sig.url}
                  alt={`Signature by ${sig.signedBy ?? 'customer'}`}
                  className="w-full bg-white"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
