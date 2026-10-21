# KAPPO Master Data — 03/09/26

## ขอบเขตที่อ่าน

ต้นฉบับอ่านอย่างเดียว ไม่แก้ไข PDF / CSV / Excel และไม่เผยแพร่ภายนอก

| Reference | รายละเอียดที่ตรวจครบ |
| --- | --- |
| Kappo Takashi_Daily_Sales_Report_20260901-For Codex.xlsx | ทั้ง 6 ชีต: DashBord 14 แถว, Sale 56 แถว, Guest 48 แถว, S104 4,207 แถวที่มีค่า/สูตร, S107 5 แถว, Category 463 แถวที่มีค่า/สูตร |
| A103 | 1 หน้า, 2 ใบเสร็จ, Net 35,663.10 |
| S102 | หัวตาราง 23 ช่อง รวม Remark; สินค้า 4 แถว |
| S104 | หัวตาราง 15 ช่อง; รายการขาย 8 แถว |
| S114 | 1 หน้า; 6 รายการ: Service Charge 2, Green Tea 1, Sake 2, Dinner Course 1 |
| S117 | 1 หน้ายาว; ตรวจ Sales Item, ItemGroup, Payment, Guests/Bills/Total per Person ครบ |
| KAPPO-I106.pdf | 8 หน้า, 170 รหัสไม่ซ้ำ; รวมจำนวนจากบรรทัด Total ทุกหมวดได้ 170 ตรงกัน |

