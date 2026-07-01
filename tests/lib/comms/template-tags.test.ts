import { describe, it, expect } from 'vitest'
import { renderTemplate, findUnknownTags } from '@/lib/comms/template-render'
import { formatCurrency, formatDate } from '@/lib/comms/template-tags'
import type { InvoiceTagContext } from '@/lib/comms/template-tags'

function makeContext(overrides?: Partial<InvoiceTagContext['invoice']> & {
  lineItems?: InvoiceTagContext['lineItems']
}): InvoiceTagContext {
  return {
    kind: 'invoice',
    tenantId: 'org_test',
    invoiceId: 'inv_test',
    invoice: {
      invoiceNo: 1042,
      invoiceDate: '2026-06-20',
      dueDate: '2026-07-20',
      total: '245.00',
      balance: '120.00',
      notes: 'Thanks & have a great day!',
      paymentTermsDays: 30,
      jobId: 'job_test',
      customerId: 'cust_test',
      contactId: 'contact_test',
      serviceLocationId: 'loc_test',
      ...overrides,
    },
    customer: { name: 'Acme & Co' },
    contact: { firstName: 'John', lastName: 'Smith' },
    location: {
      addressLine1: '123 Main St',
      addressLine2: 'Suite 100',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
    },
    job: { jobNo: 2048, description: 'Spring replacement' },
    lineItems: overrides?.lineItems ?? [
      { id: 'li1', type: 'service', title: 'Spring', description: 'Torsion spring', qty: '1', rate: '120.00', cost: '120.00' },
    ],
    company: {
      name: "Infantino's Garage Door Service",
      phone: '(555) 987-6543',
      email: 'contact@example.com',
      address: '456 Commerce Ave',
      logoSignedUrl: 'https://example.com/logo.png',
    },
  }
}

describe('format helpers', () => {
  it('formats currency', () => {
    expect(formatCurrency('245.00')).toBe('$245.00')
    expect(formatCurrency(245)).toBe('$245.00')
    expect(formatCurrency(null)).toBe('$0.00')
    expect(formatCurrency('')).toBe('$0.00')
  })

  it('formats dates', () => {
    expect(formatDate('2026-06-20')).toBe('June 20, 2026')
    expect(formatDate(null)).toBe('')
  })
})

describe('renderTemplate html mode', () => {
  it('replaces scalar tags', () => {
    const ctx = makeContext()
    const out = renderTemplate('Hi {Customer.Name}, invoice {Invoice.Number} is {Invoice.Total}.', ctx, 'html')
    expect(out).toBe("Hi Acme &amp; Co, invoice INV-1042 is $245.00.")
  })

  it('escapes HTML in scalar values', () => {
    const ctx = makeContext()
    const out = renderTemplate('{Invoice.Notes}', ctx, 'html')
    expect(out).toBe('Thanks &amp; have a great day!')
  })

  it('accepts colon delimiter', () => {
    const ctx = makeContext()
    const out = renderTemplate('{Customer:Name} / {Invoice:Total}', ctx, 'html')
    expect(out).toBe('Acme &amp; Co / $245.00')
  })

  it('renders the job rate table as HTML', () => {
    const ctx = makeContext()
    const out = renderTemplate('{Job:RateTable}', ctx, 'html')
    expect(out).toContain('<table')
    expect(out).toContain('Spring')
    expect(out).toContain('$120.00')
  })

  it('renders company logo as HTML img tag', () => {
    const ctx = makeContext()
    const out = renderTemplate('{Company.CompanyLogo}', ctx, 'html')
    expect(out).toContain('<img')
    expect(out).toContain('https://example.com/logo.png')
  })

  it('keeps unknown tags unchanged', () => {
    const ctx = makeContext()
    const out = renderTemplate('{Invoice.Missing}', ctx, 'html')
    expect(out).toBe('{Invoice.Missing}')
  })

  it('emits empty for SF JobsBegin/JobsEnd markers', () => {
    const ctx = makeContext()
    const out = renderTemplate('A{Invoice.JobsBegin}B{Invoice.JobsEnd}C', ctx, 'html')
    expect(out).toBe('ABC')
  })

  it('finds unknown tags', () => {
    const ctx = makeContext()
    const unknown = findUnknownTags('{Invoice.Missing} and {Customer.Missing}', ctx)
    expect(unknown).toEqual(['{Invoice.Missing}', '{Customer.Missing}'])
  })
})

describe('renderTemplate text mode', () => {
  it('replaces scalars but drops HTML block tags', () => {
    const ctx = makeContext()
    const out = renderTemplate(
      'Hi {Customer.Name}. {Job:RateTable} Total: {Invoice.Total}. Logo: {Company.CompanyLogo}',
      ctx,
      'text',
    )
    expect(out).toBe('Hi Acme & Co.  Total: $245.00. Logo: ')
  })
})
