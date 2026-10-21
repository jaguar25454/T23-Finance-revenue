'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, Download, RefreshCw, Save, Upload } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateMasterCategories, filterMasterTable, masterFilterOptions, masterSubTypeFilter, masterCategoryFilter, masterTableRows, masterCategoryNames, masterChangeCount, masterKey, originalCapricciMaster, parseMasterJson, validateCapricciMaster, type MasterItem, type MasterTableFilters } from '@/lib/capricci-master';
import { formatBusinessTimestamp, formatPeriod, reportsForPeriod, type Period } from '@/lib/report-data';
import type { useCapricciMaster } from '@/hooks/use-capricci-master';
import type { ImportedBatch } from '@/lib/sales-import';
import { periodFinanceSummary, reportDataset } from '@/lib/runtime-reports';
import { capricciMenuPrice, capricciPriceSource } from '@/lib/capricci-prices';

type Connection = ReturnType<typeof useCapricciMaster>;
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (value: string | null) => value ? formatBusinessTimestamp(value) : 'ยังไม่ได้บันทึก';
function Choice({ value, options, onChange, label, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  return <Select value={value} onValueChange={v => v && onChange(v)} disabled={disabled}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>;
}

export function CapricciMasterData({ connection, period, batches = [], onDirty, onDashboard }: { connection: Connection; period: Period; batches?:ImportedBatch[]; onDirty: (dirty: boolean) => void; onDashboard: () => void }) {
  const { record, busy, status, canEdit, error } = connection;
  const [draft, setDraft] = useState(record.master);
  const [editor, setEditor] = useState<(MasterItem & { isNew: boolean }) | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MasterTableFilters['status']>('ทั้งหมด');
  const [typeFilter, setTypeFilter] = useState('ทั้งหมด');
  const [subTypeFilter, setSubTypeFilter] = useState('ทั้งหมด');
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const dirty = masterChangeCount(draft, record.master) > 0 || editor !== null;
  useEffect(() => { setDraft(record.master); setEditor(null); }, [record]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  const preview = useMemo(() => periodFinanceSummary(draft,batches,period), [draft,batches,period]);
  const saved = useMemo(() => periodFinanceSummary(record.master,batches,period), [record.master,batches,period]);
  const hasData = !!reportsForPeriod('capricci', period,reportDataset(batches));
  const tableRows = useMemo(() => {const sold=new Set(preview.detail.map(r=>masterKey(r.itemCode)));return masterTableRows(draft).map(r=>({...r,hasSales:sold.has(masterKey(r.itemCode))}));}, [draft,preview]);
  const subTypeChoice = useMemo(() => masterSubTypeFilter(tableRows, typeFilter, subTypeFilter), [tableRows, typeFilter, subTypeFilter]);
  useEffect(() => {
    if (subTypeFilter !== subTypeChoice.value) { setSubTypeFilter(subTypeChoice.value); setPage(0); }
  }, [subTypeFilter, subTypeChoice.value]);
  const categoryChoice = useMemo(() => masterCategoryFilter(tableRows, typeFilter, subTypeChoice.value, categoryFilter), [tableRows, typeFilter, subTypeChoice.value, categoryFilter]);
  useEffect(() => {
    if (categoryFilter !== categoryChoice.value) { setCategoryFilter(categoryChoice.value); setPage(0); }
  }, [categoryFilter, categoryChoice.value]);
  const displayed = filterMasterTable(tableRows, {
    type: typeFilter === 'ทั้งหมด' ? undefined : typeFilter,
    subType: subTypeChoice.value === 'ทั้งหมด' ? undefined : subTypeChoice.value,
    sourceCategory: categoryChoice.value === 'ทั้งหมด' ? undefined : categoryChoice.value,
    search, status: filter,
  }).map(row => ({ ...row, sellingPrice: capricciMenuPrice(row.itemCode) }));
  const pages = Math.max(1, Math.ceil(displayed.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const editable = status !== 'connected' || canEdit;
  function stageItem() {
    if (!editor) return;
    try {
      if (editor.isNew && draft.items.some(item => masterKey(item.itemCode) === masterKey(editor.itemCode))) throw new Error('ItemCode นี้มีอยู่แล้ว กรุณาแก้ไขรายการเดิม');
      const item = { itemCode: editor.itemCode, name: editor.name, subgroup: editor.subgroup };
      const items = editor.isNew ? [...draft.items, item] : draft.items.map(old => masterKey(old.itemCode) === masterKey(item.itemCode) ? item : old);
      setDraft(validateCapricciMaster({ ...draft, items })); setEditor(null); setNotice('เก็บในแบบร่างแล้ว ตรวจผลกระทบและกดทดลองใช้กับ Dashboard; ยังไม่บันทึกส่วนกลาง');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ข้อมูลไม่ถูกต้อง'); }
  }
  async function save() {
    if (editor) { setNotice('กรุณาเก็บรายการที่กำลังแก้ไขลงแบบร่าง หรือยกเลิกรายการก่อนบันทึก'); return; }
    if (!window.confirm('บันทึก Master Data เป็นเวอร์ชันใหม่? หมวดบน Dashboard จะคำนวณใหม่จากเวอร์ชันนี้ รวมวันที่ย้อนหลังที่มีข้อมูล โดยไม่แก้รายงานต้นฉบับ')) return;
    if (await connection.save(draft)) setNotice('บันทึกฐานข้อมูลกลางสำเร็จ Dashboard ใช้เวอร์ชันใหม่นี้แล้ว');
  }
  async function reload() {
    if (dirty && !window.confirm('โหลดเวอร์ชันล่าสุดจะทิ้งแบบร่างที่ยังไม่บันทึก ต้องการดำเนินการหรือไม่?')) return;
    if (await connection.reload()) setNotice('โหลด Master Data ล่าสุดแล้ว');
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify(validateCapricciMaster(draft), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `Capricci-Master-Data-draft-v${record.revision}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('ส่งออกแบบร่างเป็นไฟล์แล้ว ไม่ใช่การบันทึกฐานข้อมูลกลาง');
  }
  function applyPreview() {
    if (editor) { setNotice('เก็บรายการที่กำลังแก้ไขลงแบบร่าง หรือยกเลิกรายการก่อนทดลองใช้'); return; }
    try {
      connection.preview(validateCapricciMaster(draft));
      setNotice('นำแบบร่างไปทดลองบน Dashboard แล้ว ยังไม่บันทึกส่วนกลาง และจะหายเมื่อปิด/Refresh');
      onDashboard();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ข้อมูลไม่ถูกต้อง'); }
  }
  async function importDraft(file: File) {
    if ((dirty || connection.previewActive) && !window.confirm('นำเข้าไฟล์เป็นแบบร่างใหม่แทนแบบร่างปัจจุบันหรือไม่? ยังไม่เปลี่ยน Dashboard จนกดทดลองใช้')) return;
    try {
      if (file.size > 3_000_000) throw new Error('ไฟล์ใหญ่เกิน 3 MB');
      setDraft(parseMasterJson(await file.text())); setEditor(null); setNotice('นำเข้าแบบร่างแล้ว ตรวจผลกระทบก่อนทดลองใช้');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'นำเข้าไม่ได้'); }
  }
  return (
    <section className="space-y-5" aria-label="Capricci Master Data">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Database className="size-6" /> Master Data · Capricci</h2><p className="mt-1 text-sm text-stone-500">จัดหมวดสินค้า → Sale by Category</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onDashboard}>กลับ Dashboard</Button><Button disabled={busy || !!editor} onClick={applyPreview}>ทดลองใช้กับ Dashboard</Button><Button variant="outline" disabled={busy || status !== 'connected'} onClick={reload}><RefreshCw className="size-4" /> โหลดล่าสุด</Button><Button disabled={busy || !canEdit || status !== 'connected' || !!editor || (masterChangeCount(draft, record.master) === 0 && record.revision > 0)} onClick={save}><Save className="size-4" /> {busy ? 'กำลังเชื่อมต่อ…' : 'บันทึกส่วนกลาง'}</Button></div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed" role="status">
        <strong>{status === 'connected' ? `เชื่อมต่อฐานข้อมูลกลาง · เวอร์ชัน ${record.revision} · ${canEdit ? 'มีสิทธิ์แก้ไข' : 'อ่านอย่างเดียว'}` : status === 'loading' ? 'กำลังเชื่อมฐานข้อมูลกลาง…' : 'โหมดออกแบบ · GitHub + Google Drive จะเชื่อมหลังระบบ Final'}</strong>
        <p className="mt-1">บันทึกเมื่อ {time(record.updatedAt)} (เวลาไทย) {record.updatedBy && `โดย ${record.updatedBy}`} · แบบร่างที่เปลี่ยน {masterChangeCount(draft, record.master)} รายการ · Master นี้ใช้เฉพาะ Capricci</p>
        <p className="mt-1 text-amber-800">{status === 'connected' ? 'บันทึกแล้วผู้ใช้อื่นต้องกด “โหลดล่าสุด” หรือ Refresh เพื่อรับเวอร์ชันใหม่' : 'แก้แบบร่าง → ทดลองใช้กับ Dashboard ได้ในหน้านี้เท่านั้น; ส่งออก JSON เก็บไว้และนำเข้ากลับได้ แบบร่าง/ผลทดลองหายเมื่อปิดหรือ Refresh ไม่มีการบันทึกอัตโนมัติหรือส่งข้อมูลขึ้น Drive'}</p>
        {error && <p className="mt-2 text-red-700" role="alert">{error}</p>}
        {notice && <p className="mt-2 text-[#245b43]">{notice}</p>}
      </div>
      <Card><CardHeader><CardTitle>ผลกระทบก่อนบันทึก · {formatPeriod(period)}</CardTitle><p className="text-xs text-stone-500">Master ปรับเฉพาะการจัดกลุ่ม ไม่แก้ยอดเงิน รายการขาย หรือเงื่อนไขยกเว้น · เวอร์ชันล่าสุดใช้กับวันที่ย้อนหลังด้วย ยังไม่มี Effective date แยกรายวัน</p></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Sale by Category</TableHead><TableHead className="text-right">ที่ใช้อยู่</TableHead><TableHead className="text-right">แบบร่าง</TableHead><TableHead className="text-right">เปลี่ยนแปลง</TableHead></TableRow></TableHeader><TableBody>
          {[...new Set([...preview.categories,...saved.categories].map(c=>c.name))].map(name => { const category=preview.categories.find(c=>c.name===name)??{name,value:0}; const savedValue=saved.categories.find(c=>c.name===name)?.value??0; return <TableRow key={category.name}><TableCell>{category.name}</TableCell><TableCell className="text-right tabular-nums">{hasData ? money(savedValue) : 'NO DATA'}</TableCell><TableCell className="text-right tabular-nums font-semibold">{hasData ? money(category.value) : 'NO DATA'}</TableCell><TableCell className="text-right tabular-nums">{hasData ? money(category.value - savedValue) : 'NO DATA'}</TableCell></TableRow>; })}
          <TableRow className="font-bold"><TableCell>รวม (บาท)</TableCell><TableCell className="text-right">{hasData ? money(saved.sales) : 'NO DATA'}</TableCell><TableCell className="text-right">{hasData ? money(preview.sales) : 'NO DATA'}</TableCell><TableCell className="text-right">{hasData ? money(preview.sales - saved.sales) : 'NO DATA'}</TableCell></TableRow>
        </TableBody></Table>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Report Data · รายงานยอดขายของ Capricci</CardTitle><p className="text-xs text-stone-500">นำเข้ารายงานขาย ไม่ใช่ไฟล์ Category · รหัสสินค้าใหม่แสดง “ยังไม่จัดหมวด” ส่วนรายการเดิมคงการจัดหมวดที่แก้ไว้</p></CardHeader><CardContent className="space-y-3">
        <Button variant="outline" onClick={()=>document.getElementById('import-files')?.scrollIntoView({behavior:'smooth'})}><Upload className="size-4"/> Import รายงานยอดขาย</Button>
        <Table><TableHeader><TableRow><TableHead>วันที่ / สาขา</TableHead><TableHead>รายงานที่ Verify และ Import แล้ว</TableHead><TableHead>S104</TableHead></TableRow></TableHeader><TableBody>
          {batches.filter(b=>b.destination.brand==='capricci').map(b=><TableRow key={`${b.destination.branch}-${b.destination.date}`}><TableCell>{formatPeriod({start:b.destination.date,end:b.destination.date,mode:'day'})} / {b.destination.branch}</TableCell><TableCell>A103 · S102 · S104 · S114 · S117</TableCell><TableCell>{b.report.S104.rows.length} แถว</TableCell></TableRow>)}
          {!batches.some(b=>b.destination.brand==='capricci')&&<TableRow><TableCell colSpan={3} className="text-stone-500">ยังไม่มีชุด Import เพิ่ม — Dashboard ใช้ข้อมูลต้นแบบ</TableCell></TableRow>}
        </TableBody></Table>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Data Management (Capricci)</CardTitle><p className="text-xs text-stone-500">{draft.items.length} รหัสไม่ซ้ำ · ต้นแบบจาก Category ใน Excel · รหัสซ้ำใช้แถวแรก; พบหมวดขัดกัน 3 รหัสให้ตรวจโดยค้นหา “หมวดขัดกัน” · Service Charge ถูกล็อกแยกจากยอดขาย</p><p className="text-xs text-stone-500">Selling Price (THB) อ่านจาก Sheet Category คอลัมน์ I จับคู่ ItemCode คอลัมน์ F · ไม่มีราคาในต้นแบบแสดง NO DATA · เป็นราคาอ้างอิง ไม่ใช่ราคาสุทธิหลังส่วนลดจาก Report และไม่ใช้คำนวณยอด Dashboard ใหม่</p></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 md:grid-cols-3">
          <div className="space-y-1"><p className="text-xs font-medium">Type <span className="font-normal text-stone-500">· Main.</span></p><Choice label="กรอง Type (Main.)" value={typeFilter} options={['ทั้งหมด', ...masterFilterOptions(tableRows, 'type')]} onChange={value => { setTypeFilter(value); setPage(0); }} /></div>
          <div className="space-y-1"><p className="text-xs font-medium">Sub Type <span className="font-normal text-stone-500">· Sub.</span></p><Choice label="กรอง Sub Type (Sub.)" value={subTypeChoice.value} options={subTypeChoice.options} onChange={value => { setSubTypeFilter(value); setPage(0); }} /></div>
          <div className="space-y-1"><p className="text-xs font-medium">Category <span className="font-normal text-stone-500">· Category</span></p><Choice label="กรอง Category" value={categoryChoice.value} options={categoryChoice.options} onChange={value => { setCategoryFilter(value); setPage(0); }} /></div>
          <p className="text-xs leading-relaxed text-stone-500 md:col-span-3">อ้างอิง Sheet Category: Main. (P) / Sub. (O) / Category (D) · ตัวกรองสัมพันธ์กัน Type → Sub Type → Category; เปลี่ยนตัวเลือกด้านบนแล้วตัวเลือกย่อยเดิมไม่ตรงกันจะกลับเป็น “ทั้งหมด” · กรองเฉพาะตารางนี้ ไม่เปลี่ยนยอด Dashboard · ช่องว่างในต้นฉบับแสดง “ไม่ระบุ”</p>
        </div>
        <div className="flex flex-wrap gap-2"><Input aria-label="ค้นหา Master Data" placeholder="ค้นหา ItemCode / Menu / หมวด" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-md" /><div className="w-44"><Choice value={filter ?? 'ทั้งหมด'} options={['ทั้งหมด', 'มีรายการขาย', 'หมวดขัดกัน']} label="กรอง Master Data" onChange={value => { setFilter(value as MasterTableFilters['status']); setPage(0); }} /></div><Button variant="outline" onClick={() => { setTypeFilter('ทั้งหมด'); setSubTypeFilter('ทั้งหมด'); setCategoryFilter('ทั้งหมด'); setSearch(''); setFilter('ทั้งหมด'); setPage(0); }}>ล้างตัวกรอง</Button><Button variant="outline" disabled={!editable || busy} onClick={() => { if (!editor || window.confirm('ทิ้งรายการที่กำลังแก้ไขและเพิ่มรหัสใหม่หรือไม่?')) setEditor({ itemCode: '', name: '', subgroup: draft.groups[0].subgroup, isNew: true }); }}>เพิ่มรหัสสินค้า</Button><Button variant="outline" disabled={!!editor} onClick={exportDraft}><Download className="size-4" /> ส่งออกแบบร่าง</Button><Button variant="outline" onClick={() => { if (window.confirm('คืนแบบร่างเป็นหมวดต้นแบบ Excel? Dashboard ยังไม่เปลี่ยนจนกดทดลองใช้')) { setDraft(originalCapricciMaster); setEditor(null); } }}>คืนต้นแบบ</Button></div>
        <label className="flex max-w-lg flex-col gap-1 text-xs text-stone-500">นำเข้าแบบร่าง Master Data (.json) · ไม่ใช่ Import Report<Input type="file" accept=".json,application/json" aria-label="นำเข้าแบบร่าง Master Data" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importDraft(file); }} /></label>
        {editor && <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 md:grid-cols-3">
          <label className="space-y-1 text-xs">ItemCode<Input aria-label="ItemCode" value={editor.itemCode} disabled={!editor.isNew} onChange={e => setEditor({ ...editor, itemCode: e.target.value })} /></label>
          <label className="space-y-1 text-xs">ชื่อสินค้า<Input aria-label="ชื่อสินค้า" value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} /></label>
          <div className="space-y-1 text-xs">หมวดย่อย<Choice label="หมวดย่อยของสินค้า" value={editor.subgroup} options={['ยังไม่จัดหมวด',...draft.groups.map(g => g.subgroup)]} onChange={subgroup => setEditor({ ...editor, subgroup })} /></div>
          <div className="flex gap-2 md:col-span-3"><Button disabled={busy || !editable} onClick={stageItem}>เก็บในแบบร่าง</Button><Button variant="outline" onClick={() => setEditor(null)}>ยกเลิกการแก้รายการ</Button></div>
        </div>}
        <Table aria-label="ItemCode Master Data"><TableHeader><TableRow>{['Type', 'Sub Type', 'Category', 'Menu', 'Selling Price', 'Output', 'ปุ่มแก้ไข'].map(label => <TableHead key={label} className={label === 'Selling Price' ? 'text-right' : undefined}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{displayed.slice(currentPage * 20, currentPage * 20 + 20).map(item => <TableRow key={item.itemCode}>
          <TableCell className="max-w-40 whitespace-normal">{item.type}</TableCell><TableCell className="max-w-40 whitespace-normal">{item.subType}</TableCell><TableCell className="max-w-44 whitespace-normal">{item.sourceCategory}</TableCell><TableCell className="min-w-48 max-w-80 whitespace-normal"><span className="font-medium">{item.name}</span><span className="mt-1 block text-xs text-stone-500">{item.itemCode}</span>{item.hasConflict && <span className="block text-[10px] text-amber-700">ต้นแบบมีหมวดขัดกัน</span>}</TableCell><TableCell className="text-right tabular-nums" title={item.sellingPrice.cell ? `${capricciPriceSource.filename} · Category!${item.sellingPrice.cell} · THB` : 'ไม่มีราคาในไฟล์ต้นแบบ'}>{item.sellingPrice.value === null ? <span className="text-xs text-stone-400">NO DATA</span> : money(item.sellingPrice.value)}</TableCell><TableCell className="max-w-44 whitespace-normal">{item.output}</TableCell><TableCell><Button variant="outline" size="sm" aria-label={`แก้ไข ${item.itemCode}`} disabled={busy || !editable || masterKey(item.itemCode) === 'servicecharge'} onClick={() => { if (!editor || window.confirm('ทิ้งรายการที่กำลังแก้ไขและเปิดรายการนี้หรือไม่?')) setEditor({ itemCode: item.itemCode, name: item.name, subgroup: item.subgroup, isNew: false }); }}>แก้ไข</Button></TableCell>
        </TableRow>)}{!displayed.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-stone-500">NO DATA · ไม่พบรหัสสินค้าที่ตรงกับตัวกรองและการค้นหา</TableCell></TableRow>}</TableBody></Table>
        <div className="flex items-center justify-between gap-2 text-xs"><span>พบ {displayed.length} รหัส · หน้า {currentPage + 1} / {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</Button><Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>ถัดไป</Button></div></div>
      </CardContent></Card>
      <Card><CardContent><Accordion><AccordionItem value="groups"><AccordionTrigger>Type selection</AccordionTrigger><AccordionContent><Table><TableHeader><TableRow><TableHead>Sub Type</TableHead><TableHead>ItemCodes</TableHead><TableHead>Sale by Category</TableHead></TableRow></TableHeader><TableBody>{draft.groups.map(group => <TableRow key={group.subgroup}><TableCell>{group.subgroup}</TableCell><TableCell>{draft.items.filter(item => masterKey(item.subgroup) === masterKey(group.subgroup)).length}</TableCell><TableCell><Choice label={`Output ของ ${group.subgroup}`} value={group.category} options={masterCategoryNames} disabled={!editable || busy} onChange={category => setDraft({ ...draft, groups: draft.groups.map(old => old.subgroup === group.subgroup ? { ...old, category } : old) })} /></TableCell></TableRow>)}</TableBody></Table></AccordionContent></AccordionItem></Accordion></CardContent></Card>
      <Card><CardHeader><CardTitle>Logic: Master Data → Dashboard</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-relaxed text-stone-600">
        <p>1. ใช้ Master Data ที่เลือก: รหัสสินค้า → หมวดย่อย → Food / Non-Alcohol / Alcohol / Other (รุ่นนี้ใช้ต้นแบบหรือแบบร่างที่กดทดลองใช้; หลัง Final จึงอ่านจากส่วนกลาง)</p>
        <p>2. เลือกรายการ S104 ของ Capricci ใน Period ที่เลือก เฉพาะ CustomerName “ลูกค้าทั่วไป เงินสด” (ไม่ใช่การกรองวิธีชำระเงิน) ยกเว้น Entertain และ Service Charge</p>
        <p>3. ยอดต่อรายการ = ExtendedPrice + Column1 ตามไฟล์ Finance ไม่คูณ Qty ซ้ำ ไม่บวก VAT และไม่หัก Discount ซ้ำ</p>
        <p>4. จับคู่ด้วย ItemCode แล้วรวมยอดตามหมวด Output; ไม่พบรหัสต้องตรวจและจัดหมวด ไม่โยนเข้า Other อัตโนมัติ</p>
        <p>5. กดทดลองใช้ → Dashboard คำนวณใหม่; Period รวมวันที่มีข้อมูล และ Daily เฉพาะวันสิ้นสุดช่วง หากไม่มีรายงานแสดง NO DATA ส่วนการบันทึกเวอร์ชัน/ผู้แก้ไขและป้องกันการเขียนทับจะเปิดใช้พร้อม API กลางหลัง Final</p>
        <p>ตัวอย่าง: ย้ายรหัสสินค้าจาก Water → A La Carte จะย้ายยอดของรหัสนั้นจาก Non-Alcohol → Food แต่ยอดขายรวมเท่าเดิม · S102/S104/S117 ต้นฉบับไม่ถูกแก้</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>ฐานข้อมูลกลาง · หลัง Final</CardTitle></CardHeader><CardContent><p className="text-sm text-stone-500">GitHub (หน้าเว็บ) → API ตรวจสิทธิ์และเวอร์ชัน → Google Drive (Master Data / ประวัติ) · ยังไม่เชื่อมต่อและยังไม่มีประวัติการบันทึกส่วนกลางในรุ่นนี้</p><p className="mt-2 text-xs text-amber-800">ไฟล์ HTML ตัวอย่างมีข้อมูลยอดขายจริง ห้ามนำไฟล์นี้ขึ้นเว็บไซต์สาธารณะโดยตรง รุ่น Deploy ต้องย้ายข้อมูลธุรกิจออกจากหน้าเว็บและอ่านหลังตรวจสิทธิ์</p></CardContent></Card>
      <p className="text-xs text-stone-500">แก้จากต้นแบบทั้งหมด {masterChangeCount(draft, originalCapricciMaster)} รายการ · แบบร่างไม่เปลี่ยน Dashboard จนกดทดลองใช้ และไม่ใช่ข้อมูลส่วนกลาง</p>
    </section>
  );
}
