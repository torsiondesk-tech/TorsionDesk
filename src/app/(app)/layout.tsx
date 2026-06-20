import { auth } from '@clerk/nextjs/server'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Sidebar } from '@/components/shell/sidebar'
import { MobileNav } from '@/components/shell/mobile-nav'
import { CreateNewButton } from '@/components/header/create-new-button'
import { GlobalSearch } from '@/components/header/global-search'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { SignOutButton } from '@/components/header/sign-out-button'

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
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 lg:px-6">
          <div className="flex items-center gap-2">
            {/* Hamburger — only visible on mobile (sidebar is hidden there) */}
            <MobileNav role={orgRole ?? ''} />
            {/* App name shown on mobile since the sidebar is hidden */}
            <span className="font-semibold lg:hidden">TorsionDesk</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <GlobalSearch />
            <ModeToggle />
            <SignOutButton />
            <CreateNewButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <NuqsAdapter>{children}</NuqsAdapter>
        </main>
      </div>
    </div>
  )
}
