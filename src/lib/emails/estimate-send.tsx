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

export interface EstimateSendEmailProps {
  estimateNo: number
  customerName: string
  total: string
  companyName: string
  footerText?: string | null
}

export function EstimateSendEmail({
  estimateNo,
  customerName,
  total,
  companyName,
  footerText,
}: EstimateSendEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your estimate from {companyName}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600 }}>{companyName}</Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>Estimate #{estimateNo}</Text>
            <Text>Hi {customerName},</Text>
            <Text>Please find your estimate attached. Total: {total}.</Text>
            {footerText ? <Text style={{ marginTop: '24px', color: '#64748b' }}>{footerText}</Text> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
