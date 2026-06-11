import { auth } from '@clerk/nextjs/server'
import { Sidebar } from '@/components/shell/sidebar'

/**
 * Protected app shell (D-07/D-16; RESEARCH Pattern 5).
 *
 * Every route in the (app) group renders inside this shell. The middleware has
 * already guaranteed a signed-in, non-technician session by the time we get here,
 * and admin-gated /settings — this layout is the defense-in-depth UX layer.
 *
 * We read the active org role server-side via `auth()` and pass it to the client
 * `<Sidebar/>`, which uses `visibleModules(role)` to hide modules the role cannot
 * access. The role is NEVER trusted for enforcement here — the middleware is the
 * enforcement point; this is hiding for UX only (D-16).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgRole } = await auth()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={orgRole ?? ''} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
