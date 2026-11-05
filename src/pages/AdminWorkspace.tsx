import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { AdminServerList } from "@/components/admin/AdminServerList";
import { ManagementMap } from "@/components/dashboard/ManagementMap";
import { adminClient,adminLists,canReadFinance,listQuery,type AdminRow } from "@/lib/adminData";
import { recordHref } from "@/lib/adminNavigation";
import { legacyUnitStatus } from "@/lib/unitStatus";
import type { DashboardUnit } from "@/lib/dashboardMetrics";

export default function AdminWorkspace(){
 const auth=useAuth(),location=useLocation(),navigate=useNavigate();const key=location.pathname.split("/")[2];const spec=adminLists[key];const [mode,setMode]=useState("table"),[building,setBuilding]=useState(""),[status,setStatus]=useState(""),[search,setSearch]=useState("");
 const allowed=!!auth.user&&(auth.isAdmin||auth.isManager||auth.isControl||auth.isLeasingManager||auth.isSalesAgent||auth.isAccountant)&&(!spec?.finance||canReadFinance(auth));const filters={...(building?{building_number:building}:{}),...(status?{leasing_status:status}:{})};
 const buildings=useQuery({queryKey:["admin-building-options"],enabled:allowed&&key==="units",queryFn:async()=>{const r=await adminClient.from("buildings").select("number").order("number");if(r.error)throw r.error;return r.data;}});
 const map=useQuery({queryKey:["admin-units-map",filters,search],enabled:allowed&&key==="units"&&mode==="map",queryFn:async({signal})=>{const rows:AdminRow[]=[];for(let offset=0;;offset+=500){const r=await listQuery(spec,search,"unit_number",true,false,filters,signal).range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data as unknown as AdminRow[]);if(r.data.length<500)break;}return rows;}});
 if(auth.loading)return null;if(!allowed)return <Navigate to="/auth" replace/>;
 return <div dir="rtl" className="min-h-screen bg-background"><Header/><main className="mx-auto max-w-7xl space-y-6 px-4 py-6"><h1 className="text-2xl font-bold">{spec?.title}</h1>{key==="units"&&<div className="flex flex-wrap gap-3"><div className="flex"><Button variant={mode==="table"?"default":"outline"} onClick={()=>setMode("table")}>الجدول</Button><Button variant={mode==="map"?"default":"outline"} onClick={()=>setMode("map")}>الخريطة</Button></div><select aria-label="المبنى" className="rounded-md border border-input bg-background px-3" value={building} onChange={e=>setBuilding(e.target.value)}><option value="">كل المباني</option>{buildings.data?.map(b=><option key={b.number} value={b.number}>مبنى {b.number}</option>)}</select><select aria-label="حالة التأجير" className="rounded-md border border-input bg-background px-3" value={status} onChange={e=>setStatus(e.target.value)}><option value="">كل الحالات</option>{[["available","متاحة"],["on_hold","محجوزة مؤقتًا"],["pending_contract","بانتظار العقد"],["leased","مؤجرة"],["maintenance","صيانة"],["blocked","موقوفة"]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></div>}
 <div className={mode==="map"?"[&_table]:hidden":""}><AdminServerList spec={spec} filters={key==="units"?filters:{}} onSearch={setSearch}/></div>{mode==="map"&&(map.isError?<p role="alert" className="text-destructive">تعذر تحميل الخريطة</p>:map.isPending?<p>جارٍ تحميل المخطط…</p>:<ManagementMap building={building||"all"} onBuilding={v=>setBuilding(v==="all"?"":v)} units={(map.data??[]).map(r=>({...r,status:legacyUnitStatus(String(r.leasing_status)),area:r.area_m2,price:0,activity:"",tenant_name:null})) as unknown as DashboardUnit[]} onUnit={u=>navigate(recordHref("units",u.id))}/>)}
 </main></div>;
}