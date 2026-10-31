import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@4';
import { audience, SOURCES, templateComponents, outcome } from './logic.ts';

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('audience') }), z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('create'), name: z.string().trim().min(1).max(120), template: z.string().regex(/^[a-z0-9_]{1,512}$/), language: z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/), channel: z.number().int().positive(), body: z.array(z.string().min(1).max(1024)).max(30), header: z.string().max(1024), image: z.union([z.literal(''), z.url().startsWith('https://')]), confirmed: z.literal(true), expected: z.number().int().positive() }),
  ...(['detail','start','pause','batch'] as const).map(action => z.object({ action: z.literal(action), id: z.uuid() })),
]);
function reply(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'الطلب غير مدعوم' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('إعدادات الخدمة غير مكتملة');
    const db = createClient(url, key);
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply({ error: 'سجّل الدخول أولًا' }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: 'جلسة الدخول غير صالحة' }, 401);
    const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', auth.user.id);
    if (roleError || !roles?.some(r => r.role === 'admin')) return reply({ error: 'هذه الصفحة للأدمن فقط' }, 403);
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ error: 'راجع بيانات الطلب', details: parsed.error.flatten() }, 400);
    const input = parsed.data;
    async function collect() {
      const rows: { phone: string; source: string }[] = [];
      for (const [table, field, source] of SOURCES) {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await db.from(table).select(`id,${field}`).order('id').range(offset, offset + 999);
          if (error) throw new Error(`تعذر قراءة ${source}؛ لم يتم إنشاء جمهور ناقص`);
          for (const row of data || []) { const record = row as unknown as Record<string, unknown>; if (typeof record[field] === 'string') rows.push({ phone: record[field] as string, source }); }
          if ((data?.length || 0) < 1000) break;
        }
      }
      for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error('تعذر قراءة أرقام المستخدمين');
        for (const user of data.users) if (user.phone) rows.push({ phone: user.phone, source: 'المستخدمون' });
        if (data.users.length < 1000) break;
      }
      return audience(rows);
    }
    if (input.action === 'audience') { const result = await collect(); return reply({ summary: result.summary }); }
    if (input.action === 'list') {
      const { data, error } = await db.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error; return reply({ campaigns: data });
    }
    if (input.action === 'create') {
      if (!Deno.env.get('RESPOND_IO_API_TOKEN')) return reply({ error: 'مفتاح Respond.io غير موجود' }, 503);
      const result = await collect();
      if (result.summary.total !== input.expected) return reply({ error: 'تغيّر عدد الجمهور؛ حدّث الأرقام وأكّد العدد الجديد' }, 409);
      const { data: campaign, error } = await db.from('marketing_campaigns').insert({ created_by: auth.user.id, name: input.name, template_name: input.template, language: input.language, channel_id: input.channel, components: templateComponents(input.body, input.header, input.image), audience_summary: result.summary }).select().single();
      if (error) throw error;
      for (let offset = 0; offset < result.recipients.length; offset += 500) {
        const { error: insertError } = await db.from('marketing_recipients').insert(result.recipients.slice(offset, offset + 500).map(r => ({ ...r, campaign_id: campaign.id })));
        if (insertError) throw new Error('لم يكتمل تجميع الحملة؛ لا ترسل هذه الحملة وأنشئ حملة جديدة');
      }
      return reply({ id: campaign.id });
    }
    const { data: campaign, error: campaignError } = await db.from('marketing_campaigns').select('*').eq('id', input.id).single();
    if (campaignError || !campaign) return reply({ error: 'الحملة غير موجودة' }, 404);
    async function detail() {
      const counts: Record<string, number> = {};
      for (const status of ['queued','sending','accepted','failed','unknown']) {
        const { count, error } = await db.from('marketing_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', input.id).eq('status', status);
        if (error) throw error; counts[status] = count || 0;
      }
      const { data: errors, error } = await db.from('marketing_recipients').select('id,status,error').eq('campaign_id', input.id).in('status',['failed','unknown']).limit(20);
      if (error) throw error;
      const { data: current } = await db.from('marketing_campaigns').select('*').eq('id', input.id).single();
      return { campaign: current, counts, errors };
    }
    if (input.action === 'start' || input.action === 'pause') {
      if (input.action === 'start') {
        const d = await detail();
        if (Object.values(d.counts).reduce((a,b) => a+b,0) !== Number(campaign.audience_summary.total)) return reply({ error: 'الحملة غير مكتملة؛ أنشئ حملة جديدة' }, 409);
      }
      const { error } = await db.from('marketing_campaigns').update({ status: input.action === 'start' ? 'running' : 'paused', updated_at: new Date().toISOString() }).eq('id', input.id);
      if (error) throw error; return reply(await detail());
    }
    if (input.action === 'batch') {
      const providerToken = Deno.env.get('RESPOND_IO_API_TOKEN');
      if (!providerToken) return reply({ error: 'مفتاح Respond.io غير موجود' }, 503);
      for (let n = 0; n < 5; n++) {
        const { data: claimed, error: claimError } = await db.rpc('claim_marketing_recipient', { _campaign_id: input.id });
        if (claimError) throw claimError;
        const recipient = claimed?.[0]; if (!recipient) break;
        let status: 'accepted' | 'failed' | 'unknown' = 'unknown'; let errorText: string | null = null; let responseData: unknown = null; let stop = false;
        try {
          const response = await fetch(`https://api.respond.io/v2/contact/phone:${encodeURIComponent(recipient.phone)}/message`, { method: 'POST', headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: Number(campaign.channel_id), message: { type: 'whatsapp_template', template: { name: campaign.template_name, languageCode: campaign.language, components: campaign.components } } }), signal: AbortSignal.timeout(8000) });
          const text = await response.text();
          try { responseData = JSON.parse(text); } catch { responseData = { detail: text.slice(0,4000) }; }
          status = outcome(response.status);
          if (!response.ok) { errorText = `[${response.status}] ${text.slice(0,2000)}`; stop = true; }
        } catch { errorText = 'نتيجة غير مؤكدة بعد انقطاع الاتصال؛ لم تتم إعادة الإرسال'; stop = true; }
        const { error: updateError } = await db.from('marketing_recipients').update({ status, error: errorText, provider_response: responseData, updated_at: new Date().toISOString() }).eq('id', recipient.id);
        if (updateError) throw new Error('تعذر حفظ نتيجة الإرسال؛ توقف للتأكد من Respond.io قبل الاستئناف');
        if (stop) {
          const { error } = await db.from('marketing_campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', input.id); if (error) throw error; break;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      const d = await detail();
      if (!d.counts.queued && !d.counts.sending) {
        const { error } = await db.from('marketing_campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', input.id); if (error) throw error;
        return reply(await detail());
      }
      return reply(d);
    }
    return reply(await detail());
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'تعذر إكمال الطلب' }, 500); }
});