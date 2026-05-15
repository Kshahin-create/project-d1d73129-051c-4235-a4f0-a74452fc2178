// Generic admin-action Telegram notifier — routed via subscribers table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SECRET = Deno.env.get("AUDIT_ALERT_SECRET") ?? "aud_9f3kqz7m2x8vp4nrl1bs6h0";

const TABLE_LABELS: Record<string, string> = {
  bookings: "حجز", booking_units: "وحدة في حجز", invoices: "فاتورة", units: "وحدة",
  tenants: "مستأجر", tenant_accounts: "حساب مستأجر", tenant_account_units: "ربط وحدة بمستأجر",
  buildings: "مبنى", user_roles: "صلاحية مستخدم",
};
const TABLE_TO_TOPIC: Record<string, string> = {
  bookings: "booking", booking_units: "booking", invoices: "invoice", units: "unit",
  tenants: "tenant", tenant_accounts: "tenant", tenant_account_units: "tenant",
  buildings: "unit", user_roles: "anomaly",
};
const ACTION_LABELS: Record<string, string> = { INSERT: "➕ إضافة", UPDATE: "✏️ تعديل", DELETE: "🗑️ حذف" };
const FIELD_LABELS: Record<string, string> = {
  status: "الحالة", price: "السعر/الإيجار", paid_amount: "المبلغ المدفوع", total_price: "الإجمالي",
  amount: "المبلغ", paid: "مدفوعة", area: "المساحة", activity: "النشاط", unit_type: "نوع الوحدة",
  full_name: "الاسم", customer_full_name: "اسم العميل", customer_phone: "جوال العميل",
  business_name: "النشاط التجاري", cr_number: "الرقم الوطني الموحد", phone: "الجوال", email: "البريد",
  notes: "ملاحظات", expires_at: "تاريخ الانتهاء", payment_plan: "خطة الدفع", role: "الدور",
  display_name: "الاسم الظاهر",
};

