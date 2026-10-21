'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { capricciCategorySummary as defaultSummary, capricciFinance, formatBusinessDate } from '@/lib/report-data';

const amount = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reasons: Record<string, string> = { Included: 'รวมยอด', 'Excluded customer': 'ไม่ใช่ลูกค้าตามเงื่อนไข', 'Service Charge': 'แยก Service Charge', Unmapped: 'ต้องตรวจหมวด' };

export function CapricciCategoryDetail({ summary: activeSummary = defaultSummary, changed = false, periodLabel='01/09/26', imported=false }: { summary?: typeof defaultSummary; changed?: boolean; periodLabel?:string; imported?:boolean }) {
  const summary = activeSummary;
  return (
    <Card className="gap-3 border-0 bg-white ring-1 ring-stone-200/80">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-bold">Capricci · วิธีคำนวณตาม {changed ? 'Master Data ที่ใช้อยู่' : 'Finance / Master Data ต้นแบบ'}</CardTitle>
        <p className="text-xs text-stone-500">S104 → ItemCode → Category · {periodLabel}{imported?' · มีข้อมูล Import (รวมตาม ItemCode ไม่ใช่การจัดสรรส่วนลดรายบิล)':''}</p>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <p className="text-sm font-semibold tabular-nums text-[#245b43]">
          {summary.detail.length ? `${amount(summary.extendedPrice)} + ${amount(summary.adjustment)} = ${amount(summary.sales)} บาท` : 'NO DATA · ไม่มีรายงาน Capricci ในเดือนนี้'}
        </p>
        <p className="text-xs leading-relaxed text-stone-600">
          รวม ExtendedPrice + ค่าปรับกลับส่วนลด ({imported?'ชุด Import ใช้ S114 Sales เทียบ S104 ตาม ItemCode; ชุดต้นแบบใช้ Column1 ตาม Excel':'Column1 ตาม Excel'}) เฉพาะ CustomerName “{capricciFinance.customerFilter}” ·
          ไม่รวม VAT, Service Charge {amount(summary.serviceCharge)} บาท และรายการลูกค้ากลุ่มอื่น {amount(summary.excludedCustomerTotal)} บาท (รวม Service Charge ของกลุ่มนั้น)
          · Discount บนการ์ดอ้างอิง S117 แสดงแยก ไม่หักซ้ำจากยอด Gross sales
        </p>
        <p className="text-xs text-stone-500">
          รวม {summary.includedRows} / {summary.detail.length} แถว · รายการขายที่ยังจัดหมวดไม่ได้ {summary.unmapped.length} แถว ·
          ตัวเลขหมวดต่างจาก S117 ได้ เพราะใช้ Category ของ Finance ไม่แก้หมวดในรายงานต้นฉบับ
        </p>
        <Accordion>
          <AccordionItem value="subgroups">
            <AccordionTrigger>ดูยอดหมวดย่อยและการรวมเป็น 4 หมวด</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader><TableRow><TableHead>Daily Report Sub. Group</TableHead><TableHead>Sale by Category</TableHead><TableHead className="text-right">ยอดก่อนส่วนลด (บาท)</TableHead></TableRow></TableHeader>
                <TableBody>{summary.subgroups.map(group => (
                  <TableRow key={group.name}><TableCell>{group.name}</TableCell><TableCell>{group.category}</TableCell><TableCell className="text-right tabular-nums">{amount(group.value)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="rows">
            <AccordionTrigger>ตรวจรายการ S104 และตำแหน่งในชีต Category</AccordionTrigger>
            <AccordionContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader><TableRow>{['วันที่ / S104 แถว', 'ItemCode / รายการ', 'Category แถว / หมวดย่อย', 'หมวดหลัก', 'ExtendedPrice', 'Adjustment', 'Gross sales', 'การนำมาคำนวณ'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{summary.detail.map(row => (
                    <TableRow key={`${row.businessDate}-${row.sourceRow}`}>
                      <TableCell><span className="block tabular-nums">{formatBusinessDate(row.businessDate)}</span><span className="text-xs text-stone-500">แถว {row.sourceRow}</span></TableCell>
                      <TableCell><span className="block font-medium">{row.itemCode}</span><span className="block max-w-64 whitespace-normal text-xs text-stone-500">{row.itemDesc}</span></TableCell>
                      <TableCell>{row.mappingRow ?? '—'} · {row.subgroup ?? 'ไม่พบหมวด'}</TableCell>
                      <TableCell>{row.category ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount(row.extendedPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount(row.adjustment)}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount(row.value)}</TableCell>
                      <TableCell>{reasons[row.reason]}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="break-words text-[11px] leading-relaxed text-stone-500">
          ต้นแบบ: {capricciFinance.source.filename} · S104!L:P:Q, Category!F:K และ O:Q; {changed ? 'หมวดที่แสดงใช้ Master Data ที่แก้ไข จึงอาจต่างจาก Excel ต้นแบบ' : 'ตรวจตรงกับ DashBord!E3:E6 / J3:J6'}
          · รหัสซ้ำใช้แถวแรกตาม VLOOKUP; พบหมวดขัดกัน {capricciFinance.duplicateConflicts.length} รหัสในตารางต้นแบบ แต่ไม่มีรายการขายรหัสเหล่านี้ในวันที่ 01/09/26
          · ชื่อหมวดปรับเฉพาะช่องว่างให้สม่ำเสมอ ไม่เดาหมวดจากชื่อสินค้า
        </p>
      </CardContent>
    </Card>
  );
}
