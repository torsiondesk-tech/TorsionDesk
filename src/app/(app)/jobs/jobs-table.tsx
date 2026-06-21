'use client'

import Link from 'next/link'
import { useQueryStates, parseAsString, parseAsInteger } from 'nuqs'
import { useTransition } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { JobRow } from '@/lib/jobs/jobs'
import { STATUS_GROUPS, statusBadgeVariant, statusLabel } from '@/lib/jobs/transitions'
import { cn } from '@/lib/utils'

interface JobsTableProps {
  rows: JobRow[]
  pageCount: number
  page: number
  pageSize: number
  bucket?: string
}

const MOBILE_HIDDEN: Record<string, string> = {
  city: 'hidden sm:table-cell',
  category: 'hidden md:table-cell',
  priority: 'hidden sm:table-cell',
  startDate: 'hidden sm:table-cell',
}

function priorityLabel(priority: string | null) {
  if (!priority) return '—'
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

const columns: ColumnDef<JobRow>[] = [
  {
    accessorKey: 'jobNo',
    header: 'Job #',
    cell: ({ row }) => (
      <Link
        href={`/jobs/${row.original.id}`}
        className="font-medium text-foreground hover:underline tabular-nums"
      >
        #{`JOB-${row.original.jobNo}`}
      </Link>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block text-muted-foreground">
        {row.original.description ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'city',
    header: 'City',
    cell: ({ row }) => row.original.city ?? '—',
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.original.category ?? '—',
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => priorityLabel(row.original.priority),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusBadgeVariant(row.original.status)}>
        {statusLabel(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: 'startDate',
    header: 'Date',
    cell: ({ row }) => formatDate(row.original.startDate),
  },
]

export function JobsTable({ rows, pageCount, page, pageSize, bucket }: JobsTableProps) {
  const [isPending, startTransition] = useTransition()
  const [{ sort, dir }, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(0),
      sort: parseAsString.withDefault(''),
      dir: parseAsString.withDefault('desc'),
    },
    {
      shallow: false,
      startTransition,
    },
  )

  const currentSort = sort
  const currentDir = dir

  const table = useReactTable({
    data: rows,
    columns,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    state: {
      pagination: { pageIndex: page, pageSize },
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const goToPage = (p: number) => {
    startTransition(() => {
      setParams({ page: p > 0 ? p : null })
    })
  }

  const toggleSort = (columnId: string) => {
    startTransition(() => {
      if (currentSort === columnId) {
        const nextDir = currentDir === 'asc' ? 'desc' : 'asc'
        setParams({ dir: nextDir })
      } else {
        setParams({ sort: columnId, dir: 'asc', page: null })
      }
    })
  }

  const isSortable = (id: string) =>
    ['jobNo', 'customerName', 'city', 'category', 'priority', 'startDate'].includes(id)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = isSortable(h.column.id)
                  const isActive = currentSort === h.column.id
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        MOBILE_HIDDEN[h.column.id],
                        'uppercase tracking-wide text-xs',
                        sortable && 'cursor-pointer select-none',
                      )}
                      onClick={sortable ? () => toggleSort(h.column.id) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {isActive && (
                          <span className="text-[10px]">
                            {currentDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-pending={isPending} className="py-2">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn(MOBILE_HIDDEN[cell.column.id], 'py-2')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">
                      {bucket === 'advanced_search'
                        ? 'No jobs match your filters.'
                        : 'No open jobs'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bucket === 'advanced_search'
                        ? 'Try adjusting or clearing your filters.'
                        : 'Jobs you create will appear here. Create your first job to get started.'}
                    </p>
                    <Link href="/jobs/new">
                      <Button variant="outline" size="sm">Create Job</Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 0 || isPending}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount - 1 || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
