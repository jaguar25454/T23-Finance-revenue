import { capricciFinance, detectReportCode, formatBusinessDate, getReconciliation, isBusinessDate, isRetiredReport, reportTemplates, type BrandKey, type ReportCode, type ReportSnapshot } from './report-data';
import { masterKey, validateCapricciMaster, type CapricciMaster } from './capricci-master';

export type Destination = { brand: BrandKey; branch: string; date: string };
export type PdfWord = { text: string; x: number; y: number; width: number };
export type PdfPage = { width: number; height: number; words: PdfWord[] };
export type RawImport = { name: string; base64: string; sha256: string };
export type VerifiedFile = { raw: RawImport; code: ReportCode; payload: unknown; warnings: string[]; count: number; total: number; period?:{start:string;end:string} };
export type ImportedBatch = { destination: Destination; files: RawImport[]; report: ReportSnapshot; importedAt: string };
type DataRow = Record<string, string | number>;
const round = (value: number) => Math.round(value * 100) / 100;
const sum = (rows: Record<string, unknown>[], key: string) => round(rows.reduce((n, r) => n + Number(r[key]), 0));
const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
function requireThat(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function numberCell(value: unknown, field = 'จำนวนเงิน'): number {
  const text = String(value ?? '').trim();
  requireThat(/^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(text) && /\d/.test(text), `${field}: ตัวเลขไม่ถูกต้อง (${text.slice(0, 60)})`);
  const n = Number(text.replace(/,/g, ''));
  requireThat(Number.isFinite(n) && Math.abs(n) < 1e12, `${field}: ตัวเลขเกินขอบเขต`);
  return n;
}
export function compareTotal(actual: number, expected: number, label: string, warnings: string[]) {
  const delta = round(actual - expected);
  requireThat(Number.isFinite(delta) && Math.abs(delta) <= 0.02, `${label}: ยอดไม่ตรงกัน ${actual} / ${expected} (ต่าง ${delta})`);
  if (delta) warnings.push(`${label}: ต่าง ${delta.toFixed(2)} บาท — คงยอดต้นฉบับ ไม่ปรับยอด`);
}
export function validateDestination(d: Destination) {
  requireThat(['capricci', 'kappo', 'lawoi'].includes(d.brand) && typeof d.branch === 'string' && /^[\w-]{1,50}$/.test(d.branch) && isBusinessDate(d.date), 'กรุณาระบุร้าน รหัสสาขา และวันที่ให้ถูกต้อง');
}
const months = ['January|มกราคม','February|กุมภาพันธ์','March|มีนาคม','April|เมษายน','May|พฤษภาคม','June|มิถุนายน','July|กรกฎาคม','August|สิงหาคม','September|กันยายน','October|ตุลาคม','November|พฤศจิกายน','December|ธันวาคม'];
export function sourceDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = norm(String(value ?? ''));
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let year: number, month: number, day: number;
  if (match) { year = +match[1]; month = +match[2]; day = +match[3]; }
  else {
    match = s.match(/^(\d{1,2})[ /]([^ /]+)[ /](\d{4})/);
    requireThat(match, `อ่านวันที่ไม่ได้: ${s}`);
    day = +match[1]; year = +match[3]; month = /^\d+$/.test(match[2]) ? +match[2] : months.findIndex(m => m.toLowerCase().split('|').includes(match![2].toLowerCase())) + 1;
  }
  if (year >= 2400) year -= 543;
  const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  requireThat(isBusinessDate(date), `วันที่ไม่ถูกต้อง: ${s}`);
  return date;
}

