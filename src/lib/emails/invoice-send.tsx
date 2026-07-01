import * as React from 'react'
import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Preview,
  Head,
} from '@react-email/components'

export interface InvoiceSendEmailProps {
  invoiceNo: number
  customerName: string
  total: string
  balance: string
  companyName: string
  footerText?: string | null
}

export function InvoiceSendEmail({
  invoiceNo,
  customerName,
  total,
  balance,
  companyName,
  footerText,
}: InvoiceSendEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your invoice from {companyName}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600 }}>{companyName}</Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>Invoice #{invoiceNo}</Text>
            <Text>Hi {customerName},</Text>
            <Text>Please find your invoice attached.</Text>
            <Text>
              <strong>Total:</strong> {total}
              <br />
              <strong>Balance due:</strong> {balance}
            </Text>
            {footerText ? <Text style={{ marginTop: '24px', color: '#64748b' }}>{footerText}</Text> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
