'use client';

import { useMemo, useState } from 'react';
import { FileText, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { brandData, reportsForPeriod, getReconciliation, formatBusinessDate, formatSourceDate, formatPeriod, reportTemplates, type Period, type BrandKey, type ReportCode, type ReportSnapshot } from '@/lib/report-data';

type Row = Record<string, string | number | null>;
type Column = { key: string; label: string };
const amount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exactNumber = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });
const panel = 'border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80';

function Stats({ values }: { values: [string, string][] }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{values.map(([label, value]) => (
    <div key={label} className="rounded-xl bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 text-base font-bold tabular-nums text-[#245b43]">{value}</p>
    </div>
  ))}</div>;
}

function DetailTable({ rows, columns, title }: { rows: Row[]; columns: Column[]; title: string }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const matches = useMemo(() => rows.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase()))), [rows, query]);
  const pageCount = Math.max(1, Math.ceil(matches.length / 25));
  const current = Math.min(page, pageCount - 1);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-bold">{title} <span className="font-normal text-stone-400">{matches.length} / {rows.length} แถว</span></h3>
      <Input aria-label={`ค้นหา ${title}`} placeholder="ค้นหารหัส / ชื่อ / เลขบิล" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} className="max-w-xs bg-white" />
    </div>
    <div className="rounded-lg border border-stone-200">
      <Table><TableHeader><TableRow>{columns.map(column => <TableHead key={column.key} className="bg-stone-50 text-xs">{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{matches.slice(current * 25, (current + 1) * 25).map((row, index) => <TableRow key={index}>
          {columns.map(column => <TableCell key={column.key} className={`text-xs ${typeof row[column.key] === 'number' ? 'text-right tabular-nums' : ''}`}>
            {typeof row[column.key] === 'number' ? exactNumber(row[column.key] as number) : column.key === 'SaleDate'
              ? formatSourceDate(String(row[column.key]))
              : row[column.key] || '—'}
          </TableCell>)}
        </TableRow>)}{!matches.length && <TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-stone-500">ไม่พบรายการ</TableCell></TableRow>}</TableBody>
      </Table>
    </div>
    <div className="flex items-center justify-between text-xs text-stone-500">
      <span>เลื่อนตารางแนวนอนเพื่อดูทุกคอลัมน์ · ตัวเลข CSV คงทศนิยมต้นทาง</span>
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>ก่อนหน้า</Button><span>{current + 1} / {pageCount}</span><Button variant="outline" size="sm" disabled={current + 1 >= pageCount} onClick={() => setPage(current + 1)}>ถัดไป</Button></div>
    </div>
  </div>;
}

export function Reconciliation({ reports }: { reports: ReportSnapshot }) {
  const checks = getReconciliation(reports);
  const mismatched = checks.some(check => check.delta !== 0);
  return <Card className={panel}><CardHeader>
    <CardTitle className={`text-sm ${mismatched ? 'text-amber-800' : 'text-emerald-700'}`}>
      {mismatched ? 'NEEDS REVIEW · พบส่วนต่างยอด' : 'ยอดที่เปรียบเทียบตรงกัน'}
    </CardTitle>
    <p className="text-xs text-stone-500">THB · เปรียบเทียบที่ 2 ตำแหน่งทศนิยม คงค่าดิบ CSV และยอดพิมพ์ PDF ไว้ ไม่ปรับยอดอัตโนมัติ</p>
  </CardHeader><CardContent>
    <Table><TableHeader><TableRow><TableHead>รายการตรวจสอบ</TableHead><TableHead className="text-right">ยอดแรก</TableHead><TableHead className="text-right">ยอดอ้างอิง</TableHead><TableHead className="text-right">ส่วนต่าง</TableHead></TableRow></TableHeader>
      <TableBody>{checks.map(check => <TableRow key={check.label}><TableCell className="text-xs">{check.label}</TableCell><TableCell className="text-right text-xs tabular-nums">{amount(check.actual)}</TableCell><TableCell className="text-right text-xs tabular-nums">{amount(check.expected)}</TableCell><TableCell className={`text-right text-xs font-bold tabular-nums ${check.delta ? 'text-amber-700' : 'text-emerald-700'}`}>{amount(check.delta)}</TableCell></TableRow>)}</TableBody>
    </Table>
  </CardContent></Card>;
}

function TaxDetail({ reports }: { reports: ReportSnapshot }) {
  const tax = reports.A103;
  const voidCount = tax.rows.filter(row => 'status' in row && row.status === 'VOID').length;
  return <Card className={panel}><CardHeader><CardTitle className="text-sm">A103 · Sales Tax Report</CardTitle>
    <p className="text-xs text-stone-500">{tax.establishment} · Tax ID {tax.taxId} · Branch ใน A103: {tax.branchAsPrinted ?? 'ไม่ระบุ'} (คงค่าตามต้นฉบับ)</p>
  </CardHeader><CardContent className="space-y-5">
    <Stats values={[["ใบภาษี", String(tax.rows.length)], ['Product / Service Value', amount(tax.totals.value)], ['Tax', amount(tax.totals.tax)], ['Net', amount(tax.totals.net)]]} />
    {voidCount > 0 && <Alert className="border-amber-200 bg-amber-50 text-amber-900"><TriangleAlert /><AlertTitle>มี Void Bill {voidCount} รายการ</AlertTitle><AlertDescription>แสดงครบ {tax.rows.length} แถว รวมรายการยกเลิกยอด 0 บาท · รายการไม่ยกเลิก {tax.rows.length - voidCount} แถว · ไม่ลบ Void และไม่รวมเป็นยอดขายซ้ำ</AlertDescription></Alert>}
    <DetailTable title="Tax invoices" rows={tax.rows} columns={[
      { key: 'no', label: '#' }, { key: 'invoice', label: 'Tax Invoice No.' },
      ...(reports.brandId === 'lawoi' ? [{ key: 'receipt', label: 'Receipt No.' }, { key: 'status', label: 'Status' }] : []), { key: 'type', label: 'Type' },
      { key: 'customer', label: 'Customer' }, { key: 'customerTaxId', label: 'Purchaser Tax ID' }, { key: 'customerBranch', label: 'Purchaser Branch' },
      { key: 'eTax', label: 'E-Tax' }, { key: 'value', label: 'Product / Service Value' }, { key: 'tax', label: 'Tax' }, { key: 'rounding', label: 'Rounding' }, { key: 'net', label: 'Net' },
    ]} />
  </CardContent></Card>;
}

function CsvDetail({ code, reports }: { code: 'S102' | 'S104'; reports: ReportSnapshot }) {
  const source = reports[code];
  const parsingNotes = 'parsingNotes' in source ? source.parsingNotes : [];
  const [allColumns, setAllColumns] = useState(false);
  const common = code === 'S102'
    ? ['CategoryName', 'ItemCode', 'ItemDesc', 'Qty', 'ExtendedPrice', 'AmountDiscount', 'Tax', 'ExtendedPriceTax', 'SVCInitAvg', 'ItemGroupName']
    : ['TranTypeName', 'SaleDate', 'SaleNum', 'ItemCode', 'ItemDesc', 'Qty', 'ExtendedPrice', 'Tax', 'ExtendedPriceTax'];
  return <Card className={panel}><CardHeader><CardTitle className="text-sm">{code} · {code === 'S102' ? 'Sales Report' : 'Sales Report By Item'}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <Stats values={[["Rows", String(source.rows.length)], ['Qty (รวมรายการบริการถ้ามี)', exactNumber(source.totals.Qty)], ['ExtendedPrice', exactNumber(source.totals.ExtendedPrice)], ['ExtendedPriceTax', exactNumber(source.totals.ExtendedPriceTax)]]} />
      <p className="text-xs leading-relaxed text-stone-500">{reports.sources.S104.assignment.startsWith('Verified') ? `ข้อมูล Import ที่ Verify แล้ว · ร้าน/สาขา/วันที่ ${reports.brandId} / ${reports.branchId} / ${reports.dateLabel} ยืนยันจากชุดต้นฉบับ · คงตัวเลขรายงานและรวม Service Charge ตามข้อมูลดิบ` : code === 'S102'
        ? reports.brandId === 'lawoi'
          ? 'S102 ชุด LAWOI: TerminalName = LAWOI_CASHIER แต่ไม่มีวันที่ในเนื้อหา กำหนดวันที่ตามชุดรายงาน 01/09/26 · มี Service Charge 5 แถวในหมวด Payment รวมอยู่ในยอดแล้ว ห้ามบวก SVCAvg ซ้ำ'
          : reports.brandId === 'kappo'
          ? 'S102 ชุด KAPPO: 4 แถวสินค้า ครบ 23 คอลัมน์รวม Remark · ไม่มีชื่อร้านหรือวันที่ในเนื้อหา กำหนด KAPPO / 01/09/26 ตามชุดที่ผู้ใช้ระบุ · ExtendedPriceTax จัดสรร Service Charge แล้ว ไม่บวกซ้ำ'
          : 'ไฟล์นี้เป็นยอดรวมระดับสินค้า ไม่มีชื่อร้านหรือวันที่ในเนื้อหา: กำหนด Capricci / 01/09/26 ตามชุดไฟล์ที่ผู้ใช้ระบุ · ExtendedPriceTax มีการจัดสรร Service Charge แล้ว'
        : reports.brandId === 'lawoi'
          ? 'S104 ชุด LAWOI: มี SaleDate เป็น พ.ศ. 2569 แสดงเป็น 01/09/26 บนหน้าเว็บ · รวม Service Charge 5 แถวแล้ว ชื่อร้านยืนยันจากชุดไฟล์ที่ผู้ใช้ระบุ'
          : reports.brandId === 'kappo'
          ? 'S104 ชุด KAPPO: 8 แถวจาก 2 บิล รวม Service Charge 2 แถว · SaleDate พ.ศ. 2569 แสดงเป็น 01/09/26 · ชื่อร้านยืนยันจากชุดไฟล์ที่ผู้ใช้ระบุ ชื่อสินค้าคงตามแต่ละ Report แม้ต่างจาก S102'
          : 'ไฟล์นี้เป็นรายละเอียดระดับบิลและสินค้า มี SaleDate แต่ไม่มีชื่อร้าน · รวม Sales และ Entertain ตามต้นฉบับ และมี Service Charge เป็นรายการแยก'}
        {' '}ยอดของหลาย Report เป็นมุมมองของธุรกรรมเดียวกัน ห้ามนำมาบวกซ้ำ
      </p>
      {parsingNotes.length > 0 && <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <TriangleAlert /><AlertTitle>CSV REVIEW · จัดคอลัมน์ {parsingNotes.length} แถวในสำเนา</AlertTitle>
        <AlertDescription className="text-xs">แถวต้นฉบับ {parsingNotes.map(note => note.sourceLine).join(', ')} มี comma ใน ItemDesc และ EngItemDesc โดยไม่มีเครื่องหมายคำพูด จัดกลับเป็น 15 คอลัมน์และตรวจจำนวน/ราคากับ S114 แล้ว เก็บข้อมูลดิบไว้ตรวจย้อนหลัง โดยไม่แก้ไฟล์ต้นฉบับ
          <details className="mt-2 w-full"><summary className="cursor-pointer font-semibold">ดูแถวต้นฉบับที่จัดคอลัมน์</summary>{parsingNotes.map(note => <p key={note.sourceLine} className="mt-2 break-all">{note.sourceLine}: {note.rawFields.join(',')}</p>)}</details>
        </AlertDescription>
      </Alert>}
      <Button variant="outline" size="sm" aria-pressed={allColumns} onClick={() => setAllColumns(!allColumns)}>{allColumns ? 'คอลัมน์หลัก' : `แสดงครบ ${source.headers.length} คอลัมน์`}</Button>
      <DetailTable key={code} title={`${code} Detail`} rows={source.rows} columns={(allColumns ? source.headers : common).map(key => ({ key, label: key }))} />
    </CardContent>
  </Card>;
}

function CategoryDetail({ reports }: { reports: ReportSnapshot }) {
  const source = reports.S114;
  return <Card className={panel}><CardHeader><CardTitle className="text-sm">S114 · Sales Report By Item Category /w Detail</CardTitle>
    <p className="text-xs text-stone-500">ครบ {source.pages} หน้า · ประเภทธุรกรรมตามต้นฉบับ · ไม่เติม Entertain ถ้าไม่มีรายการ</p>
  </CardHeader><CardContent className="space-y-5">
    <Stats values={[["Qty", exactNumber(source.totals.qty)], ['Price', amount(source.totals.price)], ['Discount', amount(source.totals.discount)], ['Printed Grand Total', amount(source.totals.net)]]} />
    <DetailTable title="Category totals" rows={source.categories} columns={[
      { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty' }, { key: 'price', label: 'Price' },
      { key: 'discount', label: 'Discount' }, { key: 'tax', label: 'Tax' }, { key: 'net', label: 'Net' },
    ]} />
    <DetailTable title="Item detail" rows={source.rows} columns={[
      { key: 'category', label: 'Category' }, { key: 'transaction', label: 'Type' }, { key: 'itemCode', label: 'Item Code' },
      { key: 'itemDesc', label: 'Item Desc' }, { key: 'modifier', label: 'Modifier' }, { key: 'unitPrice', label: 'Unit Price' },
      { key: 'qty', label: 'Qty' }, { key: 'unit', label: 'Unit' }, { key: 'price', label: 'Price' },
      { key: 'discount', label: 'Discount' }, { key: 'tax', label: 'Tax' }, { key: 'net', label: 'Net' }, { key: 'page', label: 'PDF page' },
    ]} />
    <p className="text-xs text-stone-500">ผลรวมแถว Tax {amount(source.rowSums.tax)} / Net {amount(source.rowSums.net)} · ยอดพิมพ์ Tax {amount(source.totals.tax)} / Net {amount(source.totals.net)}</p>
  </CardContent></Card>;
}

function SlipDetail({ reports }: { reports: ReportSnapshot }) {
  const report = reports.S117;
  return <div>
    <Card className={panel}><CardHeader><CardTitle className="text-sm">S117 · Sales Report Slip</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Sales Item</TableHead><TableHead className="text-right">Amount (THB)</TableHead></TableRow></TableHeader>
        <TableBody>{report.items.map(item => <TableRow key={item.label}><TableCell className="text-xs">{item.label}</TableCell><TableCell className={`text-right text-xs font-semibold tabular-nums ${item.label === 'Discount' ? 'text-red-600' : ''}`}>{amount(item.value)}</TableCell></TableRow>)}
          <TableRow className="bg-emerald-50"><TableCell className="font-bold">Total (รวม Entertain)</TableCell><TableCell className="text-right font-bold tabular-nums">{amount(report.grandTotal)}</TableCell></TableRow>
        </TableBody></Table>
    </CardContent></Card>

  </div>;
}



export function SaleDetails({ reports }: { reports: ReportSnapshot }) {
  const report = reports.S117;
  return <div className="grid items-start gap-5 lg:grid-cols-3">
      <Card className={panel}><CardHeader><CardTitle className="text-sm">Payment Detail</CardTitle></CardHeader><CardContent className="space-y-3">
        {report.payments.map(item => <div key={item.label} className="flex justify-between text-sm"><span>{item.label}</span><strong>{amount(item.value)}</strong></div>)}
        <div className="flex justify-between border-t pt-3 text-sm font-bold"><span>Payment Total</span><span>{amount(report.paymentTotal)}</span></div>
        <p className="text-xs text-stone-500">ส่วนต่างจาก Total Sale {amount(Math.round((report.paymentTotal - report.totalSale) * 100) / 100)} บาท</p>
      </CardContent></Card>
      <Card className={`${panel} bg-[#173c30] text-white`}><CardHeader><CardTitle className="text-sm">Slip Operations · S117</CardTitle></CardHeader><CardContent>
        <div className="grid grid-cols-3 gap-2">{[['Guests', report.guests], ['Bills', report.bills], ['Total / Person', report.totalPerPerson]].map(([label, value]) => <div key={label} className="rounded-lg bg-white/10 p-3"><p className="text-[10px] text-white/60">{label}</p><p className="mt-2 text-lg font-bold">{exactNumber(value as number)}</p></div>)}</div>
        <p className="mt-3 text-[11px] text-white/60">Bills ไม่เท่ากับจำนวนโต๊ะ · ใช้ข้อมูลส่วนนี้แสดง Guest · Daily บน Dashboard</p>
      </CardContent></Card>
      <Card className={panel}><CardHeader><CardTitle className="text-sm">ItemGroup Detail</CardTitle></CardHeader><CardContent className="space-y-3">
        {report.categories.map(item => <div key={item.label} className="flex justify-between text-xs"><span>{item.label}</span><strong>{amount(item.value)}</strong></div>)}
        <div className="flex justify-between border-t pt-3 text-sm font-bold"><span>Total</span><span>{amount(report.totalSale)}</span></div>
        <p className="text-xs text-stone-500">Payout {amount(report.payout)} · Cash Drawer {amount(report.cashDrawerTotal)}</p>
      </CardContent></Card>
    </div>;
}

export function ReportCenter({ brandKey, period, code, onCodeChange, dataset }: {
  brandKey: BrandKey; period: Period; code: ReportCode; onCodeChange: (code: ReportCode) => void; dataset?:ReportSnapshot[];
}) {
  const [detailDate,setDetailDate]=useState('');
  const availableDates=dataset?.filter(r=>r.brandId===brandKey && r.businessDate>=period.start && r.businessDate<=period.end).map(r=>r.businessDate).sort()??[];
  const reports = (availableDates.includes(detailDate)?dataset?.find(r=>r.brandId===brandKey && r.businessDate===detailDate):null)??reportsForPeriod(brandKey, period,dataset);
  const available = reports !== null && code in reports.sources;
  const template = reportTemplates.find(item => item.code === code)!;
  const source = available && reports ? reports.sources[code as keyof typeof reports.sources] : null;
  return <section id="reports" className="scroll-mt-28 space-y-5">
    {availableDates.length>1&&<label className="flex items-center gap-3 text-xs">วันที่ใน Report Detail (แสดงทีละวัน ไม่รวมหลายไฟล์)<select aria-label="วันที่ Report Detail" className="rounded border bg-white p-2" value={reports?.businessDate??''} onChange={e=>setDetailDate(e.target.value)}>{availableDates.map(date=><option key={date} value={date}>{formatBusinessDate(date)}</option>)}</select></label>}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#39755a]"><FileText className="size-4" /> Report Center</p><h2 className="mt-1 text-2xl font-bold">Report Detail</h2><p className="mt-1 text-xs text-stone-500">{brandData[brandKey].name} · Period {formatPeriod(period)} · {reports ? `มีรายงานวันที่ ${reports.dateLabel} · 5 รายงาน` : 'ไม่มีรายงานในช่วงนี้'}</p></div>
      <div className="flex flex-wrap gap-1 rounded-xl border bg-white p-1.5">{reportTemplates.map(item => <Button key={item.code} variant={code === item.code ? 'default' : 'ghost'} aria-pressed={code === item.code} onClick={() => onCodeChange(item.code)} className="text-xs">{item.code}<span className={`size-1.5 rounded-full ${reports && item.code in reports.sources ? 'bg-emerald-400' : 'bg-stone-300'}`} /></Button>)}</div>
    </div>
    <Card className={panel}><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div><p className="text-sm font-bold">{template.code} · {template.title}</p><p className="mt-1 break-all text-xs text-stone-500">{source?.fileName ?? 'Template พร้อมใช้ · ยังไม่มีไฟล์ข้อมูล'}</p></div>
      <Badge variant="outline">{available ? 'LOADED · SOURCE SNAPSHOT' : 'NO DATA'}</Badge>
    </CardContent></Card>
    {available && reports ? <>
      <p className="text-xs text-stone-500">ร้านที่ผู้ใช้ระบุ: {brandData[brandKey].name} · ชื่อในรายงาน: {reports.S117.reportStore} · {reports.sources.S104.assignment.startsWith('Verified') ? 'สาขาปลายทางที่ยืนยัน:' : 'สาขาตาม S114/S117:'} {reports.branchId ?? 'ไม่ระบุ'} · Business date: {reports.dateLabel}{'periodStartTime' in reports && ` · ช่วงรายงาน ${reports.periodStartTime}–${reports.periodEndTime}`}</p>
      {!reports.sources.S104.assignment.startsWith('Verified') && reports.brandId === 'lawoi' && <p className="text-xs text-amber-700">ไฟล์ชื่อ _202692 เป็นชุดส่งออก แต่วันที่ธุรกิจในเนื้อหาคือ 01/09/26 (แปลงจาก พ.ศ. ในต้นฉบับ) · CSV S104 มีการจัดคอลัมน์ 2 แถวในสำเนา ดูหมายเหตุในแท็บ S104</p>}
      {!reports.sources.S104.assignment.startsWith('Verified') && reports.brandId === 'kappo' && <p className="text-xs leading-relaxed text-stone-500">ใช้วันที่และช่วงเวลาในรายงาน ไม่ใช้วันที่จากชื่อไฟล์ _202692 · S117 จัดยอด 5,100 บาทเป็น Other และ Beverage 0 บาท จึงคงหมวดตามต้นฉบับ · ช่อง Branch ใน PDF ว่าง แม้ชื่อสถานประกอบการใน A103 มี “สาขา 00001” จึงยังไม่กำหนดรหัสสาขาอัตโนมัติ</p>}
      {code === 'A103' && <TaxDetail key={brandKey} reports={reports} />}
      {(code === 'S102' || code === 'S104') && <CsvDetail key={`${brandKey}-${code}`} code={code} reports={reports} />}
      {code === 'S114' && <CategoryDetail key={brandKey} reports={reports} />}
      {code === 'S117' && <SlipDetail reports={reports} />}
    </> : <Card className={panel}><CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
      <FileText className="size-8 text-stone-300" /><p className="text-xl font-bold tracking-widest text-stone-400">NO DATA</p>
      <p className="text-xs text-stone-500">คง Template {code} ไว้แล้ว · ไม่พบรายงานของ {brandData[brandKey].name} ใน Period {formatPeriod(period)}</p>
    </CardContent></Card>}
  </section>;
}
