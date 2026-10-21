import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('User Guide excludes KAPPO while the four remaining brand tabs stay functional',()=>{
 const source=readFileSync('components/user-guide.tsx','utf8'),exports={};
 const brandData={kappo:{name:'KAPPO TAKASHI',logo:'kappo.jpg'},capricci:{name:'Capricci',logo:'capricci.png'},lawoi:{name:'LAWOI',logo:'lawoi.jpg'},saryu:{name:'SUSHI SARYU',logo:'saryu.jpg'},maison:{name:'Maison Dunand',logo:'maison.png'}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'};
  if(name==='@/lib/report-data')return{brandData,formatPeriod:()=> '01/09/26 – 30/09/26'};
  return new Proxy({},{get:(_,key)=>key});
 }});
 const changed=[],actions=[],summary={sales:190580};
 const tree=exports.UserGuide({brand:'capricci',onBrandChange:value=>changed.push(value),onDashboard:()=>actions.push('dashboard'),onImport:()=>actions.push('import'),monthlyPeriod:{start:'2026-09-01',end:'2026-09-30',mode:'month'},financeSummary:summary,masterChanged:true,imported:true});
 function find(root,type){const found=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;if(n.type===type)found.push(n);visit(n.props?.children);}visit(root);return found;}
 const tabs=find(tree,'Tabs')[0];assert.equal(tabs.props.value,'capricci');
 assert.deepEqual(find(tree,'TabsTrigger').map(n=>n.props.value),['capricci','lawoi','saryu','maison']);
 for(const key of ['lawoi','capricci','saryu','maison'])tabs.props.onValueChange(key);
 tabs.props.onValueChange('kappo');tabs.props.onValueChange('unknown');assert.deepEqual(changed,['lawoi','capricci','saryu','maison']);assert.equal(actions.length,0);
 const panels=find(tree,'TabsContent');assert.equal(panels.length,4);
 for(const panel of panels)assert.equal(find(panel,'CapricciCategoryDetail').length,panel.props.value==='capricci'?1:0);
 const detail=find(tree,'CapricciCategoryDetail')[0];assert.equal(detail.props.summary,summary);assert.equal(detail.props.changed,true);assert.equal(detail.props.imported,true);
 const buttons=find(tree,'Button');buttons[0].props.onClick();buttons[1].props.onClick();assert.deepEqual(actions,['dashboard','import']);
});

test('Dashboard uses calendar-month sales/categories/discount and keeps the guide separate',()=>{
 const page=readFileSync('app/page.tsx','utf8'),tree=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.doesNotMatch(page,/CapricciCategoryDetail|Period · Selected range|Daily · วันสิ้นสุดช่วง/);
 assert.match(page,/'Sale \(Monthly\)' : 'Sales \(Daily\)'/);
 assert.match(page,/hidden=\{page !== 'dashboard'\}/);assert.match(page,/page === 'user-guide' && <UserGuide/);
 assert.match(page,/pageFragment\(page\)/);assert.match(page,/setPage\('user-guide'\)/);
 const cards=[];function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='SalesCard')cards.push(node);ts.forEachChild(node,visit);}visit(tree);
 assert.equal(cards.length,2);
 const monthly=cards.find(n=>n.getText(tree).includes('tone="monthly"')).getText(tree),daily=cards.find(n=>n.getText(tree).includes('tone="daily"')).getText(tree);
 for(const key of ['monthlySales','monthlyCategories','monthlyDiscount'])assert.ok(monthly.includes(`activeMonthly.data.${key}`));
 assert.match(monthly,/date=\{monthlyLabel\}/);
 for(const [prop,field] of [['value','monthlySales'],['discount','monthlyDiscount'],['categories','monthlyCategories']])assert.ok(daily.includes(`${prop}={data.${field}}`));
 assert.match(daily,/date=\{periodLabel\}/);assert.match(daily,/period=\{periodLabel\}/);
 assert.match(page,/setBatches\(next\)/);assert.match(page,/\[brandKey, period, monthlyFinanceSummary, dataset, masterConnection.record.master,kappoMaster,lawoiMaster, batches\]/);
 assert.match(page,/mappedBrands:\['kappo','lawoi'\]/);
});

