import * as React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { InvoicePdfData } from '@/lib/invoices/pdf-data'

export interface InvoicePdfDocumentProps {
  data: InvoicePdfData
  workOrder?: boolean
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  companyBlock: {
    width: '60%',
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  companyMeta: {
    fontSize: 9,
    color: '#666',
  },
  invoiceBlock: {
    width: '40%',
    alignItems: 'flex-end',
  },
  invoiceLabel: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#333',
  },
  invoiceNumber: {
    fontSize: 12,
    marginTop: 4,
  },
  invoiceMeta: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  customerAddress: {
    fontSize: 9,
    color: '#444',
  },
  descriptionBox: {
    marginTop: 12,
  },
  descriptionText: {
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  itemDescription: {
    flex: 3,
    fontSize: 9,
  },
  itemNumber: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },
  itemMoney: {
    flex: 1,
    fontSize: 9,
    textAlign: 'right',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  subtotalText: {
    fontSize: 9,
    color: '#555',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#333',
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginRight: 8,
  },
  totalAmount: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  balanceDueRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
  },
  balanceDueLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginRight: 8,
  },
  balanceDueAmount: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
  },
  paymentSection: {
    marginTop: 16,
  },
  paymentHeader: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    marginBottom: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  paymentCell: {
    flex: 1,
    fontSize: 9,
  },
  workOrderSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  workOrderTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  signatureBox: {
    marginTop: 12,
    width: 240,
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureImage: {
    width: 232,
    height: 92,
    objectFit: 'contain',
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666',
  },
  notesBox: {
    marginTop: 16,
  },
  notesText: {
    fontSize: 9,
    color: '#444',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
})

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function toCents(s: string | null | undefined): number {
  return Math.round(parseFloat(s ?? '0') * 100) || 0
}

function fromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function lineTotalCents(qty: string | null, rate: string | null): number {
  const q = parseFloat(qty ?? '0') || 0
  const r = toCents(rate)
  return Math.round(q * r)
}

