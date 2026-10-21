import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Module} from 'node:module';
import {build} from 'esbuild';
import 'pdfjs-dist/legacy/build/pdf.mjs';
import {zipSync,strToU8} from 'fflate';
const result=await build({entryPoints:['lib/sales-import-files.ts'],bundle:true,platform:'browser',format:'cjs',target:'es2022',write:false,alias:{'@':process.cwd()},logLevel:'error'});
const mod=new Module(path.resolve('tests/compiled-import-check.cjs'));mod.filename=path.resolve('tests/compiled-import-check.cjs');mod.paths=Module._nodeModulePaths(process.cwd());mod._compile(result.outputFiles[0].text,mod.filename);
const api=mod.exports;
const base=process.argv[2];if(!base)throw new Error('Pass source report directory');
const folder=path.join(base,'Capricci/Capricci Report 01_09_2026');
const files=fs.readdirSync(folder).filter(n=>/^(A103|S102|S104|S114|S117)-/.test(n)).map(n=>new File([fs.readFileSync(path.join(folder,n))],n));
const d={brand:'capricci',branch:'00001',date:'2026-09-01'};
const verified=await api.verifyBatch(files,d);
assert.equal(verified.batch.report.S117.totalSale,107807.42);
console.log('PASS browser-bundled decoder verifies actual PDF + CSV files');
const source=JSON.parse(fs.readFileSync('app/data/capricci-finance-20260901.json'));
const items=new Map();for(const r of source.mapping)if(!items.has(r.itemCode.trim().toLowerCase()))items.set(r.itemCode.trim().toLowerCase(),{itemCode:r.itemCode.trim(),name:(r.menu||r.itemCode).trim(),subgroup:(r.subgroup||'').trim()});
const master={version:1,brandId:'capricci',sourceSha256:source.source.sha256,items:[...items.values()],groups:source.groups.map(r=>({subgroup:r.subgroup.trim(),category:r.category.trim().replace(/\s+/g,' ')}))};
const text=api.backupText([verified.batch],master);
const restored=await api.restoreBackup(text);
assert.equal(restored.batches.length,1);assert.equal(restored.batches[0].report.S117.totalSale,107807.42);assert.equal(restored.master.items.length,775);
assert.deepEqual(restored.batches[0].report,verified.batch.report);
console.log('PASS Backup round trip reparses all originals and reproduces report data');
const tampered=JSON.parse(text);tampered.batches[0].files[0].sha256='f'.repeat(64);await assert.rejects(api.restoreBackup(JSON.stringify(tampered)),/checksum/);
console.log('PASS damaged checksum rejected without applying');
await assert.rejects(api.verifyBatch(files,{...d,brand:'kappo'}),/ไม่ตรง/);
await assert.rejects(api.verifyBatch(files,{...d,date:'2026-09-02'}),/ไม่ตรง/);
await assert.rejects(api.readReportBytes('S107-test.csv',new TextEncoder().encode('a,b'),d),/ยกเลิก/);
await assert.rejects(api.readReportBytes('A103-fake.pdf',new TextEncoder().encode('not a pdf'),d),/ไม่ใช่ PDF/);
await assert.rejects(api.readReportBytes('S104.xls',new Uint8Array([1]),d),/ไม่ใช่ Excel/);
console.log('PASS wrong brand/date, retired report, fake PDF and fake Excel rejected');
// In-memory parser fixture only, never saved as a spreadsheet deliverable.
const headers=['TranTypeName','CustomerName','SaleDate','SaleNum','ItemCode','ItemDesc','Qty','ExtendedPrice','Tax','ExtendedPriceTax'];
const fixture=[headers,['Sales','ลูกค้าทั่วไป เงินสด','01 September 2026 12:00','RC1','TEST-1','Test menu',1,100,7,107]];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const xml=`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${fixture.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
const zip=zipSync({
 '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
 '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
 'xl/workbook.xml':strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S104" sheetId="1" r:id="rId1"/></sheets></workbook>'),
 'xl/_rels/workbook.xml.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
 'xl/worksheets/sheet1.xml':strToU8(xml)
});
const excel=await api.readReportBytes('S104-test.xlsx',zip,d);
assert.equal(excel.code,'S104');assert.equal(excel.payload.rows[0].ExtendedPriceTax,107);
console.log('PASS Excel .xlsx byte decoder and typed table verification');