// RFC-style quoted CSV, retaining empty trailing cells and embedded newlines.
export function csvCells(text: string): string[][] {
  requireThat(!text.includes('\uFFFD') && !text.includes('\0'), 'CSV มีอักขระเสียหาย กรุณาบันทึกเป็น UTF-8 CSV');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === '\r' && text[i+1] === '\n') i++; }
    } else { requireThat(!closed || c === ' ', 'CSV มีข้อความต่อท้ายช่องที่ปิดเครื่องหมายคำพูดแล้ว'); cell += c; }
  }
  requireThat(!quoted, 'CSV ปิดเครื่องหมายคำพูดไม่ครบ');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  requireThat(rows.length <= 100001, 'รายงานเกิน 100,000 แถว');
  return rows;
}
const numericColumns = new Set(['UnitPrice','Qty','ExtendedPrice','Tax','ExtendedPriceTax','FullPrice','AmountDiscountWTax','AmountDiscount','UnitsInStock','SVCAvg','SVCInitAvg']);
export function parseSalesTable(cells: unknown[][], d: Destination, warnings: string[]) {
  const headerAt = cells.slice(0,30).findIndex(row => row.includes('ItemCode') && row.includes('ExtendedPriceTax'));
  requireThat(headerAt >= 0, 'ไม่พบหัวตาราง Easy Restaurant S102/S104 (ItemCode, ExtendedPriceTax)');
  const headers = cells[headerAt].map(v => String(v ?? '').trim());
  requireThat(headers.every(Boolean) && new Set(headers).size === headers.length, 'หัวคอลัมน์ว่างหรือซ้ำ');
  const code = headers.includes('SaleDate') ? 'S104' : 'S102';
  const required = code === 'S104' ? ['TranTypeName','CustomerName','SaleDate','SaleNum','ItemCode','ItemDesc','Qty','ExtendedPrice','Tax','ExtendedPriceTax'] : ['CategoryName','ItemCode','ItemDesc','Qty','ExtendedPrice','Tax','ExtendedPriceTax','AmountDiscount'];
  requireThat(required.every(h => headers.includes(h)), `${code}: คอลัมน์ไม่ครบ ${required.filter(h => !headers.includes(h)).join(', ')}`);
  const rows: DataRow[] = [];
  for (let i = headerAt+1; i < cells.length; i++) {
    const values = [...cells[i]];
    if (!values.some(v => v !== null && v !== undefined && String(v).trim())) continue;
    while (values.length < headers.length) values.push('');
    // A known Easy Restaurant export omits quotes around TWO identical menu
    // columns. Repair only that unambiguous shape; never guess a split.
    if (values.length>headers.length && code==='S104' && headers.length===15 && headers[8]==='ItemDesc' && headers[9]==='EngItemDesc') {
      const middle=values.slice(8,-5), half=middle.length/2;
      if (Number.isInteger(half) && half>1 && String(middle[0]).endsWith(String(middle[half])) && String(middle[half]).trim() && middle.slice(1,half).every((v,j)=>v===middle[j+half+1])) {
        values.splice(8,middle.length,middle.slice(0,half).join(','),middle.slice(half).join(','));
        warnings.push(`S104 แถว ${i+1}: รวม comma ใน ItemDesc/EngItemDesc ที่มีส่วนท้ายซ้ำตรงกัน; เก็บไฟล์ดิบไว้ใน Backup`);
      }
    }
    requireThat(values.length === headers.length, `แถว ${i+1}: จำนวนคอลัมน์ ${values.length} ไม่ตรง ${headers.length}; ตรวจ comma ในชื่อสินค้าแล้วส่งออก CSV ใหม่ หรือใช้ Excel .xlsx`);
    const row = Object.fromEntries(headers.map((h, j) => [h, numericColumns.has(h) ? numberCell(values[j], `แถว ${i+1} ${h}`) : values[j] instanceof Date ? (values[j] as Date).toISOString() : String(values[j] ?? '').trim()]));
    requireThat(String(row.ItemCode).length > 0 && String(row.ItemCode).length <= 80 && String(row.ItemDesc).length <= 300, `แถว ${i+1}: ItemCode / ItemDesc ไม่ถูกต้อง`);
    if (code === 'S104') {
      requireThat(sourceDate(row.SaleDate) === d.date, `แถว ${i+1}: SaleDate ไม่ตรงวันที่ปลายทาง ${formatBusinessDate(d.date)}`);
      requireThat(['sales','entertain'].includes(masterKey(String(row.TranTypeName))), `แถว ${i+1}: ยังไม่รองรับธุรกรรม ${row.TranTypeName}`);
      requireThat(String(row.CustomerName) && String(row.SaleNum), `แถว ${i+1}: ไม่มี CustomerName / SaleNum`);
    }
    rows.push(row);
  }
  requireThat(rows.length > 0 && rows.length <= 100000, 'ไม่พบรายการขาย หรือเกิน 100,000 แถว');
  const terminals = rows.map(r => String(r.TerminalName ?? '')).join(' ');
  const identified = terminals.match(/capricci|kappo|lawoi/i)?.[0].toLowerCase();
  requireThat(!identified || identified === d.brand, `TerminalName ระบุร้าน ${identified} ไม่ตรงปลายทาง`);
  warnings.push(`${code}: ${code === 'S102' ? 'ไม่มีวันที่ธุรกิจในตาราง; ' : ''}ต้องยืนยันร้าน/สาขาจากชุดต้นฉบับร่วมกับ PDF ไม่ใช้ชื่อไฟล์ตัดสิน`);
  return { code: code as ReportCode, payload: { headers, rows, totals: Object.fromEntries(['Qty','ExtendedPrice','Tax','ExtendedPriceTax'].map(k => [k, rows.reduce((n,r) => n+Number(r[k]),0)])) } };
}

