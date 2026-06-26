'use client'

import Link from 'next/link'
import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsString } from 'nuqs'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  invoiceStatusBadgeVariant,
  invoiceStatusLabel,
} from '@/lib/invoices/status'
import { deleteInvoiceAction } from './actions'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  MoreVertical,
  FileText,
  Banknote,
  Download,
  Link as LinkIcon,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  MailOpen,
} from 'lucide-react'

export interface InvoiceRow {
  id: string
  tenantId: string
  invoiceNo: number
  customerId: string
  customerName: string | null
  jobId: string
  jobNo: number | null
  invoiceDate: string | null
  dueDate: string | null
  total: string
  balance: string
  paymentLinkUrl: string | null
  paymentTermsDays: number | null
  sentOn: string | null
  emailOpenedAt: string | null
  createdAt: string | null
}

interface InvoicesTableProps {
  rows: InvoiceRow[]
  orgId: string
  status?: string
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function formatMoney(value: string | number | null) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return '—'
  return `$${num.toFixed(2)}`
}

function formatTerms(days: number | null): string {
  if (days == null) return '—'
  if (days === 0) return 'Due on Receipt'
  return `Net ${days}`
}

const PAGE_SIZE = 10

const SORTABLE_COLUMNS = new Set([
  'invoiceNo',
  'invoiceDate',
  'dueDate',
  'total',
  'balance',
])

