// CRM shared labels and transition policy.
// The database (move_opportunity) is the authoritative writer; this module mirrors
// its rules for UI display only and must never be used to bypass the RPC.

export const STAGE_LABELS: Record<string, string> = {
  new: "جديد / مستهدف",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  offer_sent: "عرض مُرسل",
  booking_request: "طلب حجز",
  on_hold: "حجز مؤقت",
  pending_contract: "بانتظار العقد والدفع",
  won: "مستأجر",
  postponed: "مؤجل",
  waitlist: "قائمة انتظار",
};

export const OPEN_STAGES = [
  "new",
  "contacted",
  "qualified",
  "offer_sent",
  "booking_request",
  "on_hold",
  "pending_contract",
] as const;

export const PARKED_STAGES = ["postponed", "waitlist"] as const;

export const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "لا يرد",
  not_interested: "غير مهتم",
  not_suitable: "غير مناسب",
  chose_other: "اختار مكانًا آخر",
  duplicate: "مكرر",
};

export const SOURCE_LABELS: Record<string, string> = {
  platform: "المنصة",
  target_list: "قائمة مستهدفة",
  whatsapp: "واتساب",
  call: "مكالمة",
  referral: "ترشيح",
  campaign: "حملة",
  walk_in: "زيارة مباشرة",
  agent: "وسيط",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "مكالمة",
  whatsapp: "واتساب",
  visit: "زيارة",
  meeting: "اجتماع",
  note: "ملاحظة",
};

export const ACTIVITY_OUTCOME_LABELS: Record<string, string> = {
  answered: "رد",
  no_answer: "لم يرد",
  follow_up: "متابعة",
};

export const LIFECYCLE_LABELS: Record<string, string> = {
  active: "نشط",
  renewal_due: "تجديد مستحق",
  renewed: "مُجدد",
  ended: "منتهي",
  terminated: "مفسوخ",
};

export const NO_ANSWER_AUTO_CLOSE_ATTEMPTS = 10;

/**
 * Mirrors move_opportunity in the database:
 * - open stages move forward only (never backward)
 * - any open stage can park (postponed/waitlist)
 * - parked stages reopen to qualified only
 * - won is reachable only from pending_contract
 */
export function canMoveStage(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === "won") return false;
  const openFrom = (OPEN_STAGES as readonly string[]).indexOf(from);
  const openTo = (OPEN_STAGES as readonly string[]).indexOf(to);
  if ((PARKED_STAGES as readonly string[]).includes(from)) {
    return to === "qualified";
  }
  if (openFrom === -1) return false;
  if (to === "postponed" || to === "waitlist") return true;
  if (to === "won") return from === "pending_contract";
  if (openTo === -1) return false;
  return openTo > openFrom;
}

export function stageLabel(stage: string | null | undefined): string {
  return (stage && STAGE_LABELS[stage]) || "غير محددة";
}

export function isOverdue(nextActionAt: string | null | undefined, now = new Date()): boolean {
  if (!nextActionAt) return true;
  return new Date(nextActionAt).getTime() < now.getTime();
}
