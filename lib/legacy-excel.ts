// Read-only BIFF Excel import. No formulas, macros or links are executed.
export async function legacyExcelTable(bytes: Uint8Array): Promise<unknown[][]> {
  const ole = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i)=>bytes[i]===v);
  const biff = bytes.length>=8 && bytes[0]===0x09 && [0x00,0x02,0x04,0x08].includes(bytes[1]);
  if(!ole && !biff) throw new Error('เนื้อหาไม่ใช่ Excel .xls แบบ BIFF กรุณาส่งออก .xls จริง หรือบันทึกเป็น .xlsx / UTF-8 CSV ไม่ใช่เปลี่ยนนามสกุล');
  const xls = await import('@e965/xlsx');
  const workbook = xls.read(bytes, {type:'array',cellDates:false,cellNF:true,cellFormula:true,cellHTML:false,cellText:false,bookVBA:false,sheetRows:100031,WTF:true});
  if(workbook.SheetNames.length>50) throw new Error('Excel .xls เกิน 50 ชีต');
  const candidates:unknown[][][]=[];
  let cellCount=0;
  for(const name of workbook.SheetNames) {
    const sheet=workbook.Sheets[name];
    const ref=sheet?.['!fullref']??sheet?.['!ref'];
    if(!ref) continue;
    const range=xls.utils.decode_range(ref);
    cellCount+=(range.e.r-range.s.r+1)*(range.e.c-range.s.c+1);
    if(range.e.r>=100031 || range.e.c>=128 || cellCount>2_000_000) throw new Error('Excel .xls ใหญ่เกินขอบเขตตาราง (100,000 แถว / 128 คอลัมน์ / 2 ล้านช่อง)');
    const table=xls.utils.sheet_to_json<unknown[]>(sheet,{header:1,raw:true,defval:null,blankrows:true});
    const header=table.slice(0,30).findIndex(row=>row.includes('ItemCode')&&row.includes('ExtendedPriceTax'));
    if(header<0) continue;
    for(const [address,cell] of Object.entries(sheet)) {
      if(address.startsWith('!')) continue;
      if(cell.f || cell.t==='e') throw new Error(`Excel .xls ชีต ${name} ช่อง ${address}: พบสูตรหรือค่า Error กรุณาส่งออกรายงานแบบค่า (Values)`);
    }
    // Excel serial dates are civil dates, never local/UTC timestamps. Decode
    // the workbook's 1900/1904 date system without a timezone shift.
    const dateColumn=table[header].indexOf('SaleDate');
    if(dateColumn>=0) for(let r=header+1;r<table.length;r++) {
      const cell=sheet[xls.utils.encode_cell({r:r+range.s.r,c:dateColumn+range.s.c})];
      if(cell?.t==='n' && xls.SSF.is_date(cell.z??'')) {
        const date=xls.SSF.parse_date_code(cell.v as number,{date1904:!!workbook.Workbook?.WBProps?.date1904});
        if(!date) throw new Error(`Excel .xls: วันที่แถว ${r+1} ไม่ถูกต้อง`);
        table[r][dateColumn]=`${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
      }
    }
    candidates.push(table);
  }
  if(candidates.length!==1) throw new Error('Excel ต้องมีตารางรายงาน S102 หรือ S104 เพียงหนึ่งชุด ไม่ใช่ไฟล์ Category/Master Data');
  return candidates[0];
}
