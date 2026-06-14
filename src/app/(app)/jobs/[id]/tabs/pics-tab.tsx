'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { uploadJobPhotoAction } from '../../actions'
import { Upload, ImageIcon } from 'lucide-react'

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

export function PicsTab({ jobId, photos }: PicsTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await uploadJobPhotoAction(jobId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        form.reset()
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Upload control */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="hidden"
          onChange={() => {
            const form = fileInputRef.current?.closest('form')
            if (form) form.requestSubmit()
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4 mr-1" />
          {isPending ? 'Uploading…' : 'Upload Photo'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
      </form>

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
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              <img
                src={photo.url}
                alt="Job photo"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
