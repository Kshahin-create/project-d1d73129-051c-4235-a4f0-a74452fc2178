/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MNI City'
const LOGO_URL =
  'https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/logo.jpeg'
const BRAND_PRIMARY = '#0f3d2e'
const BRAND_ACCENT = '#c9a35a'

interface BookingUnit {
  buildingNumber?: number
  unitNumber?: number
  unitType?: string | null
  area?: number
  activity?: string | null
  price?: number
}

interface BookingConfirmationProps {
  customerName?: string
  bookingId?: string
  units?: BookingUnit[]
  totalArea?: number
  totalPrice?: number
  businessName?: string
}

const formatPrice = (n?: number) =>
  typeof n === 'number'
    ? n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })
    : '—'

const BookingConfirmationEmail = ({
  customerName,
  bookingId,
  units = [],
  totalArea,
  totalPrice,
  businessName,
}: BookingConfirmationProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>
      تم استلام طلب حجزك في المدينة الصناعية بشمال مكة المكرمة
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with logo */}
        <Section style={header}>
          <Img
            src={LOGO_URL}
            width="80"
            height="80"
            alt={SITE_NAME}
            style={logo}
          />
          <Heading style={brandName}>{SITE_NAME}</Heading>
          <Text style={brandTag}>المدينة الصناعية بشمال مكة المكرمة</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>
            {customerName ? `أهلاً ${customerName}،` : 'أهلاً بك،'}
          </Heading>
          <Text style={lead}>
            تم استلام طلب الحجز الخاص بك بنجاح. فريقنا سيتواصل معك قريباً
            لإكمال إجراءات التعاقد.
          </Text>

          {bookingId && (
            <Section style={badgeWrap}>
              <Text style={badgeLabel}>رقم الطلب</Text>
              <Text style={badgeValue}>{bookingId.slice(0, 8).toUpperCase()}</Text>
            </Section>
          )}

          <Hr style={hr} />

          <Heading as="h2" style={h2}>تفاصيل الحجز</Heading>

          {businessName && (
            <Row style={detailRow}>
              <Column style={detailLabel}>اسم النشاط</Column>
              <Column style={detailValue}>{businessName}</Column>
            </Row>
          )}

          <Row style={detailRow}>
            <Column style={detailLabel}>عدد الوحدات</Column>
            <Column style={detailValue}>{units.length}</Column>
          </Row>

          {typeof totalArea === 'number' && (
            <Row style={detailRow}>
              <Column style={detailLabel}>إجمالي المساحة</Column>
              <Column style={detailValue}>
                {totalArea.toLocaleString('ar-SA')} م²
              </Column>
            </Row>
          )}

          {typeof totalPrice === 'number' && (
            <Row style={detailRow}>
              <Column style={detailLabel}>الإيجار السنوي</Column>
              <Column style={detailValueAccent}>
                {formatPrice(totalPrice)} ريال
              </Column>
            </Row>
          )}

          <Hr style={hr} />

          <Heading as="h2" style={h2}>الوحدات المحجوزة</Heading>

          {units.map((u, i) => (
            <Section key={i} style={unitCard}>
              <Row>
                <Column style={unitTitle}>
                  مبنى {u.buildingNumber} • وحدة {u.unitNumber}
                </Column>
              </Row>
              <Row style={unitMeta}>
                <Column style={unitMetaItem}>
                  <strong>المساحة:</strong> {u.area} م²
                </Column>
                <Column style={unitMetaItem}>
                  <strong>السعر:</strong> {formatPrice(u.price)} ريال
                </Column>
              </Row>
              {u.activity && (
                <Row>
                  <Column style={unitActivity}>
                    <strong>النشاط:</strong> {u.activity}
                  </Column>
                </Row>
              )}
            </Section>
          ))}

          <Section style={vatNotice}>
            <Text style={vatText}>
              * جميع الأسعار غير شاملة ضريبة القيمة المضافة (15%)
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            للاستفسار أو إكمال إجراءات الحجز، يمكنك التواصل معنا عبر
            واتساب أو الاتصال على الرقم: <strong>+966 59 565 0716</strong>
          </Text>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            شكراً لاختيارك {SITE_NAME}
          </Text>
          <Text style={footerSmall}>
            نخبة تسكين العقارية — مدير التشغيل والتأجير
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data?.bookingId
      ? `تأكيد حجز #${String(data.bookingId).slice(0, 8).toUpperCase()} — ${SITE_NAME}`
      : `تأكيد طلب الحجز — ${SITE_NAME}`,
  displayName: 'تأكيد الحجز',
  previewData: {
    customerName: 'أحمد محمد',
    bookingId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    businessName: 'مؤسسة النور التجارية',
    units: [
      {
        buildingNumber: 3,
        unitNumber: 12,
        unitType: 'مستودع',
        area: 240,
        activity: 'تخزين',
        price: 96000,
      },
      {
        buildingNumber: 3,
        unitNumber: 13,
        unitType: 'مستودع',
        area: 240,
        activity: 'تخزين',
        price: 96000,
      },
    ],
    totalArea: 480,
    totalPrice: 192000,
  },
} satisfies TemplateEntry

