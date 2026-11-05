import { adminClient,adminLists,displayAdminValue,listQuery,type AdminRow } from "@/lib/adminData";
import { exportRowsToCSV,exportRowsToExcel } from "@/lib/exportData";
export async function exportAdminList(key:string,format:"csv"|"xlsx",search="",filters:Record<string,string>={},archived=false){
 const spec=adminLists[key];if(!spec)throw new Error("التقرير غير متاح");
 const start=await adminClient.rpc("request_admin_export",{_list:key,_format:format,_scope:{search,filters,archived,phase:"المرحلة الأولى"}});if(start.error)throw start.error;
 const id=String(start.data);
 try{const rows:AdminRow[]=[];for(let offset=0;;offset+=500){const r=await listQuery(spec,search,spec.order,false,archived,filters).range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data as unknown as AdminRow[]);if(r.data.length<500)break;}
 const data=rows.map(row=>Object.fromEntries(spec.columns.map(col=>[col.label,displayAdminValue(col,row[col.key])])));

 if(format==="csv")exportRowsToCSV(data,spec.title);else exportRowsToExcel(data,spec.title,"البيانات",[{النطاق:"المرحلة الأولى — حسب الفلاتر الحالية",التحديث:new Date().toISOString(),العدد:data.length,الضريبة:"موضحة في عنوان كل عمود مالي"}]);
 const finish=await adminClient.rpc("complete_admin_export",{_id:id,_status:"generated",_count:data.length});if(finish.error)throw finish.error;
 }catch(e){await adminClient.rpc("complete_admin_export",{_id:id,_status:"failed",_count:0});throw e;}
}