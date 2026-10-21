import reference from '@/app/data/saryu-reference.json';
import { brandData, formatBusinessDate, formatPeriod, isBusinessDate, isValidPeriod, makePeriod, periodDays, type BrandData, type Period } from './report-data';

export const saryuReference=reference;
export const saryuOutputs=['Food','Beverage - Non-Alcohol','Beverage - Alcohol','Other'];
export const clean=(s:string)=>s.trim().replace(/\s+/g,' ');
const key=(s:string)=>clean(s).toLowerCase();
const money=(n:number)=>Math.round(n*100)/100;
const need=(ok:unknown,message:string):void=>{if(!ok)throw new Error(message);};
export const foodstoryKey=(name:string,group:string,category:string)=>JSON.stringify([key(name),key(group),key(category)]);
export type FoodstoryItem={id:string;date:string;receipt:string;invoice:string;code:string;name:string;posGroup:string;sourceCategory:string;quantity:number;price:number;gross:number;discount:number;net:number};
export type FoodstoryBill={date:string;receipt:string;invoice:string;gross:number;itemDiscount:number;billDiscount:number;net:number;service:number;tax:number;rounding:number;total:number;guests:number;table:string;payment:string};
export type FoodstoryFile={name:string;text:string};
export type FoodstoryBatch={date:string;files:FoodstoryFile[];items:FoodstoryItem[];bills:FoodstoryBill[]};
export type SaryuItem={id:string;name:string;posGroup:string;sourceCategory:string;subgroup:string;prices:number[];source:string};
export type SaryuMaster={version:1;brandId:'saryu';sourceSha256:string;items:SaryuItem[];groups:{subgroup:string;category:string}[]};

// RFC 4180: quoted commas, escaped quotes and embedded line breaks are retained.
export function foodstoryCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else {need(quoted||cell==='', 'CSV มีเครื่องหมายคำพูดผิดโครงสร้าง');quoted=!quoted;}}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
  need(!quoted,'CSV ปิดเครื่องหมายคำพูดไม่ครบ');row.push(cell);if(row.some(Boolean))rows.push(row);return rows;
}
const number=(s:string,label:string)=>{const t=s.trim().replace(/,/g,'');need(/^-?\d+(?:\.\d+)?$/.test(t),`ค่า ${label} ไม่ใช่ตัวเลข`);const n=Number(t);need(Number.isFinite(n)&&n>=0,`ค่า ${label} ติดลบหรือไม่ถูกต้อง ต้องตรวจรายงานคืนเงิน`);return n;};
const dateValue=(s:string)=>{const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);const d=m?`${m[3]}-${m[2]}-${m[1]}`:'';need(isBusinessDate(d),'วันที่ใน FoodStory ไม่ถูกต้อง');return d;};
const near=(a:number,b:number,label:string)=>need(Math.abs(money(a)-money(b))<0.011,`${label} ไม่ตรงกัน (${money(a)} / ${money(b)})`);

