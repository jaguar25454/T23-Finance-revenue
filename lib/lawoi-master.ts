import reference from '@/app/data/lawoi-master-reference.json';
import { calculateFinanceCategories, capricciFinance, reportsByBrand, type ReportSnapshot } from './report-data';
import { masterKey, type MasterItem, type MasterGroup, type MasterTableRow } from './capricci-master';

export const lawoiReference = reference;
export const lawoiOutputs = ['Food', 'Beverage - Non-Alcohol', 'Beverage - Alcohol', 'Other'];
export type LawoiMaster = {version:1;brandId:'lawoi';sourceSha256:string;items:MasterItem[];groups:MasterGroup[]};
const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const catalog=new Map(reference.catalog.map(row=>[masterKey(row.itemCode),row]));
const mappings=new Map<string,typeof reference.mapping[number]>();
for(const row of reference.mapping)if(!mappings.has(masterKey(row.itemCode)))mappings.set(masterKey(row.itemCode),row);

export function createLawoiMaster():LawoiMaster {
  const items=new Map<string,MasterItem>();
  for(const row of reference.mapping){const key=masterKey(row.itemCode);if(!items.has(key))items.set(key,{itemCode:row.itemCode,name:catalog.get(key)?.menu||row.menu||row.itemCode,subgroup:row.subgroup||'ยังไม่จัดหมวด'});}
  for(const row of reference.catalog)if(!items.has(masterKey(row.itemCode)))items.set(masterKey(row.itemCode),{itemCode:row.itemCode,name:row.menu||row.itemCode,subgroup:'ยังไม่จัดหมวด'});
  for(const row of reportsByBrand.lawoi!.S104.rows)if(!items.has(masterKey(row.ItemCode)))items.set(masterKey(row.ItemCode),{itemCode:row.ItemCode,name:row.ItemDesc||row.ItemCode,subgroup:masterKey(row.ItemCode)==='servicecharge'?'Service Charge':'ยังไม่จัดหมวด'});
  return {version:1,brandId:'lawoi',sourceSha256:reference.workbook.sha256,items:[...items.values()],groups:reference.groups.map(group=>({subgroup:group.subgroup,category:clean(group.category)}))};
}
export const originalLawoiMaster=createLawoiMaster();

// Only editable classification fields are accepted. Catalog prices and source
// evidence stay read-only, and the I106 unit-cost column is never represented.
export function validateLawoiMaster(value:unknown):LawoiMaster {
  if(!value||typeof value!=='object')throw new Error('รูปแบบ Master LAWOI ไม่ถูกต้อง');
  const input=value as Record<string,unknown>;
  if(input.version!==1||input.brandId!=='lawoi'||input.sourceSha256!==reference.workbook.sha256||!Array.isArray(input.items)||!Array.isArray(input.groups)||input.items.length>10000)throw new Error('ต้องใช้ Master LAWOI และชุดต้นแบบเดียวกัน');
  const field=(row:unknown,key:string,max:number)=>{const v=(row as Record<string,unknown>)?.[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`ข้อมูล ${key} ไม่ถูกต้อง`);return clean(v);};
  const allowed=new Set(reference.groups.map(group=>masterKey(group.subgroup))),seenGroups=new Set<string>();
  const groups=input.groups.map(row=>{const subgroup=field(row,'subgroup',80),category=field(row,'category',80),key=masterKey(subgroup);if(!allowed.has(key)||seenGroups.has(key)||!lawoiOutputs.includes(category))throw new Error('Sub Type / Output ไม่ถูกต้องหรือซ้ำ');seenGroups.add(key);return {subgroup,category};});
  if(seenGroups.size!==allowed.size)throw new Error('Sub Type ไม่ครบตามต้นแบบ LAWOI');
  const seen=new Set<string>();
  const items=input.items.map(row=>{const itemCode=field(row,'itemCode',80),name=field(row,'name',300),subgroup=field(row,'subgroup',80),key=masterKey(itemCode);if(seen.has(key))throw new Error(`ItemCode ซ้ำ: ${itemCode}`);if(key==='servicecharge'?subgroup!=='Service Charge':subgroup!=='ยังไม่จัดหมวด'&&!allowed.has(masterKey(subgroup)))throw new Error(`Sub Type ของ ${itemCode} ไม่ถูกต้อง`);seen.add(key);return {itemCode,name,subgroup};});
  if(originalLawoiMaster.items.some(item=>!seen.has(masterKey(item.itemCode))))throw new Error('ห้ามลบ ItemCode ต้นแบบ LAWOI');
  return {version:1,brandId:'lawoi',sourceSha256:reference.workbook.sha256,items,groups};
}

export function mergeLawoiItems(master:LawoiMaster,report:ReportSnapshot):LawoiMaster {
  if(report.brandId!=='lawoi')return master;
  const seen=new Set(master.items.map(item=>masterKey(item.itemCode))),items=[...master.items];
  for(const row of report.S104.rows)if(!seen.has(masterKey(row.ItemCode))){seen.add(masterKey(row.ItemCode));items.push({itemCode:row.ItemCode,name:row.ItemDesc||row.ItemCode,subgroup:masterKey(row.ItemCode)==='servicecharge'?'Service Charge':'ยังไม่จัดหมวด'});}
  return validateLawoiMaster({...master,items});
}

export function lawoiTableRows(master:LawoiMaster):(MasterTableRow&{sellingPrice:number|null})[]{
  return master.items.map(item=>{const key=masterKey(item.itemCode),source=mappings.get(key),group=reference.groups.find(row=>masterKey(row.subgroup)===masterKey(item.subgroup));return {...item,type:group?.type??'ไม่ระบุ',subType:group?.subgroup??'ไม่ระบุ',sourceCategory:source?.sourceCategory||'ไม่ระบุ',output:key==='servicecharge'?'Excluded':master.groups.find(row=>masterKey(row.subgroup)===masterKey(item.subgroup))?.category??'Unmapped',hasSales:false,hasConflict:false,sellingPrice:catalog.get(key)?.sellingPrice??null};});
}

export function lawoiItemEvidence(itemCode:string){return {catalog:catalog.get(masterKey(itemCode)),mapping:reference.mapping.filter(row=>masterKey(row.itemCode)===masterKey(itemCode))};}

export function calculateLawoiCategories(master:LawoiMaster,finance:typeof capricciFinance){
  const summary=calculateFinanceCategories({...finance,categoryNames:lawoiOutputs,mapping:master.items.map(item=>{const source=mappings.get(masterKey(item.itemCode));return {sourceRow:source?.sourcePage??0,...(source?{sourceCategory:source.sourceCategory,categorySourceCell:`I106 p.${source.sourcePage}`}:{sourceCategory:null,categorySourceCell:null}),itemCode:item.itemCode,menu:item.name,subgroup:item.subgroup};}),groups:master.groups.map((group,index)=>({...group,mainGroup:reference.groups[index]?.type??'',sourceRow:index+1}))});
  const value=summary.unmapped.reduce((sum,row)=>sum+row.value,0),extraPrice=summary.unmapped.reduce((sum,row)=>sum+row.extendedPrice,0),extraAdjustment=summary.unmapped.reduce((sum,row)=>sum+row.adjustment,0);
  return {...summary,categories:summary.unmapped.length?[...summary.categories,{name:'ยังไม่จัดหมวด',value}]:summary.categories,sales:summary.sales+value,extendedPrice:summary.extendedPrice+extraPrice,adjustment:summary.adjustment+extraAdjustment};
}
