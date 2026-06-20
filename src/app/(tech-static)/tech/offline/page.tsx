export const dynamic = 'force-static'

export default function TechOfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Some features are unavailable until you&apos;re back online. Your queued
        changes will sync automatically.
      </p>
    </main>
  )
}
