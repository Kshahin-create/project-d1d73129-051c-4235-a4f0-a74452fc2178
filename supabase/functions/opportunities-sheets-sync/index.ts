import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { HEADERS, sheetRow } from './format.ts';
const GATEWAY='https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return reply({error:'طريقة غير مسموحة'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!key)return reply({error:'إعدادات الخدمة غير مكتملة'},500);
 const authorization=req.headers.get('Authorization');if(!authorization)return reply({error:'يجب تسجيل الدخول'},401);
 const client=createClient(url,key,{global:{headers:{Authorization:authorization}}});
 const {data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)return reply({error:'يجب تسجيل الدخول'},401);
 const {data:isAdmin}=await client.rpc('has_role',{_user_id:auth.user.id,_role:'admin'});
 const {data:canRead}=await client.rpc('has_permission',{_capability:'opportunities.read',_level:'view'});
 if(!isAdmin||!canRead)return reply({error:'تحديث شيت الفرص للأدمن فقط'},403);
 const parsed=z.object({action:z.literal('push'),confirmed_count:z.number().int().nonnegative()}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'طلب غير صالح؛ المزامنة من المنصة للشيت فقط'},400);
 let runId:string|undefined;let count=0;
 try{
  const api=Deno.env.get('LOVABLE_API_KEY'),connection=Deno.env.get('GOOGLE_SHEETS_API_KEY');
  if(!api||!connection)throw new Error('اتصال Google Sheets غير مكتمل');
  const gw=async(path:string,method='GET',body?:unknown)=>{
   const res=await fetch(`${GATEWAY}${path}`,{method,headers:{Authorization:`Bearer ${api}`,'X-Connection-Api-Key':connection,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   const text=await res.text();if(!res.ok)throw new Error(`Google Sheets [${res.status}]: ${text}`);return text?JSON.parse(text):{};
  };
  // Capture the permitted read once across pages; refuse changed counts/duplicates rather than silently omit rows.
  const rows:Record<string,unknown>[]=[];let expected:number|undefined;
  for(let offset=0;;offset+=500){const {data,error}=await client.rpc('opportunity_export_page',{_board:false,_limit:500,_offset:offset});if(error)throw error;const page=data as {rows:Record<string,unknown>[];count:number};if(expected===undefined)expected=page.count;if(expected!==page.count)throw new Error('اتغير عدد الفرص أثناء القراءة؛ حاول التحديث مرة أخرى');rows.push(...page.rows);if(page.rows.length<500)break;}
  count=rows.length;if(count!==expected||new Set(rows.map(r=>r.id)).size!==count)throw new Error('اتغيرت الفرص أثناء القراءة؛ حاول مرة أخرى');
  if(count!==parsed.data.confirmed_count)return reply({error:'اتغير عدد الفرص؛ راجع العدد وكرر التأكيد'},409);
  const {data:run,error:startError}=await client.rpc('start_opportunity_sheet_sync');if(startError)throw startError;
  const started=run as {id:string;spreadsheet_id:string};runId=started.id;const sid=started.spreadsheet_id;
  const meta=await gw(`/${sid}?fields=sheets.properties`);
  let tab=meta.sheets?.find((s:{properties:{title:string}})=>s.properties.title==='الفرص')?.properties;
  if(!tab){const created=await gw(`/${sid}:batchUpdate`,'POST',{requests:[{addSheet:{properties:{title:'الفرص',rightToLeft:true,gridProperties:{rowCount:Math.max(1000,count+1),columnCount:10,frozenRowCount:1}}}}]});tab=created.replies[0].addSheet.properties;}
  const requests:unknown[]=[{updateSheetProperties:{properties:{sheetId:tab.sheetId,rightToLeft:true,gridProperties:{rowCount:Math.max(tab.gridProperties?.rowCount??1000,count+1),frozenRowCount:1}},fields:'rightToLeft,gridProperties.rowCount,gridProperties.frozenRowCount'}}];
  // One atomic grid batch clears stale values and writes new rows in the owned tab only.
  requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:10},rows:[HEADERS,...rows.map(sheetRow)].map(row=>({values:row.map(v=>({userEnteredValue:{stringValue:v}}))})),fields:'userEnteredValue'}});
  await gw(`/${sid}:batchUpdate`,'POST',{requests});
  const {error:finishError}=await client.rpc('finish_opportunity_sheet_sync',{_id:runId,_success:true,_count:count});if(finishError)throw finishError;
  return reply({count,url:`https://docs.google.com/spreadsheets/d/${sid}/edit#gid=${tab.sheetId}`});
 }catch(e){const message=e instanceof Error?e.message:String(e);if(runId)await client.rpc('finish_opportunity_sheet_sync',{_id:runId,_success:false,_count:count,_error:message});console.error('opportunity sheet sync failed',message);return reply({error:message},502);}
});
