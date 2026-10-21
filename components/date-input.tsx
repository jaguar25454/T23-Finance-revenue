'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatBusinessDate, isBusinessDate, parseDisplayDate } from '@/lib/report-data';

/** Native date inputs cannot guarantee the required DD/MM/YY format. */
export function DateInput({ value, onChange, label, className = '' }: {
  value: string; onChange: (iso: string) => void; label: string; className?: string;
}) {
  const [text, setText] = useState(isBusinessDate(value) ? formatBusinessDate(value) : '');
  const emitted = useRef(value);
  const reference = useRef(isBusinessDate(value) ? value : '2000-01-01');
  useEffect(() => {
    if (isBusinessDate(value)) reference.current = value;
    if (value !== emitted.current) {
      setText(isBusinessDate(value) ? formatBusinessDate(value) : '');
      emitted.current = value;
    }
  }, [value]);
  const invalid = !!text && !parseDisplayDate(text, reference.current);
  return <span className={`relative block ${className}`}>
    <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 z-10 size-3.5 -translate-y-1/2 text-[#27446a]" />
    <Input type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/YY" maxLength={10}
      aria-label={`${label} DD/MM/YY`} aria-invalid={invalid}
      title={`DD/MM/YY · ปี ค.ศ. ${reference.current.slice(0, 2)}00–${reference.current.slice(0, 2)}99 (พิมพ์ปี 4 หลักได้เมื่อต้องการเปลี่ยนศตวรรษ)`}
      className="h-8 rounded-none bg-white pl-7 text-xs tabular-nums text-[#27446a] focus-visible:border-[#5b7dbb] focus-visible:ring-1 focus-visible:ring-[#5b7dbb]"
      value={text} onChange={event => {
        const next = event.target.value;
        setText(next);
        const iso = parseDisplayDate(next, reference.current) ?? '';
        emitted.current = iso;
        onChange(iso);
      }} onBlur={() => {
        const iso = parseDisplayDate(text, reference.current);
        if (iso) setText(formatBusinessDate(iso));
      }} />
  </span>;
}
