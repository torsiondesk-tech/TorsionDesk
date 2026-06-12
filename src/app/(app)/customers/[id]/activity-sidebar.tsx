'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, FileText, Mail, Wrench, Banknote, MessageSquare } from 'lucide-react'

interface EventRow {
  id: string
  kind: string
  title: string | null
  body: string | null
  occurredAt: Date | null
  actor: string | null
}

interface ActivitySidebarProps {
  events: EventRow[]
  customerId: string
}

const KIND_ICON: Record<string, React.ReactNode> = {
  job: <Wrench className="size-3.5 text-blue-500" />,
  estimate: <FileText className="size-3.5 text-amber-500" />,
  invoice: <Banknote className="size-3.5 text-emerald-500" />,
  payment: <Banknote className="size-3.5 text-emerald-500" />,
  email: <Mail className="size-3.5 text-purple-500" />,
  note: <MessageSquare className="size-3.5 text-slate-500" />,
}

const KIND_LABEL: Record<string, string> = {
  job: 'Job',
  estimate: 'Estimate',
  invoice: 'Invoice',
  payment: 'Payment',
  email: 'Email',
  note: 'Note',
}

export function ActivitySidebar({ events }: ActivitySidebarProps) {
  const [filter, setFilter] = useState('all')

  const filtered =
    filter === 'all'
      ? events
      : events.filter((e) => {
          if (filter === 'notes') return e.kind === 'note'
          if (filter === 'jobs') return e.kind === 'job'
          if (filter === 'emails') return e.kind === 'email'
          if (filter === 'invoices') return e.kind === 'invoice' || e.kind === 'payment'
          return true
        })

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled title="Coming soon">
          <Plus className="size-3" />
          New
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <Tabs value={filter} onValueChange={setFilter} className="mb-3">
          <TabsList className="h-7 w-full">
            <TabsTrigger value="all" className="text-[10px] px-2">All</TabsTrigger>
            <TabsTrigger value="notes" className="text-[10px] px-2">Notes</TabsTrigger>
            <TabsTrigger value="jobs" className="text-[10px] px-2">Jobs</TabsTrigger>
            <TabsTrigger value="emails" className="text-[10px] px-2">Emails</TabsTrigger>
            <TabsTrigger value="invoices" className="text-[10px] px-2">Invoices</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">
              No activity matches this filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="rounded-md border p-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {KIND_ICON[e.kind] ?? (
                      <div className="size-3.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {e.title ?? KIND_LABEL[e.kind] ?? e.kind}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {e.occurredAt
                          ? new Date(e.occurredAt).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                    {e.body && (
                      <p className="text-xs leading-snug text-muted-foreground">
                        {e.body}
                      </p>
                    )}
                    {e.actor && (
                      <p className="text-[10px] text-muted-foreground">
                        by {e.actor}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
