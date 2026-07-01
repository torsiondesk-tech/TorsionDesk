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

export interface PaymentReceiptEmailProps {
  paymentNo: number
  invoiceNo: number
  amountPaid: string
  companyName: string
}

export function PaymentReceiptEmail({
  paymentNo,
  invoiceNo,
  amountPaid,
  companyName,
}: PaymentReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment receipt from {companyName}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600 }}>{companyName}</Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>Payment Receipt</Text>
            <Text>Thank you for your payment.</Text>
            <Text>
              <strong>Payment #:</strong> {paymentNo}
              <br />
              <strong>Invoice #:</strong> {invoiceNo}
              <br />
              <strong>Amount paid:</strong> {amountPaid}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
