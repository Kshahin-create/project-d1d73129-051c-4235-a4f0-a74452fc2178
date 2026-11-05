export const financeLabels: Record<string, string> = {draft:"مسودة",active:"فعال",ended:"منتهٍ",terminated:"منهي",cancelled:"ملغي",recorded:"مسجل",verified:"متحقق",reversed:"معكوس",due:"مستحق",partially_paid:"مسدد جزئيًا",paid:"مسدد",overdue:"متأخر",waived:"معفى",review:"تحتاج مراجعة",distinct:"دفعة مستقلة",duplicate:"مكرر"};
export const money = (value: unknown) => value == null ? "غير موثق" : Number(value).toLocaleString("ar-SA", {minimumFractionDigits:2, maximumFractionDigits:2});
export function installmentPreview(rent: number, vatRate: number, count: number) {
  if (!Number.isFinite(rent) || !Number.isFinite(vatRate) || rent <= 0 || vatRate < 0 || vatRate > 100 || !Number.isInteger(count) || count < 1 || count > 120) throw new Error("بيانات خطة غير صالحة");
  const cents = Math.round(rent * 100), tax = Math.round(cents * vatRate / 100);
  let assigned = 0, taxAssigned = 0;
  return Array.from({length: count}, (_, index) => {
    const excl = index === count-1 ? cents-assigned : Math.round(cents/count);
    const vat = index === count-1 ? tax-taxAssigned : Math.round(tax/count);
    assigned += excl; taxAssigned += vat;
    return {amount_excl_vat:excl/100,vat_amount:vat/100,amount_incl_vat:(excl+vat)/100};
  });
}