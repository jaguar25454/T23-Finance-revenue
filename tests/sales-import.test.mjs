import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const root=path.resolve('.'),cache=new Map();
function load(name,parent=root){
 const file=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)):path.join(parent,name));const full=file.endsWith('.json')?file:file+'.ts';
 if(cache.has(full))return cache.get(full);
 if(full.endsWith('.json'))return JSON.parse(readFileSync(full,'utf8'));
 const exports={};cache.set(full,exports);
 const source=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>load(n,path.dirname(full)),URLSearchParams,Date});return exports;
}
const api=load('@/lib/sales-import'),r=load('@/lib/report-data'),m=load('@/lib/capricci-master'),runtime=load('@/lib/runtime-reports');
const d={brand:'capricci',branch:'00001',date:'2026-09-01'};
const copy=x=>JSON.parse(JSON.stringify(x));
const table=report=>[report.headers,...report.rows.map(row=>report.headers.map(h=>row[h]))];
const files=report=>r.reportTemplates.map(({code})=>({code,payload:copy(report[code]),raw:{name:report.sources[code].fileName,sha256:report.sources[code].sha256,base64:''}}));

test('Sales Daily card range totals stay aligned with categories/discount without changing reports or endpoint guests',()=>{
 const original=JSON.stringify(r.reportsByBrand);
 for(const brand of ['capricci','kappo','lawoi']) {
   const base=r.reportsByBrand[brand],next={...base,businessDate:'2026-09-02'};
   const batches=[{destination:{brand,date:'2026-09-02'},report:next}],dataset=runtime.reportDataset(batches);
   const options={reports:dataset,financeFor:report=>runtime.financeSummaryFor(m.originalCapricciMaster,report,batches)};
   const select=period=>r.dashboardForPeriod(brand,period,undefined,options);
   const one=select(r.makePeriod('2026-09-01','day'));
   for(const end of ['2026-09-02','2026-09-03']) {
     const range=select({start:'2026-09-01',end,mode:'custom'});
     assert.equal(range.data.monthlySales,one.data.monthlySales*2);
     assert.equal(range.data.monthlyDiscount,one.data.monthlyDiscount*2);
     assert.equal(Math.round(range.data.monthlyCategories.reduce((n,c)=>n+c.value,0)*100),Math.round(range.data.monthlySales*100));
     assert.equal(range.daysWithData,2);
     if(end==='2026-09-03')assert.equal(range.data.guest,null);
   }
   assert.equal(select(r.makePeriod('2026-09-02','day')).data.monthlySales,one.data.monthlySales);
   const empty=select(r.makePeriod('2026-09-03','day'));assert.equal(empty.data.monthlySales,null);assert.equal(empty.data.monthlyDiscount,null);assert.equal(empty.data.monthlyCategories,null);
   const previous={...base,businessDate:'2026-08-31'};
   const cross=r.dashboardForPeriod(brand,{start:'2026-08-31',end:'2026-09-01',mode:'custom'},undefined,{...options,reports:[...dataset,previous]});
   assert.equal(cross.data.monthlySales,one.data.monthlySales*2);
   const replaced=runtime.reportDataset([...batches,{destination:{brand,date:'2026-09-02'},report:next}]);
   assert.equal(replaced.filter(report=>report.brandId===brand).length,2);
 }
 assert.equal(JSON.stringify(r.reportsByBrand),original);
});
test('CSV quoted commas/newlines and BOM round trip; unterminated quotes fail',()=>{
 assert.equal(JSON.stringify(api.csvCells('\uFEFFa,b\r\n"x,y","a""b\nc"\r\n')),JSON.stringify([['a','b'],['x,y','a"b\nc']]));
 assert.throws(()=>api.csvCells('a,b\n"broken'),/เครื่องหมาย/);
});
test('Content identifies S102/S104 independently of filename',()=>{for(const code of ['S102','S104']){const actual=api.parseSalesTable(table(r.capricciReports[code]),d,[]);assert.equal(actual.code,code);assert.equal(actual.payload.rows.length,r.capricciReports[code].rows.length);}});
test('Wrong business date, malformed columns, duplicate headers and invalid money fail',()=>{
 const cells=table(r.capricciReports.S104);
 assert.throws(()=>api.parseSalesTable(cells,{...d,date:'2026-09-02'},[]),/SaleDate/);
 const short=copy(cells);short[0][0]='ItemCode';assert.throws(()=>api.parseSalesTable(short,d,[]),/ซ้ำ/);
 const money=copy(cells);money[1][money[0].indexOf('ExtendedPrice')]='NaN';assert.throws(()=>api.parseSalesTable(money,d,[]),/ตัวเลข/);
 const bad=copy(cells);bad[1].push('unexpected');assert.throws(()=>api.parseSalesTable(bad,d,[]),/คอลัมน์/);
 assert.throws(()=>api.parseSalesTable([['Category','Main.','Sub.'],['Food','Food','Food']],d,[]),/หัวตาราง/);
});
test('BE dates normalize and invalid calendar dates fail',()=>{assert.equal(api.sourceDate('01 กันยายน 2569 06:00'),'2026-09-01');assert.equal(api.sourceDate('01 September 2026 12:00'),'2026-09-01');assert.throws(()=>api.sourceDate('31 February 2026'),/วันที่/);});
test('Unsupported, retired and misleading report names rejected, including mixed hints',()=>{
 assert.throws(()=>api.verifyFileName('S107-S117.pdf','S117'),/ยกเลิก/);
 assert.throws(()=>api.verifyFileName('A103-file.pdf','S117'),/เนื้อหา/);
 for(const name of ['S105-sales.csv','Capricci-S118-file.xls','A104-tax.pdf'])assert.throws(()=>api.verifyFileName(name),/ไม่รองรับ/);
 assert.throws(()=>api.verifyFileName('S102-S104.xlsx','S104'),/เนื้อหา/);
 api.verifyFileName('custom-name.pdf','S117');api.verifyFileName('KAPPO-S104-file.XLS','S104');
});
test('Complete bundle required; money conflicts block; rounding is a visible warning',()=>{
 const f=files(r.capricciReports),warnings=[];api.assembleReports(f,d,warnings);assert.ok(warnings.some(w=>w.includes('0.01')));
 assert.throws(()=>api.assembleReports(f.slice(0,4),d,[]),/อย่างละ 1/);
 const bad=copy(f);bad.find(x=>x.code==='S117').payload.totalSale+=50;assert.throws(()=>api.assembleReports(bad,d,[]),/ไม่ตรง/);
 assert.throws(()=>api.assembleReports([...f.slice(0,4),f[0]],d,[]),/อย่างละ 1/);
});
test('Imported Finance reconstruction matches original gross and four category totals',()=>{
 const report=api.assembleReports(files(r.capricciReports),d,[]);
 const batch={destination:d,report,files:[],importedAt:'2026-09-03T00:00:00Z'};
 const summary=runtime.financeSummaryFor(m.originalCapricciMaster,report,[batch]);
 assert.equal(summary.sales,95290);assert.equal(summary.excludedCustomerTotal,1815);
 assert.equal(JSON.stringify(summary.categories),JSON.stringify(r.capricciCategorySummary.categories));
});
test('New codes are deduplicated, never overwrite edits and remain visible as unmapped',()=>{
 const report=copy(r.capricciReports);report.S104.rows.push({...report.S104.rows[0],ItemCode:'NEW-1',ItemDesc:'New menu'});
 const master=copy(m.originalCapricciMaster);master.items[0].name='Edited menu';
 const result=api.mergeImportedItems(master,report);assert.equal(result.items[0].name,'Edited menu');assert.equal(result.items.at(-1).subgroup,'ยังไม่จัดหมวด');
 assert.equal(api.mergeImportedItems(result,report).items.length,result.items.length);
 const unmatched=copy(m.originalCapricciMaster);unmatched.items.find(i=>i.itemCode==='BAR-BO0027').subgroup='ยังไม่จัดหมวด';
 const summary=runtime.financeSummaryFor(unmatched,r.capricciReports,[]);assert.equal(summary.sales,95290);assert.equal(summary.categories.at(-1).name,'ยังไม่จัดหมวด');assert.equal(summary.categories.at(-1).value,4480);
});
test('Same restaurant/day replaces instead of doubling; separate brands remain isolated',()=>{
 const batch={destination:d,report:r.capricciReports,files:[],importedAt:''};
 const twice=api.upsertBatch(api.upsertBatch([],batch),batch);assert.equal(twice.length,1);assert.equal(runtime.reportDataset(twice).length,3);
 assert.throws(()=>api.upsertBatch(twice,{...batch,destination:{...d,branch:'99999'}}),/สาขา/);
});
test('Multi-day Dashboard aggregates once and daily uses only the endpoint',()=>{
 const day2=copy(r.reportsByBrand.kappo);day2.businessDate='2026-09-02';day2.dateLabel='02/09/26';
 const dataset=[r.reportsByBrand.kappo,day2];const context={reports:dataset,financeFor:()=>r.capricciCategorySummary};
 const view=r.dashboardForPeriod('kappo',{start:'2026-09-01',end:'2026-09-02',mode:'custom'},undefined,context);
 assert.equal(view.data.monthlySales,64200);assert.equal(view.data.dailySales,32100);assert.equal(view.daysWithData,2);
 assert.equal(view.data.dailyTrend.length,2);assert.equal(view.data.monthTrend.length,1);
 const absent=r.dashboardForPeriod('kappo',{start:'2026-09-01',end:'2026-09-03',mode:'custom'},undefined,context);
 assert.equal(absent.data.monthlySales,64200);assert.equal(absent.data.dailySales,null);assert.equal(absent.data.guest,null);
 assert.equal(r.dashboardForPeriod('lawoi',{start:'2026-09-01',end:'2026-09-02',mode:'custom'},undefined,context).data.monthlySales,null);
});
test('Master preview for empty periods is empty, not seeded day revenue',()=>{assert.equal(runtime.periodFinanceSummary(m.originalCapricciMaster,[],{start:'2026-09-02',end:'2026-09-02',mode:'day'}).sales,0);});
test('Import controls live only on Master Data and explicitly guard backup/dirty state',()=>{
 const ui=readFileSync('components/sales-import-panel.tsx','utf8'),page=readFileSync('app/page.tsx','utf8'),kappo=readFileSync('components/kappo-foodstory-workspace.tsx','utf8'),saryu=readFileSync('components/saryu-workspace.tsx','utf8'),maison=readFileSync('components/maison-workspace.tsx','utf8');
 assert.match(ui,/!confirmed\|\|!downloaded/);assert.match(ui,/if\(masterDirty\)/);assert.match(ui,/Save Backup/);assert.match(ui,/Open Backup/);
 assert.match(page,/function openImport\(\) \{\s*setPage\('master-data'\)/);assert.match(page,/<div hidden=\{foodstoryBrand \|\| page!==\s*'master-data'\}><SalesImportPanel/);assert.match(kappo,/<section hidden=\{page!==\s*'master-data'\} id=\{active\?'kappo-foodstory-import-files'/);assert.match(saryu,/<section hidden=\{page!==\s*'master-data'\} id=\{active\?'saryu-import-files'/);assert.match(maison,/<section hidden=\{page!==\s*'master-data'\} id=\{active\?'maison-import-files'/);assert.ok(page.indexOf('<KappoFoodstoryWorkspace active=') > page.indexOf('aria-label="Entertain"'));assert.ok(page.indexOf('<SaryuWorkspace active=') > page.indexOf('<KappoFoodstoryWorkspace active='));assert.ok(page.indexOf('<MaisonWorkspace active=') > page.indexOf('<SaryuWorkspace active='));
});
test('Import panel uses English menu labels and keeps Thai instructions',()=>{
 const ui=readFileSync('components/sales-import-panel.tsx','utf8');
 assert.match(ui,/> Import File · Easy Restaurant<\/CardTitle>/);
 assert.doesNotMatch(ui,/ระบุปลายทางแยกจากชื่อ Report/);
 for(const label of ['Restaurant','Branch Code','Business Date','Select Restaurant','Choose File','Verify Reports','Verifying…','Clear Queue','Review Notes','Save Backup','Restore Backup','Confirm Import','Cancel','Open Backup','Export Current Data','Import Blocked']) assert.ok(ui.includes(label),label);
 assert.doesNotMatch(ui,/disabled=\{[^}]*files.length!==5/,'wrong file counts must reach Verify for an explicit warning');
 assert.match(ui,/ทำงานในเครื่อง ไม่มีอัปโหลดส่วนกลาง/);
 assert.match(ui,/กำลังอ่านเนื้อหาและตรวจสอบยอด กรุณารอสักครู่/);
 assert.match(ui,/ฉันตรวจร้าน\/สาขา\/วันที่ ข้อควรตรวจ/);
 const tree=ts.createSourceFile('sales-import-panel.tsx',ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function check(node){
  if(ts.isJsxElement(node)&&['Button','TableHead','summary'].includes(node.openingElement.tagName.getText(tree))) {
   const text=node.children.filter(n=>ts.isJsxText(n)||ts.isJsxExpression(n)).map(n=>n.getText(tree)).join(' ');
   assert.doesNotMatch(text,/[\u0e00-\u0e7f]/,`Menu text must be English: ${text}`);
  }
  ts.forEachChild(node,check);
 }
 check(tree);
});

test('Monthly totals grow on new imported days, replace same-day imports, and reconstruct from restored batches',()=>{
 const selected=r.makePeriod('2026-09-15','day');
 const batch=(brand,date)=>({destination:{brand,branch:'00001',date},report:{...copy(r.reportsByBrand[brand]),businessDate:date,dateLabel:r.formatBusinessDate(date)},files:[],importedAt:''});
 const month=(brand,batches,master=m.originalCapricciMaster)=>r.dashboardForMonth(brand,selected,undefined,{reports:runtime.reportDataset(batches),financeFor:report=>runtime.financeSummaryFor(master,report,batches)});
 const seed=copy(r.reportsByBrand);
 for(const [brand,gross] of [['capricci',95290],['kappo',32100],['lawoi',33350]]) {
   assert.equal(month(brand,[]).data.monthlySales,gross);
   const next=batch(brand,'2026-09-02');const first=api.upsertBatch([],next);
   assert.equal(month(brand,first).data.monthlySales,gross*2);
   const replaced=api.upsertBatch(first,next);assert.equal(month(brand,replaced).data.monthlySales,gross*2);assert.equal(month(brand,replaced).daysWithData,2);
   const last=api.upsertBatch(replaced,batch(brand,'2026-09-03'));assert.equal(month(brand,last).data.monthlySales,gross*3);
   assert.equal(month(brand,copy(last)).data.monthlySales,gross*3,'restored verified batches');
   const nextMonth=api.upsertBatch(last,batch(brand,'2026-10-01'));assert.equal(month(brand,nextMonth).data.monthlySales,gross*3);
 }
 const replacement=batch('kappo','2026-09-01');replacement.report.S117.items.find(i=>i.label==='Food').value+=1000;
 assert.equal(month('kappo',[replacement]).data.monthlySales,33100,'corrected same-day amount replaces seed');
 assert.equal(month('lawoi',[replacement]).data.monthlySales,33350,'other brand unchanged');
 assert.equal(JSON.stringify(r.reportsByBrand),JSON.stringify(seed),'raw snapshots unchanged');
});

test('Monthly Capricci categories use the current Master across all imported days and conserve sales',()=>{
 const day2={destination:{brand:'capricci',branch:'00001',date:'2026-09-02'},report:{...copy(r.capricciReports),businessDate:'2026-09-02',dateLabel:'02/09/26'},files:[],importedAt:''};
 const master=copy(m.originalCapricciMaster);master.items.find(i=>i.itemCode==='BAR-BO0027').subgroup='ยังไม่จัดหมวด';
 const batches=[day2],view=r.dashboardForMonth('capricci',r.makePeriod('2026-09-15','day'),undefined,{reports:runtime.reportDataset(batches),financeFor:report=>runtime.financeSummaryFor(master,report,batches)});
 assert.equal(view.data.monthlySales,190580);
 assert.equal(view.data.monthlyCategories.find(c=>c.name==='ยังไม่จัดหมวด').value,8960);
 assert.equal(view.data.monthlyCategories.reduce((n,c)=>n+c.value,0),190580);
 const guide=runtime.periodFinanceSummary(master,batches,view.period);
 assert.equal(guide.sales,view.data.monthlySales,'guide and monthly card share the same monthly source');
});

test('Verified import batches update monthly S117 guest counts and restore them without duplicates',()=>{
 const day2={destination:{brand:'capricci',branch:'00001',date:'2026-09-02'},report:{...copy(r.capricciReports),businessDate:'2026-09-02',dateLabel:'02/09/26'},files:[],importedAt:''};
 const batches=api.upsertBatch(api.upsertBatch([],day2),day2);
 const result=r.guestCheckInForMonth('capricci',r.makePeriod('2026-09-15','day'),runtime.reportDataset(batches));
 assert.equal(result.guests,82);assert.equal(result.bills,24);assert.equal(result.daysWithData,2);
 const restored=r.guestCheckInForMonth('capricci',r.makePeriod('2026-09-15','day'),runtime.reportDataset(copy(batches)));
 assert.equal(restored.guests,82);assert.equal(restored.tables,null);assert.equal(restored.occupancy,null);
});
