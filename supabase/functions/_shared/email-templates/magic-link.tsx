/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = 'MNI City'
const LOGO_URL =
  'https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/logo.jpeg'
const BRAND = '#0f3d2e'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رابط الدخول إلى {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} width="72" height="72" alt={SITE_NAME} style={logo} />
          <Heading style={brandName}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>رابط الدخول الخاص بك</Heading>
          <Text style={text}>
            اضغط الزر بالأسفل لتسجيل الدخول إلى {SITE_NAME}. الرابط صالح لفترة قصيرة فقط.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button style={button} href={confirmationUrl}>تسجيل الدخول</Button>
          </Section>
          <Text style={footer}>
            إذا لم تطلب هذا الرابط، يمكنك تجاهل الرسالة بأمان.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#f5f6f8', fontFamily: '-apple-system, "Segoe UI", Tahoma, Arial, sans-serif', padding: '24px 12px' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, padding: '24px', backgroundColor: BRAND, borderRadius: '12px 12px 0 0' }
const logo = { margin: '0 auto 10px', borderRadius: '12px', display: 'block' }
const brandName = { color: '#ffffff', fontSize: '20px', fontWeight: 'bold' as const, margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 24px', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: BRAND, margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.7', margin: '0 0 16px' }
const button = { backgroundColor: BRAND, color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
