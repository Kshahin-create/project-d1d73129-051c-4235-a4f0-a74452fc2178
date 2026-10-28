import { CONTACT, LOCATION, PROJECT, SOCIAL } from "./config";

export const SITE_URL = "https://ejar.mnicity.com";
export const PUBLIC_PAGES = [
  { path: "/", title: "تأجير الوحدات | المدينة الصناعية بشمال مكة", description: "تصفّح ورش صيانة السيارات وقطع الغيار والبناشر وورش النجارة والألمنيوم والحدادة في شمال مكة. اختر النشاط والمبنى واطّلع على الوحدات المتاحة للتأجير." },
  { path: "/how-to-book", title: "طريقة الحجز | المدينة الصناعية بشمال مكة", description: "تعرّف على خطوات حجز وحدة في المدينة الصناعية بشمال مكة: تسجيل الدخول، اختيار النشاط والمبنى والوحدة، ومراجعة التفاصيل وإرسال طلب الحجز." },
  { path: "/privacy", title: "سياسة الخصوصية | المدينة الصناعية بشمال مكة", description: "سياسة الخصوصية والأمان لمنصة تأجير وحدات المدينة الصناعية بشمال مكة، وكيفية التعامل مع بيانات العملاء وطلبات الحجز ووسائل التواصل." },
  { path: "/terms", title: "الشروط والأحكام | المدينة الصناعية بشمال مكة", description: "اطّلع على شروط استخدام منصة تأجير وحدات المدينة الصناعية بشمال مكة، وطبيعة طلبات الحجز والأسعار والمدفوعات وحقوق المستخدم والتواصل." },
] as const;

export function pageSeo(pathname: string): { title: string; description: string; indexable: boolean; canonical?: string } {
  const page = PUBLIC_PAGES.find((entry) => entry.path === pathname);
  return page ? { ...page, indexable: true, canonical: `${SITE_URL}${page.path}` } : { title: "منصة التأجير | المدينة الصناعية بشمال مكة", description: PUBLIC_PAGES[0].description, indexable: false };
}

export const SITE_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://mnicity.com/#organization", name: PROJECT.nameAr, alternateName: PROJECT.nameEn, url: "https://mnicity.com/", telephone: CONTACT.phone.replace(/\s/g, ""), sameAs: Object.values(SOCIAL), address: { "@type": "PostalAddress", streetAddress: LOCATION.addressAr, addressLocality: "الجموم", addressRegion: "مكة المكرمة", addressCountry: "SA" } },
    { "@type": "Organization", "@id": `${SITE_URL}/#operator`, name: PROJECT.operator, description: PROJECT.operatorRole, email: CONTACT.email, telephone: CONTACT.phone.replace(/\s/g, "") },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: `منصة تأجير وحدات ${PROJECT.nameAr}`, url: `${SITE_URL}/`, inLanguage: "ar-SA", about: { "@id": "https://mnicity.com/#organization" }, publisher: { "@id": `${SITE_URL}/#operator` } },
  ],
};