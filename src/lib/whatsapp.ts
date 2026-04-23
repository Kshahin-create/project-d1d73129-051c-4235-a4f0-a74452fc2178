import { WHATSAPP_NUMBER } from "./config";
import type { Unit } from "@/data/types";

export interface CustomerData {
  fullName: string;
  phone: string;
  email?: string;
  business: string;
  notes?: string;
}

/**
 * يولّد رابط واتساب يحتوي على رسالة طلب الحجز منسّقة بالعربية
 * Generates a WhatsApp link with a formatted Arabic booking request message.
 */
export function buildWhatsAppLink(unit: Unit, customer: CustomerData): string {
  const date = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines = [
    "🏢 *طلب حجز جديد - المدينة الصناعية بشمال مكة*",
    "",
    `📍 *المبنى:* رقم ${unit.buildingNumber} - ${unit.buildingType}`,
    `🔢 *رقم الوحدة:* ${unit.unitNumber}${unit.unitType ? ` (${unit.unitType})` : ""}`,
    `📐 *المساحة:* ${unit.area} م²`,
    `💰 *السعر السنوي:* ${unit.price.toLocaleString("en-US")} ريال`,
    "",
    "👤 *بيانات العميل:*",
    `• الاسم: ${customer.fullName}`,
    `• الجوال: ${customer.phone}`,
    customer.email ? `• البريد: ${customer.email}` : null,
    `• النشاط: ${customer.business}`,
    customer.notes ? `• ملاحظات: ${customer.notes}` : null,
    "",
    `📅 *تاريخ الطلب:* ${date}`,
    "",
    "_تم الإرسال عبر استمارة الحجز الإلكترونية - نخبة تسكين العقارية_",
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}
