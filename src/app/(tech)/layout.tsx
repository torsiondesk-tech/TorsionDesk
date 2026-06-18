import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { BottomNav } from './components/bottom-nav'

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

export default async function TechLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="font-semibold">TorsionDesk Field</span>
      </header>
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>
      <BottomNav />
    </div>
  )
}