function lines(words: PdfWord[], tolerance = 1.4) {
  const result: { y: number; words: PdfWord[] }[] = [];
  for (const word of [...words].sort((a,b) => b.y-a.y || a.x-b.x)) {
    const last = result.at(-1);
    if (last && Math.abs(word.y-last.y) <= tolerance) last.words.push(word);
    else result.push({ y: word.y, words: [word] });
  }
  return result.map(line => ({ ...line, words: line.words.sort((a,b) => a.x-b.x), text: norm(line.words.sort((a,b) => a.x-b.x).map(w => w.text).join(' ')) }));
}
function identifyPdf(pages: PdfPage[], d: Destination, warnings: string[]) {
  requireThat(pages.length > 0 && pages.length <= 100, 'PDF ต้องมี 1–100 หน้า');
  const first = pages[0];
  const header = lines(first.words).slice(0,18).map(l => l.text).join('\n');
  const code: ReportCode | null = /Sales Tax Report|รายงานภาษีขาย/i.test(header) ? 'A103' : /Sales Report By Item Category|รายงานสรุปยอดขายแบ่งตามหมวดสินค้าแสดงรายละเอียด/i.test(header) ? 'S114' : /Sales Report Slip|รายงานสรุปยอดขาย\s*\(Slip\)/i.test(header) ? 'S117' : null;
  requireThat(code, 'PDF ไม่ใช่โครงสร้าง A103/S114/S117 ที่รองรับ หรือเป็นภาพสแกน (ต้องมีข้อความที่เลือกคัดลอกได้)');
  const identityText = header.split(/Sales Item|ยอดขายสินค้า|SaleDate:/)[0];
  const brands = [...new Set([...identityText.matchAll(/capricci|kappo|lawoi/gi)].map(m => m[0].toLowerCase()))];
  requireThat(brands.length === 1 && brands[0] === d.brand, `ชื่อร้านใน PDF ไม่ตรง ${d.brand} หรืออ่านชื่อร้านไม่ได้`);
  const dates = [...header.matchAll(/\d{1,2} (?:[A-Za-z]+|[\u0E00-\u0E7F]+) \d{4} \d{2}:\d{2}/g)].map(m => m[0]);
  requireThat(dates.length >= 2 && dates.slice(0,2).every(s => sourceDate(s) === d.date), 'วันที่เริ่ม/สิ้นสุดใน PDF ไม่ตรงวันที่ปลายทาง (นำเข้าเป็นรายวันเท่านั้น)');
  const branchLine = lines(first.words).find(l => /^Branch(?:\s|:)|^สาขาที่:/.test(l.text));
  const branch = branchLine?.text.split(':').slice(1).join(':').trim() ?? '';
  requireThat(!branch || norm(branch).toLowerCase() === norm(d.branch).toLowerCase(), `Branch ใน PDF (${branch}) ไม่ตรงปลายทาง (${d.branch})`);
  if (!branch) warnings.push(`${code}: ช่องสาขาใน PDF ว่าง ต้องยืนยันสาขาด้วยตนเอง`);
  return { code, branch, startTime: dates[0].slice(-5), endTime: dates[1].slice(-5) };
}
const slipNames: Record<string,string> = {
  'อาหาร':'Food','เครื่องดื่ม':'Beverage','อื่นๆ':'Other','ส่วนลด':'Discount','ค่าบริการ':'Service Charge','ภาษี':'Tax','ยอดขายทั้งหมด':'Total Sale',
  'ยอดขายจากการชําระหนี้':'Sale by Pay on Account','ยอดขายจากบัตรของขวัญ':'Sale by Gift Card','เอนเตอร์เทน':'Entertain','เงินมัดจํา':'Deposit','ปัดเศษ':'Rounding',
  'ค่าใช้จ่าย':'Payout','เงินในลิ้นชักทั้งหมด':'Cash Drawer Total','ลูกค้า':'Guests','จํานวนบิล':'Bills','ยอดรวม/คน':'Total/Person',
};
function parseSlip(pages: PdfPage[], d: Destination, warnings: string[]) {
  requireThat(pages.length === 1, 'S117 ต้องเป็น Slip รายวัน 1 หน้า');
  const all = lines(pages[0].words); const items: {label:string;value:number}[] = [], categories: typeof items = [], payments: typeof items = [];
  const totals: Record<string,number> = {}; let section = '';
  for (const line of all) {
    if (/^(Sales Item|ยอดขายสินค้า)$/.test(line.text)) { section = 'sales'; continue; }
    if (/^(ItemGroup Detail|รายละเอียดกลุ่มสินค้า)$/.test(line.text)) { section = 'category'; continue; }
    if (/^(Payment Detail|รายละเอียดการชําระ)$/.test(line.text)) { section = 'payment'; continue; }
    const last = line.words.at(-1)!;
    if (line.words.length < 2 || !/^-?[\d,]*\.\d+$/.test(last.text.trim())) continue;
    const original = norm(line.words.slice(0,-1).map(w => w.text).join(' '));
    const label = slipNames[original] ?? original, value = numberCell(last.text);
    if (['Payout','Cash Drawer Total','Guests','Bills','Total/Person'].includes(label)) { section = 'operations'; requireThat(!(label in totals), `S117 ${label} ซ้ำ`); totals[label] = value; }
    else if (label === 'Total' || label === 'ยอดขาย') { requireThat(!(section in totals), `S117 Total ${section} ซ้ำ`); totals[section] = value; }
    else if (section === 'sales') { requireThat(!items.some(i=>i.label===label), `S117 ${label} ซ้ำ`); items.push({label,value}); }
    else if (section === 'category') categories.push({label,value});
    else if (section === 'payment') payments.push({label,value});
  }
  const required = ['Food','Beverage','Other','Discount','Service Charge','Tax','Total Sale','Entertain','Rounding'];
  requireThat(required.every(label => items.some(i=>i.label===label)) && ['sales','category','payment','Payout','Cash Drawer Total','Guests','Bills','Total/Person'].every(k=>k in totals), 'S117 ขาดหัวข้อหรือยอดรวมที่จำเป็น');
  const get = (label:string) => items.find(i=>i.label===label)?.value ?? 0;
  compareTotal(get('Food')+get('Beverage')+get('Other')-get('Discount')+get('Service Charge')+get('Tax'), get('Total Sale'), 'S117 สูตร Total Sale', warnings);
  compareTotal(sum(categories,'value'), totals.category, 'S117 กลุ่มสินค้า', warnings);
  compareTotal(totals.category, get('Total Sale'), 'S117 Category / Total Sale', warnings);
  compareTotal(sum(payments,'value'), totals.payment, 'S117 การชำระ', warnings);
  requireThat(Number.isInteger(totals.Guests) && totals.Guests >= 0 && Number.isInteger(totals.Bills) && totals.Bills >= 0, 'S117 จำนวน Guests/Bills ไม่ถูกต้อง');
  if (totals.Guests) compareTotal(get('Total Sale')/totals.Guests, totals['Total/Person'], 'S117 Total/Person', warnings);
  return { reportStore: all[0].text, branch: d.branch, date: formatBusinessDate(d.date), items, totalSale:get('Total Sale'), grandTotal:totals.sales, categories, payments, paymentTotal:totals.payment, payout:totals.Payout, cashDrawerTotal:totals['Cash Drawer Total'], guests:totals.Guests, bills:totals.Bills, totalPerPerson:totals['Total/Person'] };
}

