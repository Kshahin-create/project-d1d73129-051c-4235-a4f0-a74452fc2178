export type DataQualityFinding = {
  check_code: string;
  entity_table: string;
  entity_id: string;
  label: string;
  detail: string;
};

export const CHECK_META: Record<string, { title: string; description: string }> = {
  leased_without_contract: {
    title: "وحدة مؤجرة بدون عقد نشط",
    description: "وحدة حالتها «مؤجرة» ولا يوجد لها عقد بحالة نشط.",
  },
  contract_without_installments: {
    title: "عقد نشط بدون أقساط",
    description: "عقد نشط لم تُولَّد له أقساط سداد.",
  },
  receipt_missing_proof_or_allocation: {
    title: "إيصال بدون إثبات أو تخصيص",
    description: "إيصال غير معكوس بدون ملف إثبات سداد أو بدون تخصيص على قسط.",
  },
  published_unit_incomplete: {
    title: "وحدة منشورة ناقصة البيانات",
    description: "وحدة منشورة بدون مبنى أو نشاط أو مساحة.",
  },
  party_on_available_unit: {
    title: "طرف على وحدة متاحة",
    description: "وحدة حالتها «متاحة» وعليها مستأجر مسجل أو عقد نشط.",
  },
  hold_expired: {
    title: "حجز منتهي والوحدة محجوزة",
    description: "حجز تجاوز تاريخ انتهائه والوحدة ما زالت بحالة «محجوزة».",
  },
  collections_receipts_mismatch: {
    title: "فرق إجمالي التحصيلات والإيصالات",
    description: "إجمالي التحصيلات القديمة لا يطابق إجمالي الإيصالات قبل الضريبة.",
  },
  duplicate_parties_unreviewed: {
    title: "تكرار محتمل لم تتم مراجعته",
    description: "طرفان مكرران محتملان بانتظار مراجعة بشرية؛ لا يوجد دمج تلقائي.",
  },
};

export const CHECK_CODES = Object.keys(CHECK_META);

export function findingHref(finding: Pick<DataQualityFinding, "entity_table" | "entity_id">): string | null {
  switch (finding.entity_table) {
    case "units":
      return `/admin/units/${finding.entity_id}`;
    case "contracts":
      return `/admin/contracts/${finding.entity_id}`;
    case "receipts":
      return `/admin/receipts/${finding.entity_id}`;
    case "duplicate_candidates":
      return "/admin/parties";
    case "finance":
      return "/admin/receipt-reconciliation";
    default:
      return null;
  }
}
