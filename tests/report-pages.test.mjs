import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const data={};vm.runInNewContext(compile('lib/report-data.ts'),{exports:data,URLSearchParams,require:name=>JSON.parse(readFileSync(name.replace('@/',''),'utf8'))});
function find(root,type){const found=[];function visit(n){if(Array.isArray(n))return n.forEach(visit);if(!n||typeof n!=='object')return;if(n.type===type)found.push(n);visit(n.props?.children);}visit(root);return found;}

test('Sale and Master reconciliation select the right brand/day, update with imports and retain NO DATA',()=>{
 const output={};let selected='';
 vm.runInNewContext(compile('components/report-details-page.tsx'),{exports:output,require:name=>{
   if(name==='react')return{useState:()=>[selected,value=>{selected=value;}]};
   if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
   if(name==='@/lib/report-data')return data;
   return new Proxy({},{get:(_,key)=>key});
 }});
 const base=data.reportsByBrand.kappo,next={...base,businessDate:'2026-09-02'},dataset=[...Object.values(data.reportsByBrand).filter(Boolean),next];
 for(const view of ['sale','reconciliation']) {
   selected='';const props={view,brandKey:'kappo',period:{start:'2026-09-01',end:'2026-09-02',mode:'custom'},dataset};
   let tree=output.ReportDetailsPage(props),tag=view==='sale'?'SaleDetails':'Reconciliation';
   assert.equal(find(tree,tag)[0].props.reports,next);
   const selector=find(tree,'select')[0];assert.equal(find(selector,'option').length,2);
   assert.equal(find(selector,'option')[0].props.children,'01/09/26');
   selector.props.onChange({target:{value:'2026-09-01'}});tree=output.ReportDetailsPage(props);assert.equal(find(tree,tag)[0].props.reports,base);
   props.brandKey='lawoi';tree=output.ReportDetailsPage(props);assert.equal(find(tree,tag)[0].props.reports,data.reportsByBrand.lawoi);
   props.period=data.makePeriod('2027-01-01','day');tree=output.ReportDetailsPage(props);assert.equal(find(tree,tag).length,0);assert.match(JSON.stringify(tree),/NO DATA/);
   props.period=data.makePeriod('2026-09-01','day');props.brandKey='kappo';const replacement={...base};props.dataset=[replacement];tree=output.ReportDetailsPage(props);assert.equal(find(tree,tag)[0].props.reports,replacement);
 }
});

test('Moved S117 cards and reconciliation are not rendered by the Dashboard Report Center',()=>{
 const text=readFileSync('components/report-center.tsx','utf8');const tree=ts.createSourceFile('reports.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const functions=new Map(tree.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name?.text,n.getText(tree)]));
 const slip=functions.get('SlipDetail'),sale=functions.get('SaleDetails'),center=functions.get('ReportCenter');
 for(const label of ['Slip Operations · S117','ItemGroup Detail','Payment Detail']) {assert.ok(sale.includes(label));assert.ok(!slip.includes(label));}
 assert.doesNotMatch(center,/<Reconciliation|<SaleDetails/);
 assert.match(slip,/Sales Report Slip/);assert.match(functions.get('Reconciliation'),/ยอดที่เปรียบเทียบตรงกัน/);
 const home=readFileSync('app/page.tsx','utf8');
 assert.match(home,/page === 'sale' && !foodstoryBrand && <ReportDetailsPage/);assert.match(home,/page === 'master-data' && !foodstoryBrand && <ReportDetailsPage/);
 assert.match(home,/hidden=\{page !== 'master-data' \|\| brandKey !== 'capricci'\}/,'only Capricci shows its category editor');
 assert.doesNotMatch(home,/aria-label="Page navigation"/);assert.match(home,/label: 'Master Data', active: page === 'master-data'/);
 assert.match(home,/page === 'sale' && !foodstoryBrand && <ReportCenter/);
 assert.ok(home.indexOf('<ReportCenter key=')<home.indexOf('hidden={page !== \'dashboard\'}'));
 assert.equal((home.match(/<ReportCenter /g)||[]).length,1);
 assert.doesNotMatch(home,/label: 'Reports'/);
});
