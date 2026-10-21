import reference from '@/app/data/kappo-master-reference.json';
import { calculateFinanceCategories, capricciFinance, reportsByBrand, type ReportSnapshot } from './report-data';
import { masterKey, type MasterItem, type MasterGroup, type MasterTableRow } from './capricci-master';

export const kappoReference = reference;
export const kappoOutputs = ['Food', 'Beverage - Non-Alcohol', 'Beverage - Alcohol', 'Other'];
export type KappoMaster = {version:1;brandId:'kappo';sourceSha256:string;items:MasterItem[];groups:MasterGroup[]};
const normalizeOutput = (s:string) => s.trim().replace(/\s+/g,' ');
const catalog = new Map(reference.catalog.map(row=>[masterKey(row.itemCode),row]));
const mappings = new Map<string,typeof reference.mapping[number]>();
for(const row of reference.mapping) if(!mappings.has(masterKey(row.itemCode))) mappings.set(masterKey(row.itemCode),row);
export function createKappoMaster():KappoMaster {
  const items = new Map<string,MasterItem>();
  for(const row of reference.mapping) {
    const key=masterKey(row.itemCode); if(items.has(key))continue;
    items.set(key,{itemCode:row.itemCode,name:catalog.get(key)?.menu||row.menu||row.itemCode,subgroup:row.subgroup||'ยังไม่จัดหมวด'});
  }
  for(const row of reference.catalog) if(!items.has(masterKey(row.itemCode))) items.set(masterKey(row.itemCode),{itemCode:row.itemCode,name:row.menu||row.itemCode,subgroup:'ยังไม่จัดหมวด'});
  for(const row of reportsByBrand.kappo!.S104.rows) if(!items.has(masterKey(row.ItemCode))) items.set(masterKey(row.ItemCode),{itemCode:row.ItemCode,name:row.ItemDesc||row.ItemCode,subgroup:masterKey(row.ItemCode)==='servicecharge'?'Service Charge':'ยังไม่จัดหมวด'});
  return {version:1,brandId:'kappo',sourceSha256:reference.workbook.sha256,items:[...items.values()],groups:reference.groups.map(g=>({subgroup:g.subgroup,category:normalizeOutput(g.category)}))};
}
export const originalKappoMaster=createKappoMaster();
// Whitelist the editable contract. No price, catalog blobs, or financial fields
// are accepted from a Master JSON; reference selling prices remain read-only.
export function validateKappoMaster(value:unknown):KappoMaster {
  if(!value||typeof value!=='object') throw new Error('รูปแบบ Master KAPPO ไม่ถูกต้อง');
  const v=value as Record<string,unknown>;
  if(v.version!==1||v.brandId!=='kappo'||v.sourceSha256!==reference.workbook.sha256||!Array.isArray(v.items)||!Array.isArray(v.groups)||v.items.length>10000) throw new Error('ต้องใช้ Master KAPPO และชุดต้นแบบเดียวกัน');
  const field=(row:unknown,k:string,max:number)=>{const s=(row as Record<string,unknown>)?.[k];if(typeof s!=='string'||!s.trim()||s.length>max)throw new Error(`ข้อมูล ${k} ไม่ถูกต้อง`);return s.trim().replace(/\s+/g,' ');};
  const allowed=new Set(reference.groups.map(g=>masterKey(g.subgroup))),seenGroups=new Set<string>(),seen=new Set<string>();
  const groups=v.groups.map(row=>{const subgroup=field(row,'subgroup',80),category=field(row,'category',80),key=masterKey(subgroup);if(!allowed.has(key)||seenGroups.has(key)||!kappoOutputs.includes(category))throw new Error('Sub Type / Output ไม่ถูกต้องหรือซ้ำ');seenGroups.add(key);return {subgroup,category};});
  if(seenGroups.size!==allowed.size)throw new Error('Sub Type ไม่ครบตามต้นแบบ KAPPO');
  const items=v.items.map(row=>{const itemCode=field(row,'itemCode',80),name=field(row,'name',300),subgroup=field(row,'subgroup',80),key=masterKey(itemCode);if(seen.has(key))throw new Error(`ItemCode ซ้ำ: ${itemCode}`);if(key==='servicecharge'?subgroup!=='Service Charge':subgroup!=='ยังไม่จัดหมวด'&&!allowed.has(masterKey(subgroup)))throw new Error(`Sub Type ของ ${itemCode} ไม่ถูกต้อง`);seen.add(key);return {itemCode,name,subgroup};});
  if(originalKappoMaster.items.some(i=>!seen.has(masterKey(i.itemCode))))throw new Error('ห้ามลบ ItemCode ต้นแบบ');
  return {version:1,brandId:'kappo',sourceSha256:reference.workbook.sha256,items,groups};
}
export function mergeKappoItems(master:KappoMaster,report:ReportSnapshot):KappoMaster {
  if(report.brandId!=='kappo')return master;
  const seen=new Set(master.items.map(i=>masterKey(i.itemCode))),items=[...master.items];
  for(const row of report.S104.rows)if(!seen.has(masterKey(row.ItemCode))){seen.add(masterKey(row.ItemCode));items.push({itemCode:row.ItemCode,name:row.ItemDesc||row.ItemCode,subgroup:masterKey(row.ItemCode)==='servicecharge'?'Service Charge':'ยังไม่จัดหมวด'});}
  return validateKappoMaster({...master,items});
}
export function kappoTableRows(master:KappoMaster): (MasterTableRow & {sellingPrice:number|null})[] {
  return master.items.map(item=>{
    const key=masterKey(item.itemCode),source=mappings.get(key),group=reference.groups.find(g=>masterKey(g.subgroup)===masterKey(item.subgroup));
    return {...item,type:group?normalizeOutput(group.type):'ไม่ระบุ',subType:group?.subgroup??'ไม่ระบุ',sourceCategory:source?.sourceCategory||'ไม่ระบุ',output:key==='servicecharge'?'Excluded':master.groups.find(g=>masterKey(g.subgroup)===masterKey(item.subgroup))?.category??'Unmapped',hasSales:false,hasConflict:reference.duplicateCodes.some(rows=>masterKey(rows[0].itemCode)===key&&new Set(rows.map(r=>r.subgroup)).size>1),sellingPrice:catalog.get(key)?.sellingPrice??null};
  });
}
export function kappoItemEvidence(itemCode:string){return {catalog:catalog.get(masterKey(itemCode)),mapping:reference.mapping.filter(r=>masterKey(r.itemCode)===masterKey(itemCode))};}
export function calculateKappoCategories(master:KappoMaster,finance:typeof capricciFinance){
  const summary=calculateFinanceCategories({...finance,categoryNames:kappoOutputs,mapping:master.items.map(i=>{const source=mappings.get(masterKey(i.itemCode));return {sourceRow:source?.sourceRow??0,...(source?.sourceCategory?{sourceCategory:source.sourceCategory,categorySourceCell:`D${source.sourceRow}`}:{sourceCategory:null,categorySourceCell:null}),itemCode:i.itemCode,menu:i.name,subgroup:i.subgroup};}),groups:master.groups.map((g,index)=>({...g,mainGroup:reference.groups[index]?.type??'',sourceRow:reference.groups[index]?.sourceRow??0}))});
  const value=summary.unmapped.reduce((n,r)=>n+r.value,0);
  return {...summary,categories:summary.unmapped.length?[...summary.categories,{name:'ยังไม่จัดหมวด',value}]:summary.categories,sales:summary.sales+value,extendedPrice:summary.extendedPrice+summary.unmapped.reduce((n,r)=>n+r.extendedPrice,0),adjustment:summary.adjustment+summary.unmapped.reduce((n,r)=>n+r.adjustment,0)};
}
