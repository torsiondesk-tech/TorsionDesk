'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Phone, Mail, MapPin, Calendar, Clock, User, Star, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPhone } from '@/lib/utils'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { computeEstimateTotals } from '@/lib/estimates/totals'
import type { getEstimateAction } from '../actions'

interface EstimateSummaryProps {
  initial: NonNullable<Awaited<ReturnType<typeof getEstimateAction>>> & {
    customerName?: string | null
  }
  referenceData: {
    jobCategories: Array<{ id: string; name: string }>
    referralSources: Array<{ id: string; name: string }>
    taxItems: Array<{ id: string; name: string; rate: string | null }>
    availableTags: Array<{ id: string; name: string; color?: string | null }>
    orgMembers: Array<{ id: string; label: string }>
    salesReps: Array<{ id: string; name: string }>
  }
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC' })
}

function fmtTime(d: Date | null | undefined): string | null {
  if (!d) return null
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

export function EstimateSummary({ initial, referenceData }: EstimateSummaryProps) {
  const est = initial.estimate
  const contact = initial.contact
  const loc = initial.serviceLocation

  const primaryPhone = contact?.phones.find((p) => p.isPrimary) ?? contact?.phones[0]
  const primaryEmail = contact?.emails.find((e) => e.isPrimary) ?? contact?.emails[0]

  const locationLines = loc
    ? [
        loc.name,
        loc.addressLine1,
        [loc.addressLine2, loc.city, loc.state, loc.postalCode].filter(Boolean).join(', '),
      ].filter(Boolean)
    : []

  const mapsAddress = loc
    ? [loc.addressLine1, loc.addressLine2, loc.city, loc.state, loc.postalCode]
        .filter(Boolean)
        .join(', ')
    : ''
  const mapsHref = mapsAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(mapsAddress)}`
    : null

  const arrivalStart = fmtTime(est.arrivalWindowStart)
  const arrivalEnd = fmtTime(est.arrivalWindowEnd)
  const arrivalWindow =
    arrivalStart && arrivalEnd
      ? `${arrivalStart} – ${arrivalEnd}`
      : arrivalStart || arrivalEnd || '—'

  const techNames =
    initial.assigneeUserIds
      .map((id) => referenceData.orgMembers.find((m) => m.id === id)?.label ?? id)
      .join(', ') || 'Unassigned'

  const categoryName = referenceData.jobCategories.find((c) => c.id === est.categoryId)?.name
  const referralName = referenceData.referralSources.find((s) => s.id === est.referralSourceId)?.name
  const salesRepName = referenceData.salesReps.find((r) => r.id === est.assignedAgentId)?.name
  const tags = referenceData.availableTags.filter((t) => initial.tagIds.includes(t.id))

  const lineTotal = (li: (typeof initial.lineItems)[0]) =>
    (parseFloat(li.qty || '0') || 0) * (parseFloat(li.rate || '0') || 0)

  const totals = useMemo(
    () =>
      computeEstimateTotals(
        initial.lineItems.map((li) => ({
          type: (li.type ?? 'service') as 'product' | 'service' | 'discount' | 'expense',
          qty: li.qty,
          rate: li.rate,
          cost: li.cost,
          taxRate:
            referenceData.taxItems.find((t) => t.id === li.taxItemId)?.rate ?? null,
          groupId: li.groupId,
        })),
        initial.groups,
      ),
    [initial.lineItems, initial.groups, referenceData.taxItems],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── LEFT: Project Specs ── */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Project Specs</h2>

          <div className="space-y-4">
            {/* Customer */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Customer
              </div>
              {est.customerId ? (
                <Link
                  href={`/customers/${est.customerId}`}
                  className="text-lg font-medium hover:underline"
                >
                  {initial.customerName || est.customerId}
                </Link>
              ) : (
                <span className="text-lg font-medium">{initial.customerName || '—'}</span>
              )}
            </div>

            {/* Contact */}
            {contact && (
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact
                </div>
                <div className="font-medium">
                  {contact.firstName} {contact.lastName ?? ''}
                  {contact.jobTitle ? (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      — {contact.jobTitle}
                    </span>
                  ) : null}
                </div>
                {primaryPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {formatPhone(primaryPhone.number)}
                    {primaryPhone.type !== 'cell' && ` (${primaryPhone.type})`}
                  </div>
                )}
                {primaryEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {primaryEmail.address}
                  </div>
                )}
              </div>
            )}

            {/* Service Location */}
            {loc && (
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Service Location
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="text-sm">
                    {mapsHref ? (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {locationLines.map((line, i) => (
                          <div
                            key={i}
                            className={i === 0 && loc.name ? 'font-medium' : 'text-muted-foreground'}
                          >
                            {line}
                          </div>
                        ))}
                      </a>
                    ) : (
                      locationLines.map((line, i) => (
                        <div
                          key={i}
                          className={i === 0 && loc.name ? 'font-medium' : 'text-muted-foreground'}
                        >
                          {line}
                        </div>
                      ))
                    )}
                    {loc.gated && (
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
                  Category
                </div>
                <div className="text-sm">{categoryName}</div>
              </div>
            )}

            {/* Description */}
            {est.description && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <p className="text-sm text-muted-foreground">{est.description}</p>
              </div>
            )}

            {/* PO */}
            {est.poNumber && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  PO #
                </div>
                <div className="text-sm">{est.poNumber}</div>
              </div>
            )}

            {/* On-site Visit Date */}
            {est.onSiteDate && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  On-site Visit Date
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {fmtDate(est.onSiteDate)}
                </div>
              </div>
            )}

            {/* Arrival Window */}
            {(est.arrivalWindowStart || est.arrivalWindowEnd) && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Arrival Window
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {arrivalWindow}
                </div>
              </div>
            )}

            {/* Assigned Techs */}
            {initial.assigneeUserIds.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assigned Techs
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="size-3.5 text-muted-foreground" />
                  {techNames}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t) => (
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

            {/* Notes for Techs */}
            {est.notesForTechs && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes for Techs
                </div>
                <p className="text-sm text-muted-foreground">{est.notesForTechs}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Sales Data ── */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Sales Data</h2>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Requested On
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="size-3.5 text-muted-foreground" />
                {fmtDate(est.requestedOn)}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <Badge variant={estimateStatusBadgeVariant(est.status)} className="mt-1">
                {estimateStatusLabel(est.status)}
              </Badge>
            </div>

            {est.opportunityRating != null && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Opportunity Rating
                </div>
                <div className="flex items-center gap-0.5 pt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= (est.opportunityRating ?? 0)
                          ? 'size-4 fill-amber-400 text-amber-400'
                          : 'size-4 text-muted-foreground/30'
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {referralName && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Referral Source
                </div>
                <div className="text-sm">{referralName}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {est.expiryDate && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Expiry Date
                  </div>
                  <div className="text-sm">{fmtDate(est.expiryDate)}</div>
                </div>
              )}
              {est.followUpDate && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Follow-up Date
                  </div>
                  <div className="text-sm">{fmtDate(est.followUpDate)}</div>
                </div>
              )}
            </div>

            {salesRepName && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sales Rep
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="size-3.5 text-muted-foreground" />
                  {salesRepName}
                </div>
              </div>
            )}

            {est.internalNotes && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal Notes
                </div>
                <p className="text-sm text-muted-foreground">{est.internalNotes}</p>
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
            <div className="flex-1">
              {initial.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items yet.</p>
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
                      {initial.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              {li.title ? (
                                <>
                                  <span className="font-medium">{li.title}</span>
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
                          <td className="px-3 py-2">${lineTotal(li).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span>Estimate Total</span>
                  <span>${totals.estimateTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimate Cost</span>
                  <span>${totals.estimateCost}</span>
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
