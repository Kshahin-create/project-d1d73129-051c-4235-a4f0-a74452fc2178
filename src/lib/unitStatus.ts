// Database remains authoritative; this module never infers financial eligibility.
export const UNIT_STATUS_LABELS = {
  available: "متاحة", on_hold: "محجوزة مؤقتًا", pending_contract: "بانتظار العقد",
  leased: "مؤجرة", maintenance: "صيانة", blocked: "موقوفة", review: "تحتاج مراجعة",
} as const;
export type LeasingStatus = Exclude<keyof typeof UNIT_STATUS_LABELS, "review">;
export const UNIT_TRANSITIONS: Record<LeasingStatus, readonly LeasingStatus[]> = {
  available: ["on_hold", "maintenance", "blocked"],
  on_hold: ["pending_contract", "available"],
  pending_contract: ["leased", "available"], leased: ["available"],
  maintenance: ["available"], blocked: ["available"],
};
export function validUnitTransition(from: string | null, to: LeasingStatus): boolean {
  return from !== null && Object.prototype.hasOwnProperty.call(UNIT_TRANSITIONS, from)
    && UNIT_TRANSITIONS[from as LeasingStatus].includes(to);
}
export function unitStatusLabel(status: string | null | undefined): string {
  return UNIT_STATUS_LABELS[status as keyof typeof UNIT_STATUS_LABELS] ?? UNIT_STATUS_LABELS.review;
}
// Legacy read compatibility only. Unknowns are deliberately not available.
export function legacyUnitStatus(status: string | null | undefined): "available" | "rented" | "reserved" | "maintenance" {
  if (status === "available") return "available";
  if (status === "leased") return "rented";
  if (status === "maintenance") return "maintenance";
  return "reserved";
}