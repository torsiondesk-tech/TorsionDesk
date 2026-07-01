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

export interface TechNotifyEmailProps {
  jobNo: number
  customerName: string
  address: string
  assignedTechName: string
  companyName: string
}

export function TechNotifyEmail({
  jobNo,
  customerName,
  address,
  assignedTechName,
  companyName,
}: TechNotifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New job assignment</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600 }}>{companyName}</Text>
            <Text style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px' }}>New job assignment</Text>
            <Text>Hi {assignedTechName},</Text>
            <Text>You have been assigned a new job.</Text>
            <Text>
              <strong>Job #:</strong> {jobNo}
              <br />
              <strong>Customer:</strong> {customerName}
              <br />
              <strong>Address:</strong> {address}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
