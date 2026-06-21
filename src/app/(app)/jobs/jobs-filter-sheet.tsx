'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal } from 'lucide-react'
import { JobsSidebar } from './jobs-sidebar'

interface TagCount {
  tagId: string
  name: string
  color: string | null
  count: number
}

interface JobsFilterSheetProps {
  tagCounts: TagCount[]
}

export function JobsFilterSheet({ tagCounts }: JobsFilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="lg:hidden" />}>
        <SlidersHorizontal className="size-4" />
        Filters
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-4">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <JobsSidebar tagCounts={tagCounts} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