test('Dashboard uses sidebar navigation and requested sales, charts, weekday, guests, entertain order',()=>{
 const page=readFileSync('app/page.tsx','utf8'),guide=readFileSync('components/user-guide.tsx','utf8');
 const tree=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const elements=[];function visit(n){if(ts.isJsxElement(n))elements.push(n);ts.forEachChild(n,visit);}visit(tree);
 const header=elements.find(n=>n.openingElement.tagName.getText(tree)==='header').getText(tree);
 assert.doesNotMatch(header,/setPage|Page navigation/);
 assert.match(header,/<HeaderDatePicker/);assert.match(header,/onClick=\{handleRefresh\}/);assert.match(header,/onClick=\{openImport\}/);
 const sidebar=elements.find(n=>n.openingElement.tagName.getText(tree)==='aside').getText(tree);
 for(const key of ['dashboard','sale','master-data','user-guide'])assert.ok(sidebar.includes(`setPage('${key}')`));
 assert.doesNotMatch(sidebar,/label: 'Guests'|label: 'Reports'/);
 assert.doesNotMatch(page,/<Alert|Entertain · แยกจากยอดขาย/);
 const entertain=elements.find(n=>n.openingElement.getText(tree).includes('aria-label="Entertain"'));
 const guests=elements.find(n=>n.openingElement.getText(tree).includes('aria-label="Guest indicators"'));
 const sales=page.indexOf('<SalesCard'),charts=page.indexOf('>Total Sale by Daily</CardTitle>'),weekday=page.indexOf('<CustomerTrafficAnalysis'),guestPosition=page.indexOf('aria-label="Guest indicators"'),entertainPosition=page.indexOf('aria-label="Entertain"');
 assert.ok(sales<charts&&charts<weekday&&weekday<guestPosition&&guestPosition<entertainPosition);assert.match(entertain.getText(tree),/>Entertain<\/CardTitle>/);
 assert.ok(guests.getText(tree).indexOf('<GuestMonthly')<guests.getText(tree).indexOf('Guest · Daily'));
 assert.match(guests.openingElement.getText(tree),/grid-cols-\[1.1fr_0.9fr\]/);
 assert.doesNotMatch(page,/Master Data ต้นแบบ · ยังไม่เชื่อมส่วนกลาง \(หลัง Final\)/);
 for(const prop of ['selectedPeriod={period}','monthlyDaysWithData={activeMonthly.daysWithData}','monthlySelectedDays={activeMonthly.selectedDays}','daysWithData={daysWithData}','selectedDays={selectedDays}'])assert.ok(page.includes(prop));
 assert.match(guide,/<AlertTitle>\{brandData\[brand\].name\} · Monthly/);
 assert.match(guide,/Unmapped · ที่มาของยอดยังไม่จัดหมวด/);assert.doesNotMatch(guide,/Sales \(Daily\).*ใช้รายงานเฉพาะวันสิ้นสุด/);
});

test('KAPPO removes User Guide and Sale navigation and redirects old fragments to Dashboard',()=>{
 const page=readFileSync('app/page.tsx','utf8'),workspace=readFileSync('components/kappo-foodstory-workspace.tsx','utf8'),guide=readFileSync('components/user-guide.tsx','utf8');
 assert.match(page,/filter\(\(\{label\}\)=>brandKey!==\s*'kappo'\|\|\(label!==\s*'User Guide'&&label!==\s*'Sale'\)\)/);
 assert.match(page,/saved\.brand===\s*'kappo'&&\(savedPage===\s*'sale'\|\|savedPage===\s*'user-guide'\)\?'dashboard'/);
 assert.match(page,/brandKey===\s*'kappo'&&\(page===\s*'sale'\|\|page===\s*'user-guide'\)\)setPage\('dashboard'\)/);
 assert.doesNotMatch(workspace,/KappoFoodstoryGuide|page==='sale'/);
 assert.doesNotMatch(guide,/value="kappo"|KappoFoodstoryGuide/);
});
