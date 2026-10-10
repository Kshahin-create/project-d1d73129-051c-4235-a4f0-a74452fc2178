import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.3.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Reason = 'bounce' | 'complaint' | 'unsubscribe'
const STATUS: Record<Reason, string> = { bounce: 'bounced', complaint: 'complained', unsubscribe: 'suppressed' }
const MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

// Notification-only record keeping; Lovable enforces suppression at send time.
async function record(event: any, reason: Reason) {
  const email = String(event.data?.recipient ?? '').toLowerCase()
  if (!email) return
  const { error: upErr } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (upErr) {
    console.error('suppressed_emails upsert failed', { code: upErr.code, message: upErr.message, event_id: event.event_id })
    throw new Error('Failed to record suppression')
  }
  const { error: logErr } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  })
  if (logErr) {
    console.error('email_send_log insert failed', { code: logErr.code, message: logErr.message, event_id: event.event_id })
    throw new Error('Failed to record event')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': (event) => record(event, 'bounce'),
    'email.complaint': (event) => record(event, 'complaint'),
    'email.unsubscribed': (event) => record(event, 'unsubscribe'),
  },
})

Deno.serve((req) => handler(req))
