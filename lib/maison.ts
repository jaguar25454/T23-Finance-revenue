import reference from '@/app/data/maison-reference.json';
import {brandData,formatBusinessDate,formatPeriod,isBusinessDate,isValidPeriod,makePeriod,periodDays,type BrandData,type Period} from './report-data';
import {clean,foodstoryCsv,foodstoryKey,type FoodstoryBatch,type FoodstoryBill,type FoodstoryFile,type FoodstoryItem,type SaryuItem} from './saryu';
export type {FoodstoryBatch,FoodstoryFile} from './saryu';

export const maisonReference=reference;
export const maisonOutputs=['Food','Beverage - Non-Alcohol','Beverage - Alcohol','Other','Pop Up - Chef Philipp'];
const key=(value:string)=>clean(value).toLowerCase();
const money=(value:number)=>Math.round(value*100)/100;
const need=(ok:unknown,message:string):void=>{if(!ok)throw new Error(message);};
const number=(value:string,label:string)=>{const text=value.trim().replace(/,/g,'');need(/^-?\d+(?:\.\d+)?$/.test(text),`ค่า ${label} ไม่ใช่ตัวเลข`);const result=Number(text);need(Number.isFinite(result)&&result>=0,`ค่า ${label} ติดลบหรือไม่ถูกต้อง ต้องตรวจรายงานคืนเงิน`);return result;};
const dateValue=(value:string)=>{const match=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);const result=match?`${match[3]}-${match[2]}-${match[1]}`:'';need(isBusinessDate(result),'วันที่ใน FoodStory ไม่ถูกต้อง');return result;};
const near=(a:number,b:number,label:string)=>need(Math.abs(money(a)-money(b))<0.011,`${label} ไม่ตรงกัน (${money(a)} / ${money(b)})`);

export type MaisonMaster={version:1;brandId:'maison';sourceSha256:string;items:SaryuItem[];groups:{subgroup:string;category:string}[]};

