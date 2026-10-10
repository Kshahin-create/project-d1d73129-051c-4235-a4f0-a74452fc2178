import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const TEMPLATE = 'booking-confirmation'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
  const user = userData.user

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : ''
  const templateData = body?.templateData && typeof body.templateData === 'object' ? body.templateData : {}
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return json({ error: 'bookingId is required' }, 400)

  // Recipient comes from the caller's own booking, never from the browser.
  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('id, user_id, customer_email')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr || !booking || booking.user_id !== user.id) return json({ error: 'Booking not found' }, 404)
  const recipient = booking.customer_email || user.email
  if (!recipient) return json({ error: 'No recipient' }, 400)

  const log = async (row: Record<string, unknown>) => {
    const { error } = await admin.from('email_send_log').insert({
      message_id: null,
      template_name: TEMPLATE,
      recipient_email: recipient,
      ...row,
    })
    if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
  }

  try {
    const result = await sendTemplateEmail(TEMPLATE, recipient, {
      templateData: { ...templateData, bookingId },
      idempotencyKey: `booking-confirm-${bookingId}`,
    })
    if (result.sent) {
      await log({ status: 'sent' })
      return json({ success: true })
    }
    await log({ status: 'suppressed' })
    return json({ success: false, reason: 'email_suppressed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log({ status: 'failed', error_message: message.slice(0, 1000) })
    console.error('Booking confirmation send failed', { message })
    return json({ error: 'Failed to send email' }, 500)
  }
})