const esc = (s: unknown) => String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtVal = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "number") return v.toLocaleString("en-US");
  const s = String(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-audit-secret") !== SECRET) return new Response("Unauthorized", { status: 401 });

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const p = await req.json();
    const table: string = p.table ?? "?";
    const action: string = p.action ?? "?";
    const before = p.before ?? null;
    const after = p.after ?? null;
    const changed: string[] = Array.isArray(p.changed) ? p.changed : [];
    const actor: string = p.actor_email ?? p.actor_id ?? "—";
    const entityId: string = p.entity_id ?? "";
    const topic = TABLE_TO_TOPIC[table] ?? "anomaly";

    // 🔇 تقليل الضوضاء: نسكِّت الجداول الفرعية اللي بتتكرر مع كل وحدة
    // ونسيب بس الأحداث المهمة الفعلية (حجز/فاتورة/تغيير حالة وحدة/مستأجر رئيسي).
    const NOISY_TABLES = new Set([
      "booking_units",        // بيتولّد سطر لكل وحدة في الحجز
      "tenant_account_units", // ربط وحدات بحساب
      "buildings",
      "user_roles",
    ]);
    if (NOISY_TABLES.has(table)) {
      return new Response(JSON.stringify({ ok: true, skipped: "noisy_table" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // tenants: نسكِّت الإضافة التلقائية عند تأكيد الحجز (بيتعمل سطر لكل وحدة)
    if (table === "tenants" && action === "INSERT") {
      return new Response(JSON.stringify({ ok: true, skipped: "tenant_auto_insert" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // bookings UPDATE: نبعت بس لو الحالة أو المبلغ المدفوع اتغيّروا
    if (table === "bookings" && action === "UPDATE") {
      const meaningful = changed.some((k) => ["status", "paid_amount", "expires_at"].includes(k));
      if (!meaningful) {
        return new Response(JSON.stringify({ ok: true, skipped: "trivial_update" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    // units UPDATE: نبعت بس لو الحالة اتغيّرت
    if (table === "units" && action === "UPDATE") {
      if (!changed.includes("status")) {
        return new Response(JSON.stringify({ ok: true, skipped: "unit_trivial" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const tableLbl = TABLE_LABELS[table] ?? table;
    const actLbl = ACTION_LABELS[action] ?? action;
    const data = after ?? before ?? {};

    const lines: string[] = [];
    lines.push(`🔔 <b>${actLbl} — ${esc(tableLbl)}</b>`);
    if (entityId) lines.push(`🆔 <code>${esc(entityId.slice(0, 8))}</code>`);
    lines.push(`👤 ${esc(actor)}`);

    const idBits: string[] = [];
    if (data.customer_full_name) idBits.push(`عميل: ${esc(data.customer_full_name)}`);
    if (data.full_name) idBits.push(`الاسم: ${esc(data.full_name)}`);
    if (data.tenant_name) idBits.push(`مستأجر: ${esc(data.tenant_name)}`);
    if (data.invoice_number) idBits.push(`فاتورة: ${esc(data.invoice_number)}`);
    if (data.building_number !== undefined && data.unit_number !== undefined)
      idBits.push(`مبنى ${data.building_number} — وحدة ${data.unit_number}`);
    if (idBits.length) lines.push(idBits.map((x) => `• ${x}`).join("\n"));

    if (action === "INSERT") {
      const summary: string[] = [];
      for (const k of ["total_price", "amount", "price", "status", "payment_plan"]) {
        if (data[k] !== undefined && data[k] !== null) summary.push(`${FIELD_LABELS[k] ?? k}: <b>${esc(fmtVal(data[k]))}</b>`);
      }
      if (summary.length) lines.push("\n" + summary.join("\n"));
    } else if (action === "UPDATE" && changed.length) {
      lines.push("\n<b>التغييرات:</b>");
      for (const k of changed) {
        if (k === "updated_at") continue;
        const lbl = FIELD_LABELS[k] ?? k;
        lines.push(`• ${lbl}: <s>${esc(fmtVal(before?.[k]))}</s> ⬅️ <b>${esc(fmtVal(after?.[k]))}</b>`);
      }
    }
    lines.push(`\n📅 ${new Date().toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" })}`);
    const text = lines.join("\n");

    // Inline action buttons for actionable events
    let reply_markup: any = undefined;
    if (table === "bookings" && action === "INSERT" && data.status === "pending" && entityId) {
      reply_markup = { inline_keyboard: [[
        { text: "✅ تأكيد", callback_data: `confirm_b:${entityId}` },
        { text: "❌ إلغاء", callback_data: `cancel_b:${entityId}` },
        { text: "📄 PDFs", callback_data: `pdfs_b:${entityId}` },
      ]] };
    } else if (table === "invoices" && action === "INSERT" && !data.paid && entityId) {
      reply_markup = { inline_keyboard: [[{ text: "✅ تسجيل دفع كامل", callback_data: `pay_full:${entityId}` }]] };
    }

    // Get recipients: prefer subscribers, fallback to env chat IDs
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, svc);

    let recipients: { chat_id: number }[] = [];
    const { data: subs } = await admin
      .from("telegram_subscribers")
      .select("chat_id, subscriptions, muted_until")
      .or(`muted_until.is.null,muted_until.lt.${new Date().toISOString()}`);
    recipients = (subs || [])
      .filter((s: any) => Array.isArray(s.subscriptions) && s.subscriptions.includes(topic))
      .map((s: any) => ({ chat_id: s.chat_id }));

    if (recipients.length === 0) {
      // Fallback: env chat IDs (legacy)
      for (const k of ["TELEGRAM_CHAT_ID_1", "TELEGRAM_CHAT_ID_2", "TELEGRAM_CHAT_ID_3", "TELEGRAM_CHAT_ID_4"]) {
        const v = Deno.env.get(k)?.trim();
        if (v) recipients.push({ chat_id: Number(v) });
      }
    }

    await Promise.all(recipients.map((r) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: r.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup }),
      }).catch((e) => console.error("tg send fail", r.chat_id, e)),
    ));

    return new Response(JSON.stringify({ ok: true, sent: recipients.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-alert error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
