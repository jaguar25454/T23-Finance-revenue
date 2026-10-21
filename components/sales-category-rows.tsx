import { Fragment } from 'react';
import type { Category, GuestMetrics } from '@/lib/report-data';

type SalesGuests = Pick<GuestMetrics, 'guests' | 'totalPerPerson'>;
export const unmappedColor = '#b75b93';

function GuestRows({ guest, formatValue }: { guest: SalesGuests; formatValue: (value: number | null) => string }) {
  return <div role="group" aria-label="S117 guest metrics" className="space-y-3">
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-xs" title="จำนวนคนจาก S117 ตามช่วงวันที่ของกล่องนี้">
      <span className="flex min-w-0 items-center gap-2 font-medium text-stone-600">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-[#2a9d8f]" />
        <span>Guests</span>
      </span>
      <strong className="tabular-nums text-stone-900">{formatValue(guest.guests)}</strong>
    </div>
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-xs" title="บาท / คน · ใช้ฐาน Total Sale จาก S117 ไม่ใช่ Gross sales · ดูวิธีคำนวณใน User Guide">
      <span className="flex min-w-0 items-center gap-2 font-medium text-stone-600">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-[#517ca4]" />
        <span>Total / Person</span>
      </span>
      <strong className="tabular-nums text-stone-900">{formatValue(guest.totalPerPerson)}</strong>
    </div>
  </div>;
}

// Display insertion only: guest metrics never enter the category array or pie.
export function SalesCategoryRows({ items, guest, colors, formatValue }: {
  items: Category[] | null; guest: SalesGuests; colors: string[];
  formatValue: (value: number | null) => string;
}) {
  const alcoholIndex = items?.findIndex(item => item.name === 'Beverage - Alcohol') ?? -1;
  // Other restaurants retain their native Food / Beverage / Other grouping.
  const guestIndex = alcoholIndex >= 0 ? alcoholIndex : (items?.length ?? 0) - 1;
  return <div className="space-y-3">
    {items?.length ? items.map((item, index) => <Fragment key={item.name}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 text-xs">
        <span className={`flex min-w-0 items-center gap-2 font-medium ${item.name === 'ยังไม่จัดหมวด' ? 'text-[#934371]' : 'text-stone-600'}`}>
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.name === 'ยังไม่จัดหมวด' ? unmappedColor : colors[index] }} />
          <span>{item.name}</span>
        </span>
        <strong className={`tabular-nums ${item.name === 'ยังไม่จัดหมวด' ? 'text-[#934371]' : 'text-stone-900'}`}>{item.value ? formatValue(item.value) : '—'}</strong>
      </div>
      {index === guestIndex && <GuestRows guest={guest} formatValue={formatValue} />}
    </Fragment>) : <>
      <div className="pt-4 text-center text-xs font-semibold tracking-[0.12em] text-stone-400">NO DATA</div>
      <GuestRows guest={guest} formatValue={formatValue} />
    </>}
  </div>;
}
