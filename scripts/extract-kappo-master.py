"""Read-only source extraction. Persist only explicitly allowed selling/catalog fields."""
from pathlib import Path
import json, re, sys, hashlib, zipfile
from collections import defaultdict
import xml.etree.ElementTree as ET
import pdfplumber

base = Path(sys.argv[1])
book = base / 'Kappo Takashi_Daily_Sales_Report_20260901-For Codex.xlsx'
pdfpath = base / 'KAPPO-I106.pdf'
ns = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
clean = lambda v: re.sub(r'\s+', ' ', str(v or '')).strip()
key = lambda v: clean(v).lower()
with zipfile.ZipFile(book) as z:
    strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheet = next(s for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', ns) if s.attrib['name']=='Category')
    target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    xml = ET.fromstring(z.read(target.lstrip('/') if target.startswith('/') else 'xl/'+target))
    cells = {}
    for c in xml.findall('m:sheetData/m:row/m:c',ns):
        v=c.find('m:v',ns)
        if v is not None: cells[c.attrib['r']] = strings[int(v.text)] if c.attrib.get('t')=='s' else v.text
    merged={}
    for m in xml.findall('m:mergeCells/m:mergeCell',ns):
        match=re.fullmatch(r'D(\d+):D(\d+)',m.attrib['ref'])
        if match:
            start,end=map(int,match.groups())
            for row in range(start,end+1): merged[row]=start
    groups=[]
    for row in range(4,19):
        if clean(cells.get(f'O{row}')):
            groups.append({'subgroup':clean(cells[f'O{row}']), 'type':clean(cells.get(f'P{row}')), 'category':clean(cells.get(f'Q{row}')), 'sourceRow':row})
    mapping=[]
    for row in range(4,474):
        code=clean(cells.get(f'F{row}'))
        if not code or code=='Code': continue
        assert not clean(cells.get(f'I{row}')), 'Review nonempty workbook selling prices before changing precedence'
        mapping.append({'itemCode':code,'menu':clean(cells.get(f'G{row}')), 'subgroup':clean(cells.get(f'K{row}')), 'sourceCategory':clean(cells.get(f'D{merged.get(row,row)}')), 'sourceRow':row})

catalog=[]; totals=[]; current_group=''
with pdfplumber.open(pdfpath) as pdf:
    assert len(pdf.pages)==8
    for page_number,page in enumerate(pdf.pages,1):
        # Delete the entire disallowed column before extracting text/words.
        safe=page.filter(lambda o: o.get('object_type')!='char' or not (332.5<=o['x0']<405 and o['top']>=90))
        words=safe.extract_words(x_tolerance=1,y_tolerance=2)
        codes=[w for w in words if 82<=w['x0']<144 and 108<w['top']<810 and re.fullmatch(r'(?:[A-Za-z]+-[A-Za-z0-9]+-?\d+|Om\d+)',w['text'])]
        headings=[]
        lines=defaultdict(list)
        for w in words:
            if 108<w['top']<810: lines[round(w['top'],0)].append(w)
        for y,ws in sorted(lines.items()):
            if any(w['x0']<30 or w['text']=='Total' for w in ws):
                text=clean(' '.join(w['text'] for w in sorted(ws,key=lambda w:w['x0'])))
                if text.startswith('Total of '):
                    n=re.search(r'(\d+)\s+รายการ',text)
                    assert n, text
                    totals.append(int(n.group(1)))
                    headings.append((y,None))
                else: headings.append((y,text))
        for i,c in enumerate(codes):
            previous=[(y,t) for y,t in headings if y<c['top'] and t]
            if previous: current_group=previous[-1][1]
            # The PDF draws each row in cell order. Use that order, not nearest
            # vertical centers (which truncate long wrapped names beside short rows).
            start=next(j for j,ch in enumerate(safe.chars) if abs(ch['x0']-c['x0'])<.2 and abs(ch['top']-c['top'])<.2)
            text_columns={146:[],241:[]}; column=None; previous_y=None
            for ch in safe.chars[start:]:
                if ch['x0']>=405: break
                anchor=next((x for x in text_columns if abs(ch['x0']-(146.2 if x==146 else 241.2))<.25),None)
                if anchor is not None:
                    column=anchor
                    if text_columns[column]: text_columns[column].append(' ')
                if column is not None: text_columns[column].append(ch['text'])
            def description(left,right): return clean(''.join(text_columns[left]))
            def amount(left,right):
                selected=[w for w in words if left<=w['x0']<right and abs(w['top']-c['top'])<3]
                assert len(selected)==1,(page_number,c['text'],left)
                return float(selected[0]['text'].replace(',',''))
            before,tax,unit=amount(405,459),amount(459,510),amount(510,580)
            assert abs(before+tax-unit)<.011
            catalog.append({'itemCode':c['text'],'menu':description(146,241),'description2':description(241,332.5), 'posCategory':current_group,'sellingPrice':before,'sellingTax':tax,'sellingPriceWithTax':unit,'sourcePage':page_number})
        if headings and headings[-1][1]: current_group=headings[-1][1]
assert sum(totals)==len(catalog),(sum(totals),len(catalog))
assert len({key(r['itemCode']) for r in catalog})==len(catalog)
dupes=defaultdict(list)
for r in mapping: dupes[key(r['itemCode'])].append(r)
data={'brandId':'kappo','workbook':{'filename':book.name,'sha256':hashlib.sha256(book.read_bytes()).hexdigest(),'sheet':'Category'},'catalogSource':{'filename':pdfpath.name,'sha256':hashlib.sha256(pdfpath.read_bytes()).hexdigest(),'pages':8,'sellingPriceBasis':'ราคาก่อนรวมภาษี','sellingPriceDate':'2026-09-03'},'groups':groups,'mapping':mapping,'catalog':catalog,'duplicateCodes':[rows for rows in dupes.values() if len(rows)>1]}
target=Path(__file__).resolve().parents[1]/'app/data/kappo-master-reference.json'
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'catalog':len(catalog),'categoryRows':len(mapping),'uniqueCategoryCodes':len(dupes),'groups':len(groups),'duplicates':data['duplicateCodes'],'catalogOnly':sum(key(r['itemCode']) not in dupes for r in catalog)},ensure_ascii=False))
for row in catalog: print(json.dumps(row,ensure_ascii=False))
