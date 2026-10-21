import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Module} from 'node:module';
import {build} from 'esbuild';
import * as xls from '@e965/xlsx';
import 'pdfjs-dist/legacy/build/pdf.mjs';

// In-memory binary fixtures only; original workbooks/reports are never changed.
const bundle=await build({entryPoints:[path.resolve('lib/sales-import-files.ts')],bundle:true,platform:'browser',format:'cjs',target:'es2022',write:false,alias:{'@':process.cwd()},logLevel:'error'});
const mod=new Module(path.resolve('tests/compiled-xls-check.cjs'));mod.filename=path.resolve('tests/compiled-xls-check.cjs');mod.paths=Module._nodeModulePaths(process.cwd());mod._compile(bundle.outputFiles[0].text,mod.filename);
const api=mod.exports,base=JSON.parse(fs.readFileSync('app/data/capricci-20260901.json'));
const d={brand:'capricci',branch:'00001',date:'2026-09-01'};
const table=code=>[base[code].headers,...base[code].rows.map(row=>base[code].headers.map(h=>row[h]))];
const workbook=(tables,edit=()=>{})=>{const book=xls.utils.book_new();tables.forEach((rows,i)=>xls.utils.book_append_sheet(book,xls.utils.aoa_to_sheet(rows),`Report${i}`));edit(book);return book;};
const bytes=book=>new Uint8Array(xls.write(book,{type:'array',bookType:'biff8'}));

test('Real BIFF8 .xls reads complete S102/S104, Thai names and exact numbers',async()=>{
 for(const code of ['S102','S104']) {
  const buffer=bytes(workbook([table(code)])),original=buffer.slice();
  assert.deepEqual([...buffer.slice(0,8)],[208,207,17,224,161,177,26,225]);
  const parsed=await api.readReportBytes(`${code}-sales.XLS`,buffer,d);
  assert.equal(parsed.code,code);assert.equal(parsed.payload.rows.length,base[code].rows.length);
  for(const key of Object.keys(base[code].totals))assert.ok(Math.abs(parsed.payload.totals[key]-base[code].totals[key])<0.00001,key);
  assert.equal(parsed.payload.rows[0].ItemDesc,base[code].rows[0].ItemDesc);
  assert.equal(parsed.payload.rows[0].ItemCode,base[code].rows[0].ItemCode);
  assert.deepEqual(buffer,original);assert.equal(Buffer.from(parsed.raw.base64,'base64').length,buffer.length);
 }
});
test('XLS Excel serial business dates use both 1900 and 1904 systems without timezone shifts',async()=>{
 for(const date1904 of [false,true]) {
  const rows=table('S104'),column=rows[0].indexOf('SaleDate');
  rows.slice(1).forEach(row=>{row[column]=46266-(date1904?1462:0);});
  const book=workbook([rows],b=>{b.Workbook={WBProps:{date1904}};for(let row=1;row<rows.length;row++)b.Sheets.Report0[xls.utils.encode_cell({r:row,c:column})].z='dd/mm/yyyy';});
  const parsed=await api.readReportBytes('S104-date.xls',bytes(book),d);
  assert.equal(parsed.payload.rows[0].SaleDate,'2026-09-01');
  await assert.rejects(api.readReportBytes('S104-date.xls',bytes(book),{...d,date:'2026-09-02'}),/SaleDate ไม่ตรง/);
 }
});
test('Fake, unrelated, ambiguous and error-cell XLS files cannot pass verification',async()=>{
 await assert.rejects(api.readReportBytes('S104.xls',new TextEncoder().encode('ItemCode,ExtendedPriceTax'),d),/ไม่ใช่ Excel/);
 await assert.rejects(api.readReportBytes('S104.xls',bytes(workbook([[['Category','Main.','Sub.'],['Food','Food','Food']]])),d),/เพียงหนึ่งชุด/);
 await assert.rejects(api.readReportBytes('S104.xls',bytes(workbook([table('S104'),table('S104')])),d),/เพียงหนึ่งชุด/);
 await assert.rejects(api.readReportBytes('S105.xls',bytes(workbook([table('S104')])),d),/ไม่รองรับ/);
 await assert.rejects(api.readReportBytes('S102.xls',bytes(workbook([table('S104')])),d),/เนื้อหา/);
 const errorBook=workbook([table('S104')],b=>{const c=xls.utils.encode_cell({r:1,c:table('S104')[0].indexOf('Qty')});b.Sheets.Report0[c]={t:'e',v:7};});
 await assert.rejects(api.readReportBytes('S104.xls',bytes(errorBook),d),/Error/);
});
test('Verify reports explains unsupported files even when the selection count is wrong',async()=>{
 await assert.rejects(api.verifyBatch([new File(['x'],'S105.csv'),new File(['x'],'notes.txt')],d),error=>/รวม 5 ไฟล์/.test(error.message)&&/S105/.test(error.message)&&/notes.txt/.test(error.message)&&/ยังไม่อนุญาต Import/.test(error.message));
});

const reportFolder=process.env.REVENUE_TEST_REPORT_FOLDER;
test('XLS + real PDF bundle verifies, rejects duplicate reports, and round-trips Backup', {skip:!reportFolder}, async()=>{
 const files=['S102','S104'].map(code=>new File([bytes(workbook([table(code)]))],`${code}.xls`));
 for(const code of ['A103','S114','S117']) {const name=fs.readdirSync(reportFolder).find(n=>n.startsWith(`${code}-`)&&/\.pdf$/i.test(n));files.push(new File([fs.readFileSync(path.join(reportFolder,name))],name));}
 const verified=await api.verifyBatch(files,d);assert.equal(verified.batch.report.S117.totalSale,107807.42);
 const source=JSON.parse(fs.readFileSync('app/data/capricci-finance-20260901.json')),items=new Map();
 for(const r of source.mapping)if(!items.has(r.itemCode.trim().toLowerCase()))items.set(r.itemCode.trim().toLowerCase(),{itemCode:r.itemCode.trim(),name:(r.menu||r.itemCode).trim(),subgroup:(r.subgroup||'').trim()});
 const master={version:1,brandId:'capricci',sourceSha256:source.source.sha256,items:[...items.values()],groups:source.groups.map(r=>({subgroup:r.subgroup.trim(),category:r.category.trim().replace(/\s+/g,' ')}))};
 const restored=await api.restoreBackup(api.backupText([verified.batch],master));assert.deepEqual(restored.batches[0].report,verified.batch.report);
 assert.equal(restored.batches[0].files.filter(f=>/\.xls$/i.test(f.name)).length,2);
 const duplicate=[files[0],files[0],...files.slice(2)];await assert.rejects(api.verifyBatch(duplicate,d),/อย่างละ 1 ไฟล์/);
});