S104 ใน Excel มีธุรกรรมจริง 8 แถว + หัวตาราง 1 แถว ส่วนอีก 4,198 แถวเป็นสูตรที่ลากลงในแถวไม่มีธุรกรรม (Q=0, R=#VALUE!, S/T/U=#N/A) ไม่ใช้เป็นยอดขายหรือวันนำเข้า ประวัติรายเดือนเดิมใน Sale / Guest อ่านเป็น reference แต่ไม่ Import แทน 5 รายงานที่ผู้ใช้ให้

ตัวหนังสือเก่าใน Template เช่น H2 “KAVEE”, หัวเดือน June, YTD ปีเก่า, DashBord!E6 อ้าง R443 และสูตรภายนอก Category!P4 ไม่ถูกนำมาเป็นร้าน/วันที่/ยอดจริง ไม่เปิดลิงก์ภายนอก ใช้วันที่ในรายงาน 01/09/26 และ mapping KAPPO ที่ตรวจจากค่า O/P/Q เท่านั้น S107 อ่านเพื่อเข้าใจสูตรเดิม แต่ยังยกเลิกการใช้ในระบบ; Guests ยึด S117 ตามคำยืนยันเดิม

## โครงสร้างและลำดับความสำคัญ

- ItemCode = Category!F; Sub Type = K เทียบตาราง O; Type = P; Output = Q; Category = D ขยายเฉพาะช่วงเซลล์ Merge จริง ไม่เติมลงไปทุกแถว
- Category มี 117 แถวสินค้า, 115 รหัสไม่ซ้ำ, 13 Sub Types และ 4 Outputs
- ใช้ ItemCode แบบ trim / ไม่แยกตัวพิมพ์ใหญ่เล็ก ไม่จับคู่จากชื่อหรือ prefix
- I106 เพิ่มสินค้าอีก 91 รหัสที่ไม่มีใน Category โดยเริ่มเป็น Unmapped; รหัสที่มีเฉพาะ Workbook เก็บไว้ ไม่ลบเพื่อให้ตรงกับ I106
- รวม 206 รหัสสินค้า + SERVICECHARGE 1 = 207 รหัสเริ่มต้น รหัสใหม่จาก Sales Import ของ KAPPO เพิ่มเฉพาะ Master KAPPO เป็น Unmapped
- ชื่อ Menu ใช้รายละเอียดสินค้าจาก I106 เมื่อพบรหัส มิฉะนั้นใช้ชื่อ Category; Detail แสดงชื่อ Category และชื่อ S104 แยกพร้อมที่มา ไม่เปลี่ยนต้นฉบับยอดขาย
- GFT-BOX001: แถว 59 Dessert, แถว 62 Other Food / BENTO BOX เลือกแถว 59 ตาม VLOOKUP พร้อม Category Conflict; SAK-PRM004 แถว 93/106 หมวดเดียวกัน ใช้ครั้งเดียว
- DIN-COU002: Workbook เรียก DINNER COURSE PAIRING / S104 เรียก DINNER COURSE B จับคู่ด้วยรหัสเดียวกันเป็น DINNER COURSE → Food ไม่เดาว่าเป็น Sake จากคำ Pairing
- OTH-SAK001 ตาม Workbook คือ Other Food → Food; OTH-WHK001 คือ WHISKY → Alcohol; ไม่แก้ตามความรู้สึกว่าชื่อเมนูควรเป็นหมวดใด

## Selling Price และการไม่ใช้ต้นทุน

Selling Price ใน Category ว่างทุกแถวสินค้า ใช้ I106 “ราคาก่อนรวมภาษี” เป็นราคาแสดงผลโดยระบุวันที่รายงาน 03/09/26; Detail แสดง “ภาษี” และ “ราคาต่อหน่วย” รวมภาษีแยกกัน ตรวจทุกแถวว่าราคาก่อนภาษี + ภาษี = ราคารวมภาษี

มีราคาใน I106 170 รหัส; อีก 37 รหัสรวม Service Charge แสดง NO DATA ราคา 0 ในต้นฉบับแสดง 0.00 ไม่เปลี่ยนเป็นข้อมูลขาด ไม่ประมาณราคาจากยอดขาย ÷ Qty และไม่ใช้ราคาวันที่ 03/09/26 คำนวณยอดย้อนหลัง 01/09/26

ไม่อ่านออกมาเป็น field, ไม่เก็บ, ไม่แสดง, ไม่คำนวณ “ต้นทุนต่อหน่วย” ตัวสกัดลบคอลัมน์นั้นออกก่อนแปลงเป็นข้อความและเลือกเฉพาะ 8 fields: itemCode, menu, description2, posCategory, sellingPrice, sellingTax, sellingPriceWithTax, sourcePage ไม่มี raw I106 ใน app, HTML, source ZIP หรือ Backup

สคริปต์ `scripts/extract-kappo-master.py` ทำซ้ำได้โดยรับโฟลเดอร์ KAPPO เป็น argument ต้องมี Python/pdfplumber; ไม่แก้ต้นฉบับ และล้มเหลวเมื่อจำนวนรายการ/ราคารวมไม่ตรง

## Logic ยอดขายและบทบาท 5 Reports

1. S104 กรอง Sales ของ CustomerName “ลูกค้าทั่วไป เงินสด” ของร้าน/วันนั้น
2. รวมตาม ItemCode เทียบ S114 Sales: ExtendedPrice = Price − Discount ต้องตรงก่อนนำเข้า คืนยอด Gross ด้วย ExtendedPrice + Discount ไม่สร้างส่วนลดรายบิลขึ้นเอง
3. จับคู่ Master ItemCode → Sub Type → Output แล้วรวมยอดขาย 4 หมวด รวม Unmapped แยกสีม่วงเมื่อมี ไม่ย้ายไป Other โดยอัตโนมัติ
4. ยกเว้น Service Charge และลูกค้าที่ไม่เข้าเงื่อนไข ยอด Entertain แสดงแยกจาก S117 ไม่บวก/หักซ้ำ
5. A103 / S102 / S104 / S114 / S117 เป็นคนละมุมมองของยอดเดียวกัน ใช้ตรวจสอบ ไม่บวกรวมข้าม Report
6. S117 ให้ Discount, Entertain, Guests, Bills, Total per Person, ItemGroup และ Payment; ไม่แปลง Bills เป็นโต๊ะจริง

ตรวจ 01/09/26: Dinner 25,200 + Discount 1,800 = Food 27,000; Sake 2,200 + 2,900 = Alcohol 5,100; Non-Alcohol 0; Other 0; Gross 32,100 บาท ตรง workbook Sale!S12 / DashBord!B3

32,100 − 1,800 + Service Charge 3,030 + Tax 2,333.10 = Total Sale 35,663.10 ตรง A103 และ S117; Guests 6, Bills 2, Total/Person 5,943.85 ตาม S117 (ไม่ใช่ 5,350 ที่ Excel คำนวณจาก Gross ÷ Guests)

Raw S117 ยังคง Other 5,100 เพื่อแสดงต้นฉบับใน Sale; Dashboard ใช้ Master KAPPO จัดเป็น Alcohol โดยไม่แก้ source report

## ใช้งานและสำรอง

Master Data → KAPPO TAKASHI → Edit → Save Draft → Apply to Dashboard; การแก้ Output ในกล่อง Type selection มีผลกับสินค้าทั้ง Sub Type รวมวันนำเข้าที่ผ่านมา แต่ไม่เปลี่ยน Gross รวม Type/Sub Type/Category เป็นตัวกรองดูข้อมูลเท่านั้น

Monthly รวมเดือนของวันสิ้นสุดที่เลือก; Sales (Daily) รวม Period ที่เลือก วันเดิม Import แทน ไม่บวกซ้ำ ไม่มีรายงานแสดง NO DATA ไม่ดึงยอดจากเดือนเก่าใน Excel มาเติม

Export Current Data เก็บรายงานนำเข้าและ Master Capricci/KAPPO/LAWOI ที่ Apply แล้วใน Backup v3; Restore รองรับ v1/v2 เดิม โดยตั้ง Master ที่ขาดจากต้นแบบของร้านและเพิ่มรหัสที่พบในรายงานเป็น Unmapped พร้อมแจ้งผู้ใช้ HTML รุ่นเก่าจะปฏิเสธเวอร์ชันใหม่แทนการทิ้งหมวดเงียบ ๆ

แบบร่างที่ยังไม่ Apply ทำให้ Export/Import ถูกปิดเพื่อป้องกันทับงาน Refresh เตือนทั้งสองร้าน ไม่มีฐานข้อมูลกลาง/บันทึกอัตโนมัติ/อัปโหลด Google Drive จนกว่าจะ Final

Capricci และ LAWOI source snapshots ไม่เปลี่ยน Capricci Output box เดิมคงทุกตัวอักษร และ LAWOI ใช้ Master จากต้นแบบของตนเองแยกจาก KAPPO

## การทดสอบ

Tests ตรวจ counts/unique/duplicate, schema whitelist, ราคาทุกรหัส, ชื่อหลายบรรทัด, master validation, filter cascades, UI Edit/Save/Apply/Detail/pagination, period/month/no-data, reclassification, import replacement, brand isolation, backup v1/v2 และ SHA256 ของทุก baseline

`tests/kappo-import-check.mjs <โฟลเดอร์ Auto Report 01_09_2569>` อ่านต้นฉบับทั้ง 5 รายงานผ่าน decoder ที่ใช้ใน HTML จริง แล้ว Verify/Backup/Restore ซ้ำ ตรวจการปฏิเสธ checksum ผิด ร้านผิด วันที่ผิด และ I106 ในช่อง Sales Import ทั้งหมดทำในหน่วยความจำ ไม่มี browser interaction หรือ external writes
