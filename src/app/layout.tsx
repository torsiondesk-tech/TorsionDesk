import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'TorsionDesk',
  description: 'Field service CRM for garage door service businesses.',
}

/**
 * Root layout.
 *
 * Wraps the entire app in <ClerkProvider> (RESEARCH Pattern 1). This is what
 * makes Clerk's native Supabase third-party auth, session persistence (AUTH-04),
 * and the built-in password-reset flow (AUTH-05) available to every route —
 * no extra code required. Sign-in / sign-up routes are added by Plan 03.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("font-sans", geist.variable)}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
