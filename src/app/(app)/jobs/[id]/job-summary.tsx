'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  User,
  DollarSign,
  Repeat,
  Tag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPhone } from '@/lib/utils'
import { statusBadgeVariant, statusLabel } from '@/lib/jobs/transitions'
import { computeJobTotals } from '@/lib/jobs/totals'
import type { JobDetail } from '@/lib/jobs/jobs'

interface JobSummaryProps {
  job: JobDetail
  orgMembers: Array<{ id: string; label: string }>
  salesReps: Array<{ id: string; name: string }>
  categoryName?: string
  sourceName?: string
  taxItems: Array<{ id: string; name: string; rate: string | null }>
}

export function JobSummary({
  job,
  orgMembers,
  salesReps,
  categoryName,
  sourceName,
  taxItems,
}: JobSummaryProps) {
  const primaryPhone =
    job.contact?.phones.find((p) => p.isPrimary) ?? job.contact?.phones[0]
  const primaryEmail =
    job.contact?.emails.find((e) => e.isPrimary) ?? job.contact?.emails[0]

  const techNames =
    job.assignees
      .map(
        (a) => orgMembers.find((m) => m.id === a.userId)?.label ?? a.userId,
      )
      .join(', ') || 'Unassigned'

  const locationLines = [
    job.serviceLocation?.name,
    job.serviceLocation?.addressLine1,
    [
      job.serviceLocation?.addressLine2,
      job.serviceLocation?.city,
      job.serviceLocation?.state,
      job.serviceLocation?.postalCode,
    ]
      .filter(Boolean)
      .join(', '),
  ].filter(Boolean)

  const arrivalStart = job.arrivalWindowStart
    ? new Date(job.arrivalWindowStart).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : null
  const arrivalEnd = job.arrivalWindowEnd
    ? new Date(job.arrivalWindowEnd).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : null
  const arrivalWindow =
    arrivalStart && arrivalEnd
      ? `${arrivalStart} – ${arrivalEnd}`
      : arrivalStart || arrivalEnd || '—'

  const startDate = job.startDate
    ? new Date(job.startDate).toLocaleDateString(undefined, { timeZone: 'UTC' })
    : '—'
  const endDate = job.endDate
    ? new Date(job.endDate).toLocaleDateString(undefined, { timeZone: 'UTC' })
    : null

  const lineTotal = (li: (typeof job.lineItems)[0]) =>
    (parseFloat(li.qty || '0') || 0) * (parseFloat(li.rate || '0') || 0)

  const totals = useMemo(
    () =>
      computeJobTotals(
        job.lineItems.map((li) => ({
          type: (li.type ?? 'product') as
            | 'product'
            | 'service'
            | 'discount'
            | 'expense',
          qty: String(li.qty ?? '1'),
          rate: String(li.rate ?? '0'),
          cost: String(li.cost ?? '0'),
          taxRate:
            taxItems.find((t) => t.id === li.taxItemId)?.rate ?? null,
        })),
      ),
    [job.lineItems, taxItems],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── LEFT: Customer / Contact / Details ── */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Details</h2>

          <div className="space-y-4">
            {/* Customer */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Customer
              </div>
              <Link
                href={`/customers/${job.customerId}`}
                className="text-lg font-medium hover:underline"
              >
                {job.customerName}
              </Link>
            </div>

            {/* Contact */}
            {job.contact && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contact
                  </div>
                  {job.contact.id === job.primaryContactId && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
                  )}
                </div>
                <div className="font-medium">
                  {job.contact.firstName} {job.contact.lastName ?? ''}
                </div>
                {primaryPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {formatPhone(primaryPhone.number)}{' '}
                    {primaryPhone.type !== 'cell' &&
                      `(${primaryPhone.type})`}
                  </div>
                )}
                {primaryEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {primaryEmail.address}{' '}
                    {primaryEmail.type !== 'work' &&
                      `(${primaryEmail.type})`}
                  </div>
                )}
                {job.contact.phones.length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    +{job.contact.phones.length - 1} more phone
                    {job.contact.phones.length > 2 ? 's' : ''}
                  </div>
                )}
                {job.contact.emails.length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    +{job.contact.emails.length - 1} more email
                    {job.contact.emails.length > 2 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Service Location */}
            {job.serviceLocation && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Service Location
                  </div>
                  {job.serviceLocation?.id && job.serviceLocation.id === job.primaryLocationId && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="text-sm">
                    {locationLines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          i === 0 && job.serviceLocation?.name
                            ? 'font-medium'
                            : 'text-muted-foreground'
                        }
                      >
                        {line}
                      </div>
                    ))}
                    {job.serviceLocation.gated && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Gated Property
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Category */}
            {categoryName && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Job Category
                </div>
                <div className="text-sm">{categoryName}</div>
              </div>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <p className="text-sm text-muted-foreground">
                  {job.description}
                </p>
              </div>
            )}

            {/* PO */}
            {job.poNumber && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  PO #
                </div>
                <div className="text-sm">{job.poNumber}</div>
              </div>
            )}

            {/* Job Source */}
            {sourceName && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Job Source
                </div>
                <div className="text-sm">{sourceName}</div>
              </div>
            )}

            {/* Agent */}
            {job.assignedAgentId && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agent / Rep
                </div>
                <div className="text-sm">{salesReps.find((r) => r.id === job.assignedAgentId)?.name ?? job.assignedAgentId}</div>
              </div>
            )}

            {/* Tags */}
            {job.tags.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.tags.map((t) => (
                    <Badge
                      key={t.id}
                      style={{
                        backgroundColor: t.color ?? undefined,
                        color: t.color ? '#fff' : undefined,
                      }}
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Job Info ── */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Job Info</h2>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <Badge
                variant={statusBadgeVariant(job.status)}
                className="mt-1"
              >
                {statusLabel(job.status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Start Date
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {startDate}
                </div>
              </div>
              {job.multiDay && endDate && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    End Date
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    {endDate}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Arrival Window
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="size-3.5 text-muted-foreground" />
                {arrivalWindow}
              </div>
            </div>

            {job.estimatedDuration && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Est. Duration
                </div>
                <div className="text-sm">
                  {job.estimatedDuration} min
                </div>
              </div>
            )}

            {job.priority && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Priority
                </div>
                <div className="text-sm capitalize">{job.priority}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assigned Techs
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <User className="size-3.5 text-muted-foreground" />
                {techNames}
              </div>
            </div>

            {job.notesForTechs && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes for Techs
                </div>
                <p className="text-sm text-muted-foreground">
                  {job.notesForTechs}
                </p>
              </div>
            )}

            {job.completionNotes && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Completion Notes
                </div>
                <p className="text-sm text-muted-foreground">
                  {job.completionNotes}
                </p>
              </div>
            )}

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Billing Type
              </div>
              <div className="flex items-center gap-1.5 text-sm capitalize">
                <DollarSign className="size-3.5 text-muted-foreground" />
                {job.billingType.replace('_', ' ')}
              </div>
            </div>

            {job.isRepeating && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Repeating
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Repeat className="size-3.5 text-muted-foreground" />
                  {job.repeatFrequency ?? 'Repeating'}
                  {job.repeatEndDate &&
                    ` until ${new Date(job.repeatEndDate).toLocaleDateString()}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Line items table */}
            <div className="flex-1">
              {job.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No line items yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Rate</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {job.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              {li.title ? (
                                <>
                                  <span className="font-medium">
                                    {li.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {li.description}
                                  </span>
                                </>
                              ) : (
                                <span>{li.description}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">{li.qty}</td>
                          <td className="px-3 py-2">
                            ${parseFloat(li.rate || '0').toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            ${lineTotal(li).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Totals panel */}
            <div className="w-full rounded-xl border bg-card p-5 lg:w-72">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Totals
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Products</span>
                  <span>${totals.products}</span>
                </div>
                <div className="flex justify-between">
                  <span>Services</span>
                  <span>${totals.services}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Discounts</span>
                  <span>-${totals.discount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Fees</span>
                  <span>${totals.taxes}</span>
                </div>
                <div className="flex justify-between">
                  <span>Drive & Labor</span>
                  <span>${totals.driveLabor}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billable Expenses</span>
                  <span>${totals.expenses}</span>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span>Job Total</span>
                  <span>${totals.jobTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payments / Deposits</span>
                  <span>${totals.payments}</span>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span>Total Due</span>
                  <span>${totals.totalDue}</span>
                </div>
                <div className="flex justify-between">
                  <span>Job Cost</span>
                  <span>${totals.jobCost}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Profit</span>
                  <span>${totals.grossProfit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Profit %</span>
                  <span>{totals.grossProfitPct ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
