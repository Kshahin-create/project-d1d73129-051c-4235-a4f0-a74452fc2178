import { supabase } from '@/integrations/supabase/client';
export type MetricScope = {phase?:string;building?:string;activity?:string;unit_type?:string;from?:string;to?:string;publish_state?:string};
export type MetricRow = Record<string,string|number|null>;
export type MetricSnapshot = {as_of:string;scope:MetricScope;audience:string;inventory?:{total:number;published:number;draft:number;unpublished:number;leased:number;published_reserved:number;available:number;occupied:number;leased_rate:number|null;occupancy_rate:number|null;groups:MetricRow[]};pipeline?:{stages:MetricRow[];holds_expiring_24h:number;booking_requests:number;converted_opportunities:number;conversion_rate:number|null};finance?:Record<string,number|string|null>;quality?:Record<string,number|boolean|null>;approvals?:Record<string,number>;maintenance?:number;options:{buildings:number[];phases:(number|null)[];activities:{id:string|null;name:string}[];unit_types:string[]}};
export async function readMetrics(scope:MetricScope,signal?:AbortSignal){let q=supabase.rpc('metrics_snapshot',{_scope:scope});if(signal)q=q.abortSignal(signal);const r=await q;if(r.error)throw r.error;return r.data as unknown as MetricSnapshot;}
export async function readMetricRows(metric:string,scope:MetricScope,offset=0,limit=25){const r=await supabase.rpc('metrics_drilldown',{_metric:metric,_scope:scope,_offset:offset,_limit:limit});if(r.error)throw r.error;return r.data as unknown as {rows:MetricRow[];count:number;as_of:string};}
export const metricDefinitions:Record<string,string>={published:'الوحدات المنشورة في النطاق، بدون الوحدات التجريبية. لقطة حالية.',leased:'المنشور المؤجر ÷ جميع المنشور. المقام صفر يعني غير قابل للحساب.',occupancy:'المنشور المؤجر والمحجوز مؤقتًا وبانتظار العقد ÷ جميع المنشور.',annual:'أجرة العقود الفعالة بدون الضريبة؛ العقود متعددة الوحدات حسب أجرة الوحدات المطابقة.',due:'الرصيد غير المسدد لأقساط الفترة التي مر تاريخ استحقاقها؛ بعد خصم التخصيص المتحقق واستبعاد المعفى.',overdue:'المستحق الذي تجاوز فترة السماح المحددة في إعدادات المشروع.',collected:'إيصالات معتمدة متحققة غير معكوسة حسب تاريخ السداد الفعلي في الفترة؛ الضريبة منفصلة.',collection_rate:'التخصيص المتحقق لأقساط الفترة ÷ إجمالي التزام نفس الأقساط؛ غير المخصص لا يدخل النسبة.',conversion:'فرص فريدة وصلت بانتظار العقد بحدث موثق خلال الفترة ÷ طلبات الحجز في الفترة؛ قد تتجاوز ١٠٠٪ لتحول طلبات أقدم.',holds:'حجوزات مؤقتة نشطة تنتهي من الآن إلى أقل من ٢٤ ساعة.',draft:'وحدات مسودة منفصلة عن المنشور؛ لا تدخل مقام نسب الإشغال.'};
export function metricScopeFromSearch(search:string):MetricScope{const params=new URLSearchParams(search);const result:MetricScope={};for(const key of ['phase','building','activity','unit_type','from','to'] as const){const value=params.get(key);if(value&&value!=='all')result[key]=value;}return result;}
// Legacy (pre-cutover) finance: separate, labelled read; never merged with metrics_finance totals.
export type LegacyFinance={as_of:string;period:{from:string;to:string};collections_count:number;collections_excl:number;collections_period_count:number;collections_period_excl:number;invoices_count:number;invoices_excl:number;invoices_paid_excl:number;invoices_remaining_excl:number;leased_without_contract:number;receipts_recorded:number|null;receipts_without_paid_at:number|null;legacy_sources_review:number|null};
export async function readLegacyFinance(scope:MetricScope){const r=await supabase.rpc('metrics_legacy_finance',{_scope:scope});if(r.error)throw r.error;return r.data as unknown as LegacyFinance;}
export type LegacyTile={label:string;value:number;money:boolean;definition:string};
// Amounts are confirmed WITHOUT VAT: shown as stored, never multiplied/divided by VAT and never summed across sources.
export function legacyFinanceTiles(l:LegacyFinance):LegacyTile[]{return [
 {label:'صافي التحصيلات القديمة بدون الضريبة',value:l.collections_excl,money:true,definition:`كل سجلات التحصيل القديمة غير المؤرشفة (${l.collections_count} سجل) بتاريخ تسجيل التحصيل؛ المبالغ كما سُجلت بدون الضريبة.`},
 {label:'تحصيلات الفترة بدون الضريبة',value:l.collections_period_excl,money:true,definition:`سجلات التحصيل القديمة المسجلة داخل الفترة المختارة (${l.collections_period_count} سجل).`},
 {label:'الفواتير القديمة بدون الضريبة',value:l.invoices_excl,money:true,definition:`إجمالي الفواتير القديمة غير المؤرشفة (${l.invoices_count} فاتورة).`},
 {label:'المدفوع من الفواتير بدون الضريبة',value:l.invoices_paid_excl,money:true,definition:'المبالغ المدفوعة المسجلة على الفواتير القديمة؛ قد تتداخل مع سجلات التحصيل فلا تُجمع معها.'},
 {label:'المتبقي من الفواتير بدون الضريبة',value:l.invoices_remaining_excl,money:true,definition:'الفرق بين مبلغ كل فاتورة قديمة والمدفوع عليها، بدون أرقام سالبة.'},
];}
export type SetupStep={label:string;count:number;to:string};
export function legacySetupSteps(l:LegacyFinance):SetupStep[]{return [
 {label:'وحدات مؤجرة بدون عقد فعّال',count:l.leased_without_contract,to:'/admin/contracts'},
 {label:'سندات مسجلة بانتظار التحقق',count:l.receipts_recorded??0,to:'/admin/receipts'},
 {label:'سندات بدون تاريخ دفع',count:l.receipts_without_paid_at??0,to:'/admin/receipts'},
 {label:'مصادر تاريخية قيد المراجعة',count:l.legacy_sources_review??0,to:'/admin/receipts'},
].filter(s=>s.count>0);}
