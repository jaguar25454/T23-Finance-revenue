'use client';

import { useState } from 'react';
import { Database, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Reconciliation, SaleDetails } from '@/components/report-center';
import { brandData, formatBusinessDate, formatPeriod, reportsForPeriod, type BrandKey, type Period, type ReportSnapshot } from '@/lib/report-data';

export function ReportDetailsPage({ view, brandKey, period, dataset }: {
  view: 'sale' | 'reconciliation'; brandKey: BrandKey; period: Period; dataset: ReportSnapshot[];
}) {
  const [date, setDate] = useState('');
  const dates = [...new Set(dataset.filter(r => r.brandId === brandKey && r.businessDate >= period.start && r.businessDate <= period.end).map(r => r.businessDate))].sort();
  const report = (dates.includes(date) ? dataset.find(r => r.brandId === brandKey && r.businessDate === date) : null) ?? reportsForPeriod(brandKey, period, dataset);
  const sale = view === 'sale', Icon = sale ? ShoppingBag : Database;
  return <section aria-label={sale ? 'Sale' : 'Report Reconciliation'} className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Icon className="size-6 text-[#39755a]" />{sale ? 'Sale' : 'Master Data · Report Reconciliation'}</h2>
        <p className="mt-1 text-xs text-stone-500">{brandData[brandKey].name} · ช่วง {formatPeriod(period)} · แสดงรายละเอียดรายวัน ไม่บวกยอดข้ามรายงาน</p></div>
      {dates.length > 0 && <label className="space-y-1 text-xs font-semibold">Report Date<select aria-label={sale ? 'Sale Report Date' : 'Reconciliation Report Date'} className="block rounded-lg border bg-white p-2" value={report?.businessDate ?? ''} onChange={e => setDate(e.target.value)}>{dates.map(value => <option key={value} value={value}>{formatBusinessDate(value)}</option>)}</select></label>}
    </div>
    {report ? <>
      <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600">รายงานวันที่ <strong>{formatBusinessDate(report.businessDate)}</strong> · {sale ? report.sources.S117.fileName : 'A103 / S102 / S104 / S114 / S117'} · {dates.length} วันที่มีรายงานในช่วงนี้</p>
      {sale ? <SaleDetails reports={report} /> : <Reconciliation reports={report} />}
    </> : <Card><CardContent className="py-12 text-center"><p className="font-bold tracking-widest text-stone-500">NO DATA</p><p className="mt-2 text-xs text-stone-500">ไม่มีรายงานของร้านนี้ในช่วงที่เลือก คงข้อมูลของร้านและช่วงอื่นไว้</p></CardContent></Card>}
    {!sale && brandKey !== 'capricci' && <p className="text-xs text-stone-500">หน้านี้ใช้ตรวจยอดรายงานของ {brandData[brandKey].name} · ยังไม่มี Master จัดหมวด ItemCode ของร้านนี้ และไม่ใช้หมวด Capricci แทน</p>}
  </section>;
}
