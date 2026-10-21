import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {test} from 'node:test';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';

const root=path.resolve('.'),cache=new Map(),copy=value=>JSON.parse(JSON.stringify(value));
function load(name,parent=root){
 const file=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)):path.join(parent,name));const full=file.endsWith('.json')?file:file+'.ts';
 if(cache.has(full))return cache.get(full);if(full.endsWith('.json'))return JSON.parse(readFileSync(full,'utf8'));
 const exports={};cache.set(full,exports);const source=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:value=>load(value,path.dirname(full)),URLSearchParams,Date,TextDecoder,TextEncoder,Uint8Array,DataView,crypto:webcrypto,btoa,atob});return exports;
}
const law=load('@/lib/lawoi-master'),runtime=load('@/lib/lawoi-runtime'),reports=load('@/lib/report-data'),cap=load('@/lib/capricci-master'),files=load('@/lib/sales-import-files');
const master=law.originalLawoiMaster,report=reports.reportsByBrand.lawoi,byName=summary=>Object.fromEntries(summary.categories.map(row=>[row.name,row.value]));

test('LAWOI reads all I106 rows and keeps a separate, complete restaurant master',()=>{
 assert.equal(law.lawoiReference.catalog.length,676);assert.equal(law.lawoiReference.mapping.length,676);assert.equal(new Set(law.lawoiReference.catalog.map(row=>row.itemCode.toLowerCase())).size,676);
 assert.equal(new Set(law.lawoiReference.catalog.map(row=>row.sourcePage)).size,18);assert.equal(master.items.length,677);assert.equal(master.groups.length,15);
 assert.equal(master.items.filter(item=>item.subgroup==='ยังไม่จัดหมวด').length,0);assert.equal(master.items.find(item=>item.itemCode==='SERVICECHARGE').subgroup,'Service Charge');
});

test('I106 contract contains only product and selling-price evidence, never unit cost',()=>{
 const keys=['itemCode','menu','description2','posCategory','sellingPrice','sellingTax','sellingPriceWithTax','sourcePage'].sort();
 for(const row of law.lawoiReference.catalog){assert.deepEqual(Object.keys(row).sort(),keys);assert.ok(row.itemCode&&row.menu);assert.ok(Math.abs(row.sellingPrice+row.sellingTax-row.sellingPriceWithTax)<.011);}
 assert.doesNotMatch(JSON.stringify(law.lawoiReference),/unit.?cost|ต้นทุนต่อหน่วย/i);
 const injected=copy(master);injected.items[0].unitCost=9999;injected.items[0].sellingPrice=1;injected.unitCost=9999;
 const safe=law.validateLawoiMaster(injected);assert.doesNotMatch(JSON.stringify(safe),/unitCost|sellingPrice/);
});

test('LAWOI output reconciles the workbook and five-report snapshot for 01/09/26',()=>{
 const summary=runtime.lawoiSummaryFor(master,report);
 assert.deepEqual(byName(summary),{'Food':30810,'Beverage - Non-Alcohol':1840,'Beverage - Alcohol':700,'Other':0});
 assert.equal(summary.sales,33350);assert.equal(summary.serviceCharge,3335);assert.equal(summary.unmapped.length,0);
 assert.equal(report.S117.guests,19);assert.equal(report.S117.bills,5);assert.equal(report.S117.totalPerPerson,2065.94);
 assert.throws(()=>runtime.lawoiSummaryFor(master,reports.reportsByBrand.kappo));
});

test('LAWOI edits reallocate but conserve sales; service charge remains excluded',()=>{
 const item=report.S104.rows.find(row=>row.ItemCode!=='SERVICECHARGE'),edited=copy(master);edited.items.find(row=>row.itemCode===item.ItemCode).subgroup='Other';
 const summary=runtime.lawoiSummaryFor(law.validateLawoiMaster(edited),report);assert.equal(summary.sales,33350);assert.ok(byName(summary).Other>0);
 const unmapped=copy(master);unmapped.items.find(row=>row.itemCode===item.ItemCode).subgroup='ยังไม่จัดหมวด';const purple=runtime.lawoiSummaryFor(unmapped,report);assert.equal(purple.sales,33350);assert.ok(byName(purple)['ยังไม่จัดหมวด']>0);
 const service=copy(master);service.items.find(row=>row.itemCode==='SERVICECHARGE').subgroup='Other';assert.throws(()=>law.validateLawoiMaster(service));
 const removed=copy(master);removed.items.pop();assert.throws(()=>law.validateLawoiMaster(removed));
});

test('Type/Sub Type/Category filters use LAWOI evidence and imported unknown codes stay unmapped',()=>{
 const rows=law.lawoiTableRows(master),subs=cap.masterSubTypeFilter(rows,'Beverage - Alcohol');assert.ok(subs.options.includes('Hard Liquor'));assert.ok(!subs.options.includes('Dessert'));
 const categories=cap.masterCategoryFilter(rows,'Beverage - Alcohol','Hard Liquor');assert.ok(categories.options.includes('HIGHBALL'));assert.ok(!categories.options.includes('DESSERT'));
 const next=copy(report);next.S104.rows.push({...next.S104.rows[0],ItemCode:'NEW-LAWOI',ItemDesc:'New LAWOI Item'});const merged=law.mergeLawoiItems(master,next);assert.equal(merged.items.at(-1).subgroup,'ยังไม่จัดหมวด');assert.equal(master.items.length,677);
 assert.equal(law.mergeLawoiItems(master,reports.reportsByBrand.kappo),master);
});

test('Backup v3 round-trips all three masters and old backups initialize LAWOI safely',async()=>{
 const edited=copy(master);edited.groups[0].category='Other';const text=files.backupText([],cap.originalCapricciMaster,undefined,edited),restored=await files.restoreBackup(text);
 assert.equal(JSON.parse(text).version,3);assert.deepEqual(copy(restored.lawoiMaster),edited);assert.doesNotMatch(text,/unitCost|sellingPrice|description2|LAWOI-I106/);
 const old=JSON.parse(text);old.version=2;delete old.lawoiMaster;const legacy=await files.restoreBackup(JSON.stringify(old));assert.equal(legacy.lawoiMaster.items.length,677);assert.ok(legacy.warnings.some(w=>w.includes('Master LAWOI')));
 const invalid=JSON.parse(text);invalid.lawoiMaster.brandId='kappo';await assert.rejects(()=>files.restoreBackup(JSON.stringify(invalid)));
});
