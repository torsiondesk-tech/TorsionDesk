'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TechSignOutButton() {
  const { signOut } = useClerk()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      onClick={() => signOut({ redirectUrl: '/sign-in' })}
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-5" />
    </Button>
  )
}
