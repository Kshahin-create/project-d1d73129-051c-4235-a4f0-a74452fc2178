import { supabase } from '@/integrations/supabase/client';
import { exportRowsToCSV, exportRowsToExcel } from '@/lib/exportData';
import { stageLabel, SOURCE_LABELS } from '@/lib/crm';
export type OpportunityScope={search:string;stage:string;source:string;owner:string;board:boolean};
export type OpportunityExportRow={id:string;customer_name:string|null;tenant_code:string|null;stage:string;source:string;owner_name:string|null;next_action:string|null;next_action_at:string|null;created_at:string};
export async function collectOpportunityPages<T extends {id:string}>(fetchPage:(offset:number)=>Promise<{rows:T[];count:number}>):Promise<T[]>{
 const rows:T[]=[];let expected:number|undefined;
 for(let offset=0;;offset+=500){const p=await fetchPage(offset);if(expected===undefined)expected=p.count;if(p.count!==expected)throw new Error('اتغير عدد الفرص أثناء التصدير؛ حاول مرة أخرى');rows.push(...p.rows);if(p.rows.length<500)break;}
 if(rows.length!==expected||new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('اتغيرت الفرص أثناء التصدير؛ حاول مرة أخرى');return rows;
}
export function opportunityColumns(r:OpportunityExportRow){return {'معرّف الفرصة':r.id,'اسم العميل':r.customer_name??'غير موثق','كود العميل':r.tenant_code??'غير موثق','المرحلة':stageLabel(r.stage),'المصدر':SOURCE_LABELS[r.source]??r.source,'المسؤول':r.owner_name??'غير موزّعة','المتابعة القادمة':r.next_action??'','موعد المتابعة':r.next_action_at??'','تاريخ الإنشاء':r.created_at,'رابط الفرصة':`${window.location.origin}/admin/opportunities/${r.id}`};}
export async function exportOpportunities(scope:OpportunityScope,format:'xlsx'|'csv'='xlsx'){
 let request:string|undefined;
 try{
  const start=await supabase.rpc('request_admin_export',{_list:'opportunities',_format:format,_scope:scope});if(start.error)throw start.error;request=String(start.data);
  const rows=await collectOpportunityPages<OpportunityExportRow>(async offset=>{const r=await supabase.rpc('opportunity_export_page',{_search:scope.search,_stage:scope.stage,_source:scope.source,_owner:scope.owner,_board:scope.board,_limit:500,_offset:offset});if(r.error)throw r.error;return r.data as unknown as {rows:OpportunityExportRow[];count:number};});
  const values=rows.map(opportunityColumns);
  if(format==='xlsx')exportRowsToExcel(values,'لوحة الفرص','الفرص',[{البحث:scope.search,المرحلة:scope.stage||'كل المراحل',المصدر:scope.source||'كل المصادر',المسؤول:scope.owner||'الكل',النطاق:scope.board?'لوحة المراحل — الفرص المفتوحة':'قائمة الفرص',السجلات:rows.length,التحديث:new Date().toISOString()}]);else exportRowsToCSV(values,'لوحة الفرص');
  const end=await supabase.rpc('complete_admin_export',{_id:request,_status:'generated',_count:rows.length});if(end.error)throw end.error;return rows.length;
 }catch(e){if(request)await supabase.rpc('complete_admin_export',{_id:request,_status:'failed',_count:0});throw e;}
}