// Styles
const main = {
  backgroundColor: '#f5f6f8',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Arial, sans-serif',
  margin: 0,
  padding: '24px 12px',
}
const container = { maxWidth: '600px', margin: '0 auto' }
const header = {
  textAlign: 'center' as const,
  padding: '24px 16px',
  backgroundColor: BRAND_PRIMARY,
  borderRadius: '12px 12px 0 0',
}
const logo = {
  margin: '0 auto 12px',
  borderRadius: '12px',
  display: 'block',
}
const brandName = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  margin: '0 0 4px',
}
const brandTag = {
  color: BRAND_ACCENT,
  fontSize: '13px',
  margin: 0,
}
const card = {
  backgroundColor: '#ffffff',
  padding: '28px 24px',
  borderRadius: '0',
}
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: BRAND_PRIMARY,
  margin: '0 0 12px',
}
const h2 = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: BRAND_PRIMARY,
  margin: '20px 0 12px',
}
const lead = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.7',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.7',
  margin: '12px 0',
}
const badgeWrap = {
  textAlign: 'center' as const,
  backgroundColor: '#f8fafc',
  padding: '14px',
  borderRadius: '10px',
  border: `1px solid #e2e8f0`,
  margin: '8px 0 16px',
}
const badgeLabel = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
}
const badgeValue = {
  fontSize: '20px',
  color: BRAND_PRIMARY,
  fontWeight: 'bold' as const,
  margin: 0,
  fontFamily: 'Courier, monospace',
  letterSpacing: '2px',
}
const hr = {
  border: 'none',
  borderTop: '1px solid #e2e8f0',
  margin: '20px 0',
}
const detailRow = { padding: '6px 0' }
const detailLabel = {
  fontSize: '13px',
  color: '#64748b',
  width: '50%',
}
const detailValue = {
  fontSize: '14px',
  color: '#0f172a',
  fontWeight: '600' as const,
  width: '50%',
  textAlign: 'left' as const,
}
const detailValueAccent = {
  fontSize: '15px',
  color: BRAND_PRIMARY,
  fontWeight: 'bold' as const,
  width: '50%',
  textAlign: 'left' as const,
}
const unitCard = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '8px 0',
}
const unitTitle = {
  fontSize: '14px',
  color: BRAND_PRIMARY,
  fontWeight: 'bold' as const,
  paddingBottom: '6px',
}
const unitMeta = { paddingTop: '4px' }
const unitMetaItem = {
  fontSize: '13px',
  color: '#475569',
  paddingLeft: '8px',
}
const unitActivity = {
  fontSize: '13px',
  color: '#475569',
  paddingTop: '6px',
}
const vatNotice = {
  backgroundColor: '#fef9e7',
  borderRight: `3px solid ${BRAND_ACCENT}`,
  padding: '10px 14px',
  margin: '14px 0',
  borderRadius: '6px',
}
const vatText = {
  fontSize: '12px',
  color: '#7c5e1a',
  margin: 0,
}
const footer = {
  textAlign: 'center' as const,
  padding: '20px 16px',
  backgroundColor: '#0f172a',
  borderRadius: '0 0 12px 12px',
}
const footerText = {
  color: '#ffffff',
  fontSize: '13px',
  margin: '0 0 4px',
  fontWeight: '600' as const,
}
const footerSmall = {
  color: '#94a3b8',
  fontSize: '11px',
  margin: 0,
}
