'use client';

import { useState } from 'react';
import { th } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateInput } from '@/components/date-input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { bangkokBusinessDate, datePresetPeriod, formatBusinessDate, formatPeriod, isBusinessDate, isValidPeriod, MAX_DATE, MIN_DATE, periodDays, periodFromCalendar, shiftPeriod, type DatePreset, type Period } from '@/lib/report-data';

// Calendar uses local civil dates, not UTC instants (avoids a one-day timezone shift).
const calendarDate = (iso: string) => new Date(`${iso}T12:00:00`);
const fromCalendar = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const presets: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'วันนี้' }, { key: 'yesterday', label: 'เมื่อวานนี้' },
  { key: 'last7', label: '7 วันล่าสุด' }, { key: 'last30', label: '30 วันล่าสุด' },
  { key: 'thisMonth', label: 'เดือนนี้' }, { key: 'lastMonth', label: 'เดือนที่แล้ว' },
];

export function HeaderDatePicker({ period, onChange, latest, daysWithData }: {
  period: Period; onChange: (period: Period) => void; latest: Period; daysWithData: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Period>(period);
  const [preset, setPreset] = useState<DatePreset | 'custom'>('custom');
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [month, setMonth] = useState(calendarDate(period.start));
  const [today, setToday] = useState(() => bangkokBusinessDate());
  const previous = shiftPeriod(period, -1), next = shiftPeriod(period, 1);
  const valid = isValidPeriod(draft);
  function editDate(key: 'start' | 'end', value: string) {
    setPreset('custom'); setRangeStart(null);
    setDraft(current => ({ ...current, [key]: value, mode: 'custom' }));
    if (isBusinessDate(value)) setMonth(calendarDate(value));
  }
  return <div role="group" aria-label="เลือกวันที่รายงาน DD/MM/YY" className="flex h-10 shrink-0 items-center rounded-lg border border-stone-200 bg-white px-1 shadow-sm">
    <Button variant="ghost" size="icon-sm" aria-label="ช่วงก่อนหน้า" title="ช่วงก่อนหน้า" disabled={!previous} onClick={() => previous && onChange(previous)}><ChevronLeft /></Button>
    <Popover open={open} onOpenChange={value => {
      setOpen(value);
      if (value) { setDraft(period); setPreset('custom'); setRangeStart(null); setMonth(calendarDate(period.start)); setToday(bangkokBusinessDate()); }
    }}>
      <PopoverTrigger id="header-date-picker" render={<Button variant="ghost" className="h-8 gap-3 px-2 text-xs font-normal text-[#27446a]" />} aria-label="เลือกวันที่หรือช่วงวันที่ DD/MM/YY แม้ไม่มีข้อมูล">
        <CalendarDays className="size-4" /><span className="tabular-nums">{formatBusinessDate(period.start)} - {formatBusinessDate(period.end)}</span>
      </PopoverTrigger>
      <PopoverContent className="reference-date-picker max-h-[calc(100dvh-90px)] w-[670px] max-w-[95vw] gap-0 overflow-y-auto rounded-sm p-2" align="end" sideOffset={5}>
        <PopoverTitle className="sr-only">เลือกวันที่ · DD/MM/YY</PopoverTitle>
        <div className="date-picker-layout">
          <div className="min-w-0">
            <div className="mb-2 grid grid-cols-2 gap-3">
              <DateInput label="วันที่เริ่มต้น" value={draft.start} onChange={value => editDate('start', value)} />
              <DateInput label="วันที่สิ้นสุด" value={draft.end} onChange={value => editDate('end', value)} />
            </div>
            <Calendar mode="range" locale={th} weekStartsOn={0} fixedWeeks showOutsideDays
              month={month} onMonthChange={setMonth} numberOfMonths={2} captionLayout="dropdown"
              today={calendarDate(today)} startMonth={calendarDate(MIN_DATE)} endMonth={calendarDate(MAX_DATE)}
              // Data availability never disables calendar days.
              disabled={[{ before: calendarDate(MIN_DATE) }, { after: calendarDate(MAX_DATE) }]}
              selected={isBusinessDate(draft.start) ? { from: calendarDate(draft.start), to: isBusinessDate(draft.end) && draft.end >= draft.start ? calendarDate(draft.end) : undefined } : undefined}
              onSelect={(_range, date, modifiers) => {
                if (modifiers.disabled) return;
                const clicked = fromCalendar(date);
                setPreset('custom');
                if (rangeStart) {
                  setDraft(periodFromCalendar(clicked < rangeStart ? clicked : rangeStart, clicked < rangeStart ? rangeStart : clicked));
                  setRangeStart(null);
                } else { setDraft(periodFromCalendar(clicked)); setRangeStart(clicked); }
              }}
              formatters={{
                formatMonthDropdown: date => new Intl.DateTimeFormat('th-TH-u-ca-gregory', { month: 'long' }).format(date),
                formatYearDropdown: date => String(date.getFullYear()),
                formatWeekdayName: date => ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][date.getDay()],
              }}
              labels={{ labelDayButton: date => formatBusinessDate(fromCalendar(date)), labelNext: () => 'เดือนถัดไป', labelPrevious: () => 'เดือนก่อนหน้า', labelMonthDropdown: () => 'เลือกเดือน', labelYearDropdown: () => 'เลือกปี ค.ศ.' }}
              className="w-full p-0 [--cell-size:30px]"
              classNames={{ months: 'relative flex flex-row gap-3', month: 'flex min-w-0 flex-1 flex-col gap-1', month_grid: 'w-full border-collapse', month_caption: 'flex h-8 items-center justify-center px-7', dropdowns: 'flex items-center justify-center gap-1 text-xs font-semibold', dropdown_root: 'relative rounded-sm focus-within:ring-1', caption_label: 'flex items-center text-xs font-semibold [&>svg]:hidden', weekday: 'flex-1 text-center text-xs font-semibold text-stone-800', week: 'flex w-full', day: 'group/day relative aspect-square w-full p-0 text-center', button_previous: 'date-calendar-nav left-0', button_next: 'date-calendar-nav right-0' }} />
          </div>
          <aside aria-label="ช่วงวันที่ลัด" className="flex flex-col gap-1.5">
            {presets.map(item => <button key={item.key} type="button" className="date-preset" aria-pressed={preset === item.key} onClick={() => {
              const value = datePresetPeriod(item.key, today);
              setDraft(value); setPreset(item.key); setRangeStart(null); setMonth(calendarDate(value.start));
            }}>{item.label}</button>)}
            <button type="button" className="date-preset" aria-pressed={preset === 'custom'} onClick={() => { setPreset('custom'); setDraft(current => ({ ...current, mode: 'custom' })); setRangeStart(null); }}>ปรับแต่งเอง</button>
            <div className="mt-0.5 flex gap-1">
              <Button size="sm" className="h-8 rounded-sm bg-[#5aa565] px-3 text-xs text-white hover:bg-[#4b9155]" disabled={!valid} onClick={() => { onChange(draft); setOpen(false); }}>เลือก</Button>
              <Button size="sm" variant="outline" className="h-8 rounded-sm bg-[#f5f5f5] px-3 text-xs text-[#27446a]" onClick={() => setOpen(false)}>ยกเลิก</Button>
            </div>
          </aside>
        </div>
        <div className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-[11px] leading-relaxed text-stone-500">
          <p role="status" className={valid ? '' : 'text-red-600'}>{valid ? `${formatPeriod(draft)} · ${periodDays(draft)} วัน · คลิก 1 วันเพื่อเลือกวันเดียว หรือคลิกอีกวันเพื่อเลือกช่วง` : 'กรอก DD/MM/YY ให้ครบและถูกต้อง โดยวันเริ่มต้นต้องไม่เกินวันสิ้นสุด'}</p>
          <p>เลือกได้แม้ไม่มีรายงาน ระบบจะแสดง NO DATA · ช่วงที่กำลังแสดงมีข้อมูล {daysWithData} / {periodDays(period)} วัน</p>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span>{period.mode === 'month' ? 'ลูกศรด้านบนเลื่อนทีละเดือน' : `ลูกศรด้านบนเลื่อนทีละ ${periodDays(period)} วัน`} · Daily ใช้วันสิ้นสุด</span>
            <button type="button" className="text-[#567dbf] underline underline-offset-2" onClick={() => { setDraft(latest); setPreset('custom'); setRangeStart(null); setMonth(calendarDate(latest.start)); }}>วันที่มีข้อมูลล่าสุด · {formatBusinessDate(latest.start)}</button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    <Button variant="ghost" size="icon-sm" aria-label="ช่วงถัดไป" title="ช่วงถัดไป" disabled={!next} onClick={() => next && onChange(next)}><ChevronRight /></Button>
  </div>;
}
