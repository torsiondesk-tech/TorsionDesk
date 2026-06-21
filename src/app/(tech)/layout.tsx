import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { BottomNav } from './components/bottom-nav'
import { Toaster } from '@/components/ui/sonner'
import { TechSyncProvider } from './components/sync-provider'
import { OfflineBadge } from './components/offline-badge'
import { SyncToast } from './components/sync-toast'
import { CreateButton } from './components/create-button'
import { TechSignOutButton } from './components/tech-sign-out-button'

export const metadata: Metadata = {
  title: 'TorsionDesk Field',
  description: 'Technician mobile workspace',
  manifest: '/tech/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function TechLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <TechSyncProvider>
      <div className="bg-background h-dvh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
          <span className="font-semibold">TorsionDesk Field</span>
          <div className="flex items-center gap-1">
            <OfflineBadge />
            <TechSignOutButton />
          </div>
        </header>
        <main className="h-[calc(100dvh-3.5rem)] overflow-hidden">{children}</main>
        <BottomNav />
        <CreateButton />
        <Toaster />
        <SyncToast />
      </div>
    </TechSyncProvider>
  )
}
