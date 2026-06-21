'use client'

import { useQueryState } from 'nuqs'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function CustomersToolbar() {
  const [q, setQ] = useQueryState('q', { shallow: false })
  const [status, setStatus] = useQueryState('status', { shallow: false })
  const [page, setPage] = useQueryState('page', { shallow: false })
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search by name, phone, email, or address…"
        value={q ?? ''}
        onChange={(e) => {
          startTransition(() => {
            setQ(e.currentTarget.value || null)
            setPage(null)
          })
        }}
        className="max-w-sm"
      />
      <Select
        value={status ?? ''}
        onValueChange={(val) => {
          startTransition(() => {
            setStatus(val || null)
            setPage(null)
          })
        }}
      >
        <SelectTrigger className="h-8 w-full sm:w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
