import * as React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { EstimatePdfData } from '@/lib/estimates/pdf-data'

export interface EstimatePdfDocumentProps {
  data: EstimatePdfData
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
  estimateBlock: {
    width: '40%',
    alignItems: 'flex-end',
  },
  estimateLabel: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#333',
  },
  estimateNumber: {
    fontSize: 12,
    marginTop: 4,
  },
  estimateMeta: {
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
  groupRow: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  groupName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
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
  notesBox: {
    marginTop: 16,
  },
  notesText: {
    fontSize: 9,
    color: '#444',
    marginTop: 2,
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

function moneyLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function EstimatePdfDocument({ data }: EstimatePdfDocumentProps) {
  const estimateDate = formatDate(data.createdAt)
  const validUntil = data.expiryDate ? formatDate(data.expiryDate) : null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.companyName || 'TorsionDesk'}</Text>
            {data.companyAddress && <Text style={styles.companyMeta}>{data.companyAddress}</Text>}
            {data.companyPhone && <Text style={styles.companyMeta}>{data.companyPhone}</Text>}
            {data.companyEmail && <Text style={styles.companyMeta}>{data.companyEmail}</Text>}
          </View>

          <View style={styles.estimateBlock}>
            <Text style={styles.estimateLabel}>ESTIMATE</Text>
            <Text style={styles.estimateNumber}>#EST-{data.estimateNo}</Text>
            <Text style={styles.estimateMeta}>Date: {estimateDate}</Text>
            {validUntil && <Text style={styles.estimateMeta}>Valid Until: {validUntil}</Text>}
          </View>
        </View>

        <View style={styles.rule} />

        {/* Bill To */}
        <View>
          <Text style={styles.sectionLabel}>Bill To:</Text>
          <Text style={styles.customerName}>{data.customerName || 'Customer'}</Text>
          {data.serviceAddress && <Text style={styles.customerAddress}>{data.serviceAddress}</Text>}
        </View>

        {/* Description */}
        {data.description && (
          <View style={styles.descriptionBox}>
            <Text style={styles.sectionLabel}>Project Description:</Text>
            <Text style={styles.descriptionText}>{data.description}</Text>
          </View>
        )}

        {/* Line Items */}
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.itemDescription, styles.tableHeaderCell]}>Description</Text>
            <Text style={[styles.itemNumber, styles.tableHeaderCell]}>Qty</Text>
            <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Rate</Text>
            <Text style={[styles.itemMoney, styles.tableHeaderCell]}>Total</Text>
          </View>

          {data.groups.map((group, gi) => {
            const groupTotalCents = group.items.reduce(
              (sum, item) => sum + Math.round(parseFloat(item.total) * 100),
              0,
            )
            const showSubtotal = group.items.length > 1 && group.name

            return (
              <View key={gi}>
                {group.name && (
                  <View style={styles.groupRow}>
                    <Text style={styles.groupName}>{group.name}</Text>
                  </View>
                )}

                {group.items.map((item, ii) => (
                  <View key={ii} style={styles.itemRow}>
                    <Text style={styles.itemDescription}>{item.description || '—'}</Text>
                    <Text style={styles.itemNumber}>{item.qty}</Text>
                    <Text style={styles.itemMoney}>${item.rate}</Text>
                    <Text style={styles.itemMoney}>${item.total}</Text>
                  </View>
                ))}

                {showSubtotal && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalText}>Subtotal: {moneyLabel(groupTotalCents)}</Text>
                  </View>
                )}
              </View>
            )
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>${data.grandTotal}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.sectionLabel}>Notes:</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}
