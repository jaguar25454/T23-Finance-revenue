import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {test} from 'node:test';
import {createHash,webcrypto} from 'node:crypto';
import ts from 'typescript';
const root=path.resolve('.'),cache=new Map(),copy=x=>JSON.parse(JSON.stringify(x));
function load(name,parent=root){
 const file=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)):path.join(parent,name));const full=file.endsWith('.json')?file:file+'.ts';
 if(cache.has(full))return cache.get(full);
 if(full.endsWith('.json'))return JSON.parse(readFileSync(full,'utf8'));
 const exports={};cache.set(full,exports);
 const source=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>load(n,path.dirname(full)),URLSearchParams,Date,TextDecoder,TextEncoder,Uint8Array,DataView,crypto:webcrypto,btoa,atob});return exports;
}
const k=load('@/lib/kappo-master'),r=load('@/lib/report-data'),cap=load('@/lib/capricci-master'),run=load('@/lib/kappo-runtime'),files=load('@/lib/sales-import-files'),imports=load('@/lib/sales-import');
const master=k.originalKappoMaster,base=r.reportsByBrand.kappo;
const byName=s=>Object.fromEntries(s.categories.map(c=>[c.name,c.value]));

test('All KAPPO references: 117 Category rows, 115 unique codes, 170 catalog rows over 8 pages, 207 master codes',()=>{
 assert.equal(k.kappoReference.mapping.length,117);assert.equal(new Set(k.kappoReference.mapping.map(i=>i.itemCode.toLowerCase())).size,115);
 assert.equal(k.kappoReference.catalog.length,170);assert.equal(new Set(k.kappoReference.catalog.map(i=>i.sourcePage)).size,8);
 assert.equal(master.items.length,207);assert.equal(master.groups.length,13);
 assert.equal(master.items.filter(i=>i.subgroup==='ยังไม่จัดหมวด').length,91);
 assert.equal(k.kappoReference.duplicateCodes.length,2);
 const g=master.items.find(i=>i.itemCode==='GFT-BOX001');assert.equal(g.subgroup,'Dessert');
 assert.equal(k.kappoTableRows(master).filter(i=>i.hasConflict).length,1);
 assert.equal(master.items.filter(i=>i.itemCode==='SAK-PRM004').length,1);
});
test('I106 is strictly whitelisted, selling prices preserve zero/missing and descriptions never contain totals',()=>{
 const keys=['itemCode','menu','description2','posCategory','sellingPrice','sellingTax','sellingPriceWithTax','sourcePage'].sort();
 for(const row of k.kappoReference.catalog){assert.deepEqual(Object.keys(row).sort(),keys);assert.ok(row.menu);assert.doesNotMatch(row.menu+row.description2,/Total of|Total  of/);assert.ok(Math.abs(row.sellingPrice+row.sellingTax-row.sellingPriceWithTax)<.011);}
 const rows=k.kappoTableRows(master),get=code=>rows.find(r=>r.itemCode===code);
 assert.equal(get('SAK-PRM005').sellingPrice,2200);assert.equal(get('SAK-PRM018').sellingPrice,2900);assert.equal(get('SOF-GRT001').sellingPrice,0);assert.equal(get('DIN-COU002').sellingPrice,null);
 assert.equal(k.kappoItemEvidence('WIN-WHI002').catalog.menu,'Soleil Koshu 2022');
 assert.equal(k.kappoItemEvidence('WIN-WHI003').catalog.menu,"Von Winning Deidesheimer 'Grainhubel' Riesling Trocken GG 2018 vintage");
 assert.equal(k.kappoItemEvidence('SAK-PRM018').catalog.menu,'Kakushika Junmai Daiginjo');
 const injected=copy(master);injected.unitCost=9876;injected.items[0].unitCost=9876;injected.items[0].sellingPrice=123;
 const valid=k.validateKappoMaster(injected);assert.ok(!JSON.stringify(valid).includes('unitCost'));assert.ok(!JSON.stringify(valid).includes('sellingPrice'));
 assert.throws(()=>imports.verifyFileName('KAPPO-I106.pdf'));
});
test('KAPPO output matches workbook 01/09/26 using report sales, not I106 prices or S117 category labels',()=>{
 const before=JSON.stringify(r.reportsByBrand),s=run.kappoSummaryFor(master,base);
 assert.deepEqual(byName(s),{'Food':27000,'Beverage - Non-Alcohol':0,'Beverage - Alcohol':5100,'Other':0});
 assert.equal(s.sales,32100);assert.equal(s.extendedPrice,30300);assert.equal(s.adjustment,1800);assert.equal(s.serviceCharge,3030);assert.equal(s.unmapped.length,0);
 assert.equal(s.detail.find(i=>i.itemCode==='DIN-COU002').value,27000);
 assert.equal(base.S117.items.find(i=>i.label==='Other').value,5100);
 assert.equal(base.A103.totals.net,35663.10);assert.equal(base.S117.guests,6);assert.equal(base.S117.bills,2);assert.equal(base.S117.totalPerPerson,5943.85);
 assert.equal(JSON.stringify(r.reportsByBrand),before);
 assert.throws(()=>run.kappoSummaryFor(master,r.reportsByBrand.capricci));
});
test('Item/group edits conserve gross, preserve excluded Service Charge and unknown items stay purple not Other',()=>{
 const edited=copy(master);edited.items.find(i=>i.itemCode==='SAK-PRM005').subgroup='DINNER COURSE';
 const s=run.kappoSummaryFor(k.validateKappoMaster(edited),base);assert.equal(s.sales,32100);assert.equal(byName(s).Food,29200);assert.equal(byName(s)['Beverage - Alcohol'],2900);
 const groups=copy(master);groups.groups.find(g=>g.subgroup==='Sake').category='Other';const t=run.kappoSummaryFor(k.validateKappoMaster(groups),base);assert.equal(t.sales,32100);assert.equal(byName(t).Other,5100);
 const unknown=copy(master);unknown.items.find(i=>i.itemCode==='SAK-PRM005').subgroup='ยังไม่จัดหมวด';const u=run.kappoSummaryFor(unknown,base);assert.equal(u.sales,32100);assert.equal(byName(u)['ยังไม่จัดหมวด'],2200);assert.equal(byName(u).Other,0);
 const sc=copy(master);sc.items.find(i=>i.itemCode==='SERVICECHARGE').subgroup='Other';assert.throws(()=>k.validateKappoMaster(sc));
 assert.throws(()=>k.validateKappoMaster(cap.originalCapricciMaster));assert.throws(()=>cap.validateCapricciMaster(master));
 const removed=copy(master);removed.items.pop();assert.throws(()=>k.validateKappoMaster(removed));
 const dup=copy(master);dup.items.push(dup.items[0]);assert.throws(()=>k.validateKappoMaster(dup));
 const bad=copy(master);bad.groups[0].category='Invented';assert.throws(()=>k.validateKappoMaster(bad));
});
test('Cascading KAPPO filters follow its own Type/Sub Type/Category evidence; unsold catalog entries do not invent sales',()=>{
 const rows=k.kappoTableRows(master),subs=cap.masterSubTypeFilter(rows,'Food');assert.ok(subs.options.includes('DINNER COURSE'));assert.ok(!subs.options.includes('Sake'));
 const cats=cap.masterCategoryFilter(rows,'Food','DINNER COURSE');assert.ok(cats.options.includes('PAIRING A'));assert.ok(!cats.options.includes('Sake'));
 assert.equal(cap.masterSubTypeFilter(rows,'Food','Sake').value,'ทั้งหมด');
 assert.equal(k.kappoTableRows(master).find(i=>i.itemCode==='DIN-SET001').output,'Unmapped');
 const before=run.kappoSummaryFor(master,base).sales,edited=copy(master);edited.items.find(i=>i.itemCode==='DIN-SET001').subgroup='DINNER COURSE';assert.equal(run.kappoSummaryFor(edited,base).sales,before);
});
test('Monthly/selected ranges update from new reports, same-day imports replace, brand/date isolation and NO DATA hold',()=>{
 const next=copy(base);next.businessDate='2026-09-02';const batch={destination:{brand:'kappo',branch:'00001',date:next.businessDate},report:next,files:[],importedAt:'2026-09-03T00:00:00Z'};
 const batches=imports.upsertBatch(imports.upsertBatch([],batch),batch);assert.equal(batches.length,1);
 const reports=[...Object.values(r.reportsByBrand).filter(Boolean),next],options={reports,mappedBrands:['kappo'],financeFor:report=>report.brandId==='kappo'?run.kappoSummaryFor(master,report):cap.calculateMasterCategories(cap.originalCapricciMaster)};
 const period={start:'2026-09-01',end:'2026-09-03',mode:'custom'},selected=r.dashboardForPeriod('kappo',period,undefined,options);
 assert.equal(selected.data.monthlySales,64200);assert.equal(selected.data.dailySales,null);assert.equal(selected.daysWithData,2);assert.equal(selected.data.monthlyCategories.find(i=>i.name==='Beverage - Alcohol').value,10200);
 assert.equal(r.dashboardForMonth('kappo',period,undefined,options).data.monthlySales,64200);
 assert.equal(r.dashboardForPeriod('kappo',r.makePeriod('2026-10-01','day'),undefined,options).data.monthlySales,null);
 assert.equal(r.dashboardForPeriod('lawoi',r.makePeriod('2026-09-01','day'),undefined,options).data.monthlySales,33350);
 assert.equal(run.kappoPeriodSummary(master,batches,period).sales,64200);
 const unknown=copy(base);unknown.S104.rows[0].ItemCode='NEW-KAPPO';const merged=k.mergeKappoItems(master,unknown);assert.equal(merged.items.at(-1).subgroup,'ยังไม่จัดหมวด');assert.equal(master.items.length,207);
 assert.equal(k.mergeKappoItems(master,r.reportsByBrand.lawoi),master);
});
test('Backup round-trips both masters; older backups safely initialize KAPPO; bad brand/source blocks restore',async()=>{
 const edited=copy(master);edited.groups[0].category='Other';const text=files.backupText([],cap.originalCapricciMaster,edited),restored=await files.restoreBackup(text);
 assert.deepEqual(copy(restored.kappoMaster),edited);assert.deepEqual(copy(restored.master),copy(cap.originalCapricciMaster));
 assert.doesNotMatch(text,/unitCost|sellingPrice|description2|KAPPO-I106/);
 const old=JSON.parse(text);old.version=1;delete old.kappoMaster;const legacy=await files.restoreBackup(JSON.stringify(old));assert.equal(legacy.kappoMaster.items.length,207);assert.ok(legacy.warnings.some(w=>w.includes('รุ่นเดิม')));
 const invalid=JSON.parse(text);invalid.kappoMaster.brandId='lawoi';await assert.rejects(()=>files.restoreBackup(JSON.stringify(invalid)));
});
test('The five supplied reports and all other brand seed data stay byte-for-byte unchanged',()=>{
 const hashes={'capricci-20260901.json':'124cec32c83f15538f5e6cc738673ed480050e6f46950137e267636cbab9eff8','capricci-finance-20260901.json':'07a763217ffc09b9d04ab6b5b042f68a9ab306c36a07a3dcb23002b7bb2e0ccd','kappo-20260901.json':'6e9b0b42375720ccd7db5094d9a072abfb49c2f30df89ebdaab59fc067c7ef0e','lawoi-20260901.json':'3f47f26fe0bc62f4aca484256c9eb9c82bfddd079e066c3b862d28f5fec0e64e'};
 for(const [file,sha] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync('app/data/'+file)).digest('hex'),sha);
 const expected={A103:'a2dea3fea7b3cbd23a2b623645a19a1278b3d0832c3c7a70b208dc7c3c10b650',S102:'90b1710a98b4da769cc80d89fc375b0bde757a7359ba3f431b93ab4155f06d96',S104:'fb37cbbb05af7a0cc411ea2894044d4d85cefc89f9e3d32ef2e2847d582b72f0',S114:'36672bc8bdd73e7c864eb8e7f5dd22369267a0a64092a5882f94526a204e8bef',S117:'c8bf565f057bdf303f26c659b17d03c98d1551129df7320c4e3f6af639a7a221'};
 for(const [code,sha] of Object.entries(expected))assert.equal(base.sources[code].sha256,sha);
});

