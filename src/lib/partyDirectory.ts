// Unified customer directory helpers.
// The database computes each customer's status (party_status) and owns every write
// (party_upsert, party_update, party_close, ...). This module only labels and shapes data for the UI.
import { supabase } from "@/integrations/supabase/client";

export type PartyStatus = "tenant" | "booker" | "interested" | "target" | "closed" | "archived";
export type CloseReason = "not_interested" | "no_answer" | "not_suitable" | "chose_other";

export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  tenant: "مستأجر",
  booker: "حاجز",
  interested: "مهتم",
  target: "مستهدف",
  closed: "مغلق",
  archived: "مؤرشف",
};

/** Tab order on the customers page. */
export const PARTY_STATUS_TABS: PartyStatus[] = ["tenant", "booker", "interested", "target", "closed", "archived"];

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  not_interested: "مش مهتم",
  no_answer: "لا يرد",
  not_suitable: "غير مناسب",
  chose_other: "اختار مكان تاني",
};

export const ID_TYPE_LABELS: Record<string, string> = {
  national_id: "هوية وطنية",
  iqama: "إقامة",
  commercial_registration: "سجل تجاري",
};

export type PartyRow = {
  id: string;
  tenant_code: string;
  name_ar: string;
  name_en: string | null;
  party_type: "company" | "individual";
  city: string | null;
  source: string | null;
  contact_visible: boolean;
  phone: string | null;
  email: string | null;
  id_type: string | null;
  id_number: string | null;
  status: PartyStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  closed_at: string | null;
  close_reason: CloseReason | null;
  interested_at: string | null;
  duplicate_of_id: string | null;
  merged_into_id: string | null;
  duplicate_of_code: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
  last_contact_at: string | null;
  open_opportunity: { id: string; stage: string; next_action: string | null; next_action_at: string | null; no_answer_attempts: number } | null;
};

export type DirectoryPage = {
  rows: PartyRow[];
  count: number;
  counts: Partial<Record<PartyStatus, number>>;
  no_owner: number;
  as_of: string;
};

/**
 * Same comparison key the database uses to detect duplicates:
 * the last 9 digits, so 0551234567, 966551234567 and +966 55 123 4567 match.
 */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  if (source.startsWith("import: ")) return `استيراد: ${source.slice(8)}`;
  if (source.startsWith("interested:")) return source.endsWith("telegram") ? "تيليجرام" : "المهتمون";
  const map: Record<string, string> = {
    manual: "إضافة يدوية", lead: "قائمة المستهدفين", platform: "المنصة", target_list: "قائمة مستهدفة",
    backfill_leads: "قائمة المستهدفين", backfill_customer_profiles: "حساب على المنصة", backfill_tenants: "سجل المستأجرين",
    backfill_tenant_accounts: "حسابات المستأجرين", backfill_bookings: "الحجوزات", backfill_interested_customers: "المهتمون",
  };
  return map[source] ?? source;
}

export async function rpcOrThrow<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

export type StaffOption = { user_id: string; name: string; role: string };
