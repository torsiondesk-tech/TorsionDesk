'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console in development; in production this should route to
    // an error-tracking service (Sentry, LogRocket, etc.).
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. Try refreshing or
          contact support if the problem persists.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-2 max-w-md overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}
