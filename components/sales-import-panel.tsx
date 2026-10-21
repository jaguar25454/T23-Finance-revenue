'use client';
import {useEffect,useRef,useState} from 'react';
import {Upload,Download,FileCheck2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {BusinessDatePicker} from '@/components/business-date-picker';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from '@/components/ui/table';
import {brandData,formatBusinessDate,isBusinessDate,reportTemplates,reportsByBrand,type BrandKey} from '@/lib/report-data';
import {mergeImportedItems,upsertBatch,type Destination,type ImportedBatch} from '@/lib/sales-import';
import {backupText,downloadBackup,restoreBackup,verifyBatch,MAX_BACKUP_BYTES} from '@/lib/sales-import-files';
import {masterKey,type CapricciMaster} from '@/lib/capricci-master';
import {mergeKappoItems,type KappoMaster} from '@/lib/kappo-master';
import {mergeLawoiItems,type LawoiMaster} from '@/lib/lawoi-master';

type Preview=Awaited<ReturnType<typeof verifyBatch>>;
type Restore=Awaited<ReturnType<typeof restoreBackup>>;
const easyRestaurantBrands=(['capricci','lawoi'] as const);
export function SalesImportPanel({batches,master,kappoMaster,lawoiMaster,masterDirty,onApply,onQueueCount}:{batches:ImportedBatch[];master:CapricciMaster;kappoMaster:KappoMaster;lawoiMaster:LawoiMaster;masterDirty:boolean;onApply:(batches:ImportedBatch[],master:CapricciMaster,destination?:Destination,kappoMaster?:KappoMaster,lawoiMaster?:LawoiMaster)=>void;onQueueCount:(n:number)=>void}) {
  const [brand,setBrand]=useState<BrandKey|''>(''),[branch,setBranch]=useState(''),[date,setDate]=useState('');
  const [files,setFiles]=useState<File[]>([]),[preview,setPreview]=useState<Preview|null>(null),[restore,setRestore]=useState<Restore|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmed,setConfirmed]=useState(false),[downloaded,setDownloaded]=useState(false);
  const input=useRef<HTMLInputElement>(null),backupInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{onQueueCount(files.length+(restore?1:0));},[files.length,restore,onQueueCount]);
  useEffect(()=>{setDownloaded(false);setConfirmed(false);},[master,kappoMaster,lawoiMaster,batches]);
  function invalidate(){setPreview(null);setRestore(null);setError('');setNotice('');setConfirmed(false);setDownloaded(false);}
  const existing=preview&&(batches.find(b=>b.destination.brand===preview.batch.destination.brand&&b.destination.date===preview.batch.destination.date)?.report??reportsByBrand[preview.batch.destination.brand]);
  const replacing=!!(preview&&existing?.businessDate===preview.batch.destination.date);
  const selectedMaster=preview?.batch.destination.brand==='kappo'?kappoMaster:preview?.batch.destination.brand==='lawoi'?lawoiMaster:master;
  const knownCodes=new Set(selectedMaster.items.map(i=>masterKey(i.itemCode)));
  const newItems=preview?.batch.destination.brand==='kappo'?mergeKappoItems(kappoMaster,preview.batch.report).items.filter(i=>!knownCodes.has(masterKey(i.itemCode))):preview?.batch.destination.brand==='lawoi'?mergeLawoiItems(lawoiMaster,preview.batch.report).items.filter(i=>!knownCodes.has(masterKey(i.itemCode))):preview?.batch.destination.brand==='capricci'?mergeImportedItems(master,preview.batch.report).items.filter(i=>!knownCodes.has(masterKey(i.itemCode))):[];
  async function verify(){
    if(!brand)return;if(!easyRestaurantBrands.includes(brand as 'capricci'|'lawoi')){setError('KAPPO TAKASHI เปลี่ยนเป็น FoodStory แล้ว กรุณาใช้ช่อง Import FoodStory ของ KAPPO');return;}setBusy(true);invalidate();
    try{const result=await verifyBatch(files,{brand,branch:branch.trim(),date});upsertBatch(batches,result.batch);mergeImportedItems(master,result.batch.report);setPreview(result);}
    catch(e){setError(e instanceof Error?e.message:'Verify ไม่สำเร็จ');}finally{setBusy(false);}
  }
  function candidate(){
    if(restore)return restore;
    if(!preview)throw new Error('กรุณา Verify ก่อน');
    return {batches:upsertBatch(batches,preview.batch),master:mergeImportedItems(master,preview.batch.report),kappoMaster:mergeKappoItems(kappoMaster,preview.batch.report),lawoiMaster:mergeLawoiItems(lawoiMaster,preview.batch.report)};
  }
  function exportCandidate(){try{const next=candidate();downloadBackup(backupText(next.batches,next.master,next.kappoMaster,next.lawoiMaster));setDownloaded(true);setNotice('ส่งคำขอดาวน์โหลดแล้ว กรุณาตรวจว่าไฟล์ Revenue-Backup…json อยู่ในเครื่อง ก่อนยืนยัน Import');}catch(e){setError(e instanceof Error?e.message:'สร้าง Backup ไม่สำเร็จ');}}
  function apply(){
    if(masterDirty){setError('มี Master Data ที่กำลังแก้ไข กรุณาเก็บแบบร่างและกดทดลองใช้กับ Dashboard ก่อน Import เพื่อไม่ทับงานที่ยังไม่บันทึก');return;}
    if(!confirmed||!downloaded)return;
    try{const next=candidate();onApply(next.batches,next.master,preview?.batch.destination,next.kappoMaster,next.lawoiMaster);setFiles([]);setPreview(null);setRestore(null);setConfirmed(false);setDownloaded(false);setNotice('Import สำเร็จ — Dashboard ใช้ข้อมูลที่ตรวจแล้ว เก็บ Backup นี้ไว้เปิดกลับหลัง Refresh/ปิดหน้า');}
    catch(e){setError(e instanceof Error?e.message:'Import ไม่สำเร็จ');}
  }
  async function openBackup(file:File){setBusy(true);invalidate();setFiles([]);try{if(file.size>MAX_BACKUP_BYTES)throw new Error('Backup เกิน 80 MB');const result=await restoreBackup(await file.text());let valid:ImportedBatch[]=[];for(const b of result.batches)valid=upsertBatch(valid,b);setRestore({...result,batches:valid});setDownloaded(true);setNotice('ตรวจไฟล์ต้นฉบับและ checksum ใน Backup แล้ว — กรุณายืนยันก่อนแทนชุดข้อมูลในหน้านี้');}catch(e){setError(e instanceof Error?e.message:'อ่าน Backup ไม่สำเร็จ');}finally{setBusy(false);}}
  const control='h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm';
  return <section id="import-files" className="scroll-mt-28"><Card className="border-emerald-200 bg-white"><CardHeader>
    <CardTitle className="flex items-center gap-2"><Upload className="size-5"/> Import File · Easy Restaurant</CardTitle>
    <p className="text-xs leading-relaxed text-stone-500">สำหรับ Capricci และ LAWOI เท่านั้น · KAPPO TAKASHI ใช้ช่อง FoodStory แยกต่างหาก · ทำงานในเครื่อง ไม่มีอัปโหลดส่วนกลาง</p>
  </CardHeader><CardContent className="space-y-4">
    <fieldset disabled={busy} className="grid gap-3 md:grid-cols-4">
      <label className="space-y-2 text-xs font-semibold">1. Restaurant<select aria-label="Import Restaurant" className={control} value={brand} onChange={e=>{setBrand(e.target.value as BrandKey);setBranch('');invalidate();}}><option value="">Select Restaurant</option>{easyRestaurantBrands.map(key=><option key={key} value={key}>{brandData[key].name}</option>)}</select></label>
      <label className="space-y-2 text-xs font-semibold">2. Branch Code<Input aria-label="Import Branch Code" value={branch} maxLength={50} placeholder="เช่น 00001 / Default" onChange={e=>{setBranch(e.target.value);invalidate();}}/></label>
      <div className="space-y-2 text-xs font-semibold"><p>3. Business Date</p><BusinessDatePicker value={date} onChange={value=>{setDate(value);invalidate();}}/></div>
      <div className="flex items-end"><Button className="w-full" disabled={!brand||!branch.trim()||!isBusinessDate(date)} onClick={()=>input.current?.click()}><Upload className="size-4"/> Choose File</Button></div>
    </fieldset>
    <input aria-label="Select Sales Reports" className="hidden" ref={input} type="file" multiple accept=".csv,.xlsx,.pdf,.xls" onChange={e=>{invalidate();setFiles(Array.from(e.target.files??[]));e.target.value='';}}/>
    <p className="text-xs text-stone-500">A103 / S114 / S117: PDF ข้อความ · S102 / S104: CSV หรือ Excel .xlsx / .xls (หัวคอลัมน์ Easy Restaurant) · อย่างละ 1 ไฟล์ในวันเดียวกัน · ไม่รองรับ PDF สแกน / Workbook Category · ไฟล์ผิดประเภทหรือไม่ครบจะเตือนที่ Verify และยัง Import ไม่ได้</p>
    {files.length>0&&<div className="rounded-lg bg-stone-50 p-3 text-xs"><p className="font-semibold">เลือกแล้ว {files.length} / 5 ไฟล์</p>{files.map((f,i)=><p className="mt-1 break-all" key={i}>{f.name} · {Math.ceil(f.size/1024)} KB</p>)}<div className="mt-3 flex gap-2"><Button disabled={busy||!brand||!isBusinessDate(date)||!branch.trim()} onClick={()=>void verify()}><FileCheck2 className="size-4"/>{busy?'Verifying…':'Verify Reports'}</Button><Button disabled={busy} variant="outline" onClick={()=>{setFiles([]);invalidate();}}>Clear Queue</Button></div></div>}
    {busy&&<p role="status" className="text-sm text-emerald-700">กำลังอ่านเนื้อหาและตรวจสอบยอด กรุณารอสักครู่…</p>}
    {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap"><p className="font-bold">Import Blocked</p><p>ไม่เปลี่ยนข้อมูล: {error}</p><p className="mt-2 text-xs">แก้ไขไฟล์/ปลายทางแล้ว Verify Reports ใหม่ก่อน Import</p></div>}
    {(preview||restore)&&<div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <h3 className="font-bold text-emerald-800">Verified · {restore?'Awaiting Restore':'Awaiting Import'}</h3>
      {preview&&<><p className="text-xs">{brandData[preview.batch.destination.brand].name} / {preview.batch.destination.branch} / {formatBusinessDate(preview.batch.destination.date)} · {replacing?'แทนชุดของวันเดิม (ไม่บวกซ้ำ)':'เพิ่มวันใหม่'} · ItemCode ใหม่ใน Master ของร้านนี้ {newItems.length} รายการ</p>
        <Table><TableHeader><TableRow><TableHead>Report</TableHead><TableHead>Rows</TableHead><TableHead className="text-right">Report Total</TableHead></TableRow></TableHeader><TableBody>{preview.verified.map(f=><TableRow key={f.code}><TableCell>{f.code}</TableCell><TableCell>{f.count}</TableCell><TableCell className="text-right tabular-nums">{f.total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell></TableRow>)}</TableBody></Table>
        <p className="text-xs text-stone-500">ยอดข้างต้นซ้อนทับกัน ห้ามบวกรวมเป็นยอดขาย · A103/S117 ใช้ Net/Total Sale · S102/S104/S114 ใช้ยอดรวมตามรายงาน</p></>}
      {restore&&<p className="text-xs">{restore.batches.length} ชุดรายวัน · Capricci {restore.master.items.length} รหัส · KAPPO {restore.kappoMaster.items.length} รหัส · LAWOI {restore.lawoiMaster.items.length} รหัส · เปิดแล้วแทนข้อมูล Import/หมวดปัจจุบันทั้งชุด ไม่รวม Backup หลายไฟล์เข้าด้วยกัน</p>}
      <details open className="text-xs text-amber-900"><summary className="cursor-pointer font-semibold">Review Notes</summary><ul className="mt-2 list-disc space-y-1 pl-5">{(preview?.warnings??restore?.warnings??[]).map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <div className="flex flex-wrap gap-2">{!restore&&<Button variant="outline" disabled={busy||masterDirty} onClick={exportCandidate}><Download className="size-4"/> 1. Save Backup</Button>}<Button disabled={busy||masterDirty||!confirmed||!downloaded} onClick={apply}>2. {restore?'Restore Backup':'Confirm Import'}</Button><Button variant="ghost" disabled={busy} onClick={invalidate}>Cancel</Button></div>
      <label className="flex items-start gap-2 text-xs"><input aria-label="Confirm Import Details" type="checkbox" checked={confirmed} disabled={!downloaded||busy} onChange={e=>setConfirmed(e.target.checked)}/><span>ฉันตรวจร้าน/สาขา/วันที่ ข้อควรตรวจ และมีไฟล์สำรองอยู่ในเครื่องแล้ว; ยืนยัน{replacing||restore?'แทนข้อมูลเดิม':'นำเข้าชุดนี้'}</span></label>
      {masterDirty&&<p className="text-xs text-red-700">กรุณาใช้แบบร่าง Master Data กับ Dashboard ก่อน เพื่อเก็บการจัดหมวดที่กำลังแก้ไข</p>}
    </div>}
    {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" disabled={busy} onClick={()=>backupInput.current?.click()}>Open Backup</Button><Button variant="outline" disabled={busy||masterDirty} onClick={()=>{try{downloadBackup(backupText(batches,master,kappoMaster,lawoiMaster));setNotice('ส่งคำขอดาวน์โหลดชุดข้อมูลและ Master Data ทั้ง Capricci / KAPPO / LAWOI ที่ใช้อยู่แล้ว ตรวจไฟล์ใน Downloads');}catch(e){setError(e instanceof Error?e.message:'สำรองไม่ได้');}}}><Download className="size-4"/> Export Current Data</Button><span className="self-center text-xs text-stone-500">มีชุด Import {batches.length} วัน · หลัง Refresh ต้องเปิด Backup กลับมา · ไฟล์มีข้อมูลยอดขาย/ใบภาษี ควรเก็บอย่างจำกัดสิทธิ์</span></div>
    <input aria-label="Open Backup File" ref={backupInput} type="file" accept=".json" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void openBackup(f);}}/>
  </CardContent></Card></section>;
}
