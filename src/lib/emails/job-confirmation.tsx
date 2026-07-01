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

export interface JobConfirmationEmailProps {
  jobNo: number
  customerName: string
  scheduledDate: string
  address: string
  companyName: string
  footerText?: string | null
}

export function JobConfirmationEmail({
  jobNo,
  customerName,
  scheduledDate,
  address,
  companyName,
  footerText,
}: JobConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your garage door service is scheduled</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600 }}>{companyName}</Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>Your appointment is scheduled</Text>
            <Text>Hi {customerName},</Text>
            <Text>
              Your garage door service has been scheduled for {scheduledDate}.
            </Text>
            <Text>
              <strong>Job #:</strong> {jobNo}
              <br />
              <strong>Service address:</strong> {address}
            </Text>
            {footerText ? <Text style={{ marginTop: '24px', color: '#64748b' }}>{footerText}</Text> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
