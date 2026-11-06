import {describe,it,expect} from 'vitest';
import {collectOpportunityPages,opportunityColumns} from './opportunityExport';
describe('opportunity export',()=>{
 it('collects all 1207 matching rows over three server pages',async()=>{const all=Array.from({length:1207},(_,i)=>({id:String(i)}));const offsets:number[]=[];const rows=await collectOpportunityPages(async offset=>{offsets.push(offset);return {rows:all.slice(offset,offset+500),count:1207};});expect(rows).toHaveLength(1207);expect(offsets).toEqual([0,500,1000]);});
 it('rejects a changing count rather than generating incomplete exports',async()=>{await expect(collectOpportunityPages(async offset=>({rows:offset===0?Array.from({length:500},(_,i)=>({id:String(i)})):[],count:offset===0?501:500}))).rejects.toThrow();});
 it('excludes contact, identity and financial fields',()=>{const row={id:'opp-1',customer_name:'عميل',tenant_code:'T-1',stage:'on_hold',source:'platform',owner_name:'مسؤول',next_action:null,next_action_at:null,created_at:'2026-11-06',phone:'private',id_number:'private',paid_amount:123};const columns=opportunityColumns(row);expect(Object.values(columns)).not.toContain('private');expect(Object.values(columns)).not.toContain(123);expect(Object.keys(columns)).toHaveLength(10);});
});
