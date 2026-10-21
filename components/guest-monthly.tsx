'use client';

import { UsersRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatPeriod, type guestCheckInForMonth } from '@/lib/report-data';

const config = { guests: { label: 'Customer check-in (Person)', color: '#ef7d32' }, bills: { label: 'Bills (not tables)', color: '#4475c4' } } satisfies ChartConfig;
const count = (value: number | null) => value === null ? 'NO DATA' : value.toLocaleString('en-US');

export function GuestMonthly({ summary, source='S117' }: { summary: ReturnType<typeof guestCheckInForMonth>; source?:'S117'|'FoodStory' }) {
  const chart = summary.guests !== null || summary.bills !== null ? [{ month: `${summary.period.start.slice(5,7)}/${summary.period.start.slice(2,4)}`, guests: summary.guests, bills: summary.bills }] : [];
  return <Card className="gap-0 overflow-hidden border-0 py-0 ring-1 ring-stone-200/80">
    <CardHeader className="border-b border-amber-200 bg-[#fff1a8] px-5 py-4"><CardTitle className="flex items-center gap-2 text-sm font-bold text-[#413718]"><UsersRound className="size-4" />Guest Check-In (Monthly)</CardTitle><p className="text-xs text-stone-600">{formatPeriod(summary.period)} · {source} · มีรายงาน {summary.daysWithData} / {summary.selectedDays} วัน</p></CardHeader>
    <CardContent className="space-y-4 px-5 py-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <dl className="space-y-3">
          {[
            ['No. of Table check-in', summary.tables, source==='FoodStory'?'นับบิลแยกจากหมายเลขโต๊ะ ไม่รวมหมายเลขโต๊ะเป็นจำนวนโต๊ะ':'ไม่มีจำนวนโต๊ะจริงใน S117'],
            ['No. of Customer check-in', summary.guests, `Guests · ${summary.guestDays} / ${summary.daysWithData} วันที่มีค่าจำนวนคน`],
            ['No. of Bills', summary.bills, `Bills · ${summary.billDays} / ${summary.daysWithData} วันที่มีค่าจำนวนบิล`],
            ['% Occupancy Rate', summary.occupancy, 'ยังไม่มีความจุและจำนวนรอบให้บริการ'],
          ].map(([label,value,note]) => <div key={String(label)} className="border-b border-stone-100 pb-2 last:border-0"><dt className="text-xs font-semibold text-stone-600">{label}</dt><dd className="mt-1 flex flex-wrap items-end justify-between gap-2"><span className="max-w-[65%] text-[10px] text-stone-400">{note}</span><strong className={`text-right text-base tabular-nums ${value === null ? 'text-stone-400' : 'text-[#4475c4]'}`}>{count(value as number | null)}</strong></dd></div>)}
        </dl>
        <div className="min-w-0">
          {chart.length ? <ChartContainer config={config} className="h-[210px] w-full"><BarChart data={chart} margin={{top:12,right:8,left:-12,bottom:0}}><CartesianGrid vertical={false} stroke="#ecefe9" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="guests" fill="var(--color-guests)" maxBarSize={48} radius={[3,3,0,0]} /><Bar dataKey="bills" fill="var(--color-bills)" maxBarSize={48} radius={[3,3,0,0]} /></BarChart></ChartContainer> : <div className="flex min-h-[210px] items-center justify-center rounded-lg border border-dashed text-sm font-bold text-stone-400">NO DATA</div>}
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-stone-500"><span className="flex items-center gap-1"><i className="size-2 bg-[#ef7d32]" />Customer check-in · Person</span><span className="flex items-center gap-1"><i className="size-2 bg-[#4475c4]" />Bills · ไม่ใช่โต๊ะ</span></div>
        </div>
      </div>
      <p className="border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">{source==='FoodStory'?'ใช้ Guests และเลขบิลไม่ซ้ำจาก FoodStory รวมทุกวันที่มีรายงานในเดือนของวันสิ้นสุด · ไม่ใช้ยอดเก่าหรือตัวหาร Occupancy 6 × 17 ของเดือนสิงหาคมแทนเดือนที่เลือก':'อ้างอิงโครงกล่องจาก Template แต่ใช้ยอด Guests / Bills ใน S117 ตามที่ยืนยัน · รวมทุกวันที่มีรายงานในเดือนของวันสิ้นสุดที่เลือก · Import วันเดิมแทนชุดเดิม ไม่บวกซ้ำ · ไม่ใช้จำนวนคน 40 หรือความจุ 60 จาก Excel แทนข้อมูลในรายงาน และไม่แยกคน Sales / Entertain โดยไม่มีข้อมูลรองรับ'}</p>
      {summary.daysWithData > 0 && (summary.guestDays < summary.daysWithData || summary.billDays < summary.daysWithData) && <p className="text-xs text-amber-700">บางรายงานไม่มีค่าจำนวนคนหรือบิล ยอดรวมของตัวชี้วัดนั้นจึงแสดง NO DATA แทนยอดที่ไม่ครบ</p>}
    </CardContent>
  </Card>;
}