export type FoodstoryVerifyOptions={branch?:string;branchLabel?:string;normalizeCategory?:(category:string)=>string};
export function verifyFoodstory(files:FoodstoryFile[],date:string,options:FoodstoryVerifyOptions={}):FoodstoryBatch {
  const expectedBranch=options.branch??'Sushi Saryu',branchLabel=options.branchLabel??'SUSHI SARYU',normalizeCategory=options.normalizeCategory??((category:string)=>category);
  need(isBusinessDate(date),'กรุณาเลือก Business Date');need(files.length===2,'ต้องเลือก CSV รายละเอียดบิลและสรุปตามบิลอย่างละ 1 ไฟล์');
  let items:FoodstoryItem[]|undefined,bills:FoodstoryBill[]|undefined;
  for(const file of files){
    need(/\.csv$/i.test(file.name),'FoodStory รองรับรายงาน CSV สองประเภทนี้เท่านั้น');need(file.text.length<=10000000,'ไฟล์ใหญ่เกินกำหนด');
    const rows=foodstoryCsv(file.text),headers=rows.shift()??[];
    need(new Set(headers).size===headers.length,'หัวคอลัมน์ซ้ำ');
    const detail=headers.includes('ชื่อเมนู'),expected=detail?['วันที่ชำระเงิน','หมายเลขใบเสร็จ / ID','INV. No','รหัสเมนู','ชื่อเมนู','กลุ่ม','หมวดสินค้า','จำนวน','ราคาต่อหน่วย','ยอดก่อนลด','ส่วนลดสินค้า','ราคาสุทธิ','สาขา']:['วันที่ชำระเงิน','หมายเลขใบเสร็จ / ID','INV. No','ยอดก่อนลด','ส่วนลดสินค้า','ส่วนลดบิล','ค่าบริการ','ภาษี','ยอดปัดเศษ','จำนวนลูกค้า','โต๊ะ','ประเภทการชำระเงิน','คืนเงิน','ส่วนลด Voucher','มูลค่า Voucher มูลค่า Voucher มีโอกาสที่จะมากกว่ายอดรวมทั้งบิล ส่วนลดที่ใช้ได้สูงสุดจึงเป็นยอดรวมของบิล','ค่าจัดส่ง','ทิป','สาขา'];
    need(expected.every(h=>headers.includes(h)),'โครงสร้างไม่ใช่รายงาน FoodStory ที่รองรับ หรือคอลัมน์ไม่ครบ');
    const netHeader=headers.find(h=>h.startsWith('ยอดรวม ยอดก่อนลด')),totalHeader=headers.find(h=>h.startsWith('รวมสุทธิ ('));
    if(!detail)need(netHeader&&totalHeader,'ไม่พบยอดรวม / รวมสุทธิของสรุปบิล');
    const totalRows=rows.filter(r=>r[0]==='Total');need(totalRows.length===1,'ต้องมีแถว Total เพียง 1 แถว');
    const totals=totalRows[0],data=rows.filter(r=>r[0]!=='Total');need(data.length>0,'รายงานไม่มีรายการ');
    need(rows.every(r=>r.length===headers.length),'จำนวนคอลัมน์ใน CSV ไม่ครบ');
    const get=(r:string[],h:string)=>r[headers.indexOf(h)],num=(r:string[],h:string)=>number(get(r,h),h);
    const common=(r:string[])=>{need(key(get(r,'สาขา'))===key(expectedBranch),`สาขาไม่ใช่ ${branchLabel} ห้าม Import ข้ามร้าน`);const d=dateValue(get(r,'วันที่ชำระเงิน'));need(d===date,'วันที่รายงานไม่ตรงกับ Business Date');const receipt=clean(get(r,'หมายเลขใบเสร็จ / ID')),invoice=clean(get(r,'INV. No'));need(receipt&&invoice,'ไม่มีเลขอ้างอิงบิล');return {date:d,receipt,invoice};};
    if(detail){need(!items,'เลือกรายละเอียดบิลซ้ำ');items=data.map(r=>{const name=clean(get(r,'ชื่อเมนู')),posGroup=clean(get(r,'กลุ่ม')),sourceCategory=clean(normalizeCategory(clean(get(r,'หมวดสินค้า')))),code=clean(get(r,'รหัสเมนู'));need(name,'ไม่มีชื่อเมนู');need(sourceCategory,'ไม่มีหมวดสินค้า');const item={...common(r),id:foodstoryKey(name,posGroup,sourceCategory),code,name,posGroup,sourceCategory,quantity:num(r,'จำนวน'),price:num(r,'ราคาต่อหน่วย'),gross:num(r,'ยอดก่อนลด'),discount:num(r,'ส่วนลดสินค้า'),net:num(r,'ราคาสุทธิ')};near(item.gross-item.discount,item.net,'ราคาสุทธิสินค้า');return item;});for(const [field,header] of [['gross','ยอดก่อนลด'],['discount','ส่วนลดสินค้า'],['net','ราคาสุทธิ'],['quantity','จำนวน']] as const)near(items.reduce((n,r)=>n+r[field],0),num(totals,header),`Total ${header}`);
    }else{need(!bills,'เลือกสรุปตามบิลซ้ำ');bills=data.map(r=>{for(const h of ['คืนเงิน','ส่วนลด Voucher','มูลค่า Voucher มูลค่า Voucher มีโอกาสที่จะมากกว่ายอดรวมทั้งบิล ส่วนลดที่ใช้ได้สูงสุดจึงเป็นยอดรวมของบิล','ค่าจัดส่ง','ทิป'])need(num(r,h)===0,`พบ ${h} ต้องตรวจ Logic ก่อน Import ไม่หักหรือจัดสรรอัตโนมัติ`);const b={...common(r),gross:num(r,'ยอดก่อนลด'),itemDiscount:num(r,'ส่วนลดสินค้า'),billDiscount:num(r,'ส่วนลดบิล'),net:num(r,netHeader!),service:num(r,'ค่าบริการ'),tax:num(r,'ภาษี'),rounding:num(r,'ยอดปัดเศษ'),total:num(r,totalHeader!),guests:num(r,'จำนวนลูกค้า'),table:clean(get(r,'โต๊ะ')),payment:clean(get(r,'ประเภทการชำระเงิน'))};need(Number.isInteger(b.guests),'จำนวนลูกค้าต้องเป็นจำนวนเต็ม');near(b.gross-b.itemDiscount,b.net,'ยอดสินค้าสรุปบิล');near(b.net-b.billDiscount+b.service+b.tax+b.rounding,b.total,'ยอดรวมสุทธิบิล');return b;});need(new Set(bills.map(b=>b.receipt)).size===bills.length,'เลขบิลซ้ำ ต้องตรวจการแบ่งชำระก่อน Import');for(const [field,header] of [['gross','ยอดก่อนลด'],['itemDiscount','ส่วนลดสินค้า'],['billDiscount','ส่วนลดบิล'],['service','ค่าบริการ'],['tax','ภาษี'],['guests','จำนวนลูกค้า'],['total',totalHeader!]] as const)near(bills.reduce((n,r)=>n+r[field],0),num(totals,header),`Total ${header}`);}
  }
  need(items&&bills,'ต้องมีรายงานสองประเภทครบ');
  for(const bill of bills!){const lines=items!.filter(r=>r.receipt===bill.receipt);need(lines.length&&lines.every(r=>r.invoice===bill.invoice),'เลขอ้างอิงบิลไม่ตรงกันระหว่างสองรายงาน');near(lines.reduce((n,r)=>n+r.gross,0),bill.gross,'ยอดสินค้าต่อบิล');near(lines.reduce((n,r)=>n+r.net,0),bill.net,'ยอดสุทธิสินค้าต่อบิล');}
  need(items!.every(r=>bills!.some(b=>b.receipt===r.receipt)),'รายละเอียดมีบิลที่ไม่อยู่ในสรุป');
  return {date,files:files.map(f=>({name:f.name,text:f.text})),items:items!,bills:bills!};
}
export const originalSaryuBatch=verifyFoodstory(reference.files,'2026-09-01');
const subgroupFor=(category:string)=>reference.groups.find(g=>g.criteria.some(c=>key(c)===key(category||'Other food')))?.subgroup??'Unmapped';
export function mergeSaryuItems(master:SaryuMaster,batch:FoodstoryBatch):SaryuMaster {
  const items=master.items.map(i=>({...i,prices:[...i.prices]}));
  for(const row of batch.items){const old=items.find(i=>i.id===row.id);if(old){if(!old.prices.includes(row.price))old.prices.push(row.price);}else items.push({id:row.id,name:row.name,posGroup:row.posGroup,sourceCategory:row.sourceCategory,subgroup:subgroupFor(row.sourceCategory),prices:[row.price],source:`FoodStory ${formatBusinessDate(batch.date)}`});}
  return {...master,items};
}
export const originalSaryuMaster=mergeSaryuItems({version:1,brandId:'saryu',sourceSha256:reference.workbook.sha256,items:reference.catalog.map(i=>({...i,subgroup:subgroupFor(i.sourceCategory)})),groups:reference.groups.map(g=>({subgroup:g.subgroup,category:g.category}))},originalSaryuBatch);
export function validateSaryuMaster(value:unknown,baseline:SaryuMaster=originalSaryuMaster):SaryuMaster {
  need(value&&typeof value==='object','Master ไม่ถูกต้อง');const m=value as SaryuMaster;
  need(m.version===1&&m.brandId==='saryu'&&m.sourceSha256===reference.workbook.sha256&&Array.isArray(m.items)&&Array.isArray(m.groups),'ต้องใช้ Master ของ SUSHI SARYU ต้นแบบเดียวกัน');
  need(m.groups.length===reference.groups.length&&new Set(m.groups.map(g=>g.subgroup)).size===m.groups.length,'Sub Type ไม่ครบหรือซ้ำ');
  const groups=m.groups.map(g=>{need(reference.groups.some(r=>r.subgroup===g.subgroup)&&saryuOutputs.includes(g.category),'Sub Type / Output ไม่ถูกต้อง');return {subgroup:g.subgroup,category:g.category};});
  need(m.items.length===baseline.items.length&&new Set(m.items.map(i=>i.id)).size===m.items.length,'เมนูไม่ครบหรือซ้ำ');
  const items=baseline.items.map(i=>{const next=m.items.find(n=>n.id===i.id);need(next&&typeof next.name==='string'&&clean(next.name).length>0&&next.name.length<=300&&(next.subgroup==='Unmapped'||groups.some(g=>g.subgroup===next.subgroup)),'การจัดหมวดเมนูไม่ถูกต้อง');return {...i,name:clean(next!.name),subgroup:next!.subgroup};});
  return {...baseline,items,groups};
}
export function saryuDataset(imported:FoodstoryBatch[]){const days=new Map([[originalSaryuBatch.date,originalSaryuBatch]]);for(const b of imported)days.set(b.date,b);return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));}
export function saryuSummary(master:SaryuMaster,batches:FoodstoryBatch[],period:Period){
  const days=isValidPeriod(period)?batches.filter(b=>b.date>=period.start&&b.date<=period.end):[];
  const categories=new Map(saryuOutputs.map(k=>[k,0]));
  const detail=days.flatMap(b=>b.items).map(row=>{const item=master.items.find(i=>i.id===row.id),group=master.groups.find(g=>g.subgroup===item?.subgroup),output=group?.category??'ยังไม่จัดหมวด';categories.set(output,money((categories.get(output)??0)+row.net));return {...row,subgroup:item?.subgroup??'Unmapped',output};});
  const bills=days.flatMap(b=>b.bills),total=(field:'gross'|'itemDiscount'|'billDiscount'|'service'|'tax'|'total'|'guests'|'rounding')=>money(bills.reduce((n,b)=>n+b[field],0));
  const sales=money(detail.reduce((n,r)=>n+r.net,0)),guests=days.length?total('guests'):null;
  return {days,detail,bills,categories:[...categories].map(([name,value])=>({name,value})),sales:days.length?sales:null,guests,totalPerPerson:guests?money(total('gross')/guests):null,discount:days.length?money(total('itemDiscount')+total('billDiscount')):null,total:days.length?total('total'):null,service:total('service'),tax:total('tax'),rounding:total('rounding')};
}
export function saryuSelection(master:SaryuMaster,batches:FoodstoryBatch[],period:Period){
  const s=saryuSummary(master,batches,period),daily=saryuSummary(master,batches,makePeriod(period.end,'day')),months=new Map<string,number>();
  const trend=s.days.map(b=>{const sales=saryuSummary(master,[b],makePeriod(b.date,'day')).sales!;const month=b.date.slice(0,7);months.set(month,money((months.get(month)??0)+sales));return {day:formatBusinessDate(b.date),sales};});
  const data:BrandData={...brandData.saryu,date:formatBusinessDate(period.end),month:formatPeriod(period),monthlySales:s.sales,dailySales:daily.sales,monthlyDiscount:s.discount,dailyDiscount:daily.discount,monthlyCategories:s.days.length?s.categories:null,categories:daily.days.length?daily.categories:null,guest:daily.days.length?{guests:daily.guests,bills:daily.bills.length,totalPerPerson:daily.totalPerPerson}:null,dailyTrend:trend,monthTrend:[...months].map(([m,sales])=>({month:`${m.slice(5)}/${m.slice(2,4)}`,sales})),status:s.days.length?(s.detail.some(r=>r.output==='ยังไม่จัดหมวด')?'FOODSTORY · NEEDS REVIEW':'FOODSTORY · MATCHED'):'NO DATA'};
  return {data,report:null,daysWithData:s.days.length,selectedDays:periodDays(period)};
}
export function saryuGuestMonth(master:SaryuMaster,batches:FoodstoryBatch[],selected:Period){const period=makePeriod(selected.end,'month'),s=saryuSummary(master,batches,period);return {period,daysWithData:s.days.length,selectedDays:periodDays(period),guests:s.guests,bills:s.days.length?s.bills.length:null,tables:null,occupancy:null,guestDays:s.days.length,billDays:s.days.length,rows:s.days.map(b=>({date:b.date,guests:b.bills.reduce((n,r)=>n+r.guests,0),bills:b.bills.length,totalPerPerson:null}))};}
export function saryuBackup(master:SaryuMaster,imported:FoodstoryBatch[]){return JSON.stringify({format:'saryu-foodstory-local',version:1,master,imports:imported.map(b=>({date:b.date,files:b.files}))},null,2);}
export function restoreSaryuBackup(text:string){const b=JSON.parse(text);need(b.format==='saryu-foodstory-local'&&b.version===1&&Array.isArray(b.imports)&&b.imports.length<=3660,'ไม่ใช่ Backup FoodStory ของ SUSHI SARYU');const imported:FoodstoryBatch[]=b.imports.map((r:{date:string;files:FoodstoryFile[]})=>verifyFoodstory(r.files,r.date));need(new Set(imported.map(r=>r.date)).size===imported.length,'Backup มีวันที่ซ้ำ');const baseline=imported.reduce(mergeSaryuItems,originalSaryuMaster);return {imported,master:validateSaryuMaster(b.master,baseline)};}
