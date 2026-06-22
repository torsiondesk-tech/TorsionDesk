'use client'

import Link from 'next/link'
import { useQueryStates, parseAsString, parseAsBoolean } from 'nuqs'
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
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { StarPicker } from '@/components/line-items/star-picker'

export interface EstimateRow {
  id: string
  tenantId: string
  status: string
  customerId: string
  customerName: string | null
  description: string | null
  value: number | null
  followUpDate: string | null
  expiryDate: string | null
  notes: string | null
  createdAt: string | null
  assignedAgentId?: string | null
  opportunityRating?: number | null
}

interface EstimatesTableProps {
  rows: EstimateRow[]
  userId?: string
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function formatMoney(value: number | null) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

const columns: ColumnDef<EstimateRow>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Requested On',
    cell: ({ row }) => (
      <Link
        href={`/estimates/${row.original.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {formatDate(row.original.createdAt)}
      </Link>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => row.original.customerName ?? '—',
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="max-w-[240px] truncate block text-muted-foreground">
        {row.original.description ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => formatMoney(row.original.value),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={estimateStatusBadgeVariant(row.original.status)}>
        {estimateStatusLabel(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: 'opportunityRating',
    header: 'Rating',
    cell: ({ row }) => {
      const rating = (row.original as unknown as { opportunityRating?: number | null }).opportunityRating
      return <StarPicker value={rating ?? null} onChange={() => {}} readOnly />
    },
  },
]

export function EstimatesTable({ rows, userId }: EstimatesTableProps) {
  const [isPending, startTransition] = useTransition()
  const [{ status, mine }] = useQueryStates(
    {
      status: parseAsString.withDefault(''),
      mine: parseAsBoolean.withDefault(false),
    },
    { shallow: false, startTransition },
  )

  const filteredRows = rows.filter((row) => {
    if (status && row.status !== status) return false
    if (mine && userId && row.assignedAgentId !== userId) return false
    return true
  })

  const hasFilters = !!status || mine

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="uppercase tracking-wide text-xs"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-pending={isPending} className="py-2">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground font-medium">
                      {hasFilters ? 'No estimates match your filters.' : 'No estimates yet'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasFilters
                        ? 'Try adjusting or clearing your filters.'
                        : 'Estimates you create will appear here. Create your first estimate to get started.'}
                    </p>
                    {!hasFilters && (
                      <Link href="/estimates/new">
                        <Button variant="outline" size="sm">Create Estimate</Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
