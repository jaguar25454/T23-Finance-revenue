'use client';

import { useState } from 'react';
import { th } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateInput } from '@/components/date-input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { bangkokBusinessDate, formatBusinessDate, isBusinessDate, MIN_DATE, MAX_DATE } from '@/lib/report-data';

const civil = (iso: string) => new Date(`${iso}T12:00:00`);
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function BusinessDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => civil(isBusinessDate(value) ? value : bangkokBusinessDate()));
  return <div className="space-y-2">
    <div className="flex items-center gap-1">
      <DateInput label="Import Business Date" value={value} onChange={onChange} className="min-w-0 flex-1" />
      <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { setDraft(value); setMonth(civil(isBusinessDate(value) ? value : bangkokBusinessDate())); } }}>
        <PopoverTrigger aria-label="Choose Business Date" render={<Button variant="outline" size="icon" type="button" />}><CalendarDays className="size-4" /></PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[95vw]">
          <PopoverTitle>Business Date · DD/MM/YY</PopoverTitle>
          <Calendar mode="single" locale={th} weekStartsOn={0} fixedWeeks showOutsideDays captionLayout="dropdown"
            month={month} onMonthChange={setMonth} startMonth={civil(MIN_DATE)} endMonth={civil(MAX_DATE)}
            disabled={[{ before: civil(MIN_DATE) }, { after: civil(MAX_DATE) }]}
            selected={isBusinessDate(draft) ? civil(draft) : undefined}
            onSelect={date => setDraft(date ? isoDate(date) : '')}
            formatters={{ formatMonthDropdown: date => new Intl.DateTimeFormat('th-TH-u-ca-gregory', { month: 'long' }).format(date), formatYearDropdown: date => String(date.getFullYear()) }}
            labels={{ labelDayButton: date => formatBusinessDate(isoDate(date)), labelNext: () => 'เดือนถัดไป', labelPrevious: () => 'เดือนก่อนหน้า', labelMonthDropdown: () => 'เลือกเดือน', labelYearDropdown: () => 'เลือกปี ค.ศ.' }} />
          <p className="text-xs text-stone-500" role="status">{isBusinessDate(draft) ? formatBusinessDate(draft) : 'เลือกวันที่ธุรกิจ 1 วัน'} · เลือกได้แม้ยังไม่มีรายงาน</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!isBusinessDate(draft)} onClick={() => { if (isBusinessDate(draft)) { onChange(draft); setOpen(false); } }}>Apply</Button></div>
        </PopoverContent>
      </Popover>
    </div>
    <span className="block text-xs font-normal text-stone-500">เลือกจากปฏิทินหรือกรอก DD/MM/YY · 1 วันต่อชุด Import</span>
  </div>;
}
