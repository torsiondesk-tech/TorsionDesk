'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import { Camera, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb, type OutboxItem } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type PhotoPayload } from '@/app/(tech)/lib/sync'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { cn } from '@/lib/utils'

interface SignedPhoto {
  id: string
  url: string
  uploadedBy: string | null
  createdAt: Date | null
}

interface PhotoUploaderProps {
  orgId: string
  jobId: string
  userId: string
  signedPhotos: SignedPhoto[]
}

export function PhotoUploader({ orgId, jobId, userId, signedPhotos }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const online = useOnline()
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const pendingItems = useLiveQuery(
    () => db.outbox.where('type').equals('job_photo').sortBy('createdAt'),
    [db],
  )

  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map())
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const photosForJob = (pendingItems ?? []).filter(
    (item) => (item.payload as PhotoPayload).jobId === jobId,
  )

  useEffect(() => {
    const urls = new Map<string, string>()
    for (const item of photosForJob) {
      const blob = (item.payload as PhotoPayload).blob
      if (blob) {
        urls.set(item.id, URL.createObjectURL(blob))
      }
    }
    setObjectUrls(urls)
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url)
      }
    }
  }, [photosForJob])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    await enqueueOutboxItem(orgId, {
      type: 'job_photo',
      payload: {
        jobId,
        filename: file.name,
        fileSize: file.size,
        blob: file,
      } satisfies PhotoPayload,
    })

    if (online) {
      void flushOutbox(orgId, userId)
    }

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function handleRetry() {
    void flushOutbox(orgId, userId)
  }

  async function handleDeleteConfirmed() {
    if (!deleteId) return
    await db.outbox.delete(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Add a job photo from camera"
      />

      <Button
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="mr-2 size-4" aria-hidden="true" />
        Add Photo
      </Button>

      {photosForJob.length === 0 && signedPhotos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No photos yet. Tap Add Photo to capture one.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {photosForJob.map((item) => {
          const payload = item.payload as PhotoPayload
          const url = objectUrls.get(item.id)
          const failed = item.syncStatus === 'failed'
          return (
            <Card
              key={item.id}
              className={cn(
                'relative overflow-hidden',
                failed && 'border-destructive',
              )}
            >
              <CardContent className="p-0">
                {url ? (
                  <img
                    src={url}
                    alt={payload.filename}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    <Camera className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  {failed ? (
                    <span className="rounded-md bg-destructive px-1.5 py-0.5 text-xs font-medium text-destructive-foreground">
                      Failed
                    </span>
                  ) : (
                    <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                      Pending
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  {failed && (
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      onClick={handleRetry}
                      aria-label="Retry upload"
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                  )}
                  <Dialog open={deleteId === item.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <DialogTrigger
                      render={
                        <Button
                          variant="secondary"
                          size="icon-xs"
                          aria-label="Delete queued photo"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <X className="size-3" />
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete photo?</DialogTitle>
                        <DialogDescription>
                          This queued photo will be removed and will not upload.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirmed}>Delete</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {signedPhotos.map((photo) => (
          <Card key={photo.id} className="overflow-hidden">
            <CardContent className="p-0">
              <img
                src={photo.url}
                alt="Job photo"
                className="aspect-square w-full object-cover"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
