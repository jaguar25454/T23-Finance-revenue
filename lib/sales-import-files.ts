import { assembleReports, csvCells, parseSalesPdf, parseSalesTable, validateDestination, verifyFileName, type Destination, type ImportedBatch, type PdfPage, type RawImport, type VerifiedFile } from './sales-import';
import { validateCapricciMaster, type CapricciMaster } from './capricci-master';
import { isRetiredReport, reportsByBrand } from './report-data';
import { originalKappoMaster, validateKappoMaster, mergeKappoItems, type KappoMaster } from './kappo-master';
import { originalLawoiMaster, validateLawoiMaster, mergeLawoiItems, type LawoiMaster } from './lawoi-master';

export const MAX_REPORT_BYTES = 12_000_000;
export const MAX_BACKUP_BYTES = 80_000_000;
const baseline = Object.entries(reportsByBrand).map(([brand,report])=>({brand,sources:report?.sources}));
export async function readReportBytes(name:string, bytes:Uint8Array, destination:Destination):Promise<VerifiedFile> {
  validateDestination(destination);
  if (!bytes.length || bytes.length>MAX_REPORT_BYTES) throw new Error('รายงานต้องมีขนาดมากกว่า 0 และไม่เกิน 12 MB');
  if (isRetiredReport(name)) throw new Error('S107 ยกเลิกการใช้แล้ว');
  verifyFileName(name);
  const extension=name.split('.').at(-1)?.toLowerCase();
  const warnings:string[]=[];
  let parsed:ReturnType<typeof parseSalesTable> | ReturnType<typeof parseSalesPdf>;
  if (extension==='csv') {
    parsed=parseSalesTable(csvCells(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),destination,warnings);
  } else if (extension==='xlsx') {
    // Bound ZIP entries and expanded size before the workbook reader allocates.
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let expanded=0,entries=0;
    if (bytes.length<4 || view.getUint32(0,true)!==0x04034b50) throw new Error('ไฟล์ไม่ใช่ Excel .xlsx');
    for (let i=0;i<bytes.length-46;i++) if(view.getUint32(i,true)===0x02014b50) {
      entries++; expanded+=view.getUint32(i+24,true);
      if (entries>3000 || expanded>50_000_000) throw new Error('Excel ใหญ่เกินขอบเขตเมื่อแตกไฟล์ (50 MB / 3,000 ส่วน)');
      i+=45+view.getUint16(i+28,true)+view.getUint16(i+30,true)+view.getUint16(i+32,true);
    }
    if (!entries) throw new Error('โครงสร้าง Excel ZIP ไม่ครบ');
    const {default:readXlsx}=await import('read-excel-file/universal');
    const sheets=await readXlsx(bytes.slice().buffer);
    const candidates=sheets.filter(s=>s.data.slice(0,30).some(r=>r.includes('ItemCode')&&r.includes('ExtendedPriceTax')));
    if (candidates.length!==1) throw new Error('Excel ต้องมีตารางรายงาน S102 หรือ S104 เพียงหนึ่งชุด ไม่ใช่ไฟล์ Category/Master Data');
    parsed=parseSalesTable(candidates[0].data,destination,warnings);
  } else if(extension==='pdf') {
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Error('เนื้อหาไฟล์ไม่ใช่ PDF');
    // Bundle both modules: the in-process worker keeps standalone file:// HTML
    // independent of CDN, remote services, browser worker URLs and user data uploads.
    const [pdf,worker]=await Promise.all([import('pdfjs-dist/build/pdf.mjs'),import('pdfjs-dist/build/pdf.worker.mjs')]);
    (globalThis as unknown as {pdfjsWorker:unknown}).pdfjsWorker=worker;
    const task=pdf.getDocument({data:bytes.slice(),useSystemFonts:true,stopAtErrors:true,disableFontFace:true});
    try {
      const doc=await task.promise;
      if(doc.numPages>100) throw new Error('PDF เกิน 100 หน้า');
      const pages:PdfPage[]=[];
      for(let i=1;i<=doc.numPages;i++) {
        const page=await doc.getPage(i), content=await page.getTextContent();
        pages.push({width:page.view[2],height:page.view[3],words:content.items.filter((w):w is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in w && !!w.str.trim()).map(w=>({text:w.str,x:w.transform[4],y:w.transform[5],width:w.width}))});
        if(pages.reduce((n,p)=>n+p.words.length,0)>300000) throw new Error('PDF มีข้อความมากเกินขอบเขต');
      }
      parsed=parseSalesPdf(pages,destination,warnings);
    } finally { await task.destroy(); }
  } else if(extension==='xls') {
    const {legacyExcelTable}=await import('./legacy-excel');
    parsed=parseSalesTable(await legacyExcelTable(bytes),destination,warnings);
  } else throw new Error('รองรับ CSV, Excel .xlsx / .xls และ PDF เท่านั้น');
  verifyFileName(name,parsed.code);
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');
  let binary=''; for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const payload=parsed.payload as {rows?:unknown[];items?:unknown[];totalSale?:number;totals?:{net?:number;ExtendedPriceTax?:number}};
  return {raw:{name,sha256,base64:btoa(binary)},code:parsed.code,payload:parsed.payload,...('period' in parsed?{period:parsed.period}:{}),warnings,count:payload.rows?.length??payload.items?.length??0,total:payload.totalSale??payload.totals?.net??payload.totals?.ExtendedPriceTax??0};
}
export async function verifyBatch(files:File[], destination:Destination) {
  const issues:string[]=[];
  if(files.length!==5) issues.push('เลือก A103/S102/S104/S114/S117 อย่างละ 1 ไฟล์ รวม 5 ไฟล์');
  if(files.reduce((n,f)=>n+f.size,0)>35_000_000) issues.push('ชุดนำเข้าเกิน 35 MB');
  for(const file of files) {
    try { verifyFileName(file.name); }
    catch(error) { issues.push(`${file.name}: ${error instanceof Error?error.message:'ชื่อ Report ไม่ถูกต้อง'}`); }
    if(!/\.(csv|xlsx|xls|pdf)$/i.test(file.name)) issues.push(`${file.name}: รองรับ CSV, Excel .xlsx / .xls และ PDF เท่านั้น`);
    if(!file.size || file.size>MAX_REPORT_BYTES) issues.push(`${file.name}: รายงานต้องมีขนาดมากกว่า 0 และไม่เกิน 12 MB`);
  }
  if(issues.length) throw new Error(`Verify ไม่ผ่าน — ยังไม่อนุญาต Import\n${issues.join('\n')}`);
  const verified:VerifiedFile[]=[];
  for(const file of files) {
    try { verified.push(await readReportBytes(file.name,new Uint8Array(await file.arrayBuffer()),destination)); }
    catch(error) { throw new Error(`${file.name}: ${error instanceof Error?error.message:'อ่านไฟล์ไม่สำเร็จ'}`); }
  }
  const warnings=verified.flatMap(f=>f.warnings);
  const report=assembleReports(verified,destination,warnings);
  return {verified,warnings:[...new Set(warnings)],batch:{destination:{...destination},files:verified.map(f=>f.raw),report,importedAt:new Date().toISOString()} satisfies ImportedBatch};
}
export function backupText(batches:ImportedBatch[], master:CapricciMaster, kappoMaster:KappoMaster=originalKappoMaster, lawoiMaster:LawoiMaster=originalLawoiMaster) {
  const text=JSON.stringify({format:'finance-revenue-local-backup',version:3,baseline,exportedAt:new Date().toISOString(),master:validateCapricciMaster(master),kappoMaster:validateKappoMaster(kappoMaster),lawoiMaster:validateLawoiMaster(lawoiMaster),batches:batches.map(b=>({destination:b.destination,files:b.files,importedAt:b.importedAt}))});
  if(text.length>MAX_BACKUP_BYTES) throw new Error('ไฟล์สำรองเกิน 80 MB กรุณาแยกชุดข้อมูล');
  return text;
}
export async function restoreBackup(text:string) {
  if(text.length>MAX_BACKUP_BYTES) throw new Error('ไฟล์สำรองเกิน 80 MB');
  const input=JSON.parse(text);
  if(input?.format!=='finance-revenue-local-backup'||![1,2,3].includes(input.version)||!Array.isArray(input.batches)||input.batches.length>100) throw new Error('ไฟล์สำรองไม่ตรงรูปแบบหรือเวอร์ชัน');
  if(input.version===2&&input.kappoMaster===undefined)throw new Error('Backup v2 ต้องมี Master KAPPO ครบ');
  if(input.version===3&&(input.kappoMaster===undefined||input.lawoiMaster===undefined))throw new Error('Backup v3 ต้องมี Master KAPPO / LAWOI ครบ');
  if(JSON.stringify(input.baseline)!==JSON.stringify(baseline)) throw new Error('ชุดข้อมูลต้นแบบของ Backup ไม่ตรงกับ HTML นี้ กรุณาเปิดด้วย HTML รุ่นที่สร้าง Backup');
  const master=validateCapricciMaster(input.master), batches:ImportedBatch[]=[]; const warnings:string[]=[]; const keys=new Set<string>();
  for(const value of input.batches) {
    const d=value.destination as Destination; validateDestination(d);
    const key=`${d.brand}/${d.branch}/${d.date}`; if(keys.has(key)) throw new Error('ไฟล์สำรองมีร้าน/สาขา/วันซ้ำ'); keys.add(key);
    if(!Array.isArray(value.files)||value.files.length!==5) throw new Error('ไฟล์สำรองมีรายงานไม่ครบ');
    const verified:VerifiedFile[]=[];
    for(const raw of value.files as RawImport[]) {
      if(typeof raw.name!=='string'||raw.name.length>250||typeof raw.base64!=='string'||raw.base64.length>MAX_REPORT_BYTES*1.4||!/^[a-f0-9]{64}$/.test(raw.sha256)) throw new Error('ข้อมูลไฟล์ต้นฉบับใน Backup ไม่ถูกต้อง');
      const bytes=Uint8Array.from(atob(raw.base64),c=>c.charCodeAt(0));
      const parsed=await readReportBytes(raw.name,bytes,d);
      if(parsed.raw.sha256!==raw.sha256) throw new Error(`${raw.name}: checksum ไม่ตรง ไฟล์สำรองอาจเสียหาย`);
      verified.push(parsed); warnings.push(...parsed.warnings);
    }
    const report=assembleReports(verified,d,warnings);
    batches.push({destination:d,report,files:verified.map(f=>f.raw),importedAt:typeof value.importedAt==='string'?value.importedAt:new Date().toISOString()});
  }
  let kappoMaster=input.kappoMaster===undefined?originalKappoMaster:validateKappoMaster(input.kappoMaster);
  for(const batch of batches)kappoMaster=mergeKappoItems(kappoMaster,batch.report);
  if(input.kappoMaster===undefined)warnings.push('Backup รุ่นเดิม: ใช้ Master KAPPO ต้นแบบใหม่ แล้วเพิ่มรหัสจากรายงานโดยไม่เดาหมวด');
  let lawoiMaster=input.lawoiMaster===undefined?originalLawoiMaster:validateLawoiMaster(input.lawoiMaster);
  for(const batch of batches)lawoiMaster=mergeLawoiItems(lawoiMaster,batch.report);
  if(input.lawoiMaster===undefined)warnings.push('Backup รุ่นเดิม: ใช้ Master LAWOI ต้นแบบใหม่ แล้วเพิ่มรหัสจากรายงานโดยไม่เดาหมวด');
  return {batches,master,kappoMaster,lawoiMaster,warnings:[...new Set(warnings)]};
}
export function downloadBackup(text:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a'); link.href=url; link.download=`Revenue-Backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  link.click(); window.setTimeout(()=>URL.revokeObjectURL(url),10000);
}
