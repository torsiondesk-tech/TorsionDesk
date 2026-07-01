import {
  Html,
  Head,
  Body,
  Container,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface CustomBodyEmailProps {
  companyName: string
  body: string
  footerText?: string | null
}

export function CustomBodyEmail({ companyName, body, footerText }: CustomBodyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Message from {companyName}</Preview>
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', maxWidth: '600px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>{companyName}</Text>
            <Text style={{ whiteSpace: 'pre-line', fontSize: '14px', lineHeight: '1.6' }}>{body}</Text>
            {footerText ? (
              <Text style={{ marginTop: '24px', color: '#64748b', fontSize: '12px' }}>{footerText}</Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
