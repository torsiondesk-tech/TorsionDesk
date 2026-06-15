'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getJobPhotoUploadUrlAction,
  confirmJobPhotoAction,
  deleteJobPhotoAction,
} from '../../actions'
import { Upload, ImageIcon, Trash2, Download, Eye } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Photo {
  id: string
  url: string
  uploadedBy: string | null
  createdAt: Date | null
}

interface PicsTabProps {
  jobId: string
  photos: Photo[]
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function PicsTab({ jobId, photos }: PicsTabProps) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelected() {
    setError(null)
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)

    try {
      const urlResult = await getJobPhotoUploadUrlAction(jobId, file.name, file.size)
      if (urlResult.error || !urlResult.signedUrl || !urlResult.path) {
        throw new Error(urlResult.error ?? 'Failed to get upload URL')
      }

      const uploadRes = await fetch(urlResult.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      })
      if (!uploadRes.ok) {
        throw new Error(`Storage upload failed (${uploadRes.status})`)
      }

      const confirmResult = await confirmJobPhotoAction(jobId, urlResult.path)
      if (confirmResult.error) {
        throw new Error(confirmResult.error)
      }

      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('photoUpload', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = useCallback((photo: Photo) => {
    const a = document.createElement('a')
    a.href = photo.url
    a.download = `job-${jobId}-photo-${photo.id}.jpg`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [jobId])

  const handleDelete = useCallback(async (photoId: string) => {
    const result = await deleteJobPhotoAction(jobId, photoId)
    if (result.error) {
      setError(result.error)
    } else {
      setDeletingId(null)
      setLightboxPhoto(null)
      router.refresh()
    }
  }, [jobId, router])

  return (
    <div className="space-y-6">
      {/* Upload control */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelected}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4 mr-1" />
          {uploading ? 'Uploading…' : 'Upload Photo'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 gap-3">
          <ImageIcon className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No photos yet. Upload before/after photos for this job.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer"
              onClick={() => setLightboxPhoto(photo)}
            >
              <img
                src={photo.url}
                alt="Job photo"
                className="h-full w-full object-contain p-2 transition-transform group-hover:scale-[1.02]"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxPhoto(photo)
                  }}
                  aria-label="View full size"
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(photo)
                  }}
                  aria-label="Download"
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingId(photo.id)
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => { if (!open) setLightboxPhoto(null) }}>
        <DialogContent className="max-w-4xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo viewer</DialogTitle>
            <DialogDescription>View and manage job photo</DialogDescription>
          </DialogHeader>
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={lightboxPhoto.url}
                alt="Job photo full size"
                className="w-full max-h-[70vh] object-contain bg-muted"
              />
              {/* Lightbox toolbar — below image to avoid overlap with Dialog close button */}
              <div className="flex items-center justify-end gap-2 border-t bg-card p-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() => handleDownload(lightboxPhoto)}
                >
                  <Download className="size-4" />
                  Download
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1"
                  onClick={() => setDeletingId(lightboxPhoto.id)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this photo?</DialogTitle>
            <DialogDescription>
              This removes the photo from the job and from storage. This can&apos;t be undone.
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
              Delete Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
