// Generic admin-action Telegram notifier. Called by DB trigger on audit_log insert.
const SECRET = Deno.env.get("AUDIT_ALERT_SECRET") ?? "aud_9f3kqz7m2x8vp4nrl1bs6h0";

const TABLE_LABELS: Record<string, string> = {
  bookings: "حجز",
  booking_units: "وحدة في حجز",
  invoices: "فاتورة",
  units: "وحدة",
  tenants: "مستأجر",
  tenant_accounts: "حساب مستأجر",
  tenant_account_units: "ربط وحدة بمستأجر",
  buildings: "مبنى",
  user_roles: "صلاحية مستخدم",
  customer_profiles: "ملف عميل",
  api_keys: "مفتاح API",
  profiles: "ملف شخصي",
};
const ACTION_LABELS: Record<string, string> = {
  INSERT: "➕ إضافة",
  UPDATE: "✏️ تعديل",
  DELETE: "🗑️ حذف",
};
const FIELD_LABELS: Record<string, string> = {
  status: "الحالة",
  price: "السعر/الإيجار",
  paid_amount: "المبلغ المدفوع",
  total_price: "الإجمالي",
  amount: "المبلغ",
  paid: "مدفوعة",
  area: "المساحة",
  activity: "النشاط",
  unit_type: "نوع الوحدة",
  full_name: "الاسم",
  customer_full_name: "اسم العميل",
  customer_phone: "جوال العميل",
  business_name: "النشاط التجاري",
  cr_number: "الرقم الوطني الموحد",
  phone: "الجوال",
  email: "البريد",
  notes: "ملاحظات",
  expires_at: "تاريخ الانتهاء",
  payment_plan: "خطة الدفع",
  role: "الدور",
  display_name: "الاسم الظاهر",
};

const esc = (s: unknown) =>
  String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

    const chatIds: string[] = [];
    for (const k of ["TELEGRAM_CHAT_ID_1", "TELEGRAM_CHAT_ID_2", "TELEGRAM_CHAT_ID_3", "TELEGRAM_CHAT_ID_4"]) {
      const v = Deno.env.get(k)?.trim();
      if (v) chatIds.push(v);
    }
    if (chatIds.length === 0) {
      const legacy = Deno.env.get("TELEGRAM_CHAT_IDS");
      if (legacy) legacy.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((v) => chatIds.push(v));
    }
    if (chatIds.length === 0) throw new Error("No Telegram chat IDs configured");

    const p = await req.json();
    const table: string = p.table ?? "?";
    const action: string = p.action ?? "?";
    const before: Record<string, unknown> | null = p.before ?? null;
    const after: Record<string, unknown> | null = p.after ?? null;
    const changed: string[] = Array.isArray(p.changed) ? p.changed : [];
    const actor: string = p.actor_email ?? p.actor_id ?? "—";
    const entityId: string = p.entity_id ?? "";

    const tableLbl = TABLE_LABELS[table] ?? table;
    const actLbl = ACTION_LABELS[action] ?? action;

    const lines: string[] = [];
    lines.push(`🔔 <b>${actLbl} — ${esc(tableLbl)}</b>`);
    if (entityId) lines.push(`🆔 <code>${esc(entityId.slice(0, 8))}</code>`);
    lines.push(`👤 ${esc(actor)}`);

    // Identifying info
    const data = after ?? before ?? {};
    const idBits: string[] = [];
    if ((data as any).customer_full_name) idBits.push(`عميل: ${esc((data as any).customer_full_name)}`);
    if ((data as any).full_name) idBits.push(`الاسم: ${esc((data as any).full_name)}`);
    if ((data as any).tenant_name) idBits.push(`مستأجر: ${esc((data as any).tenant_name)}`);
    if ((data as any).invoice_number) idBits.push(`فاتورة: ${esc((data as any).invoice_number)}`);
    if ((data as any).building_number !== undefined && (data as any).unit_number !== undefined)
      idBits.push(`مبنى ${(data as any).building_number} — وحدة ${(data as any).unit_number}`);
    if (idBits.length) lines.push(idBits.map((x) => `• ${x}`).join("\n"));

    if (action === "INSERT") {
      const summary: string[] = [];
      for (const k of ["total_price", "amount", "price", "status", "payment_plan"]) {
        if ((data as any)[k] !== undefined && (data as any)[k] !== null) {
          summary.push(`${FIELD_LABELS[k] ?? k}: <b>${esc(fmtVal((data as any)[k]))}</b>`);
        }
      }
      if (summary.length) lines.push("\n" + summary.join("\n"));
    } else if (action === "UPDATE" && changed.length) {
      lines.push("\n<b>التغييرات:</b>");
      for (const k of changed) {
        if (k === "updated_at") continue;
        const lbl = FIELD_LABELS[k] ?? k;
        const b = fmtVal(before?.[k]);
        const a = fmtVal(after?.[k]);
        lines.push(`• ${lbl}: <s>${esc(b)}</s> ⬅️ <b>${esc(a)}</b>`);
      }
    } else if (action === "DELETE") {
      const summary: string[] = [];
      for (const k of ["total_price", "amount", "price", "status"]) {
        if ((data as any)[k] !== undefined) summary.push(`${FIELD_LABELS[k] ?? k}: ${esc(fmtVal((data as any)[k]))}`);
      }
      if (summary.length) lines.push("\n" + summary.join("\n"));
    }

    const date = new Date().toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" });
    lines.push(`\n📅 ${date}`);

    const text = lines.join("\n");

    await Promise.all(
      chatIds.map((chat_id) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
        }).catch((e) => console.error("tg send fail", chat_id, e)),
      ),
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-audit-alert error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
