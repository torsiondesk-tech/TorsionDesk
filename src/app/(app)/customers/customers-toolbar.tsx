'use client'

import { useQueryState } from 'nuqs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTransition } from 'react'

export function CustomersToolbar() {
  const [q, setQ] = useQueryState('q')
  const [status, setStatus] = useQueryState('status')
  const [page, setPage] = useQueryState('page')
  const [isPending, startTransition] = useTransition()

  const handleSearch = (val: string) => {
    startTransition(() => {
      setQ(val || null)
      setPage(null)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search by name, phone, email, or address…"
        defaultValue={q ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value
          if (isPending) return
          handleSearch(v)
        }}
        className="max-w-sm"
      />
      <select
        value={status ?? ''}
        onChange={(e) => {
          const v = e.target.value
          startTransition(() => {
            setStatus(v || null)
            setPage(null)
          })
        }}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  )
}