export function verifyMaisonFoodstory(files:FoodstoryFile[],date:string):FoodstoryBatch {
  need(isBusinessDate(date),'กรุณาเลือก Business Date');
  need(files.length===2,'ต้องเลือก CSV รายละเอียดบิลและสรุปตามบิลอย่างละ 1 ไฟล์');
  let items:FoodstoryItem[]|undefined,bills:FoodstoryBill[]|undefined;
  for(const file of files){
    need(/\.csv$/i.test(file.name),'Maison รองรับรายงาน FoodStory CSV สองประเภทนี้เท่านั้น');
    need(file.text.length<=10000000,'ไฟล์ใหญ่เกินกำหนด');
    const rows=foodstoryCsv(file.text),headers=rows.shift()??[];
    need(new Set(headers).size===headers.length,'หัวคอลัมน์ซ้ำ');
    const detail=headers.includes('ชื่อเมนู');
    const expected=detail?['วันที่ชำระเงิน','หมายเลขใบเสร็จ / ID','INV. No','รหัสเมนู','ชื่อเมนู','กลุ่ม','หมวดสินค้า','จำนวน','ราคาต่อหน่วย','ยอดก่อนลด','ส่วนลดสินค้า','ราคาสุทธิ','สาขา']:['วันที่ชำระเงิน','หมายเลขใบเสร็จ / ID','INV. No','ยอดก่อนลด','ส่วนลดสินค้า','ส่วนลดบิล','ค่าบริการ','ภาษี','ยอดปัดเศษ','จำนวนลูกค้า','โต๊ะ','ประเภทการชำระเงิน','คืนเงิน','ส่วนลด Voucher','มูลค่า Voucher มูลค่า Voucher มีโอกาสที่จะมากกว่ายอดรวมทั้งบิล ส่วนลดที่ใช้ได้สูงสุดจึงเป็นยอดรวมของบิล','ค่าจัดส่ง','ทิป','สาขา'];
    need(expected.every(header=>headers.includes(header)),'โครงสร้างไม่ใช่รายงาน FoodStory ที่รองรับ หรือคอลัมน์ไม่ครบ');
    const netHeader=headers.find(header=>header.startsWith('ยอดรวม ยอดก่อนลด')),totalHeader=headers.find(header=>header.startsWith('รวมสุทธิ ('));
    if(!detail)need(netHeader&&totalHeader,'ไม่พบยอดรวม / รวมสุทธิของสรุปบิล');
    const totalRows=rows.filter(row=>row[0]==='Total');need(totalRows.length===1,'ต้องมีแถว Total เพียง 1 แถว');
    const totals=totalRows[0],data=rows.filter(row=>row[0]!=='Total');need(data.length>0,'รายงานไม่มีรายการ');
    need(rows.every(row=>row.length===headers.length),'จำนวนคอลัมน์ใน CSV ไม่ครบ');
    const get=(row:string[],header:string)=>row[headers.indexOf(header)],num=(row:string[],header:string)=>number(get(row,header),header);
    const common=(row:string[])=>{need(key(get(row,'สาขา'))===key(reference.branch),'สาขาไม่ใช่ Maison Dunand ห้าม Import ข้ามร้าน');const businessDate=dateValue(get(row,'วันที่ชำระเงิน'));need(businessDate===date,'วันที่รายงานไม่ตรงกับ Business Date');const receipt=clean(get(row,'หมายเลขใบเสร็จ / ID')),invoice=clean(get(row,'INV. No'));need(receipt&&invoice,'ไม่มีเลขอ้างอิงบิล');return {date:businessDate,receipt,invoice};};
    if(detail){
      need(!items,'เลือกรายละเอียดบิลซ้ำ');
      items=data.map(row=>{const name=clean(get(row,'ชื่อเมนู')),posGroup=clean(get(row,'กลุ่ม')),sourceCategory=clean(get(row,'หมวดสินค้า')),code=clean(get(row,'รหัสเมนู'));need(name,'ไม่มีชื่อเมนู');const item={...common(row),id:foodstoryKey(name,posGroup,sourceCategory),code,name,posGroup,sourceCategory,quantity:num(row,'จำนวน'),price:num(row,'ราคาต่อหน่วย'),gross:num(row,'ยอดก่อนลด'),discount:num(row,'ส่วนลดสินค้า'),net:num(row,'ราคาสุทธิ')};near(item.gross-item.discount,item.net,'ราคาสุทธิสินค้า');return item;});
      for(const [field,header] of [['gross','ยอดก่อนลด'],['discount','ส่วนลดสินค้า'],['net','ราคาสุทธิ'],['quantity','จำนวน']] as const)near(items.reduce((sum,row)=>sum+row[field],0),num(totals,header),`Total ${header}`);
    }else{
      need(!bills,'เลือกสรุปตามบิลซ้ำ');
      bills=data.map(row=>{for(const header of ['คืนเงิน','ส่วนลด Voucher','มูลค่า Voucher มูลค่า Voucher มีโอกาสที่จะมากกว่ายอดรวมทั้งบิล ส่วนลดที่ใช้ได้สูงสุดจึงเป็นยอดรวมของบิล','ค่าจัดส่ง','ทิป'])need(num(row,header)===0,`พบ ${header} ต้องตรวจ Logic ก่อน Import ไม่หักหรือจัดสรรอัตโนมัติ`);const bill={...common(row),gross:num(row,'ยอดก่อนลด'),itemDiscount:num(row,'ส่วนลดสินค้า'),billDiscount:num(row,'ส่วนลดบิล'),net:num(row,netHeader!),service:num(row,'ค่าบริการ'),tax:num(row,'ภาษี'),rounding:num(row,'ยอดปัดเศษ'),total:num(row,totalHeader!),guests:num(row,'จำนวนลูกค้า'),table:clean(get(row,'โต๊ะ')),payment:clean(get(row,'ประเภทการชำระเงิน'))};need(Number.isInteger(bill.guests),'จำนวนลูกค้าต้องเป็นจำนวนเต็ม');near(bill.gross-bill.itemDiscount,bill.net,'ยอดสินค้าสรุปบิล');near(bill.net-bill.billDiscount+bill.service+bill.tax+bill.rounding,bill.total,'ยอดรวมสุทธิบิล');return bill;});
      need(new Set(bills.map(bill=>bill.receipt)).size===bills.length,'เลขบิลซ้ำ ต้องตรวจการแบ่งชำระก่อน Import');
      for(const [field,header] of [['gross','ยอดก่อนลด'],['itemDiscount','ส่วนลดสินค้า'],['billDiscount','ส่วนลดบิล'],['service','ค่าบริการ'],['tax','ภาษี'],['guests','จำนวนลูกค้า'],['total',totalHeader!]] as const)near(bills.reduce((sum,row)=>sum+row[field],0),num(totals,header),`Total ${header}`);
    }
  }
  need(items&&bills,'ต้องมีรายงานสองประเภทครบ');
  need(items!.every(item=>bills!.some(bill=>bill.receipt===item.receipt&&bill.invoice===item.invoice)),'รายละเอียดมีบิลที่ไม่อยู่ในสรุป หรือ Invoice ไม่ตรงกัน');
  for(const bill of bills!){const allocated=items!.filter(item=>item.receipt===bill.receipt).reduce((sum,item)=>sum+item.net,0);need(money(allocated)<=money(bill.net),`รายละเอียดบิล ${bill.receipt} สูงกว่าสรุปบิล`);}
  return {date,files:files.map(file=>({name:file.name,text:file.text})),items:items!,bills:bills!};
}

