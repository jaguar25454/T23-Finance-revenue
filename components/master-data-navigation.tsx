'use client';

import { Button } from '@/components/ui/button';
import { brandData, type BrandKey } from '@/lib/report-data';

const restaurants: BrandKey[] = ['capricci', 'kappo', 'lawoi', 'saryu', 'maison'];

export function MasterDataNavigation({ brand, onBrandChange }: { brand: BrandKey; onBrandChange: (brand: BrandKey) => void }) {
  return <section className="space-y-3" aria-label="Master Data restaurant pages">
    <div><h2 className="text-xl font-bold text-stone-800">Master Data</h2><p className="mt-1 text-xs text-stone-500">เลือกหน้าร้านเพื่อจัดการข้อมูลแยกกัน · ไม่ใช้ Type / Sub Type / Category ร่วมกันระหว่างร้าน</p></div>
    <nav aria-label="Master Data restaurants" className="grid gap-3 sm:grid-cols-5">
      {restaurants.map(key => <Button key={key} variant="outline" aria-current={brand === key ? 'page' : undefined} onClick={() => onBrandChange(key)} className={`h-auto min-h-16 justify-start gap-3 rounded-xl px-4 py-3 ${brand === key ? 'border-[#39755a] bg-[#e5eee8] text-[#173c30] ring-1 ring-[#39755a]' : 'border-stone-200 bg-white text-stone-600'}`}>
        <img src={brandData[key].logo} alt="" className="h-9 w-16 rounded bg-white object-contain p-1" />
        <span className="text-sm font-bold">{brandData[key].name}</span>
      </Button>)}
    </nav>
  </section>;
}