export function InvoicePdfDocument({ data, workOrder }: InvoicePdfDocumentProps) {
  const invoiceDate = formatDate(data.invoiceDate)
  const dueDate = formatDate(data.dueDate)

  const grossSubtotalCents = data.lineItems.reduce((sum, li) => {
    if (li.type === 'expense') return sum
    return sum + lineTotalCents(li.qty, li.rate)
  }, 0)

  const discountCents = data.lineItems.reduce((sum, li) => {
    if (li.type !== 'discount') return sum
    return sum + Math.abs(lineTotalCents(li.qty, li.rate))
  }, 0)

  const totalCents = toCents(data.total)
  const taxCents = Math.max(0, totalCents - grossSubtotalCents + discountCents)

  const paidCents = totalCents - toCents(data.balance)

  const customerAddressLines = [
    data.customer?.addressLine1,
    data.customer?.addressLine2,
    [data.customer?.city, data.customer?.state, data.customer?.postalCode]
      .filter(Boolean)
      .join(' '),
  ].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>TorsionDesk</Text>
            <Text style={styles.companyMeta}>Infantino&apos;s Garage Door Service</Text>
          </View>

          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#INV-{data.invoiceNo}</Text>
            <Text style={styles.invoiceMeta}>Invoice Date: {invoiceDate}</Text>
            <Text style={styles.invoiceMeta}>Due Date: {dueDate}</Text>
            {data.paymentTermsDays != null && (
              <Text style={styles.invoiceMeta}>
                Payment Terms: {data.paymentTermsDays === 0 ? 'Due on Receipt' : `Net ${data.paymentTermsDays} days`}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rule} />

        {/* Bill To */}
        <View>
          <Text style={styles.sectionLabel}>Bill To:</Text>
          <Text style={styles.customerName}>{data.customer?.name || 'Customer'}</Text>
          {customerAddressLines.map((line, i) => (
            <Text key={i} style={styles.customerAddress}>
              {line}
            </Text>
          ))}
          {data.contact && (
            <Text style={styles.customerAddress}>
              {data.contact.firstName} {data.contact.lastName ?? ''}
            </Text>
          )}
        </View>

        {/* Description / Notes */}
        {data.notes && (
          <View style={styles.descriptionBox}>
            <Text style={styles.sectionLabel}>Notes:</Text>
            <Text style={styles.descriptionText}>{data.notes}</Text>
          </View>
        )}

        {/* Job reference */}
        {data.job && (
          <View style={styles.descriptionBox}>
            <Text style={styles.sectionLabel}>Job:</Text>
            <Text style={styles.descriptionText}>
              #JOB-{data.job.jobNo}
            </Text>
          </View>
        )}

        {/* Line Items */}
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.itemDescription, styles.tableHeaderCell]}>
              Description
            </Text>
            <Text style={[styles.itemNumber, styles.tableHeaderCell]}>Qty</Text>
            <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Rate</Text>
            <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Amount</Text>
          </View>

          {data.lineItems.length === 0 && (
            <View style={styles.itemRow}>
              <Text style={styles.itemDescription}>No line items.</Text>
              <Text style={styles.itemNumber} />
              <Text style={styles.itemMoney} />
              <Text style={styles.itemMoney} />
            </View>
          )}

          {data.lineItems.map((item, index) => {
            const amountCents =
              item.type === 'expense' ? 0 : lineTotalCents(item.qty, item.rate)
            return (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemDescription}>
                  {item.title || item.description || '—'}
                  {item.title && item.description && item.description !== item.title && (
                    <Text style={{ color: '#666' }}>{`\n${item.description}`}</Text>
                  )}
                </Text>
                <Text style={styles.itemNumber}>{item.qty || '—'}</Text>
                <Text style={styles.itemMoney}>
                  {item.rate ? `$${parseFloat(item.rate).toFixed(2)}` : '—'}
                </Text>
                <Text
                  style={[
                    styles.itemMoney,
                    ...(item.type === 'discount' ? [{ color: '#cc0000' }] : []),
                  ]}
                >
                  {item.type === 'expense'
                    ? '—'
                    : amountCents !== 0
                      ? fromCents(amountCents)
                      : '—'}
                </Text>
              </View>
            )
          })}

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Invoice Total</Text>
            <Text style={styles.totalAmount}>{fromCents(totalCents)}</Text>
          </View>

          {paidCents > 0 && (
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Amount Paid</Text>
              <Text style={styles.balanceDueAmount}>{fromCents(paidCents)}</Text>
            </View>
          )}

          {toCents(data.balance) > 0 && (
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Balance Due</Text>
              <Text style={[styles.balanceDueAmount, { color: '#cc0000' }]}>
                {fromCents(toCents(data.balance))}
              </Text>
            </View>
          )}
        </View>

        {/* Payments Received */}
        {data.payments.length > 0 && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentHeader}>PAYMENTS RECEIVED</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.paymentCell, styles.tableHeaderCell]}>
                Payment#
              </Text>
              <Text style={[styles.paymentCell, styles.tableHeaderCell]}>Method</Text>
              <Text style={[styles.paymentCell, styles.tableHeaderCell]}>Amount</Text>
              <Text style={[styles.paymentCell, styles.tableHeaderCell]}>Received On</Text>
            </View>
            {data.payments.map((payment, index) => (
              <View key={index} style={styles.paymentRow}>
                <Text style={styles.paymentCell}>#PAY-{payment.paymentNo}</Text>
                <Text style={styles.paymentCell}>{payment.method}</Text>
                <Text style={styles.paymentCell}>
                  {fromCents(toCents(payment.amountApplied))}
                </Text>
                <Text style={styles.paymentCell}>
                  {formatDate(payment.receivedOn)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Work Order Section */}
        {workOrder && data.job && (
          <View style={styles.workOrderSection}>
            <Text style={styles.workOrderTitle}>WORK ORDER</Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.itemDescription, styles.tableHeaderCell]}>
                Description
              </Text>
              <Text style={[styles.itemNumber, styles.tableHeaderCell]}>Qty</Text>
              <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Rate</Text>
              <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Amount</Text>
            </View>

            {data.lineItems.map((item, index) => {
              const amountCents =
                item.type === 'expense' ? 0 : lineTotalCents(item.qty, item.rate)
              return (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemDescription}>
                    {item.title || item.description || '—'}
                  </Text>
                  <Text style={styles.itemNumber}>{item.qty || '—'}</Text>
                  <Text style={styles.itemMoney}>
                    {item.rate ? `$${parseFloat(item.rate).toFixed(2)}` : '—'}
                  </Text>
                  <Text style={styles.itemMoney}>
                    {item.type === 'expense'
                      ? '—'
                      : amountCents !== 0
                        ? fromCents(amountCents)
                        : '—'}
                  </Text>
                </View>
              )
            })}

            {data.job.completionNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.sectionLabel}>Completion Notes:</Text>
                <Text style={styles.notesText}>{data.job.completionNotes}</Text>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionLabel}>Customer Signature:</Text>
              {data.signatureUrl ? (
                <View style={styles.signatureBox}>
                  <Image src={data.signatureUrl} style={styles.signatureImage} />
                </View>
              ) : (
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>No signature on file</Text>
                </View>
              )}
              {data.signedBy && (
                <Text style={styles.signatureLabel}>Signed by: {data.signedBy}</Text>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Thank you for your business.</Text>
        </View>
      </Page>
    </Document>
  )
}
