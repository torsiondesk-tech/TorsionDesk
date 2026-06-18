import { auth } from '@clerk/nextjs/server'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Sidebar } from '@/components/shell/sidebar'
import { CreateNewButton } from '@/components/header/create-new-button'
import { GlobalSearch } from '@/components/header/global-search'
import { ModeToggle } from '@/components/theme/mode-toggle'

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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={orgRole ?? ''} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <div />
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <ModeToggle />
            <CreateNewButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <NuqsAdapter>{children}</NuqsAdapter>
        </main>
      </div>
    </div>
  )
}
