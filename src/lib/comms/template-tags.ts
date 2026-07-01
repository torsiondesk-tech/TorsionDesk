// Pure definitions for communication-template merge tags.
// Client-safe: no server-only imports or Drizzle queries here.

export type TagScope = 'Customer' | 'Invoice' | 'Job' | 'Estimate' | 'Company' | 'General'
export type TemplateCategory = 'invoice' | 'estimate' | 'job' | 'general'
export type TagChannel = 'email' | 'sms' | 'both'

export interface InvoiceTagLineItem {
  id: string
  type: string | null
  title: string | null
  description: string | null
  qty: string | null
  rate: string | null
  cost: string | null
}

export interface InvoiceTagContext {
  kind: 'invoice'
  tenantId: string
  invoiceId: string
  invoice: {
    invoiceNo: number
    invoiceDate: string | Date | null
    dueDate: string | Date | null
    total: string
    balance: string
    notes: string | null
    paymentTermsDays: number | null
    jobId: string | null
    customerId: string
    contactId: string | null
    serviceLocationId: string | null
  }
  customer: {
    name: string | null
  }
  contact: {
    firstName: string | null
    lastName: string | null
  } | null
  location: {
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  } | null
  job: {
    jobNo: number
    description: string | null
  } | null
  lineItems: InvoiceTagLineItem[]
  company: {
    name: string | null
    phone: string | null
    email: string | null
    address: string | null
    logoSignedUrl: string | null
  }
}

export interface EstimateTagContext {
  kind: 'estimate'
  tenantId: string
  estimateId: string
  company: InvoiceTagContext['company']
}

export interface JobTagContext {
  kind: 'job'
  tenantId: string
  jobId: string
  company: InvoiceTagContext['company']
}

export interface GeneralTagContext {
  kind: 'general'
  tenantId: string
  company: InvoiceTagContext['company']
}

export type TagContext = InvoiceTagContext | EstimateTagContext | JobTagContext | GeneralTagContext

export function isInvoiceContext(ctx: TagContext): ctx is InvoiceTagContext {
  return ctx.kind === 'invoice'
}

export interface TagDef {
  scope: TagScope
  key: string
  label: string
  description: string
  example: string
  channel: TagChannel
  isHtml: boolean
  appliesTo: TemplateCategory[]
  resolve: (ctx: TagContext) => string
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === '') return '$0.00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function toDateInputValue(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function formatDate(value: string | Date | null | undefined): string {
  const s = toDateInputValue(value)
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fullAddress(location: InvoiceTagContext['location']): string {
  if (!location) return ''
  return [
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.state,
    location.postalCode,
  ]
    .filter(Boolean)
    .join(', ')
}

function contactName(contact: InvoiceTagContext['contact']): string {
  if (!contact) return ''
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ')
}

function paymentTermsLabel(days: number | null): string {
  if (days == null || days <= 0) return 'Due on receipt'
  if (days === 1) return 'Net 1 day'
  return `Net ${days} days`
}