export const originalMaisonBatch=verifyMaisonFoodstory(reference.files,'2026-09-01');
const subgroupFor=(category:string)=>reference.groups.find(group=>group.criteria.some(value=>key(value)===key(category||'Other Food')))?.subgroup??'Unmapped';
export function mergeMaisonItems(master:MaisonMaster,batch:FoodstoryBatch):MaisonMaster {const items=master.items.map(item=>({...item,prices:[...item.prices]}));for(const row of batch.items){const old=items.find(item=>item.id===row.id);if(old){if(!old.prices.includes(row.price))old.prices.push(row.price);}else items.push({id:row.id,name:row.name,posGroup:row.posGroup,sourceCategory:row.sourceCategory,subgroup:subgroupFor(row.sourceCategory),prices:[row.price],source:`FoodStory ${formatBusinessDate(batch.date)}`});}return {...master,items};}
export const originalMaisonMaster=mergeMaisonItems({version:1,brandId:'maison',sourceSha256:reference.workbook.sha256,items:reference.catalog.map(item=>({...item,subgroup:subgroupFor(item.sourceCategory)})),groups:reference.groups.map(group=>({subgroup:group.subgroup,category:group.category}))},originalMaisonBatch);
export function validateMaisonMaster(value:unknown,baseline:MaisonMaster=originalMaisonMaster):MaisonMaster {need(value&&typeof value==='object','Master ไม่ถูกต้อง');const master=value as MaisonMaster;need(master.version===1&&master.brandId==='maison'&&master.sourceSha256===reference.workbook.sha256&&Array.isArray(master.items)&&Array.isArray(master.groups),'ต้องใช้ Master ของ Maison Dunand ต้นแบบเดียวกัน');need(master.groups.length===reference.groups.length&&new Set(master.groups.map(group=>group.subgroup)).size===master.groups.length,'Sub Type ไม่ครบหรือซ้ำ');const groups=master.groups.map(group=>{need(reference.groups.some(item=>item.subgroup===group.subgroup)&&maisonOutputs.slice(0,4).includes(group.category),'Sub Type / Output ไม่ถูกต้อง');return {subgroup:group.subgroup,category:group.category};});need(master.items.length===baseline.items.length&&new Set(master.items.map(item=>item.id)).size===master.items.length,'เมนูไม่ครบหรือซ้ำ');const items=baseline.items.map(item=>{const next=master.items.find(candidate=>candidate.id===item.id);need(next&&typeof next.name==='string'&&clean(next.name).length>0&&next.name.length<=2000&&(next.subgroup==='Unmapped'||groups.some(group=>group.subgroup===next.subgroup)),'การจัดหมวดเมนูไม่ถูกต้อง');return {...item,name:clean(next!.name),subgroup:next!.subgroup};});return {...baseline,items,groups};}
export function maisonDataset(imported:FoodstoryBatch[]){const days=new Map([[originalMaisonBatch.date,originalMaisonBatch]]);for(const batch of imported)days.set(batch.date,batch);return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));}
const entertainBill=(bill:FoodstoryBill)=>key(bill.payment).includes('entertain');
export function maisonSummary(master:MaisonMaster,batches:FoodstoryBatch[],period:Period){
  const days=isValidPeriod(period)?batches.filter(batch=>batch.date>=period.start&&batch.date<=period.end):[];
  const categories=new Map(maisonOutputs.map(output=>[output,0]));
  const allBills=days.flatMap(batch=>batch.bills),salesBills=allBills.filter(bill=>!entertainBill(bill)),entertainBills=allBills.filter(entertainBill);
  const detail=days.flatMap(batch=>batch.items.map(row=>({row,bill:batch.bills.find(candidate=>candidate.receipt===row.receipt)!}))).map(({row,bill})=>{const item=master.items.find(candidate=>candidate.id===row.id),group=master.groups.find(candidate=>candidate.subgroup===item?.subgroup);const output=entertainBill(bill)?'Entertain':bill.invoice.startsWith('A02')?'Pop Up - Chef Philipp':group?.category??'ยังไม่จัดหมวด';if(output!=='Entertain')categories.set(output,money((categories.get(output)??0)+row.net));return {...row,subgroup:item?.subgroup??'Unmapped',output};});
  const gaps=salesBills.map(bill=>{const allocated=detail.filter(item=>item.receipt===bill.receipt).reduce((sum,item)=>sum+item.net,0);return {...bill,allocated:money(allocated),unallocated:money(bill.net-allocated)};}).filter(bill=>bill.unallocated>0.01);
  const unallocated=money(gaps.reduce((sum,bill)=>sum+bill.unallocated,0));if(unallocated)categories.set('ยังไม่จัดหมวด',unallocated);
  const total=(rows:FoodstoryBill[],field:'gross'|'net'|'itemDiscount'|'billDiscount'|'service'|'tax'|'total'|'guests'|'rounding')=>money(rows.reduce((sum,bill)=>sum+bill[field],0));
  const sales=money(total(salesBills,'net')),guests=days.length?total(allBills,'guests'):null,entertain=money(total(entertainBills,'net'));
  return {days,detail,bills:allBills,gaps,categories:[...categories].map(([name,value])=>({name,value})),sales:days.length?sales:null,entertain:days.length?entertain:null,guests,totalPerPerson:guests?money(total(allBills,'gross')/guests):null,discount:days.length?money(total(salesBills,'itemDiscount')+total(salesBills,'billDiscount')):null,total:days.length?total(salesBills,'total'):null,service:total(salesBills,'service'),tax:total(salesBills,'tax'),rounding:total(salesBills,'rounding'),unallocated};
}
export function maisonSelection(master:MaisonMaster,batches:FoodstoryBatch[],period:Period){const summary=maisonSummary(master,batches,period),daily=maisonSummary(master,batches,makePeriod(period.end,'day')),months=new Map<string,number>();const trend=summary.days.map(batch=>{const sales=maisonSummary(master,[batch],makePeriod(batch.date,'day')).sales!;const month=batch.date.slice(0,7);months.set(month,money((months.get(month)??0)+sales));return {day:formatBusinessDate(batch.date),sales};});const data:BrandData={...brandData.maison,date:formatBusinessDate(period.end),month:formatPeriod(period),monthlySales:summary.sales,dailySales:daily.sales,monthlyEntertain:summary.entertain,dailyEntertain:daily.entertain,monthlyDiscount:summary.discount,dailyDiscount:daily.discount,monthlyCategories:summary.days.length?summary.categories:null,categories:daily.days.length?daily.categories:null,guest:daily.days.length?{guests:daily.guests,bills:daily.bills.length,totalPerPerson:daily.totalPerPerson}:null,dailyTrend:trend,monthTrend:[...months].map(([month,sales])=>({month:`${month.slice(5)}/${month.slice(2,4)}`,sales})),status:summary.days.length?(summary.unallocated?'FOODSTORY · NEEDS REVIEW':'FOODSTORY · MATCHED'):'NO DATA'};return {data,report:null,daysWithData:summary.days.length,selectedDays:periodDays(period)};}
export function maisonGuestMonth(master:MaisonMaster,batches:FoodstoryBatch[],selected:Period){const period=makePeriod(selected.end,'month'),summary=maisonSummary(master,batches,period);return {period,daysWithData:summary.days.length,selectedDays:periodDays(period),guests:summary.guests,bills:summary.days.length?summary.bills.length:null,tables:null,occupancy:null,guestDays:summary.days.length,billDays:summary.days.length,rows:summary.days.map(batch=>({date:batch.date,guests:batch.bills.reduce((sum,bill)=>sum+bill.guests,0),bills:batch.bills.length,totalPerPerson:null}))};}
export function maisonBackup(master:MaisonMaster,imported:FoodstoryBatch[]){return JSON.stringify({format:'maison-foodstory-local',version:1,master,imports:imported.map(batch=>({date:batch.date,files:batch.files}))},null,2);}
export function restoreMaisonBackup(text:string){const backup=JSON.parse(text);need(backup.format==='maison-foodstory-local'&&backup.version===1&&Array.isArray(backup.imports)&&backup.imports.length<=3660,'ไม่ใช่ Backup FoodStory ของ Maison Dunand');const imported:FoodstoryBatch[]=backup.imports.map((row:{date:string;files:FoodstoryFile[]})=>verifyMaisonFoodstory(row.files,row.date));need(new Set(imported.map(row=>row.date)).size===imported.length,'Backup มีวันที่ซ้ำ');const baseline=imported.reduce(mergeMaisonItems,originalMaisonMaster);return {imported,master:validateMaisonMaster(backup.master,baseline)};}