function parseItemPdf(pages: PdfPage[], warnings: string[]) {
  const rows: Record<string,string|number>[] = [], categories: Record<string,string|number>[] = [];
  let category = '', transaction = '', totals: Record<string,number> | undefined;
  pages.forEach((page, pageIndex) => {
    const header = page.words.find(w=>w.text.trim()==='Item Code' || w.text.trim()==='รหัสสินค้า');
    requireThat(header, `S114 หน้า ${pageIndex+1}: ไม่พบหัวตาราง`);
    const hasModifier = page.words.some(w=>w.text.trim()==='Modifier');
    const headerLabels = hasModifier ? ['Unit Price','Qty','Price','Discount','Tax','Net'] : ['ราคาต่อหน่วย','จํานวน','ราคา','ส่วนลด','ภาษี','ยอดสุทธิ'];
    const centers = headerLabels.map(label=> {
      const w=page.words.find(w=>norm(w.text)===label && Math.abs(w.y-header.y)<2); requireThat(w, `S114 ไม่พบคอลัมน์ ${label}`); return w.x+w.width/2;
    });
    const body = page.words.filter(w=>w.y<header.y-6 && w.y>22);
    const numericRows = lines(body).filter(l=>l.words.filter(w=>w.x>centers[0]-25 && /^-?[\d,]*\.\d+$/.test(w.text.trim())).length>=4);
    const descriptions = body.filter(w=>w.x<centers[0]-30);
    const sectionLabels=lines(descriptions).filter(l=>l.words[0].x<40 && numericRows.every(n=>Math.abs(n.y-l.y)>13));
    // Numeric baselines anchor rows; wrapped codes/descriptions stay in their own cell.
    for (let i=0;i<numericRows.length;i++) {
      const line=numericRows[i], upper=i ? (numericRows[i-1].y+line.y)/2 : header.y-6, lower=i+1<numericRows.length ? (line.y+numericRows[i+1].y)/2 : 22;
      const labels = lines(descriptions.filter(w=>w.y<upper && w.y>lower));
      for (const label of sectionLabels.filter(l=>l.y>line.y && (!i || l.y<numericRows[i-1].y)).sort((a,b)=>b.y-a.y)) {
        if (/^(Sales|Entertain)$/.test(label.text)) transaction=label.text;
        else if (label.words[0].x<40 && !/^Total Of |Grand Total/.test(label.text)) category=label.text;
      }
      const numbers = centers.map((center,j)=>body.filter(w=>Math.abs(w.y-line.y)<9 && Math.abs(w.x+w.width/2-center)<(j===0?24:21) && /^-?[\d,]+(?:\.\d+)?$/.test(w.text.trim())).sort((a,b)=>b.y-a.y));
      const valueAt=(j:number)=> { requireThat(numbers[j].length>=1 && numbers[j].length<=2, `S114 หน้า ${pageIndex+1}: อ่านตัวเลข ${headerLabels[j]} ไม่ได้`); return numberCell(numbers[j].map(w=>w.text.trim()).join('')); };
      const values = {qty:valueAt(1),price:valueAt(2),discount:valueAt(3),tax:valueAt(4),net:valueAt(5)};
      const totalLabel = line.words.find(w=>/^Total Of |^Grand Total$|^ยอดรวม$/.test(w.text));
      if (totalLabel) {
        if (/^Grand Total$|^ยอดรวม$/.test(totalLabel.text)) { requireThat(!totals, 'S114 Grand Total ซ้ำ'); totals=values; }
        else if (!/^Total Of (Sales|Entertain)$/.test(totalLabel.text)) categories.push({category:totalLabel.text.slice(9),...values});
        continue;
      }
      const firstNumber = centers[0];
      const codeEnd = hasModifier ? 74 : 85, descEnd = hasModifier ? 198 : firstNumber-32;
      const near = descriptions.filter(w=>w.y<upper && w.y>lower && Math.abs(w.y-line.y)<14);
      const itemCode = near.filter(w=>w.x<codeEnd).sort((a,b)=>b.y-a.y||a.x-b.x).map(w=>w.text).join('').trim();
      const itemDesc = lines(near.filter(w=>w.x>=codeEnd && w.x<descEnd)).map(l=>l.text).join(' ');
      requireThat(itemCode && itemDesc && category && ['Sales','Entertain'].includes(transaction), `S114 หน้า ${pageIndex+1}: อ่านรหัส/หมวด/ธุรกรรมไม่ครบ`);
      rows.push({category,transaction,itemCode,itemDesc,modifier:hasModifier?near.filter(w=>w.x>=198).map(w=>w.text).join(' '):'',unitPrice:valueAt(0),...values,unit:line.words.find(w=>w.x>centers[1]+15 && w.x<centers[2]-25)?.text??'',page:pageIndex+1});
      // Section labels below the numeric row belong to the next item, including page breaks.
      for (const label of labels.filter(l=>l.y<line.y-10).sort((a,b)=>b.y-a.y)) {
        if (/^(Sales|Entertain)$/.test(label.text)) transaction=label.text;
        else if (label.words[0].x<40 && !/^Total Of |Grand Total/.test(label.text)) category=label.text;
      }
    }
    // Last page lines can open the category/transaction carried to next page.
    const lastY=numericRows.at(-1)?.y ?? header.y;
    for (const line of lines(descriptions.filter(w=>w.y<lastY-12))) {
      if (/^(Sales|Entertain)$/.test(line.text)) transaction=line.text;
      else if (line.words[0].x<40) category=line.text;
    }
  });
  requireThat(totals && rows.length, 'S114 ไม่พบ Grand Total หรือรายละเอียดสินค้า');
  const keys=['qty','price','discount','tax','net'];
  const rowSums=Object.fromEntries(keys.map(k=>[k,sum(rows,k)])), categorySums=Object.fromEntries(keys.map(k=>[k,sum(categories,k)]));
  for (const k of keys) { compareTotal(rowSums[k],totals[k],`S114 ผลรวมแถว ${k}`,warnings); compareTotal(categorySums[k],totals[k],`S114 ผลรวมหมวด ${k}`,warnings); }
  return {rows,categories,pages:pages.length,totals,rowSums,categorySums};
}

