export default function SettingsLoading() {
  return (
    <div className="min-w-0 flex-1 space-y-6">
      {/* Card skeleton */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
        <div className="space-y-3 pt-2">
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-9 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Second card skeleton */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
        <div className="flex items-center gap-5 pt-2">
          <div className="size-20 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  )
}
