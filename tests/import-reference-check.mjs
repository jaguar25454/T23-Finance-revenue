import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const bundle=await build({entryPoints:['lib/sales-import.ts'],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':process.cwd()}});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const base=process.argv[2];
if(!base) throw new Error('Pass the local report reference directory');
for(const [brand,folder,branch] of [['capricci','Capricci/Capricci Report 01_09_2026','00001'],['lawoi','LAWOI/Auto Report LAWOI 01_09_2569','Default'],['kappo','KAPPO/Auto Report 01_09_2569','00001']]) {
 const d={brand,branch,date:'2026-09-01'}, verified=[], warnings=[];
 const expected=JSON.parse(fs.readFileSync(`app/data/${brand}-20260901.json`));
 for(const code of ['A103','S102','S104','S114','S117']) {
  const name=fs.readdirSync(path.join(base,folder)).find(n=>n.startsWith(code+'-'));
  const bytes=fs.readFileSync(path.join(base,folder,name));
  try {
   let parsed;
   if(name.toLowerCase().endsWith('.csv')) parsed=api.parseSalesTable(api.csvCells(bytes.toString('utf8')),d,warnings);
   else {
    const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
    const doc=await task.promise,pages=[];
    for(let i=1;i<=doc.numPages;i++) {const p=await doc.getPage(i),c=await p.getTextContent();pages.push({width:p.view[2],height:p.view[3],words:c.items.filter(w=>w.str?.trim()).map(w=>({text:w.str,x:w.transform[4],y:w.transform[5],width:w.width}))});}
    parsed=api.parseSalesPdf(pages,d,warnings);await task.destroy();
   }
   assert.equal(parsed.code,code);
   if(code==='S117') for(const k of ['totalSale','grandTotal','guests','bills','paymentTotal']) assert.equal(parsed.payload[k],expected[code][k],k);
   else {assert.equal(parsed.payload.rows.length,expected[code].rows.length,'row count');for(const k of Object.keys(expected[code].totals)) assert.ok(Math.abs(parsed.payload.totals[k]-expected[code].totals[k])<0.00001,`${k}: ${parsed.payload.totals[k]} != ${expected[code].totals[k]}`);}
   if(code==='S114') parsed.payload.rows.forEach((r,i)=>{for(const k of ['itemCode','transaction','category'])assert.equal(r[k],expected[code].rows[i][k],`row ${i} ${k}`);});
   console.log('PASS',brand,code,parsed.payload.rows?.length??parsed.payload.totalSale);
   verified.push({code,payload:parsed.payload,raw:{name,sha256:'0'.repeat(64),base64:''},warnings:[]});
  } catch(e) {console.log('FAIL',brand,code,e.message); process.exitCode=1;}
 }
 if(verified.length===5) {try{ const r=api.assembleReports(verified,d,warnings);console.log('BUNDLE PASS',brand,warnings);if(brand==='capricci') {const finance=api.financeForImportedReport(r);const gross=finance.rows.filter(r=>r.customerName.trim()===finance.customerFilter&&r.itemCode.toLowerCase()!=='servicecharge').reduce((n,r)=>n+r.extendedPrice+r.adjustment,0);assert.equal(gross,95290);console.log('FINANCE gross excluding Entertain/service',gross);}}catch(e){console.log('BUNDLE FAIL',brand,e.message);process.exitCode=1;}}
}