function parseTaxPdf(pages: PdfPage[], d: Destination, warnings: string[]) {
  const rows: Record<string,string|number>[]=[]; let printed: Record<string,number>|undefined;
  for (const page of pages) {
    const dateLine=page.words.find(w=>w.text==='SaleDate:'); requireThat(dateLine,'A103 ไม่พบ SaleDate');
    const body=page.words.filter(w=>w.y<dateLine.y-8 && w.y>35);
    const thai = page.words.some(w=>w.text==='รายงานภาษีขาย');
    const bounds=thai?[15,36,100,138,222,305,346,420,483,530,610]:[15,36,93,132,212,282,325,349,420,465,530,610];
    const anchors = body.filter(w=>(w.x<36 && /^\d+$/.test(w.text)) || /^(Total of |Grand total$|ยอดรวม$)/i.test(w.text)).sort((a,b)=>b.y-a.y);
    for (let i=0;i<anchors.length;i++) {
      const a=anchors[i], upper=i?(anchors[i-1].y+a.y)/2:dateLine.y-8, lower=i+1<anchors.length?(a.y+anchors[i+1].y)/2:35;
      const cell=(column:number, separator=' ')=>lines(body.filter(w=>w.y<upper && w.y>lower && w.x>=bounds[column] && w.x<bounds[column+1])).map(l=>l.text).join(separator).trim();
      const n=thai?6:7;
      const values={value:numberCell(cell(n,'')),tax:numberCell(cell(n+1,'')),rounding:numberCell(cell(n+2,'')),net:numberCell(cell(n+3,''))};
      if (/^Grand total$|^ยอดรวม$/i.test(a.text)) { requireThat(!printed,'A103 Grand Total ซ้ำ'); printed=values; continue; }
      if (!/^\d+$/.test(a.text)) continue;
      const invoiceText=cell(1,'');
      const invoice=invoiceText.match(/^(?:FT|RC)[A-Z0-9]+?(?=(?:RC|FT)|$)/)?.[0];
      requireThat(invoice, 'A103 อ่านเลขใบกำกับภาษีไม่ได้');
      const customer=cell(3), status=/Void Bill/i.test(customer)?'VOID':'ACTIVE';
      if (status==='VOID') requireThat(Object.values(values).every(v=>v===0),'A103 Void Bill มียอดไม่เป็นศูนย์');
      compareTotal(values.value+values.tax+values.rounding,values.net,`A103 ใบภาษี ${invoice}`,warnings);
      rows.push({no:Number(a.text),invoice,receipt:invoiceText.slice(invoice.length),type:cell(2),customer,customerTaxId:cell(4,''),customerBranch:cell(5,''),eTax:thai?'':cell(6),status,...values});
    }
  }
  requireThat(printed && rows.length, 'A103 ไม่มีรายการหรือ Grand Total');
  requireThat(new Set(rows.map(r=>r.no)).size===rows.length,'A103 ลำดับซ้ำ');
  const totals=Object.fromEntries(['value','tax','rounding','net'].map(k=>[k,sum(rows,k)]));
  for (const k of Object.keys(totals)) compareTotal(totals[k],printed[k],`A103 ผลรวม ${k}`,warnings);
  const first=pages[0].words;
  const operator=first.find(w=>w.x>110 && w.x<330 && Math.abs(w.y-707)<3)?.text ?? d.brand;
  const establishment=first.find(w=>w.x>110 && w.x<330 && Math.abs(w.y-692)<3)?.text ?? '';
  const taxId=first.find(w=>w.x>435 && Math.abs(w.y-707)<3)?.text ?? '';
  requireThat(/^\d{13}$/.test(taxId),'A103 ไม่พบ Tax ID ผู้ประกอบการ');
  return {operator,establishment,taxId,branchAsPrinted:null,rows,totals};
}
export function parseSalesPdf(pages: PdfPage[], d: Destination, warnings: string[]) {
  // PDF.js can combine adjacent monetary cells into one text run.
  pages=pages.map(page=>({...page,words:page.words.flatMap(word=> {
    if(!/^-?[\d,]*\.\d+(?:\s+-?[\d,]*\.\d+)+$/.test(word.text.trim())) return [word];
    const chunks=[...word.text.matchAll(/\S+/g)];
    return chunks.map(m=>({...word,text:m[0],x:word.x+word.width*m.index/word.text.length,width:word.width*m[0].length/word.text.length}));
  })}));
  const identity=identifyPdf(pages,d,warnings);
  for(const page of pages.slice(1)) { const other=identifyPdf([page],d,warnings);requireThat(other.code===identity.code && other.startTime===identity.startTime && other.endTime===identity.endTime,'PDF มีรายงานหลายประเภทหรือช่วงเวลาปนกัน'); }
  return {code:identity.code,period:{start:identity.startTime,end:identity.endTime},payload:identity.code==='S117'?{...parseSlip(pages,d,warnings),branch:identity.branch||null}:identity.code==='S114'?parseItemPdf(pages,warnings):{...parseTaxPdf(pages,d,warnings),branchAsPrinted:identity.branch||null}};
}
export function verifyFileName(name:string, actual?:ReportCode) {
  requireThat(!isRetiredReport(name), 'S107 ยกเลิกการใช้แล้ว');
  requireThat(!/(?:^|[^A-Z0-9])I106(?=[^A-Z0-9]|$)/i.test(name), 'I106 เป็นข้อมูลสินค้า ไม่ใช่รายงานยอดขาย ห้ามนำเข้าต้นฉบับผ่าน Sales Import');
  const hints=[...name.toUpperCase().matchAll(/(?:^|[^A-Z0-9])([AS]\d{3})(?=[^A-Z0-9]|$)/g)].map(match=>match[1]);
  for(const hint of hints) {
    requireThat(reportTemplates.some(t=>t.code===hint), `Report ${hint} ไม่รองรับ รับเฉพาะ A103/S102/S104/S114/S117`);
    requireThat(!actual || hint===actual, `ชื่อไฟล์ระบุ ${hint} แต่เนื้อหาเป็น ${actual}`);
  }
}
export function assembleReports(files: VerifiedFile[], d: Destination, warnings: string[]): ReportSnapshot {
  validateDestination(d);
  requireThat(files.length===5 && new Set(files.map(f=>f.code)).size===5, 'ต้องมี A103/S102/S104/S114/S117 อย่างละ 1 ไฟล์ สำหรับร้าน/สาขา/วันเดียวกันก่อน Import');
  requireThat(reportTemplates.every(t=>files.some(f=>f.code===t.code)), 'รายงานไม่ครบ 5 ประเภท');
  const periods=files.filter(f=>f.period).map(f=>`${f.period!.start}/${f.period!.end}`);
  requireThat(new Set(periods).size<=1,'ช่วงเวลาเริ่ม/สิ้นสุดของ PDF ทั้ง 3 รายงานไม่ตรงกัน');
  const sources=Object.fromEntries(files.map(f=>[f.code,{fileName:f.raw.name,sha256:f.raw.sha256,assignment:`Verified content; user-confirmed ${d.brand}/${d.branch}/${d.date}`} ]));
  const report={brandId:d.brand,branchId:d.branch,businessDate:d.date,dateLabel:formatBusinessDate(d.date),sourceSystem:'Easy Restaurant',...(periods.length?{periodStartTime:files.find(f=>f.period)!.period!.start,periodEndTime:files.find(f=>f.period)!.period!.end}:{}),sources,...Object.fromEntries(files.map(f=>[f.code,f.payload]))} as unknown as ReportSnapshot;
  for (const check of getReconciliation(report)) compareTotal(check.actual,check.expected,check.label,warnings);
  if (d.brand==='capricci'||d.brand==='kappo') financeForImportedReport(report); // Also verifies discount reconstruction before publishing.
  return report;
}

