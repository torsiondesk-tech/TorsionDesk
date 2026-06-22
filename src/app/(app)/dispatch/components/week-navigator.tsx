'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn, toISODate, getMonday } from '@/lib/utils'

function formatRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

export function WeekNavigator({ weekStart }: { weekStart: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const navigate = (date: Date) => {
    const monday = toISODate(getMonday(date))
    router.push(`?weekStart=${monday}`)
    setOpen(false)
  }

  const start = new Date(`${weekStart}T00:00:00`)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          const prev = new Date(start)
          prev.setDate(prev.getDate() - 7)
          navigate(prev)
        }}
        aria-label="Previous week"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(buttonVariants({ variant: 'outline' }), 'min-w-[200px] gap-2')}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {formatRange(weekStart)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={start}
            onSelect={(date) => {
              if (date) navigate(date)
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          const next = new Date(start)
          next.setDate(next.getDate() + 7)
          navigate(next)
        }}
        aria-label="Next week"
      >
        <ChevronRight className="size-4" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => navigate(new Date())}
      >
        Today
      </Button>
    </div>
  )
}
