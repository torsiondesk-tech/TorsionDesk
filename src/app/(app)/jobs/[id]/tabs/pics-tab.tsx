'use client'

export function PicsTab({
  jobId,
  photos,
}: {
  jobId: string
  photos: { id: string; url: string; uploadedBy: string | null; createdAt: Date | null }[]
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <p className="text-muted-foreground">Pics tab placeholder — {photos.length} photos.</p>
    </div>
  )
}