// S104 carries post-discount sales. S114's Sales detail supplies the gross
// price and discount by ItemCode, without inventing bill-level allocations.
export function financeForImportedReport(report:ReportSnapshot) {
  const eligible=report.S104.rows.filter(r=>masterKey(r.TranTypeName)==='sales' && masterKey(r.CustomerName)===masterKey(capricciFinance.customerFilter));
  const source=report.S114.rows.filter(r=>r.transaction==='Sales');
  const csvGroups=new Map<string,typeof eligible>(),pdfGroups=new Map<string,typeof source>();
  for(const row of eligible){const key=masterKey(row.ItemCode);const group=csvGroups.get(key)??[];group.push(row);csvGroups.set(key,group);}
  for(const row of source){const key=masterKey(row.itemCode);const group=pdfGroups.get(key)??[];group.push(row);pdfGroups.set(key,group);}
  const itemCodes=new Set([...csvGroups.keys(),...pdfGroups.keys()]);
  const rows: typeof capricciFinance.rows=[];
  for (const key of itemCodes) {
    const csv=csvGroups.get(key)??[], pdf=pdfGroups.get(key)??[];
    const price=sum(pdf,'price'), discount=sum(pdf,'discount'), extended=round(csv.reduce((n,r)=>n+r.ExtendedPrice,0));
    compareTotal(extended,price-discount,`${report.brandId} ${key}: S104 ลูกค้าทั่วไป / S114 Sales`,[]);
    const first=csv[0]; requireThat(first,`${report.brandId} ${key}: ไม่มี S104 ที่ตรงกับ S114`);
    rows.push({sourceRow:rows.length+2,businessDate:report.businessDate,customerName:capricciFinance.customerFilter,saleId:0,saleNum:'รวมตาม ItemCode · S104 + S114',itemCode:first.ItemCode,itemDesc:first.ItemDesc,qty:csv.reduce((n,r)=>n+r.Qty,0),extendedPrice:extended,adjustment:discount,cachedTotal:price,cachedSubgroup:'',cachedMainGroup:'',cachedCategory:''});
  }
  const included=new Set(eligible);
  for(const row of report.S104.rows.filter(r=>!included.has(r))) {
    requireThat(masterKey(row.CustomerName)!==masterKey(capricciFinance.customerFilter),`${report.brandId}: ธุรกรรมอื่นใช้ CustomerName ลูกค้าทั่วไป ต้องตรวจต้นฉบับก่อนคำนวณ`);
    rows.push({sourceRow:rows.length+2,businessDate:report.businessDate,customerName:row.CustomerName,saleId:Number(row.SaleId),saleNum:row.SaleNum,itemCode:row.ItemCode,itemDesc:row.ItemDesc,qty:row.Qty,extendedPrice:row.ExtendedPrice,adjustment:0,cachedTotal:row.ExtendedPrice,cachedSubgroup:'',cachedMainGroup:'',cachedCategory:''});
  }
  return {...capricciFinance,source:{...capricciFinance.source,businessDate:report.businessDate,filename:'Imported S104 + S114 (verified by ItemCode)'},rows};
}
export function mergeImportedItems(master:CapricciMaster, report:ReportSnapshot) {
  if (report.brandId!=='capricci') return master;
  const seen=new Set(master.items.map(i=>masterKey(i.itemCode))), items=[...master.items];
  for (const row of report.S104.rows) {
    const key=masterKey(row.ItemCode); if (seen.has(key)) continue;
    seen.add(key); items.push({itemCode:row.ItemCode,name:row.ItemDesc||row.ItemCode,subgroup:key==='servicecharge'?'Service Charge':'ยังไม่จัดหมวด'});
  }
  return validateCapricciMaster({...master,items});
}
export function upsertBatch(batches:ImportedBatch[], batch:ImportedBatch) {
  const d=batch.destination;
  requireThat(!batches.some(b=>b.destination.brand===d.brand && b.destination.branch!==d.branch), 'รุ่นนี้รองรับ 1 สาขาต่อร้านในชุดข้อมูลเดียว กรุณาใช้ไฟล์สำรองแยกสาขา');
  requireThat(!batches.some(b=>b.destination.brand!==d.brand && b.files.some(f=>batch.files.some(n=>n.sha256===f.sha256))), 'พบไฟล์เดียวกันถูกผูกกับร้านอื่นแล้ว');
  return [...batches.filter(b=>!(b.destination.brand===d.brand && b.destination.date===d.date && b.destination.branch===d.branch)),batch];
}
