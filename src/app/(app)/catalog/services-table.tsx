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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ServiceRow } from '@/lib/catalog'
import { ExportButton } from './export-button'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

interface ServicesTableProps {
  rows: ServiceRow[]
  pageCount: number
  page: number
  pageSize: number
  onDelete?: (id: string) => void
}

export function ServicesTable({
  rows,
  pageCount,
  page,
  pageSize,
  onDelete,
}: ServicesTableProps) {
  const [, setPage] = useQueryState('page')
  const [isPending, startTransition] = useTransition()

  const columns = useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <Link
            href={`/catalog/services/${row.original.id}/edit`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'categoryName',
        header: 'Category',
        cell: ({ row }) => row.original.categoryName ?? '—',
      },
      {
        accessorKey: 'unitPrice',
        header: 'Price',
        cell: ({ row }) => {
          const price = row.original.unitPrice
          return (
            <span className="tabular-nums block text-right">
              {price ? `$${Number(price).toFixed(2)}` : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'unitCost',
        header: 'Cost',
        cell: ({ row }) => {
          const cost = row.original.unitCost
          return (
            <span className="tabular-nums block text-right">
              {cost ? `$${Number(cost).toFixed(2)}` : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'active',
        header: 'Active',
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'outline' : 'secondary'}>
            {row.original.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      ...(onDelete
        ? [
            {
              id: 'delete',
              header: '',
              cell: ({ row }: { row: { original: ServiceRow } }) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete “${row.original.name}”?`)) {
                      onDelete(row.original.id)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ),
            } as ColumnDef<ServiceRow>,
          ]
        : []),
    ],
    [onDelete],
  )

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
      <div className="flex items-center justify-between">
        <ExportButton kind="service" />
        <Link href="/catalog/services/new">
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            New Service
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
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
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-muted-foreground">No services yet</p>
                    <p className="text-sm text-muted-foreground">
                      Add your first service to start building the catalog.
                    </p>
                    <Link href="/catalog/services/new">
                      <Button variant="outline" size="sm">
                        <Plus className="size-4" />
                        New Service
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