function uiHarness(props){
 const slots=[];let index=0,dirty=false,effects=[],tree;
 const hooks={useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((d,j)=>!Object.is(d,slots[i][j]))){slots[i]=deps;effects.push(fn);}},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((d,j)=>!Object.is(d,slots[i].deps[j])))slots[i]={deps,value:fn()};return slots[i].value;}};
 const output={};const source=ts.transpileModule(readFileSync('components/kappo-master-data.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports:output,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name.startsWith('@/lib/')?load(name):new Proxy({},{get:(_,key)=>key})});
 function render(){let count=0;do{dirty=false;index=0;effects=[];tree=output.KappoMasterData(props);effects.forEach(fn=>fn());assert.ok(++count<10,'stable hook state');}while(dirty);}
 function all(predicate){const found=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;if(predicate(n))found.push(n);visit(n.props?.children);}visit(tree);return found;}
 render();return{render,all,one:p=>{const found=all(p);assert.equal(found.length,1);return found[0];},text:()=>JSON.stringify(tree)};
}
test('Master UI cascades filters, stages/applies edits, protects drafts, paginates and exposes safe Detail',()=>{
 let pending=false;const props={master,batches:[],period:r.makePeriod('2026-09-01','day'),onApply:m=>{props.master=m;},onDirty:value=>{pending=value;}};
 const h=uiHarness(props),button=text=>h.one(n=>n.type==='Button'&&n.props.children===text),select=label=>h.one(n=>n.type==='select'&&n.props['aria-label']==='KAPPO '+label);
 assert.deepEqual(h.all(n=>n.type==='TableHead').map(n=>n.props.children),['Type','Sub Type','Category','Menu','Selling Price','Output','Actions','Sub Type','ItemCodes','Sale by Category']);
 const change=(label,value)=>{select(label).props.onChange({target:{value}});h.render();};
 change('Type','Beverage - Alcohol');change('Sub Type','Sake');change('Category','Sake');
 change('Type','Food');assert.equal(select('Sub Type').props.value,'ทั้งหมด');assert.equal(select('Category').props.value,'ทั้งหมด');
 change('Type','ทั้งหมด');h.one(n=>n.type==='Input'&&n.props['aria-label']==='KAPPO Search').props.onChange({target:{value:'SAK-PRM005'}});h.render();
 button('Detail').props.onClick();h.render();assert.ok(h.text().includes('Nanbu Bijin'));assert.ok(!h.text().includes('unitCost'));
 button('Edit').props.onClick();h.render();assert.equal(pending,true);assert.equal(button('Apply to Dashboard').props.disabled,true);
 change('Edit Sub Type','DINNER COURSE');button('Save Draft').props.onClick();h.render();assert.equal(props.master,master);assert.equal(pending,true);
 button('Apply to Dashboard').props.onClick();h.render();assert.equal(pending,false);assert.equal(run.kappoSummaryFor(props.master,base).categories[0].value,29200);
 h.one(n=>n.type==='Input'&&n.props['aria-label']==='KAPPO Search').props.onChange({target:{value:''}});h.render();button('Next').props.onClick();h.render();assert.equal(button('Previous').props.disabled,false);
});
