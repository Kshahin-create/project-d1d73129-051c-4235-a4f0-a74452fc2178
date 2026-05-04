/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = 'MNI City'
const LOGO_URL =
  'https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/logo.jpeg'
const BRAND = '#0f3d2e'
const ACCENT = '#c9a35a'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تأكيد بريدك الإلكتروني في {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} width="72" height="72" alt={SITE_NAME} style={logo} />
          <Heading style={brandName}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>أكّد بريدك الإلكتروني</Heading>
          <Text style={text}>
            شكراً لتسجيلك في{' '}
            <Link href={siteUrl} style={link}><strong>{SITE_NAME}</strong></Link>!
          </Text>
          <Text style={text}>
            من فضلك أكّد عنوان بريدك (
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
            ) بالضغط على الزر:
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>تأكيد البريد</Button>
          </Section>
          <Text style={footer}>
            إذا لم تنشئ حساباً، يمكنك تجاهل هذه الرسالة بأمان.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#f5f6f8', fontFamily: '-apple-system, "Segoe UI", Tahoma, Arial, sans-serif', padding: '24px 12px', direction: 'rtl' as const, textAlign: 'right' as const }
const container = { maxWidth: '560px', margin: '0 auto', direction: 'rtl' as const, textAlign: 'right' as const }
const header = { textAlign: 'center' as const, padding: '24px', backgroundColor: BRAND, borderRadius: '12px 12px 0 0' }
const logo = { margin: '0 auto 10px', borderRadius: '12px', display: 'block' }
const brandName = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 24px', borderRadius: '0 0 12px 12px', direction: 'rtl' as const, textAlign: 'right' as const }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: BRAND, margin: '0 0 16px', direction: 'rtl' as const, textAlign: 'right' as const }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 16px', direction: 'rtl' as const, textAlign: 'right' as const, unicodeBidi: 'plaintext' as const }
const link = { color: BRAND, textDecoration: 'underline' }
const button = { backgroundColor: BRAND, color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0', direction: 'rtl' as const, textAlign: 'right' as const }