function renderRateTable(ctx: InvoiceTagContext): string {
  if (!ctx.lineItems.length) return ''
  const rows = ctx.lineItems
    .map(
      (li) =>
        `<tr style="border-bottom:1px solid #e2e8f0">` +
        `<td style="padding:8px 0">${escHtml(li.title ?? li.description ?? '')}</td>` +
        `<td style="padding:8px 0;text-align:right">${escHtml(li.qty ?? '')}</td>` +
        `<td style="padding:8px 0;text-align:right">${escHtml(formatCurrency(li.rate))}</td>` +
        `<td style="padding:8px 0;text-align:right">${escHtml(formatCurrency(li.cost))}</td>` +
        `</tr>`,
    )
    .join('')
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">` +
    `<thead style="border-bottom:2px solid #cbd5e1">` +
    `<tr>` +
    `<th style="text-align:left;padding:8px 0">Item</th>` +
    `<th style="text-align:right;padding:8px 0">Qty</th>` +
    `<th style="text-align:right;padding:8px 0">Rate</th>` +
    `<th style="text-align:right;padding:8px 0">Total</th>` +
    `</tr>` +
    `</thead>` +
    `<tbody>${rows}</tbody>` +
    `</table>`
  )
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const TAG_REGISTRY: TagDef[] = [
  // ── Customer scope ───────────────────────────────────────────────────────────
  {
    scope: 'Customer',
    key: 'Name',
    label: 'Customer name',
    description: "The customer's display name.",
    example: 'Acme Garage Doors',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => {
      if (ctx.kind === 'general') return ctx.company.name ?? ''
      if (isInvoiceContext(ctx)) return ctx.customer.name ?? ''
      return ''
    },
  },
  {
    scope: 'Customer',
    key: 'FirstName',
    label: 'Contact first name',
    description: 'The first name of the invoice/estimate/job contact.',
    example: 'John',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: (ctx) => {
      if (isInvoiceContext(ctx)) return ctx.contact?.firstName ?? ''
      return ''
    },
  },
  {
    scope: 'Customer',
    key: 'LastName',
    label: 'Contact last name',
    description: 'The last name of the invoice/estimate/job contact.',
    example: 'Smith',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: (ctx) => {
      if (isInvoiceContext(ctx)) return ctx.contact?.lastName ?? ''
      return ''
    },
  },
  {
    scope: 'Customer',
    key: 'Email',
    label: 'Contact email',
    description: 'The primary email address for the recipient contact.',
    example: 'john@example.com',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: () => '', // resolved at recipient layer, not in body
  },
  {
    scope: 'Customer',
    key: 'Phone',
    label: 'Contact phone',
    description: 'The primary phone number for the recipient contact.',
    example: '(555) 123-4567',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: () => '', // not stored in context; reserved for future
  },
  {
    scope: 'Customer',
    key: 'Address',
    label: 'Service address',
    description: 'The full service location address.',
    example: '123 Main St, Springfield, IL 62704',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: (ctx) => {
      if (isInvoiceContext(ctx)) return fullAddress(ctx.location)
      return ''
    },
  },

  // ── Invoice scope ────────────────────────────────────────────────────────────
  {
    scope: 'Invoice',
    key: 'Number',
    label: 'Invoice number',
    description: 'The invoice number, prefixed with INV-.',
    example: 'INV-1042',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return `INV-${ctx.invoice.invoiceNo}`
    },
  },
  {
    scope: 'Invoice',
    key: 'Date',
    label: 'Invoice date',
    description: 'The date the invoice was issued.',
    example: 'June 20, 2026',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return formatDate(ctx.invoice.invoiceDate)
    },
  },
  {
    scope: 'Invoice',
    key: 'DueDate',
    label: 'Due date',
    description: 'The invoice due date.',
    example: 'July 20, 2026',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return formatDate(ctx.invoice.dueDate)
    },
  },
  {
    scope: 'Invoice',
    key: 'Total',
    label: 'Invoice total',
    description: 'The invoice grand total.',
    example: '$245.00',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return formatCurrency(ctx.invoice.total)
    },
  },
  {
    scope: 'Invoice',
    key: 'Balance',
    label: 'Balance due',
    description: 'The remaining unpaid balance on the invoice.',
    example: '$245.00',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return formatCurrency(ctx.invoice.balance)
    },
  },
  {
    scope: 'Invoice',
    key: 'PaymentTerms',
    label: 'Payment terms',
    description: 'The payment terms in plain language.',
    example: 'Net 30 days',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return paymentTermsLabel(ctx.invoice.paymentTermsDays)
    },
  },
  {
    scope: 'Invoice',
    key: 'Notes',
    label: 'Invoice notes',
    description: 'The customer-facing notes on the invoice.',
    example: 'Thank you for your business.',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (ctx.kind !== 'invoice') return ''
      return ctx.invoice.notes ?? ''
    },
  },
  {
    scope: 'Invoice',
    key: 'JobsBegin',
    label: 'Jobs begin marker',
    description: 'Compatibility marker from Service Fusion; emits nothing.',
    example: '',
    channel: 'email',
    isHtml: true,
    appliesTo: ['invoice'],
    resolve: () => '',
  },
  {
    scope: 'Invoice',
    key: 'JobsEnd',
    label: 'Jobs end marker',
    description: 'Compatibility marker from Service Fusion; emits nothing.',
    example: '',
    channel: 'email',
    isHtml: true,
    appliesTo: ['invoice'],
    resolve: () => '',
  },

  // ── Job scope ────────────────────────────────────────────────────────────────
  {
    scope: 'Job',
    key: 'Number',
    label: 'Job number',
    description: 'The linked job number, prefixed with JOB-.',
    example: 'JOB-1042',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: (ctx) => {
      if (!isInvoiceContext(ctx) || !ctx.job) return ''
      return `JOB-${ctx.job.jobNo}`
    },
  },
  {
    scope: 'Job',
    key: 'Description',
    label: 'Job description',
    description: 'The description from the linked job.',
    example: 'Spring replacement and tune-up',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job'],
    resolve: (ctx) => {
      if (!isInvoiceContext(ctx) || !ctx.job) return ''
      return ctx.job.description ?? ''
    },
  },
  {
    scope: 'Job',
    key: 'RateTable',
    label: 'Job line items table',
    description: 'An HTML table of invoice line items.',
    example: '<table>...</table>',
    channel: 'email',
    isHtml: true,
    appliesTo: ['invoice'],
    resolve: (ctx) => {
      if (!isInvoiceContext(ctx)) return ''
      return renderRateTable(ctx)
    },
  },

  // ── Estimate scope (reserved) ────────────────────────────────────────────────
  {
    scope: 'Estimate',
    key: 'Number',
    label: 'Estimate number',
    description: 'The estimate number, prefixed with EST-.',
    example: 'EST-1042',
    channel: 'both',
    isHtml: false,
    appliesTo: ['estimate'],
    resolve: () => '', // implemented when estimate context builder lands
  },

  // ── Company scope ────────────────────────────────────────────────────────────
  {
    scope: 'Company',
    key: 'Name',
    label: 'Company name',
    description: 'The tenant company name.',
    example: "Infantino's Garage Door Service",
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => ctx.company.name ?? '',
  },
  {
    scope: 'Company',
    key: 'Phone1',
    label: 'Company phone',
    description: 'The company phone number.',
    example: '(555) 987-6543',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => ctx.company.phone ?? '',
  },
  {
    scope: 'Company',
    key: 'Email1',
    label: 'Company email',
    description: 'The company email address.',
    example: 'contact@infantinosgaragedoor.com',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => ctx.company.email ?? '',
  },
  {
    scope: 'Company',
    key: 'Address',
    label: 'Company address',
    description: 'The company address.',
    example: '456 Commerce Ave, Springfield, IL 62704',
    channel: 'both',
    isHtml: false,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => ctx.company.address ?? '',
  },
  {
    scope: 'Company',
    key: 'CompanyLogo',
    label: 'Company logo',
    description: 'An <img> tag with the signed company logo URL.',
    example: '<img src="..." />',
    channel: 'email',
    isHtml: true,
    appliesTo: ['invoice', 'estimate', 'job', 'general'],
    resolve: (ctx) => {
      if (!ctx.company.logoSignedUrl) return ''
      return `<img src="${escHtml(ctx.company.logoSignedUrl)}" alt="${escHtml(ctx.company.name ?? 'Company logo')}" style="max-width:200px;max-height:80px;display:block;margin:8px 0" />`
    },
  },
]

export function getTagsForCategory(category: TemplateCategory, channel: 'email' | 'sms'): TagDef[] {
  return TAG_REGISTRY.filter((tag) => {
    const categoryMatch = tag.appliesTo.includes(category)
    const channelMatch = tag.channel === 'both' || tag.channel === channel
    return categoryMatch && channelMatch
  })
}

export function getTagByScopeKey(scope: string, key: string): TagDef | undefined {
  return TAG_REGISTRY.find((tag) => tag.scope === scope && tag.key === key)
}
