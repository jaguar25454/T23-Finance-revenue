'use client';

import { SaryuGuide } from '@/components/saryu-workspace';
import { MaisonGuide } from '@/components/maison-workspace';
import { BookOpen, LayoutDashboard, Upload, Calculator, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CapricciCategoryDetail } from '@/components/capricci-category-detail';
import { brandData, formatPeriod, type BrandKey, type Period, type capricciCategorySummary } from '@/lib/report-data';

const brands: BrandKey[] = ['capricci', 'lawoi', 'saryu', 'maison'];

export function UserGuide({ brand, onBrandChange, onDashboard, onImport, monthlyPeriod, selectedPeriod, monthlyDaysWithData, monthlySelectedDays, daysWithData, selectedDays, financeSummary, masterChanged, imported }: {
  brand: BrandKey; onBrandChange: (brand: BrandKey) => void; onDashboard: () => void; onImport: () => void;
  monthlyPeriod: Period; financeSummary: typeof capricciCategorySummary; masterChanged: boolean; imported: boolean;
  selectedPeriod: Period; monthlyDaysWithData: number; monthlySelectedDays: number; daysWithData: number; selectedDays: number;
}) {
  return <section aria-label="User Guide" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#39755a]"><BookOpen className="size-4" /> User Guide</p><h2 className="mt-1 text-2xl font-bold">คู่มือการใช้งาน</h2><p className="mt-1 text-xs text-stone-500">เลือกแท็บร้านเพื่อดูขั้นตอน Import และวิธีคำนวณ · การเปลี่ยนแท็บไม่ลบข้อมูลหรือแบบร่าง</p></div>
      <Button variant="outline" onClick={onDashboard}><LayoutDashboard className="size-4" /> Dashboard</Button>
    </div>
    <Alert className="border-stone-200 bg-white text-stone-700">
      <TriangleAlert className="size-4" />
      <AlertTitle>{brandData[brand].name} · Monthly {formatPeriod(monthlyPeriod)} · {monthlyDaysWithData} / {monthlySelectedDays} วัน</AlertTitle>
      <AlertDescription className="text-xs">
        Sale (Monthly) สะสมทุกวันที่มีรายงานในเดือนของวันสิ้นสุดที่เลือก และอัปเดตเมื่อ Import · Sales (Daily) รวมยอดตามช่วงวันที่เลือก {formatPeriod(selectedPeriod)} พร้อม Sale by Category และ Discount ซึ่งมีข้อมูล {daysWithData} / {selectedDays} วัน · ไม่มีรายงานในช่วงแสดง NO DATA และไม่เติมวันที่ขาด · กราฟ / Report Detail / Entertain · Period ใช้ช่วงเดียวกัน · Guest · Daily และ Entertain · Daily ยังคงใช้เฉพาะวันสิ้นสุดช่วง
      </AlertDescription>
    </Alert>
    <Tabs value={brand} onValueChange={value => { if (brands.includes(value as BrandKey)) onBrandChange(value as BrandKey); }} className="gap-5">
      <TabsList aria-label="Restaurant User Guides" className="grid h-auto w-full grid-cols-4 gap-2 rounded-xl bg-stone-200/60 p-1.5">
        {brands.map(key => <TabsTrigger key={key} value={key} className="min-h-12 gap-3 rounded-lg px-3 py-2 text-xs data-active:bg-white data-active:text-[#173c30] sm:text-sm"><img src={brandData[key].logo} alt="" className="h-7 w-12 rounded bg-white object-contain max-sm:hidden" />{brandData[key].name}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="saryu"><SaryuGuide/></TabsContent>
      <TabsContent value="maison"><MaisonGuide/></TabsContent>
      {brands.filter(key=>key!=='saryu'&&key!=='maison').map(key => <TabsContent key={key} value={key} className="space-y-5">
        <Card className="border-0 ring-1 ring-stone-200/80">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Upload className="size-4 text-[#39755a]" /> Import · {brandData[key].name}</CardTitle><p className="text-xs text-stone-500">ชื่อรายงานทั้ง 3 ร้านเหมือนกัน ต้องเลือกปลายทางให้ถูกต้องทุกครั้ง</p></CardHeader>
          <CardContent className="space-y-4 text-sm text-stone-600">
            <ol className="list-decimal space-y-2 pl-5">
              <li>กด Import File แล้วเลือก Restaurant เป็น <strong>{brandData[key].name}</strong> ระบุ Branch Code และ Business Date เป็น DD/MM/YY</li>
              <li>เลือก A103 / S102 / S104 / S114 / S117 อย่างละ 1 ไฟล์ รวม 5 รายงานของวันเดียวกัน</li>
              <li>กด Verify Reports เพื่อตรวจโครงสร้าง ร้าน วันที่ และยอดเปรียบเทียบ หากไม่ผ่านจะยังไม่เปลี่ยน Dashboard</li>
              <li>กด Save Backup ตรวจว่าไฟล์สำรองอยู่ในเครื่อง แล้วติ๊กยืนยันปลายทางและข้อควรตรวจ</li>
              <li>กด Confirm Import เพื่ออัปเดต Dashboard และสะสมยอด Monthly ของเดือนนั้นทันที</li>
            </ol>
            <p className="rounded-lg bg-stone-50 p-3 text-xs leading-relaxed">Business Date เลือกจากปฏิทินหรือกรอก DD/MM/YY ได้ 1 วันต่อชุด จากนั้นกด Choose File · A103 / S114 / S117 ใช้ PDF ที่คัดลอกข้อความได้ · S102 / S104 ใช้ CSV หรือ Excel .xlsx / .xls แบบ BIFF ตามโครงสร้าง Easy Restaurant · ไม่รับ PDF สแกน หรือไฟล์ Category แทนรายงานขาย · Report ผิดประเภท ไฟล์ซ้ำ ไม่ครบ หรือข้อมูลไม่ตรงจะแจ้งที่ Verify และยัง Import ไม่ได้</p>
            <Button size="sm" variant="outline" onClick={onImport}>Import File</Button>
          </CardContent>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="border-0 ring-1 ring-stone-200/80"><CardHeader><CardTitle className="text-sm">Sale (Monthly) / Sales (Daily)</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-relaxed text-stone-600">
            <p><strong>Sale (Monthly):</strong> รวมยอดขายทุกวันที่มีรายงานในเดือนของวันสิ้นสุดที่เลือก ตั้งแต่วันแรกถึงวันสุดท้ายของเดือน ไม่จำกัดตามวันเริ่มต้นของช่วง หากเลือกข้ามเดือนจะใช้เดือนของวันสิ้นสุดเท่านั้น</p>
            <p>เดือนที่กำลังดู: <strong className="tabular-nums">{formatPeriod(monthlyPeriod)}</strong> · Sale by Category และ Discount ในการ์ด Monthly ใช้เดือนเดียวกัน</p>
            <p>Import วันใหม่ในเดือนนี้แล้วจะสะสมยอดเพิ่มทันที ส่วนการ Import วันเดิมจะ <strong>แทนชุดเดิม ไม่บวกซ้ำ</strong> ยอดจึงเปลี่ยนตามรายงานที่นำเข้าล่าสุด ไม่ใช่การบังคับให้ยอดเพิ่มเสมอ</p>
            <p><strong>Sales (Daily):</strong> เลือกวันเดียวจะแสดงยอดของวันนั้น เลือก Period หลายวันจะรวมยอดรายงานตั้งแต่วันเริ่มต้นถึงวันสิ้นสุด รวมทั้งสองวัน พร้อม Sale by Category และ Discount ของช่วงเดียวกัน แม้วันสิ้นสุดไม่มีรายงานก็ยังแสดงยอดวันที่มีรายงานภายในช่วง หากทั้งช่วงไม่มีรายงานจะแสดง NO DATA โดยไม่ยืมยอดนอกช่วงหรือเติมวันที่ขาดเป็นศูนย์</p>
            <p>กราฟรายวัน กราฟแยกเดือน Report Detail และ Entertain · Period ยังคงกรองตามช่วงวันที่ด้านบน ส่วน Guest · Daily ใช้ S117 ของวันสิ้นสุด</p>
            <p><strong>Guests / Total / Person ในกล่องยอดขาย:</strong> แสดงต่อจาก Beverage - Alcohol โดยไม่รวมเป็นหมวดยอดขายหรือส่วนของกราฟ · ร้านที่ไม่มีหมวดนี้แสดงต่อท้ายหมวดเดิม · Monthly ใช้เดือนเดียวกับยอดขายสะสม ส่วน Sales (Daily) ใช้ Period ที่เลือก รวมทั้งสองวัน ไม่ใช่เฉพาะวันสิ้นสุด</p>
            <p>จุดสีหน้า Guests และ Total / Person เป็นเพียงรูปแบบรายการ ไม่ใช่ส่วนของกราฟ · สีม่วงสงวนให้ “ยังไม่จัดหมวด” ทั้งจุดสี ยอดเงิน และส่วนกราฟของยอดนั้น จนกว่าจะจัดหมวดผ่าน Master Data โดยไม่ย้ายยอดไป Other อัตโนมัติ หากเคย Import แล้ว Refresh ต้อง Restore Backup ชุดเดิมก่อนจึงจะเห็นยอดที่ยังไม่จัดหมวดจากชุดนั้น</p>
            <p>Guests รวมจำนวนคนจาก S117 ของร้านในช่วงนั้น หากมีรายงานเดียวใช้ Total / Person ที่พิมพ์ใน S117 หากมีหลายรายงานใช้ <strong>Total Sale จาก S117 รวม ÷ Guests รวม</strong> ปัดเป็น 2 ตำแหน่ง ไม่บวกหรือเฉลี่ยค่า Total / Person รายวันแบบเท่ากัน ฐานนี้เป็นยอดหลังส่วนลด รวม Service Charge / Tax ไม่ใช่ Gross sales ในกล่อง ÷ Guests · ไม่มีรายงานหรือข้อมูลที่ต้องใช้ไม่ครบแสดง NO DATA; Guests เป็น 0 จะแสดง 0 และ Total / Person เป็น NO DATA</p>
            <p><strong>Guest Check-In (Monthly):</strong> สะสม Guests และ Bills จาก S117 ทุกวันที่มีรายงานในเดือนเดียวกับ Sale (Monthly) · Table check-in และ Occupancy แสดง NO DATA เพราะ S117 ไม่มีจำนวนโต๊ะจริงหรือความจุ/รอบบริการ · Capricci 01/09/26 ใช้ 41 คน / 12 บิลตาม S117 ไม่ใช้ 40 คน / 11 Trans จาก Excel</p>
            <p>หน้า <strong>Sale</strong> แสดง Report Center ทั้งหมด (A103/S102/S104/S114/S117) พร้อม Slip Operations · S117, ItemGroup Detail และ Payment Detail เลือกวันที่ ค้นหา และเปลี่ยนแท็บรายงานได้ ส่วนผลตรวจ “ยอดที่เปรียบเทียบตรงกัน” หรือ NEEDS REVIEW อยู่ใน <strong>Master Data</strong> ทั้ง 3 ร้าน</p>
          </CardContent></Card>
          <Card className="border-0 ring-1 ring-stone-200/80"><CardHeader><CardTitle className="text-sm">Backup &amp; Restore</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-relaxed text-stone-600">
            <p>ข้อมูล Import และ Master ที่ทดลองใช้เก็บอยู่ในหน้าที่เปิดนี้ ยังไม่มีฐานข้อมูลกลางหรือบันทึกอัตโนมัติ</p>
            <p>ก่อน Refresh หรือปิดหน้า ให้กด <strong>Export Current Data</strong> เพื่อสำรองชุด Import และ Master ล่าสุด หลังเปิดใหม่กด <strong>Open Backup → Restore Backup</strong> เพื่อกลับมาใช้ข้อมูลเดิม</p>
            <p>Refresh เปิดกล่องยืนยันในหน้าเว็บ: ใช้ Go to Backup เพื่อไปสำรองก่อน หากมีแบบร่าง Master ที่ยังไม่ทดลองใช้ ให้เก็บแบบร่างหรือใช้กับ Dashboard ก่อน Export Current Data แล้วจึงยืนยันและกด Reload Page; Cancel ไม่เปลี่ยนข้อมูล หากโหลดใหม่ไม่สำเร็จจะมีข้อความแจ้ง ไม่ปล่อยให้ปุ่มหมุนค้าง</p>
            <p>ไฟล์สำรองมีข้อมูลธุรกิจและต้นฉบับรายงาน ควรเก็บในพื้นที่จำกัดสิทธิ์ ยังไม่มีการอัปโหลด Google Drive หรือเผยแพร่ GitHub จนกว่าระบบ Final</p>
            <p>วันที่ไม่มีรายงานไม่ถูกแทนด้วยศูนย์ และไม่ยืมยอดจากวันอื่น การ Verify ตรวจรายงานทั้ง 5 มุมมองโดยไม่บวกยอดข้าม Report เป็นรายได้รวม</p>
          </CardContent></Card>
        </div>
        {key === 'capricci' ? <>
          <Card className="border-0 ring-1 ring-stone-200/80"><CardHeader><CardTitle className="text-sm">Master Data → Sale by Category</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-relaxed text-stone-600"><p>S104 → จับคู่ ItemCode กับ Master Data → หมวดย่อย → Output: Food / Beverage - Non-Alcohol / Beverage - Alcohol / Other</p><p>Type / Sub Type / Category ใช้กรองตารางหลังบ้าน การกรองไม่เปลี่ยนยอดขาย หากแก้หมวดให้กดทดลองใช้กับ Dashboard แล้วสำรองข้อมูลใหม่ การจัดหมวดใหม่ย้ายยอดระหว่างหมวดแต่ไม่เปลี่ยนยอดขายรวม</p><p>ItemCode ที่ยังไม่จัดหมวดจะแสดง “ยังไม่จัดหมวด” แยกไว้ ไม่เดาเป็น Other และไม่ตัดยอดทิ้ง วิธีคำนวณด้านล่างย้ายมาจาก Dashboard และอ้างอิงเดือนที่แสดงใน Sale (Monthly)</p></CardContent></Card>
          <Card className="border-0 ring-1 ring-stone-200/80"><CardHeader><CardTitle className="text-sm">Unmapped · ที่มาของยอดยังไม่จัดหมวด</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-relaxed text-stone-600">
            <p>มาจากรายการขายใน S104 ที่ผ่านเงื่อนไข CustomerName “ลูกค้าทั่วไป เงินสด” และไม่ใช่ Service Charge แต่จับคู่ ItemCode → หมวดย่อย → Output ใน Master Data ไม่ครบ เช่น ItemCode ใหม่ที่ Import เพิ่มให้เป็น “ยังไม่จัดหมวด” หรือหมวดย่อยยังไม่เชื่อมกับ Output</p>
            <p>ยอดนี้ใช้ฐานเดียวกับยอดขาย: ExtendedPrice + ค่าปรับกลับส่วนลด (Column1 ในชุดต้นแบบ หรือคำนวณจาก S114 เทียบ S104 ในชุด Import) และยังรวมใน Gross sales ไม่ใช่ Entertain ไม่ใช่ส่วนต่างตรวจยอด และไม่ย้ายเป็น Other อัตโนมัติ</p>
            <p>Monthly รวมรายการดังกล่าวทั้งเดือน ส่วน Sales (Daily) รวมเฉพาะ Period ที่เลือก จึงอาจมียอดไม่เท่ากัน ตรวจ ItemCode และแถวต้นทางในรายละเอียดด้านล่างที่แสดง “ต้องตรวจหมวด” แล้วค้นหารหัสนั้นใน Master Data ได้ การเปิดตัวกรองอย่างเดียวไม่เปลี่ยนยอดหรือหมวด</p>
          </CardContent></Card>
          <CapricciCategoryDetail summary={financeSummary} periodLabel={formatPeriod(monthlyPeriod)} changed={masterChanged} imported={imported} />
        </> : <Card className="border-0 ring-1 ring-stone-200/80"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Calculator className="size-4 text-[#39755a]" /> LAWOI · Master Data → Sale by Category</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-relaxed text-stone-600">
          <p>โครงสร้างจาก Sale Lawoi ในไฟล์ Lawoi_Daily_Sales_Report_20260901-For codex แบ่ง Type → Sub Type → Output 4 หมวด โดย Category ใช้หมวด POS จาก I106 เพื่อค้นหาและตรวจสอบสินค้า</p>
          <p>Sales ใช้ S104 ของ “ลูกค้าทั่วไป เงินสด” บวกส่วนลดที่ตรวจตรงกับ S114 ราย ItemCode เพื่อคืนเป็นยอดก่อนส่วนลด · Service Charge และ Entertain ไม่รวมใน Sale by Category</p>
          <p>ตัวอย่าง 01/09/26: Food 30,810 + Beverage - Non-Alcohol 1,840 + Beverage - Alcohol 700 + Other 0 = 33,350 บาท ตรงกับ Gross sales ในต้นแบบ</p>
          <p>I106 มี 676 รหัสสินค้า 18 หน้า พร้อม Menu, Description 2 และราคาขายก่อนภาษี/ภาษี/รวมภาษี ณ 03/09/26 · ระบบไม่อ่าน ไม่เก็บ และไม่ใช้ต้นทุนต่อหน่วย · ไม่คำนวณยอดขายจากราคาปัจจุบัน × จำนวน</p>
          <p>การจับคู่หมวด POS ที่ตรวจแล้ว: PASTA &amp; RICE/SIDE → PASTA &amp; RICE; BLUE/RED/SNACKS → Appetizer; SOFT DRINKS → Soft Drink; HIGHBALL → Hard Liquor; WINE → Wine Bottle; SAKE → Sake; BEER → Beer และหมวดอื่นตามโครงสร้างของ LAWOI</p>
          <p>Master Data → LAWOI → Edit → Save Draft → Apply to Dashboard · เปลี่ยน Output ใน Type selection มีผลกับสินค้าทั้ง Sub Type และคำนวณรายงานที่ Import ใหม่ทั้งหมด โดยยอดรวมไม่เปลี่ยน · ตัวกรองไม่เปลี่ยนข้อมูล</p>
          <p>A103/S102/S104/S114/S117 เป็นคนละมุมมองของยอดเดียวกัน ห้ามบวกรวม · Guest · Daily ใช้ S117: 19 คน / 5 บิล และ Total / Person 2,065.94 บาท</p>
          <p>ก่อน Refresh ให้ Export Current Data เพื่อเก็บ Master ทั้งสามร้านและ Report ที่ Import · วันที่ไม่มี Report แสดง NO DATA และ S107 ไม่เปิดกลับมาใช้</p>
        </CardContent></Card>}
      </TabsContent>)}
    </Tabs>
  </section>;
}
