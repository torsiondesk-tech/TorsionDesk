'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Banknote,
  ChevronDown,
  Copy,
  Download,
  Link as LinkIcon,
  Loader2,
  Mail,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  deleteInvoiceAction,
  generateStripePaymentLinkAction,
  listContactsAction,
  listLocationsAction,
  sendInvoiceAction,
  updateInvoiceAction,
  type getInvoiceAction,
} from '../actions'
import {
  getJobLineItemsAction,
  replaceJobLineItemsAction,
} from '@/app/(app)/jobs/actions'
import {
  GroupedLineItems,
  type LineItemGroup,
  type LineItemRow,
} from '@/components/line-items/grouped-line-items'
import type { customers } from '@/db/schema'

interface ServiceLocation {
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

interface JobDetails {
  jobNo: number | null
  startDate: string | null
  poNumber: string | null
  description: string | null
}

type ContactOption = { id: string; firstName: string; lastName: string | null; billingContact: boolean | null }
type LocationOption = {
  id: string
  name: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

interface InvoiceDetailShellProps {
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceAction>>>
  customer: typeof customers.$inferSelect | null
  serviceLocation?: ServiceLocation | null
  jobDetails?: JobDetails | null
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function fmtMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '$0.00'
  const n = Number(value)
  if (Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function fmtTerms(days: number | null): string {
  if (days == null) return '—'
  if (days === 0) return 'Due on Receipt'
  return `Net ${days}`
}

function buildAddressLines(loc: ServiceLocation | null | undefined): string[] {
  if (!loc) return []
  const lines: string[] = []
  if (loc.addressLine1) lines.push(loc.addressLine1)
  const cityStateZip = [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')
  if (cityStateZip) lines.push(cityStateZip)
  return lines
}

const STATUS_CONFIG: Record<string, { bar: string; label: string }> = {
  'Unpaid':         { bar: 'bg-amber-400',  label: 'UNPAID' },
  'Past Due':       { bar: 'bg-red-500',    label: 'PAST DUE' },
  'Paid in Full':   { bar: 'bg-emerald-500',label: 'PAID IN FULL' },
  'Partially Paid': { bar: 'bg-blue-400',   label: 'PARTIALLY PAID' },
}

const TERMS_OPTIONS = [
  { value: '0',  label: 'Due on Receipt' },
  { value: '15', label: 'Net 15' },
  { value: '30', label: 'Net 30' },
  { value: '45', label: 'Net 45' },
  { value: '60', label: 'Net 60' },
]

const SENT_BY_OPTIONS = [
  { value: '',              label: '—' },
  { value: 'Email',         label: 'Email' },
  { value: 'Text Message',  label: 'Text Message' },
  { value: 'Mail',          label: 'Mail' },
  { value: 'In Person',     label: 'In Person' },
  { value: 'Fax',           label: 'Fax' },
]

export function InvoiceDetailShell({
  invoice,
  customer,
  serviceLocation,
  jobDetails,
}: InvoiceDetailShellProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [removeJobsOpen, setRemoveJobsOpen] = useState(false)
  const [jobSelected, setJobSelected] = useState(false)
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(invoice.paymentLinkUrl)
  const [generatingLink, setGeneratingLink] = useState(false)

  // Change Bill To Account dialog
  const [custDialogOpen, setCustDialogOpen] = useState(false)
  const [custContacts, setCustContacts] = useState<ContactOption[]>([])
  const [custAddresses, setCustAddresses] = useState<LocationOption[]>([])
  const [custLoading, setCustLoading] = useState(false)

  // Change Address dialog
  const [addrDialogOpen, setAddrDialogOpen] = useState(false)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [addrLoading, setAddrLoading] = useState(false)

  // Line items lightbox
  const [lineItemsOpen, setLineItemsOpen] = useState(false)
  const [lineItemsLoading, setLineItemsLoading] = useState(false)
  const [lineItemsSaving, setLineItemsSaving] = useState(false)
  const [editLineItems, setEditLineItems] = useState<LineItemRow[]>([])
  const [editGroups, setEditGroups] = useState<LineItemGroup[]>([])
  const [lineItemsRefData, setLineItemsRefData] = useState<{
    taxItems: Array<{ id: string; name: string; rate: string | null }>
    productCategories: Array<{ id: string; name: string }>
  }>({ taxItems: [], productCategories: [] })

  // Edit form state — reset to current invoice values when entering edit mode
  const [editDate, setEditDate] = useState(invoice.invoiceDate ?? '')
  const [editTerms, setEditTerms] = useState(String(invoice.paymentTermsDays ?? 0))
  const [editNotes, setEditNotes] = useState(invoice.notes ?? '')
  const [editSentBy, setEditSentBy] = useState(invoice.sentBy ?? '')
  const [editSentOn, setEditSentOn] = useState(invoice.sentOn ?? '')

  const totalNum = Number(invoice.total)
  const balanceNum = Number(invoice.balance)
  const paidNum = totalNum - balanceNum

  const statusCfg = STATUS_CONFIG[invoice.status] ?? {
    bar: 'bg-muted-foreground',
    label: invoice.status.toUpperCase(),
  }
  const addressLines = buildAddressLines(serviceLocation)

  const enterEdit = () => {
    setEditDate(invoice.invoiceDate ?? '')
    setEditTerms(String(invoice.paymentTermsDays ?? 0))
    setEditNotes(invoice.notes ?? '')
    setEditSentBy(invoice.sentBy ?? '')
    setEditSentOn(invoice.sentOn ?? '')
    setMode('edit')
  }

  const openLineItemsDialog = async () => {
    setLineItemsOpen(true)
    setLineItemsLoading(true)
    const result = await getJobLineItemsAction(invoice.tenantId, invoice.jobId)
    if ('error' in result) {
      toast.error(result.error)
      setLineItemsOpen(false)
    } else {
      setEditLineItems(result.lineItems as LineItemRow[])
      setEditGroups(result.lineItemGroups)
      setLineItemsRefData({ taxItems: result.taxItems, productCategories: result.productCategories })
    }
    setLineItemsLoading(false)
  }

  const saveLineItems = async () => {
    setLineItemsSaving(true)
    const normalizedItems = editLineItems.map((i) => ({
      ...i,
      refId: i.refId ?? null,
      title: i.title ?? null,
      taxItemId: i.taxItemId ?? null,
      groupId: i.groupId ?? null,
    }))
    const normalizedGroups = editGroups.map((g) => ({
      ...g,
      sortOrder: g.sortOrder ?? 0,
    }))
    const result = await replaceJobLineItemsAction(
      invoice.tenantId,
      invoice.jobId,
      normalizedItems,
      normalizedGroups,
    )
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Line items saved.')
      setLineItemsOpen(false)
      router.refresh()
    }
    setLineItemsSaving(false)
  }

  const openCustDialog = async () => {
    setCustContacts([])
    setCustAddresses([])
    setCustLoading(true)
    setCustDialogOpen(true)
    const [contactRows, locationRows] = await Promise.all([
      listContactsAction(invoice.tenantId, invoice.customerId),
      listLocationsAction(invoice.tenantId, invoice.customerId),
    ])
    setCustContacts(contactRows)
    setCustAddresses(locationRows)
    setCustLoading(false)
  }

  const handleContactSelect = async (contactId: string) => {
    const result = await updateInvoiceAction(invoice.tenantId, invoice.id, { contactId })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Billing contact updated.')
      setCustDialogOpen(false)
      router.refresh()
    }
  }

  const handleBillToAddressSelect = async (locationId: string) => {
    const result = await updateInvoiceAction(invoice.tenantId, invoice.id, {
      serviceLocationId: locationId,
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Billing address updated.')
      setCustDialogOpen(false)
      router.refresh()
    }
  }

  const openAddrDialog = async () => {
    setLocations([])
    setAddrLoading(true)
    setAddrDialogOpen(true)
    const locs = await listLocationsAction(invoice.tenantId, invoice.customerId)
    setLocations(locs)
    setAddrLoading(false)
  }

  const handleLocSelect = async (locationId: string) => {
    const result = await updateInvoiceAction(invoice.tenantId, invoice.id, {
      serviceLocationId: locationId,
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Service location updated.')
      setAddrDialogOpen(false)
      router.refresh()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateInvoiceAction(invoice.tenantId, invoice.id, {
        invoiceDate: editDate || undefined,
        paymentTermsDays: editTerms !== '' ? parseInt(editTerms, 10) : null,
        notes: editNotes || null,
        sentBy: editSentBy || null,
        sentOn: editSentOn || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Invoice saved.')
        setMode('view')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEmail = async () => {
    try {
      await sendInvoiceAction(invoice.tenantId, invoice.id)
      toast('Email sending will be available in a later release. Download the PDF to send manually.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invoice.')
    }
  }

  const handleCopyLink = async () => {
    if (!paymentLinkUrl) return
    try {
      await navigator.clipboard.writeText(paymentLinkUrl)
      toast('Payment link copied.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    try {
      const result = await generateStripePaymentLinkAction(invoice.tenantId, invoice.id)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'Could not generate payment link.')
        return
      }
      setPaymentLinkUrl(result.url)
      toast('Payment link generated.')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const result = await deleteInvoiceAction(invoice.tenantId, invoice.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.push('/invoices')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete invoice.')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const dropdownTriggerClass = cn(
    'inline-flex items-center gap-1 rounded-md border bg-background px-3 h-8 text-sm font-medium',
    'hover:bg-muted transition-colors',
  )

  return (
    <div className="text-sm">
      {/* ── Top action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <h1 className="text-xl font-semibold">
          {mode === 'edit' ? 'Edit Invoice' : `View Invoice# ${invoice.invoiceNo}`}
        </h1>

        <div className="flex flex-wrap items-center gap-1.5">
          {mode === 'view' ? (
            <>
              <Button size="sm" variant="outline" onClick={enterEdit} className="gap-1.5">
                <Pencil className="size-3.5" />
                Edit Invoice
              </Button>

              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  router.push(
                    `/payments/new?invoiceId=${invoice.id}&customerId=${invoice.customerId}`,
                  )
                }
              >
                <Banknote className="size-3.5" />
                Receive Payments
              </Button>

              {/* Send dropdown */}
              <Popover>
                <PopoverTrigger className={dropdownTriggerClass}>
                  <Mail className="size-3.5" />
                  Send
                  <ChevronDown className="size-3" />
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <button
                    onClick={handleEmail}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-left"
                  >
                    <Mail className="size-3.5" />
                    Email Invoice
                  </button>
                  {paymentLinkUrl ? (
                    <button
                      onClick={handleCopyLink}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-left"
                    >
                      <Copy className="size-3.5" />
                      Copy Payment Link
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateLink}
                      disabled={generatingLink}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-left disabled:opacity-50"
                    >
                      {generatingLink ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <LinkIcon className="size-3.5" />
                      )}
                      Generate Payment Link
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Print */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
              >
                <Printer className="size-3.5" />
                Print
              </Button>

              {/* Download As dropdown */}
              <Popover>
                <PopoverTrigger className={dropdownTriggerClass}>
                  <Download className="size-3.5" />
                  Download As
                  <ChevronDown className="size-3" />
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1" align="end">
                  <Link
                    href={`/api/invoices/${invoice.id}/pdf`}
                    target="_blank"
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                  >
                    <Download className="size-3.5" />
                    PDF
                  </Link>
                </PopoverContent>
              </Popover>

              {/* Delete */}
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Delete this invoice?</DialogTitle>
                    <DialogDescription>
                      Invoice #INV-{invoice.invoiceNo} will be voided. Recorded payments stay on
                      the ledger. This can&apos;t be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                      {deleting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
                      Delete Invoice
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Status banner ── */}
      <div className="flex items-center gap-0 border-y py-2.5 my-0">
        <div className={cn('flex-1 h-2 rounded-l', statusCfg.bar)} />
        <span className="px-8 text-base font-bold tracking-widest">{statusCfg.label}</span>
        <div className={cn('flex-1 h-2 rounded-r', statusCfg.bar)} />
      </div>

      {/* ── Three-column header ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border-x border-b">
        {/* Bill To */}
        <div className="p-4 border-b sm:border-b-0 sm:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bill To
          </p>
          {customer ? (
            <Link
              href={`/customers/${customer.id}`}
              className="font-medium text-blue-600 hover:underline block mb-1"
            >
              {customer.name}
            </Link>
          ) : (
            <p className="font-medium mb-1">{invoice.customerName ?? '—'}</p>
          )}
          {(invoice.contactFirstName || invoice.contactLastName) && (
            <p className="text-sm text-muted-foreground mb-1">
              {[invoice.contactFirstName, invoice.contactLastName].filter(Boolean).join(' ')}
            </p>
          )}
          {addressLines.map((line, i) => (
            <p key={i} className="text-muted-foreground">{line}</p>
          ))}
          {mode === 'edit' && (
            <button
              onClick={openCustDialog}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Change Bill To Account
            </button>
          )}
        </div>

        {/* Primary Service Location */}
        <div className="p-4 border-b sm:border-b-0 sm:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Primary Service Location
          </p>
          {addressLines.length > 0 ? (
            addressLines.map((line, i) => (
              <p key={i} className="text-muted-foreground">{line}</p>
            ))
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
          {mode === 'edit' && (
            <button
              onClick={openAddrDialog}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Change Address
            </button>
          )}
        </div>

        {/* Invoice meta */}
        <div className="p-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
            <span className="text-muted-foreground font-medium whitespace-nowrap">Invoice #:</span>
            <span>{invoice.invoiceNo}</span>

            <span className="text-muted-foreground font-medium whitespace-nowrap">Invoice Date:</span>
            {mode === 'view' ? (
              <span>{fmtDate(invoice.invoiceDate)}</span>
            ) : (
              <Input
                aria-label="Invoice date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-6 py-0 px-1 text-xs"
              />
            )}

            <span className="text-muted-foreground font-medium whitespace-nowrap">
              Payment Terms:
            </span>
            {mode === 'view' ? (
              <span>{fmtTerms(invoice.paymentTermsDays)}</span>
            ) : (
              <select
                aria-label="Payment terms"
                value={editTerms}
                onChange={(e) => setEditTerms(e.target.value)}
                className="h-6 rounded border border-input bg-background px-1 text-xs"
              >
                {TERMS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            <span className="text-muted-foreground font-medium whitespace-nowrap">Sent By:</span>
            {mode === 'view' ? (
              <span>{invoice.sentBy ?? '—'}</span>
            ) : (
              <select
                aria-label="Sent by"
                value={editSentBy}
                onChange={(e) => setEditSentBy(e.target.value)}
                className="h-6 rounded border border-input bg-background px-1 text-xs"
              >
                {SENT_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            <span className="text-muted-foreground font-medium whitespace-nowrap">Sent On:</span>
            {mode === 'view' ? (
              <span>{fmtDate(invoice.sentOn)}</span>
            ) : (
              <Input
                aria-label="Sent on date"
                type="date"
                value={editSentOn}
                onChange={(e) => setEditSentOn(e.target.value)}
                className="h-6 py-0 px-1 text-xs"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Job-level line items table ── */}
      <div className="border-x border-b overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted">
            <tr>
              {mode === 'edit' && (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={jobSelected}
                    onChange={(e) => setJobSelected(e.target.checked)}
                  />
                </th>
              )}
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Job Date</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Job#</th>
              <th className="px-3 py-2 text-left font-medium">PO#</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Location</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Job Total</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Job Deposits</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                Job Total Due
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {mode === 'edit' && (
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={jobSelected}
                    onChange={(e) => setJobSelected(e.target.checked)}
                  />
                </td>
              )}
              <td className="px-3 py-3 whitespace-nowrap">{fmtDate(jobDetails?.startDate)}</td>
              <td className="px-3 py-3">
                {jobDetails?.jobNo ? (
                  <Link
                    href={`/jobs/${invoice.jobId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {jobDetails.jobNo}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-3">{jobDetails?.poNumber ?? '—'}</td>
              <td className="px-3 py-3 max-w-48">
                <span className="block truncate">{jobDetails?.description ?? '—'}</span>
              </td>
              <td className="px-3 py-3">
                {addressLines.length > 0 ? (
                  addressLines.map((line, i) => <div key={i}>{line}</div>)
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                <button
                  type="button"
                  onClick={openLineItemsDialog}
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  {fmtMoney(invoice.total)}
                  <span className="text-xs text-blue-600 font-normal">(edit)</span>
                </button>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-blue-600">$0.00</td>
              <td className="px-3 py-3 text-right tabular-nums text-blue-600">
                {fmtMoney(invoice.balance)}
              </td>
            </tr>
          </tbody>
        </table>

        {mode === 'edit' && (
          <div className="px-3 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={!jobSelected}
              onClick={() => setRemoveJobsOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Remove Selected Jobs
            </Button>
          </div>
        )}
      </div>

      {/* ── Customer Message ── */}
      <div className="border-x border-b p-4">
        <p className="font-medium mb-2">Customer Message</p>
        {mode === 'view' ? (
          <p className="text-muted-foreground">{invoice.notes || '—'}</p>
        ) : (
          <textarea
            aria-label="Customer message"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            placeholder="Add a message visible to the customer on the invoice…"
            className={cn(
              'w-full rounded border border-input bg-background px-3 py-2 text-sm resize-none',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          />
        )}
      </div>

      {/* ── Totals ── */}
      <div className="border-x border-b p-4 flex justify-end">
        <div className="space-y-1.5 min-w-56">
          <div className="flex justify-between gap-10">
            <span className="font-semibold uppercase tracking-wide">Invoice Total:</span>
            <span className="tabular-nums">{fmtMoney(invoice.total)}</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="font-semibold uppercase tracking-wide text-blue-600">
              Deposits (-):
            </span>
            <span className="tabular-nums text-blue-600">$0.00</span>
          </div>
          <div className="flex justify-between gap-10">
            <span className="font-semibold uppercase tracking-wide text-blue-600">
              Payments (-):
            </span>
            <span className="tabular-nums text-blue-600">{fmtMoney(paidNum.toFixed(2))}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between gap-10 text-base font-bold">
            <span className="uppercase tracking-wide">Total Due:</span>
            <span className="tabular-nums">{fmtMoney(invoice.balance)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment History ── */}
      {invoice.allocations.length > 0 && (
        <div className="mt-6 border rounded overflow-hidden">
          <div className="bg-muted px-4 py-2.5 border-b">
            <h3 className="font-semibold">Payment History</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Payment#</th>
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-right font-medium">Amount Applied</th>
                <th className="px-4 py-2 text-left font-medium">Received On</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.allocations.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/payments/${a.paymentId}`}
                      className="text-blue-600 hover:underline"
                    >
                      PAY-{a.paymentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{a.methodName ?? a.method}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmtMoney(a.amountApplied)}
                  </td>
                  <td className="px-4 py-2">{fmtDate(a.receivedOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payment Link ── */}
      {paymentLinkUrl ? (
        <div className="mt-4 flex items-center gap-2">
          <Input aria-label="Payment link URL" value={paymentLinkUrl} readOnly className="flex-1 text-xs" />
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
            <Copy className="size-3.5" />
            Copy Link
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateLink}
            disabled={generatingLink}
            className="gap-1.5"
          >
            {generatingLink ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LinkIcon className="size-3.5" />
            )}
            Generate Stripe Payment Link
          </Button>
        </div>
      )}

      {/* ── Line items lightbox ── */}
      <Dialog open={lineItemsOpen} onOpenChange={(open) => { if (!open) setLineItemsOpen(false) }}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>Edit Line Items</DialogTitle>
            <DialogDescription>
              Changes here update the job and recalculate the invoice total.
            </DialogDescription>
          </DialogHeader>

          {lineItemsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading line items…
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              <GroupedLineItems
                groups={editGroups}
                lineItems={editLineItems}
                onChange={(groups, items) => {
                  setEditGroups(groups)
                  setEditLineItems(items)
                }}
                referenceData={lineItemsRefData}
                jobId={invoice.jobId}
              />
              {editGroups.length === 0 && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const id = crypto.randomUUID()
                      const newGroup: LineItemGroup = { id, name: 'Group 1', sortOrder: 0 }
                      setEditGroups([newGroup])
                      setEditLineItems(
                        editLineItems.map((i) => ({ ...i, groupId: id })),
                      )
                    }}
                  >
                    Enable Line-Item Groups
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLineItemsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveLineItems}
              disabled={lineItemsSaving || lineItemsLoading}
            >
              {lineItemsSaving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Save Line Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change Bill To Account dialog ── */}
      <Dialog open={custDialogOpen} onOpenChange={(open) => { if (!open) setCustDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Bill To Account</DialogTitle>
            <DialogDescription>
              Select a contact or address from this customer.
            </DialogDescription>
          </DialogHeader>

          {custLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading…
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-3">
              {/* Contacts */}
              <div>
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contacts
                </p>
                <div className="divide-y rounded border">
                  {custContacts.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">No contacts on file.</p>
                  ) : (
                    custContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleContactSelect(c.id)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-muted text-left"
                      >
                        <span>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</span>
                        {c.billingContact && (
                          <span className="text-xs text-muted-foreground">Billing</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Addresses */}
              <div>
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Addresses
                </p>
                <div className="divide-y rounded border">
                  {custAddresses.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">No addresses on file.</p>
                  ) : (
                    custAddresses.map((loc) => {
                      const addrLine = [
                        loc.addressLine1,
                        [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', '),
                      ].filter(Boolean).join(', ')
                      return (
                        <button
                          key={loc.id}
                          onClick={() => handleBillToAddressSelect(loc.id)}
                          className="flex w-full flex-col items-start px-3 py-2.5 text-sm hover:bg-muted text-left"
                        >
                          {loc.name && <span className="font-medium">{loc.name}</span>}
                          <span className="text-muted-foreground">{addrLine || '—'}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove selected jobs → delete invoice confirmation ── */}
      <Dialog open={removeJobsOpen} onOpenChange={(open) => { if (!open) setRemoveJobsOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove all jobs from invoice?</DialogTitle>
            <DialogDescription>
              You are about to remove all the jobs from an invoice. Doing this will delete the entire invoice.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRemoveJobsOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Proceed With Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change Address dialog ── */}
      <Dialog open={addrDialogOpen} onOpenChange={(open) => { if (!open) setAddrDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Service Location</DialogTitle>
            <DialogDescription>
              Select the service location for this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto divide-y rounded border">
            {addrLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading locations…
              </div>
            ) : locations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No service locations found for this customer.
              </p>
            ) : (
              locations.map((loc) => {
                const addrLine = [loc.addressLine1, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean).join(', ')
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleLocSelect(loc.id)}
                    className="flex w-full flex-col items-start px-3 py-2.5 text-sm hover:bg-muted text-left"
                  >
                    {loc.name && <span className="font-medium">{loc.name}</span>}
                    <span className="text-muted-foreground">{addrLine || '—'}</span>
                  </button>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddrDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
