import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv, error } = await supa.from("invoices").select("*").eq("id", invoice_id).maybeSingle();
    if (error || !inv) throw new Error(error?.message || "Invoice not found");

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
    const chats: string[] = [];
    for (const k of ["TELEGRAM_CHAT_ID_1","TELEGRAM_CHAT_ID_2","TELEGRAM_CHAT_ID_3","TELEGRAM_CHAT_ID_4"]) {
      const v = Deno.env.get(k)?.trim(); if (v) chats.push(v);
    }
    if (chats.length === 0) {
      const legacy = Deno.env.get("TELEGRAM_CHAT_IDS");
      if (legacy) legacy.split(/[,\s]+/).filter(Boolean).forEach((v) => chats.push(v));
    }
    if (chats.length === 0) throw new Error("No chat IDs configured");

    const esc = (s: any) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const date = new Date(inv.paid_at || inv.created_at).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" });

    const baseUrl = (Deno.env.get("PUBLIC_SITE_URL") || "https://makka-lease-hub.lovable.app").replace(/\/$/,"");
    const link = `${baseUrl}/invoice/${inv.id}`;

    const lines = [
      "🧾 <b>فاتورة سداد جديدة</b>",
      `🔢 رقم الفاتورة: <code>${esc(inv.invoice_number)}</code>`,
      "",
      "👤 <b>العميل</b>",
      `• الاسم: ${esc(inv.customer_name)}`,
      inv.customer_phone ? `• الجوال: ${esc(inv.customer_phone)}` : null,
      inv.customer_business ? `• النشاط: ${esc(inv.customer_business)}` : null,
      inv.cr_number ? `• الرقم الوطني الموحد: ${esc(inv.cr_number)}` : null,
      "",
      `💰 المبلغ المدفوع: <b>${Number(inv.amount).toLocaleString("en-US")} ر.س</b>`,
      `💳 طريقة الدفع: ${esc(inv.payment_method || "—")}`,
      inv.notes ? `📝 ${esc(inv.notes)}` : null,
      "",
      `📅 ${date}`,
      "",
      `🔗 <a href="${link}">عرض الفاتورة</a>`,
    ].filter(Boolean) as string[];

    const text = lines.join("\n");
    const results: any[] = [];
    for (const chat_id of chats) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: false }),
      });
      const j = await r.json().catch(() => ({}));
      results.push({ chat_id, ok: r.ok && j?.ok === true });
    }
    return new Response(JSON.stringify({ success: results.some(x=>x.ok), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
