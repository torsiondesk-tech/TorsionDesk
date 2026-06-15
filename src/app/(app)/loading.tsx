export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="h-64 animate-pulse rounded-lg bg-muted md:col-span-2" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
