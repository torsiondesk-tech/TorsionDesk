import { Smartphone } from 'lucide-react'

/**
 * Technician holding page (D-14).
 *
 * Technicians (`org:technician`) are redirected here by the middleware before any
 * web shell renders. This is a clean, centered holding page with NO sidebar and
 * NO other navigation — Phase 5 replaces this redirect with the real PWA.
 *
 * It lives OUTSIDE the (app) route group on purpose, so it never inherits the
 * shell layout/sidebar.
 */
export default function MobileComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Smartphone className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Your mobile app is on the way</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          The TorsionDesk technician app is being built and will be available
          soon. Hang tight — you will be able to manage your jobs right from your
          phone.
        </p>
      </div>
    </main>
  )
}
