import { useState } from "react";
import { Link, useParams, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { AdminServerList } from "@/components/admin/AdminServerList";
import { adminClient, adminLists, canReadFinance, displayAdminValue, type AdminRow, type ListSpec } from "@/lib/adminData";
import { recordHref, type RecordKind } from "@/lib/adminNavigation";
import { money } from "@/lib/finance";
import { statementTotals } from "@/lib/statement";
import type { StatementInstallment,StatementReceipt,StatementAllocation } from "@/lib/statement";
import { toast } from "sonner";

const tabs:Record<string,string[]>={units:["نظرة عامة","الحجوزات","العقد","الأقساط والسندات","المستندات","السجل"],parties:["البيانات","الوحدات","الفرص","الحجوزات","العقود","كشف الحساب","التواصل","المستندات","السجل"],contracts:["نظرة عامة","الوحدات","الأقساط والسندات","المستندات","السجل"],receipts:["نظرة عامة","التخصيصات","المستندات","السجل"],bookings:["نظرة عامة","الوحدات","العقود","السجل"]};
export default function AdminRecord(){
 const auth=useAuth(),{id}=useParams(),location=useLocation(),[params,setParams]=useSearchParams();const kind=location.pathname.split("/")[2] as RecordKind;const spec=adminLists[kind];const requested=params.get("tab");const tab=requested&&tabs[kind]?.includes(requested)?requested:tabs[kind]?.[0];
 const allowed=!!auth.user&&(auth.isAdmin||auth.isManager||auth.isControl||auth.isLeasingManager||auth.isSalesAgent||auth.isAccountant)&&(!spec?.finance||canReadFinance(auth));
 const q=useQuery({queryKey:["admin-record",kind,id,auth.user?.id],enabled:allowed&&!!id&&!!spec,queryFn:async()=>{if(!id)throw new Error("السجل غير متاح");const fields=[...new Set(["id",...spec.columns.map(c=>c.key),...(kind==="units"?["activity_id"]:kind==="parties"?["name_en","party_type","email","id_type","source","created_at"]:kind==="contracts"?["party_id","booking_id","documents","signed_at"]:kind==="receipts"?["party_id","contract_id","booking_id","reverses_id","proof_bucket","proof_file"]:kind==="bookings"?["party_id"]:[])])].join(",");const r=await adminClient.from(spec.table).select(fields).eq("id",id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw new Error("السجل غير موجود أو غير مسموح لك بعرضه");return r.data as unknown as AdminRow;}});
 if(auth.loading)return null;if(!allowed)return <Navigate to="/auth" replace/>;
 return <div dir="rtl" className="min-h-screen bg-background"><Header/><main className="mx-auto max-w-7xl space-y-6 px-4 py-6"><nav className="text-sm text-muted-foreground"><Link to={`/admin/${kind}`}>{spec?.title}</Link> / تفاصيل السجل</nav><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{q.data?`${kind==="units"?"الوحدة ":""}${String(q.data[spec.columns[0].key]??id)}`:"تفاصيل السجل"}</h1><p className="mt-2 text-xs text-muted-foreground">المرحلة الأولى · آخر تحديث: {q.dataUpdatedAt?new Date(q.dataUpdatedAt).toLocaleString("ar-SA"):"—"}</p></div>{q.data?.party_id&&<Button asChild variant="outline"><Link to={recordHref("parties",String(q.data.party_id))}>صفحة العميل</Link></Button>}</div>
 <nav className="flex gap-1 overflow-x-auto border-b border-border pb-2" aria-label="تبويبات السجل">{tabs[kind]?.map(t=><Button key={t} variant={t===tab?"default":"ghost"} className="shrink-0" onClick={()=>setParams({tab:t})}>{t}</Button>)}</nav>
 {q.isError?<p role="alert" className="text-destructive">{(q.error as Error).message}</p>:q.isPending?<p>جارٍ التحميل…</p>:q.data&&<RecordTab key={`${kind}-${id}-${tab}`} kind={kind} id={String(id)} row={q.data} tab={String(tab)} spec={spec}/>}
 </main></div>;
}

function RecordTab({kind,id,row,tab,spec}:{kind:RecordKind;id:string;row:AdminRow;tab:string;spec:ListSpec}){
 const auth=useAuth();const financial=canReadFinance(auth);const [page,setPage]=useState(0);
 const q=useQuery({queryKey:["admin-record-tab",kind,id,tab,page,auth.user?.id],enabled:["السجل","التواصل","التخصيصات","المستندات"].includes(tab)&&(!(tab==="التخصيصات")||financial),queryFn:async()=>{
   const read=async(table:string,filters:Record<string,string|boolean>,order="created_at")=>{let request=adminClient.from(table).select("*",{count:"exact"});for(const [key,value] of Object.entries(filters))request=request.eq(key,value);const r=await request.order(order,{ascending:false}).order("id").range(page*25,page*25+24);if(r.error)throw r.error;return{rows:r.data as AdminRow[],count:r.count??0,table};};
   if(tab==="السجل"){
     if(kind==="units"){const r=await adminClient.rpc("admin_unit_timeline",{_unit:id,_limit:25,_offset:page*25});if(r.error)throw r.error;return{...r.data as {rows:AdminRow[];count:number},table:"timeline"};}
     const audit=auth.isAdmin?await read("audit_log",{entity_table:kind==="parties"?"parties":spec.table,entity_id:id}):{rows:[],count:0,table:"audit_log"};
     return audit;
   }
   if(tab==="التواصل")return read("party_contacts",{party_id:id});
   if(tab==="التخصيصات")return read("receipt_allocations",{receipt_id:id});
   if(tab==="المستندات"){
     if(kind==="units")return read("unit_files",{unit_id:id});
     if(kind==="parties"){
       const contracts=financial?await read("contracts",{party_id:id}):{rows:[],count:0};
       const accounts=await adminClient.from("tenant_accounts").select("id").eq("party_id",id).is("archived_at",null);
       if(accounts.error)return{...contracts,table:"contracts"};
       const accountIds=(accounts.data??[]).map(a=>a.id);
       if(!accountIds.length)return{...contracts,table:"contracts"};
       const files=await adminClient.from("tenant_account_files").select("*",{count:"exact"}).in("tenant_account_id",accountIds).eq("is_archived",false).order("created_at",{ascending:false}).range(page*25,page*25+24);
       if(files.error)throw files.error;return{rows:[...contracts.rows,...files.data.map(f=>({...f,file_name:f.custom_name,file_bucket:"tenant-account-files"}))],count:contracts.count+(files.count??0),table:"documents"};
     }
     return{rows:[row],count:1,table:spec.table};
   }
   return{rows:[],count:0,table:""};
 }});
 if(tab==="نظرة عامة"||tab==="البيانات")return <><dl className="grid gap-x-8 gap-y-5 border-b border-border pb-6 sm:grid-cols-2 lg:grid-cols-3">{spec.columns.map(c=><div key={c.key}><dt className="text-xs text-muted-foreground">{c.label}</dt><dd className="mt-1 break-words font-medium">{displayAdminValue(c,row[c.key])}</dd></div>)}{["party_id","contract_id","booking_id","reverses_id"].filter(key=>row[key]).map(key=><div key={key}><dt className="text-xs text-muted-foreground">{{party_id:"العميل",contract_id:"العقد",booking_id:"الحجز",reverses_id:"الإيصال الأصلي"}[key]}</dt><dd><Link className="text-primary hover:underline" to={recordHref(key==="party_id"?"parties":key==="contract_id"?"contracts":key==="booking_id"?"bookings":"receipts",String(row[key]))}>فتح السجل المرتبط</Link></dd></div>)}</dl>{kind==="units"&&<UnitContext unit={row}/>}</>;
 if(tab==="الحجوزات")return kind==="units"?<LinkedUnitList id={id} target="bookings"/>:<AdminServerList spec={adminLists.bookings} filters={{party_id:id}}/>;
 if(tab==="العقد"||tab==="العقود")return financial?(kind==="units"?<LinkedUnitList id={id} target="contracts"/>:<AdminServerList spec={adminLists.contracts} filters={{[kind==="bookings"?"booking_id":"party_id"]:id}}/>):<Unavailable/>;
 if(tab==="الفرص")return <AdminServerList spec={adminLists.opportunities} filters={{party_id:id}}/>;
 if(tab==="الوحدات")return kind==="parties"?<PartyUnits id={id}/>:<LinkedUnits kind={kind} id={id}/>;
 if(tab==="الأقساط والسندات")return financial?(kind==="contracts"?<div className="space-y-8"><AdminServerList spec={adminLists.installments} filters={{contract_id:id}}/><AdminServerList spec={adminLists.receipts} filters={{contract_id:id}}/></div>:<LinkedUnitList id={id} target="installments"/>):<Unavailable/>;
 if(tab==="كشف الحساب")return financial?<PartyStatement id={id}/>:<Unavailable/>;
 if(q.isError)return <p role="alert" className="text-destructive">تعذر تحميل البيانات: {(q.error as Error).message}</p>;
 if(q.isPending)return <p>جارٍ التحميل…</p>;
 const openFile=async(bucket:string,path:string)=>{const r=await adminClient.storage.from(bucket).createSignedUrl(path,300);if(r.error)toast.error(r.error.message);else window.open(r.data.signedUrl,"_blank","noopener,noreferrer");};
 return <section className="space-y-3">{q.data?.rows.map(item=><div key={String(item.id)} className="space-y-2 border-b border-border py-3 text-sm">{tab==="السجل"?<><p className="font-semibold">{String(({UNIT_STATUS_TRANSITION:"تغيير حالة الوحدة",INSERT:"إضافة",UPDATE:"تعديل",CONTRACT_STATE:"حالة العقد",RECEIPT_REVERSED:"قيد عكسي",EXPORT_GENERATED:"تصدير ملف"} as Record<string,string>)[String(item.action)]??"إجراء مسجل")} {item.to_status&&displayAdminValue({key:"leasing_status",label:"الحالة"},item.to_status)}</p><p className="text-muted-foreground">{new Date(String(item.at??item.created_at)).toLocaleString("ar-SA")} · {String(({admin:"أدمن",manager:"مدير",accountant:"محاسب",leasing_manager:"مدير التأجير",system:"النظام"} as Record<string,string>)[String(item.actor_role)]??"—")}</p><p>{String(item.reason??(item.context as {reason?:string}|undefined)?.reason??"—")}</p></>:tab==="المستندات"?<>{item.storage_path&&<Button variant="outline" onClick={()=>void openFile(String(item.file_bucket??"unit-files"),String(item.storage_path))}>{String(item.file_name??"المستند")}</Button>}{Array.isArray(item.documents)&&item.documents.map((path,index)=><Button key={index} variant="outline" onClick={()=>void openFile("contract-documents",String(path))}>مستند العقد {index+1}</Button>)}{item.proof_file&&<Button variant="outline" onClick={()=>void openFile(String(item.proof_bucket),String(item.proof_file))}>إثبات السداد</Button>}</>:tab==="التواصل"?<p>{String(item.full_name)} · {String(item.phone??"غير متاح")} · {String(item.role_label??"")}</p>:<p>شامل الضريبة: {money(item.amount_incl_vat)} {item.installment_id&&<span> · قسط مرتبط</span>}</p>}</div>)}{!q.data?.rows.length&&<p className="py-6 text-muted-foreground">لا توجد سجلات متاحة في هذا القسم</p>}<div className="flex gap-2"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><Button variant="outline" disabled={(page+1)*25>=(q.data?.count??0)} onClick={()=>setPage(p=>p+1)}>التالي</Button></div></section>;
}
function Unavailable(){return <p className="py-6 text-muted-foreground">البيانات دي غير متاحة لصلاحية حسابك</p>;}
function UnitContext({unit}:{unit:AdminRow}){
 const q=useQuery({queryKey:["unit-context",unit.id],queryFn:async()=>{const [activity,links]=await Promise.all([unit.activity_id?adminClient.from("activities").select("name_ar").eq("id",unit.activity_id).maybeSingle():Promise.resolve({data:null,error:null}),adminClient.from("contract_units").select("contracts(id,party_id,status)").eq("unit_id",unit.id)]);return{activity:activity.data,links:links.data,error:links.error};}});
 const current=(q.data?.links??[]).map(link=>link.contracts as unknown as AdminRow).find(contract=>contract?.status==="active");
 return <div className="flex flex-wrap gap-5 text-sm"><span>النشاط: {String(q.data?.activity?.name_ar??unit.activity??"غير موثق")}</span>{current?.party_id&&<Link className="text-primary hover:underline" to={recordHref("parties",String(current.party_id))}>الطرف الحالي</Link>}</div>;
}
function LinkedUnitList({id,target}:{id:string;target:"bookings"|"contracts"|"installments"}){
 const q=useQuery({queryKey:["unit-record-links",id,target],queryFn:async()=>{const r=await adminClient.from(target==="bookings"?"booking_units":"contract_units").select(target==="bookings"?"booking_id":"contract_id").eq("unit_id",id);if(r.error)throw r.error;return r.data as AdminRow[];}});
 if(q.isError)return <p role="alert" className="text-destructive">تعذر تحميل الروابط</p>;
 return <div className="space-y-6">{q.data?.map((link,index)=><div key={index}><Link className="text-primary hover:underline" to={recordHref(target==="bookings"?"bookings":"contracts",String(link.booking_id??link.contract_id))}>فتح {target==="bookings"?"الحجز":"العقد"}</Link>{target==="installments"&&<div className="space-y-6"><AdminServerList spec={adminLists.installments} filters={{contract_id:String(link.contract_id)}}/><AdminServerList spec={adminLists.receipts} filters={{contract_id:String(link.contract_id)}}/></div>}</div>)}{!q.data?.length&&<p className="text-muted-foreground">لا سجلات مرتبطة متاحة</p>}</div>;
}
function PartyUnits({id}:{id:string}){
 const [page,setPage]=useState(0);const auth=useAuth();const q=useQuery({queryKey:["party-units",auth.user?.id,id,page],queryFn:async()=>{const r=await adminClient.rpc("admin_party_units_page",{_party:id,_limit:25,_offset:page*25});if(r.error)throw r.error;return r.data as {rows:AdminRow[];count:number};}});
 return <section className="space-y-4">{q.isError&&<p role="alert" className="text-destructive">تعذر تحميل الوحدات المرتبطة</p>}<div className="flex flex-wrap gap-3">{q.data?.rows.map(u=><Button asChild variant="outline" key={String(u.id)}><Link to={recordHref("units",String(u.id))}>وحدة {String(u.unit_number)} · مبنى {String(u.building_number)}</Link></Button>)}</div>{q.data?.count===0&&<p>لا وحدات مرتبطة متاحة</p>}<div className="flex gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><Button variant="outline" disabled={(page+1)*25>=(q.data?.count??0)} onClick={()=>setPage(p=>p+1)}>التالي</Button></div></section>;
}
function LinkedUnits({kind,id}:{kind:RecordKind;id:string}){
 const [page,setPage]=useState(0);const q=useQuery({queryKey:["record-unit-links",kind,id,page],queryFn:async()=>{let request=adminClient.from(kind==="contracts"?"contract_units":kind==="bookings"?"booking_units":"contracts").select(kind==="parties"?"id,contract_units(unit_id,units(id,unit_number,building_number))":"unit_id,units(id,unit_number,building_number)",{count:"exact"}).eq(kind==="contracts"?"contract_id":kind==="bookings"?"booking_id":"party_id",id);const r=await request.order("id").range(page*25,page*25+24);if(r.error)throw r.error;return{rows:r.data as AdminRow[],count:r.count??0};}});
 const units=q.data?.rows.flatMap(r=>kind==="parties"?(r.contract_units as AdminRow[]??[]).map(link=>link.units as AdminRow):[r.units as AdminRow])??[];
 return <section className="space-y-4">{q.isError&&<p role="alert" className="text-destructive">تعذر تحميل الوحدات</p>}<div className="flex flex-wrap gap-3">{units.filter(Boolean).map(unit=><Button key={String(unit.id)} asChild variant="outline"><Link to={recordHref("units",String(unit.id))}>وحدة {String(unit.unit_number)} · مبنى {String(unit.building_number)}</Link></Button>)}</div>{!units.length&&<p className="text-muted-foreground">لا وحدات مرتبطة متاحة</p>}<Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><Button variant="outline" disabled={(page+1)*25>=(q.data?.count??0)} onClick={()=>setPage(p=>p+1)}>التالي</Button></section>;
}
function PartyStatement({id}:{id:string}){
 const q=useQuery({queryKey:["party-statement",id],queryFn:async()=>{
   const all=async(table:string,key:string,value:string|string[])=>{const rows:AdminRow[]=[];for(let offset=0;;offset+=500){let request=adminClient.from(table).select("*").order("id");request=Array.isArray(value)?request.in(key,value):request.eq(key,value);const r=await request.range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data as AdminRow[]);if(r.data.length<500)break;}return rows;};
   const contracts=await all("contracts","party_id",id);
   const ids=contracts.map(c=>String(c.id));
   const receipts=await all("receipt_cash_read","party_id",id);
   const installments=ids.length?await all("installments_read","contract_id",ids):[];
   const allocations:AdminRow[]=[];
   for(let chunk=0;chunk<receipts.length;chunk+=100){const receiptIds=receipts.slice(chunk,chunk+100).map(r=>String(r.id));allocations.push(...await all("receipt_allocations","receipt_id",receiptIds));}
   return statementTotals(installments as unknown as StatementInstallment[],receipts as unknown as StatementReceipt[],allocations as unknown as StatementAllocation[]);
 }});
 return <div className="space-y-8">{q.isError?<p role="alert" className="text-destructive">تعذر حساب كشف الحساب</p>:<dl className="grid gap-5 border-b border-border pb-5 sm:grid-cols-4">{[["المستحق شامل الضريبة",q.data?.due],["المخصص المتحقق شامل الضريبة",q.data?.allocated],["الرصيد المتبقي شامل الضريبة",q.data?.balance],["متحقق غير مخصص شامل الضريبة",q.data?.unallocated]].map(([label,value])=><div key={String(label)}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-xl font-bold">{value==null?"—":money(value)} ريال</dd></div>)}</dl>}<p className="border-r-4 border-primary pr-3 text-sm">المصادر التاريخية قيد المراجعة ليست تحصيلًا معتمدًا.</p><AdminServerList spec={{...adminLists.receipts,table:"receipt_cash_read"}} filters={{party_id:id}}/><AdminServerList spec={adminLists.contracts} filters={{party_id:id}}/></div>;
}