export function InvoicesTable({ rows, orgId, status }: InvoicesTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [{ sort, dir }, setParams] = useQueryStates(
    {
      sort: parseAsString.withDefault(''),
      dir: parseAsString.withDefault('desc'),
    },
    { shallow: false, startTransition },
  )

  const [deleting, setDeleting] = useState<InvoiceRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.customerName?.toLowerCase().includes(q) ?? false) ||
        String(r.invoiceNo).includes(q),
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const multiplier = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null
      switch (sort) {
        case 'invoiceNo':
          aVal = a.invoiceNo
          bVal = b.invoiceNo
          break
        case 'invoiceDate':
          aVal = a.invoiceDate ? new Date(a.invoiceDate).getTime() : null
          bVal = b.invoiceDate ? new Date(b.invoiceDate).getTime() : null
          break
        case 'dueDate':
          aVal = a.dueDate ? new Date(a.dueDate).getTime() : null
          bVal = b.dueDate ? new Date(b.dueDate).getTime() : null
          break
        case 'total':
          aVal = parseFloat(a.total)
          bVal = parseFloat(b.total)
          break
        case 'balance':
          aVal = parseFloat(a.balance)
          bVal = parseFloat(b.balance)
          break
        default:
          return 0
      }
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1 * multiplier
      if (bVal == null) return -1 * multiplier
      return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * multiplier
    })
  }, [filtered, sort, dir])

  const toggleSort = (columnId: string) => {
    startTransition(() => {
      if (sort === columnId) {
        setParams({ dir: dir === 'asc' ? 'desc' : 'asc' })
      } else {
        setParams({ sort: columnId, dir: 'asc' })
      }
    })
  }

  const handleCopyLink = async (url: string | null) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Payment link copied.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  const handleDelete = async (row: InvoiceRow) => {
    setIsDeleting(true)
    const result = await deleteInvoiceAction(orgId, row.id)
    setIsDeleting(false)
    setDeleting(null)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast(`Invoice #INV-${row.invoiceNo} deleted.`)
      router.refresh()
    }
  }

  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => [
      {
        accessorKey: 'invoiceDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.invoiceDate),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => {
          const name = row.original.customerName
          if (!name) return '—'
          return (
            <Link
              href={`/customers/${row.original.customerId}`}
              className="font-medium text-foreground hover:underline"
            >
              {name}
            </Link>
          )
        },
      },
      {
        accessorKey: 'invoiceNo',
        header: 'Invoice #',
        cell: ({ row }) => (
          <Link
            href={`/invoices/${row.original.id}`}
            className="font-medium text-foreground hover:underline"
          >
            #INV-{row.original.invoiceNo}
          </Link>
        ),
      },
      {
        accessorKey: 'jobNo',
        header: 'Job #',
        cell: ({ row }) => {
          const { jobId, jobNo } = row.original
          return (
            <Link
              href={`/jobs/${jobId}`}
              className="font-medium text-foreground hover:underline"
            >
              #JOB-{jobNo ?? jobId.slice(0, 6)}
            </Link>
          )
        },
      },
      {
        id: 'poNumber',
        header: 'PO #',
        cell: () => <span className="text-muted-foreground">—</span>,
      },
      {
        id: 'terms',
        header: 'Terms',
        cell: ({ row }) => formatTerms(row.original.paymentTermsDays),
      },
      {
        id: 'sent',
        header: 'Sent',
        cell: ({ row }) => {
          const { sentOn, emailOpenedAt } = row.original
          if (emailOpenedAt) {
            return (
              <span
                title={`Opened ${formatDate(emailOpenedAt)}`}
                className="flex items-center"
              >
                <MailOpen className="size-4 text-emerald-600" />
              </span>
            )
          }
          if (sentOn) {
            return (
              <span
                title={`Sent ${formatDate(sentOn)}`}
                className="flex items-center"
              >
                <Mail className="size-4 text-blue-500" />
              </span>
            )
          }
          return <span className="text-muted-foreground">—</span>
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const balance = parseFloat(row.original.balance)
          const total = parseFloat(row.original.total)
          const due = row.original.dueDate ? new Date(row.original.dueDate) : null
          const variant = invoiceStatusBadgeVariant(balance, total, due)
          const label = invoiceStatusLabel(balance, total, due)
          return <Badge variant={variant}>{label}</Badge>
        },
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{formatMoney(row.original.total)}</div>
        ),
      },
      {
        accessorKey: 'balance',
        header: 'Total Due',
        cell: ({ row }) => {
          const balance = parseFloat(row.original.balance)
          return (
            <div className="text-right tabular-nums">
              {balance === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatMoney(row.original.balance)
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const invoice = row.original
          return (
            <Popover>
              <PopoverTrigger
                className={cn(
                  'flex size-8 items-center justify-center rounded-md transition-colors',
                  'hover:bg-muted',
                )}
                aria-label="Invoice actions"
              >
                <MoreVertical className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <FileText className="size-4" />
                    View Invoice
                  </Link>
                  <Link
                    href={`/payments/new?invoiceId=${invoice.id}&customerId=${invoice.customerId}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <Banknote className="size-4" />
                    Receive Payment
                  </Link>
                  <Link
                    href={`/api/invoices/${invoice.id}/pdf`}
                    target="_blank"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <Download className="size-4" />
                    Download PDF
                  </Link>
                  {invoice.paymentLinkUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => handleCopyLink(invoice.paymentLinkUrl)}
                    >
                      <LinkIcon className="mr-2 size-4" />
                      Copy Payment Link
                    </Button>
                  )}
                  <div className="my-1 h-px bg-border" />
                  <Dialog open={!!deleting && deleting.id === invoice.id} onOpenChange={(open) => !open && setDeleting(null)}>
                    <DialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start text-destructive hover:text-destructive"
                          onClick={() => setDeleting(invoice)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete Invoice
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Delete this invoice?</DialogTitle>
                        <DialogDescription>
                          {deleting ? (
                            <>
                              Invoice #INV-{deleting.invoiceNo} and its line items will be
                              permanently removed. Recorded payments stay on the ledger and
                              become unallocated. This can&apos;t be undone.
                            </>
                          ) : null}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" onClick={() => setDeleting(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={isDeleting}
                          onClick={() => deleting && handleDelete(deleting)}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete Invoice'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </PopoverContent>
            </Popover>
          )
        },
      },
    ],
    [deleting, isDeleting, orgId],
  )

  const table = useReactTable({
    data: sorted,
    columns,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  })

  const hasFilters = !!status || !!search.trim()
  const emptyHeading = hasFilters
    ? 'No invoices match this filter.'
    : status === 'unpaid'
      ? "No open invoices — everything's paid."
      : 'No invoices yet'
  const emptyBody = hasFilters
    ? 'Try adjusting or clearing your filters.'
    : 'Invoices you create from completed jobs will appear here. Close a job to generate its first invoice.'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by customer or invoice #"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              table.setPageIndex(0)
            }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = SORTABLE_COLUMNS.has(h.column.id)
                  const isActive = sort === h.column.id
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(
                        'uppercase tracking-wide text-xs',
                        sortable && 'cursor-pointer select-none',
                        ['total', 'balance'].includes(h.column.id) && 'text-right',
                      )}
                      onClick={sortable ? () => toggleSort(h.column.id) : undefined}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-1',
                          ['total', 'balance'].includes(h.column.id) && 'justify-end',
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {isActive && (
                          <span className="text-[10px]">
                            {dir === 'asc' ? '↑' : '↓'}
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
                    <p className="text-muted-foreground font-medium">{emptyHeading}</p>
                    <p className="text-sm text-muted-foreground">{emptyBody}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
