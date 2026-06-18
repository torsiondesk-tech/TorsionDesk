'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DayCellProps {
  techId: string
  date: string
  children?: React.ReactNode
}

export function DayCell({ techId, date, children }: DayCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${techId}:${date}`,
    data: { techId, date },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-b border-r p-1 min-h-[180px] transition-colors',
        isOver ? 'bg-primary/10' : 'bg-background',
      )}
    >
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}
