import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { financeLabels, money } from "@/lib/finance";
import { unitStatusLabel } from "@/lib/unitStatus";
import { stageLabel } from "@/lib/crm";
import { recordHref, type RecordKind } from "@/lib/adminNavigation";

// Explicit field lists at this read boundary prevent exporting hidden columns.
export const adminClient = supabase as unknown as SupabaseClient;
export type AdminRow = Record<string, unknown>;
export type Column = { key: string; label: string; money?: boolean };
export type ListSpec = { key: string; title: string; table: string; columns: Column[]; search?: string[]; kind?: RecordKind; order: string; archived?: string; finance?: boolean; adminOnly?: boolean; filters?: Record<string, string | boolean>; };
const c = (key: string, label: string, monetary = false): Column => ({ key, label, money: monetary });
export const adminLists: Record<string, ListSpec> = {
  units: { key: "units", title: "الوحدات", table: "units", kind: "units", order: "unit_number", columns: [c("unit_number", "الوحدة"), c("building_number", "المبنى"), c("unit_type", "نوع الوحدة"), c("area_m2", "المساحة م²"), c("leasing_status", "حالة التأجير"), c("publish_state", "النشر")], filters: { is_test: false } },
  parties: { key: "parties", title: "العملاء", table: "parties_crm", kind: "parties", order: "created_at", archived: "archived_at", search: ["name_ar", "tenant_code", "phone", "id_number"], columns: [c("name_ar", "الاسم"), c("tenant_code", "كود العميل"), c("phone", "الجوال"), c("id_number", "الهوية"), c("city", "المدينة"), c("tenant_lifecycle", "حالة المستأجر")] },
  contracts: { key: "contracts", title: "العقود", table: "contracts", kind: "contracts", order: "created_at", finance: true, search: ["contract_no"], columns: [c("contract_no", "رقم العقد"), c("start_date", "البداية"), c("end_date", "النهاية"), c("annual_rent_excl_vat", "الأجرة السنوية بدون الضريبة", true), c("vat_rate", "نسبة الضريبة %"), c("status", "الحالة")] },
  receipts: { key: "receipts", title: "السندات والإيصالات", table: "receipts", kind: "receipts", order: "recorded_at", archived: "archived_at", finance: true, search: ["receipt_no"], columns: [c("receipt_no", "رقم الإيصال"), c("paid_at", "تاريخ السداد الفعلي"), c("amount_excl_vat", "بدون الضريبة", true), c("vat_amount", "الضريبة", true), c("amount_incl_vat", "شامل الضريبة", true), c("status", "الحالة")] },
  bookings: { key: "bookings", title: "الحجوزات", table: "bookings", kind: "bookings", order: "created_at", archived: "archived_at", search: ["customer_full_name", "customer_phone", "offer_number"], columns: [c("customer_full_name", "العميل"), c("offer_number", "رقم الطلب"), c("status", "الحالة"), c("units_count", "الوحدات"), c("created_at", "تاريخ الطلب"), c("expires_at", "انتهاء الحجز")] },
  opportunities: { key: "opportunities", title: "الفرص", table: "opportunities", kind: "opportunities", order: "created_at", columns: [c("stage", "المرحلة"), c("source", "المصدر"), c("next_action", "المتابعة القادمة"), c("next_action_at", "موعد المتابعة"), c("created_at", "تاريخ الإنشاء")] },
  installments: { key: "installments", title: "الأقساط", table: "installments_read", order: "due_date", finance: true, columns: [c("sequence_no", "القسط"), c("due_date", "الاستحقاق"), c("amount_excl_vat", "بدون الضريبة", true), c("vat_amount", "الضريبة", true), c("amount_incl_vat", "شامل الضريبة", true), c("current_status", "الحالة الحالية")] },
};
export function displayAdminValue(column: Column, value: unknown): string {
  if (value == null) return "غير موثق";
  if (column.money) return money(value);
  const text = String(value);
  if (column.key === "leasing_status") return unitStatusLabel(text);
  if (column.key === "stage") return stageLabel(text);
  const labels: Record<string, string> = { pending: "قيد الانتظار", confirmed: "مؤكد", expired: "منتهي", published: "منشور", unpublished: "غير منشور", company: "شركة", individual: "فرد", platform: "المنصة", target_list: "قائمة مستهدفة", agent: "المبيعات", active: "نشط", workshop: "ورشة", shop: "محل", showroom: "معرض", warehouse: "مستودع", renewal_due: "تجديد مستحق", renewed: "مجدد", whatsapp: "واتساب", call: "مكالمة", referral: "ترشيح", campaign: "حملة", walk_in: "زيارة مباشرة" };
  return financeLabels[text] ?? labels[text] ?? text;
}
export function safeSearch(value: string) { return value.trim().replace(/[,()%*\\]/g, "").slice(0, 100); }
export function listQuery(spec: ListSpec, search: string, sort: string, ascending: boolean, archived: boolean, filters: Record<string, string> = {}, signal?: AbortSignal) {
  const extras = spec.kind === "bookings" || spec.kind === "opportunities" ? ["party_id"] : spec.key === "installments" ? ["contract_id"] : [];
  const fields = [...new Set(["id", ...spec.columns.map(col => col.key), ...extras])].join(",");
  let q = adminClient.from(spec.table).select(fields, { count: "exact" });
  for (const [key, value] of Object.entries(spec.filters ?? {})) q = q.eq(key, value);
  for (const [key, value] of Object.entries(filters)) if (value) q = q.eq(key, value);
  if (spec.archived && !archived) q = q.is(spec.archived, null);
  const term = safeSearch(search);
  if (term) {
    if (spec.key === "units" && /^\d+$/.test(term)) q = q.eq("unit_number", Number(term));
    else if (spec.search?.length) q = q.or(spec.search.map(key => `${key}.ilike.%${term}%`).join(","));
    else if (/^[0-9a-f-]{36}$/i.test(term)) q = q.eq("id", term);
    else q = q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  const order = spec.columns.some(col => col.key === sort) ? sort : spec.order;
  q = q.order(order, { ascending, nullsFirst: false }).order("id", { ascending: true });
  return signal ? q.abortSignal(signal) : q;
}
export function rowHref(spec: ListSpec, row: AdminRow) {
  return spec.kind && typeof row.id === "string" ? recordHref(spec.kind, row.id) : typeof row.contract_id === "string" ? recordHref("contracts", row.contract_id) : null;
}
export function canReadFinance(auth: { isAdmin: boolean; isManager: boolean; isAccountant: boolean; isLeasingManager: boolean }) { return auth.isAdmin || auth.isManager || auth.isAccountant || auth.isLeasingManager; }
export function canExportList(key: string, auth: { isAdmin: boolean; isManager: boolean; isLeasingManager: boolean; isAccountant: boolean; isSalesAgent: boolean }) {
  if (auth.isAdmin || auth.isManager) return true;
  if (["contracts", "receipts", "installments"].includes(key)) return auth.isAccountant || auth.isLeasingManager;
  return key === "opportunities" && (auth.isLeasingManager || auth.isSalesAgent);
}