'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog'

export function TechSignOutButton() {
  const { signOut } = useClerk()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
            <LogOut className="size-5" />
          </Button>
        }
      />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Sign out?</DialogTitle>
          <DialogDescription>You will be returned to the sign-in page.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={() => signOut({ redirectUrl: '/sign-in' })}>
            Sign out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
