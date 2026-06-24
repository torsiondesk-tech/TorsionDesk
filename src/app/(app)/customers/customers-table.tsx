'use client'

import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useTransition } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { formatPhone, cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CustomerRow } from '@/lib/customers'

interface CustomersTableProps {
  rows: CustomerRow[]
  pageCount: number
  page: number
  pageSize: number
}

const MOBILE_HIDDEN: Record<string, string> = {
  accountNo: 'hidden sm:table-cell',
  primaryEmail: 'hidden md:table-cell',
  primaryCity: 'hidden sm:table-cell',
  tagNames: 'hidden sm:table-cell',
}

const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        href={`/customers/${row.original.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'accountNo',
    header: 'Account #',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.accountNo}</span>
    ),
  },
  {
    accessorKey: 'primaryPhone',
    header: 'Phone',
    cell: ({ row }) => formatPhone(row.original.primaryPhone) || '—',
  },
  {
    accessorKey: 'primaryEmail',
    header: 'Email',
    cell: ({ row }) => row.original.primaryEmail || '—',
  },
  {
    accessorKey: 'primaryCity',
    header: 'City',
  },
  {
    accessorKey: 'tagNames',
    header: 'Tags',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.tagNames.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.active ? 'default' : 'outline'}>
        {row.original.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
]

export function CustomersTable({
  rows,
  pageCount,
  page,
  pageSize,
}: CustomersTableProps) {
  const [q] = useQueryState('q')
  const [, setPage] = useQueryState('page', { shallow: false })
  const [isPending, startTransition] = useTransition()

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
      setPage(p > 0 ? String(p) : null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={cn(MOBILE_HIDDEN[h.column.id])}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-pending={isPending}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn(MOBILE_HIDDEN[cell.column.id])}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {q ? (
                    <p className="text-muted-foreground">No customers match &ldquo;{q}&rdquo;.</p>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No customers yet.</p>
                      <Link href="/customers/new">
                        <Button variant="outline" size="sm">Create your first customer</Button>
                      </Link>
                    </div>
                  )}
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
