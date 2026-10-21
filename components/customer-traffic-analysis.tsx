'use client';

import {Award,CalendarDays,Users} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {brandData,formatBusinessDate,type BrandKey} from '@/lib/report-data';
import {customerWeekLabel,type CustomerAnalytics} from '@/lib/customer-analytics';

const number=(value:number|null)=>value===null?'NO DATA':value.toLocaleString('en-US');
const dateWithDay=(date:string)=>`${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'})} · ${formatBusinessDate(date)}`;

export function CustomerTrafficAnalysis({brand,analytics}:{brand:BrandKey;analytics:CustomerAnalytics}){
  return <section aria-label="Customer traffic analysis">
    <Card className="border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80">
      <CardHeader className="border-b border-stone-100 px-5 pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-[#39755a]"/>Weekday Ranking</CardTitle><p className="mt-1 text-xs text-stone-500">Customer traffic · {brandData[brand].name} · {customerWeekLabel(analytics.period)}</p></div><Badge variant="outline" className="border-emerald-200 text-emerald-700">CALENDAR MONTH</Badge></div></CardHeader>
      <CardContent className="px-5">
        <Tabs defaultValue="summary">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-stone-100 p-1">
            <TabsTrigger value="summary" className="min-h-9 flex-none px-4">Summary</TabsTrigger>
            {analytics.weeks.map(week=><TabsTrigger key={week.label} value={week.label} className="min-h-9 flex-none px-4">{week.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="summary" className="pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-[#173c30] p-5 text-white"><div className="flex items-center gap-2 text-white/60"><Award className="size-4"/><p className="text-xs font-semibold uppercase tracking-[0.12em]">Busiest Week</p></div><p className="mt-3 text-2xl font-bold">{analytics.topWeeks.length?analytics.topWeeks.join(' / '):'NO DATA'}</p><p className="mt-1 text-sm text-white/65">{analytics.topWeeks.length?analytics.weeks.filter(week=>analytics.topWeeks.includes(week.label)).map(week=>customerWeekLabel(week.period)).join(' / '):'ยังไม่มี Report ในเดือนนี้'}</p><p className="mt-4 text-2xl font-bold tabular-nums text-[#9ddd70]">{number(analytics.topWeekGuests)} <span className="text-sm font-medium text-white/60">Guests</span></p></div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5"><div className="flex items-center gap-2 text-[#39755a]"><Users className="size-4"/><p className="text-xs font-semibold uppercase tracking-[0.12em]">Most Customers · Date</p></div><p className="mt-3 text-2xl font-bold text-stone-800">{analytics.topDates.length?analytics.topDates.map(dateWithDay).join(' / '):'NO DATA'}</p><p className="mt-4 text-2xl font-bold tabular-nums text-[#39755a]">{number(analytics.topDateGuests)} <span className="text-sm font-medium text-stone-500">Guests</span></p></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{analytics.weeks.map(week=><div key={week.label} className={`rounded-xl border p-4 ${analytics.topWeeks.includes(week.label)?'border-amber-300 bg-amber-50/60':'border-stone-200 bg-stone-50/70'}`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-stone-800">{week.label}</p>{analytics.topWeeks.includes(week.label)&&<Badge className="bg-amber-400 text-white">TOP</Badge>}</div><p className="mt-1 text-xs text-stone-500">{customerWeekLabel(week.period)}</p><p className={`mt-3 text-xl font-bold tabular-nums ${week.guests===null?'text-stone-400':'text-[#245b43]'}`}>{number(week.guests)}</p><p className="mt-1 text-xs text-stone-500">{week.reportDays?`${week.reportDays} report day${week.reportDays>1?'s':''}`:'NO REPORT'}</p></div>)}</div>
          </TabsContent>
          {analytics.weeks.map(week=><TabsContent key={week.label} value={week.label} className="pt-4"><div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-stone-50 p-4"><div><p className="text-sm font-bold text-stone-800">{week.label} · {customerWeekLabel(week.period)}</p><p className="mt-1 text-xs text-stone-500">วันที่ลูกค้ามาทานมากที่สุด · {week.topDates.length?week.topDates.map(dateWithDay).join(' / '):'NO DATA'}</p></div><p className={`text-xl font-bold tabular-nums ${week.topGuests===null?'text-stone-400':'text-[#39755a]'}`}>{number(week.topGuests)} <span className="text-xs font-medium text-stone-500">Guests</span></p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{week.days.map(day=><div key={day.date} className={`rounded-xl border p-4 ${week.topDates.includes(day.date)?'border-amber-300 bg-amber-50/70 ring-1 ring-amber-200':'border-stone-200 bg-white'}`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-stone-800">{day.name}</p>{week.topDates.includes(day.date)&&<Award className="size-4 text-amber-500"/>}</div><p className="mt-1 text-xs tabular-nums text-stone-500">{formatBusinessDate(day.date)}</p><p className={`mt-4 text-lg font-bold tabular-nums ${day.guests===null?'text-stone-400':'text-[#245b43]'}`}>{number(day.guests)}</p><p className="mt-1 text-xs text-stone-400">{day.guests===null?'NO REPORT':'Guests'}</p></div>)}</div></TabsContent>)}
        </Tabs>
        <p className="mt-4 text-xs leading-relaxed text-stone-500">แต่ละ Week แบ่งตามปฏิทิน Monday–Sunday และตัดช่วงให้ตรงกับเดือนที่เลือก · วันที่ไม่มี Report แสดง NO DATA และไม่นับเป็น 0</p>
      </CardContent>
    </Card>
  </section>;
}
