'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const { signOut } = useClerk()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => signOut({ redirectUrl: '/sign-in' })}
    >
      <LogOut className="size-5" />
    </Button>
  )
}
