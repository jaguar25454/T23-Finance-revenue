import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readXlsx from 'read-excel-file/node';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

globalThis.pdfjsWorker = pdfWorker;

const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Usage: node scripts/extract-lawoi-master.mjs <LAWOI source directory>');
const workbookPath = path.join(sourceDir, 'Lawoi_Daily_Sales_Report_20260901-For codex.xlsx');
const catalogPath = path.join(sourceDir, 'LAWOI-I106 all menus.pdf');
const outputPath = path.resolve('app/data/lawoi-master-reference.json');
const reportPath = path.resolve('app/data/lawoi-20260901.json');
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const key = value => clean(value).toLowerCase();
const sha256 = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const close = (actual, expected, label) => {
  if (Math.abs(actual - expected) > 0.011) throw new Error(`${label}: ${actual} != ${expected}`);
};

const sheetList = await readXlsx(workbookPath, { getSheets: true });
const sheetMap = new Map(sheetList.map(sheet => [sheet.sheet, sheet.data]));
for (const name of ['DashBord', 'Sale Lawoi', 'Guest Lawoi']) if (!sheetMap.has(name)) throw new Error(`Missing worksheet: ${name}`);
const sale = sheetMap.get('Sale Lawoi');
const dashboard = sheetMap.get('DashBord');
const at = (rows, row, column) => rows[row - 1]?.[column - 1] ?? null;
const labelAt = (row, column, expected) => {
  const value = clean(at(sale, row, column));
  if (value !== expected) throw new Error(`Sale Lawoi!${String.fromCharCode(64 + column)}${row}: ${value} != ${expected}`);
  return value;
};

const outputs = ['Food', 'Beverage - Non-Alcohol', 'Beverage - Alcohol', 'Other'];
const groups = [
  { subgroup: labelAt(11, 3, 'PASTA & RICE'), type: 'Food', category: outputs[0], sourceCell: 'C11' },
  { subgroup: labelAt(11, 4, 'Appetizer'), type: 'Food', category: outputs[0], sourceCell: 'D11' },
  { subgroup: labelAt(11, 5, 'Dessert'), type: 'Food', category: outputs[0], sourceCell: 'E11' },
  { subgroup: labelAt(11, 6, 'Other Food'), type: 'Food', category: outputs[0], sourceCell: 'F11' },
  { subgroup: labelAt(11, 8, 'Water'), type: outputs[1], category: outputs[1], sourceCell: 'H11' },
  { subgroup: labelAt(11, 9, 'Soft Drink'), type: outputs[1], category: outputs[1], sourceCell: 'I11' },
  { subgroup: labelAt(11, 10, 'Mocktails'), type: outputs[1], category: outputs[1], sourceCell: 'J11' },
  { subgroup: labelAt(11, 11, 'Coffee & Tea'), type: outputs[1], category: outputs[1], sourceCell: 'K11' },
  { subgroup: labelAt(10, 13, 'By Glass'), type: outputs[2], category: outputs[2], sourceCell: 'M10' },
  { subgroup: labelAt(10, 14, 'Wine Bottle'), type: outputs[2], category: outputs[2], sourceCell: 'N10' },
  { subgroup: labelAt(10, 15, 'Corkage Charge'), type: outputs[2], category: outputs[2], sourceCell: 'O10' },
  { subgroup: labelAt(10, 17, 'Sake'), type: outputs[2], category: outputs[2], sourceCell: 'Q10' },
  { subgroup: labelAt(10, 18, 'Beer'), type: outputs[2], category: outputs[2], sourceCell: 'R10' },
  { subgroup: labelAt(10, 19, 'Hard Liquor'), type: outputs[2], category: outputs[2], sourceCell: 'S10' },
  { subgroup: labelAt(8, 22, 'Other'), type: 'Other', category: outputs[3], sourceCell: 'V8' },
];

const posToSubgroup = new Map(Object.entries({
  BEER: 'Beer',
  BLUE: 'Appetizer',
  'DEPOSIT-SUSHI SHUNJI': 'Other',
  DESSERT: 'Dessert',
  HIGHBALL: 'Hard Liquor',
  'PASTA & RICE': 'PASTA & RICE',
  PETS: 'Other Food',
  RED: 'Appetizer',
  SAKE: 'Sake',
  SIDE: 'PASTA & RICE',
  SNACKS: 'Appetizer',
  'SOFT DRINKS': 'Soft Drink',
  'SUSHI SHUNJI': 'Other Food',
  'TEA POT': 'Coffee & Tea',
  Vegetarian: 'Other Food',
  WINE: 'Wine Bottle',
}));

const pdfBytes = new Uint8Array(fs.readFileSync(catalogPath));
const task = pdfjs.getDocument({ data: pdfBytes.slice(), useSystemFonts: true, disableFontFace: true, stopAtErrors: true });
const pdf = await task.promise;
if (pdf.numPages !== 18) throw new Error(`I106 page count changed: ${pdf.numPages}`);
const catalog = [];
const totals = [];
let currentGroup = '';
try {
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter(item => 'str' in item && clean(item.str))
      .map(item => ({ text: clean(item.str), x: item.transform[4], y: item.transform[5], width: item.width }));
    const headings = items.filter(item => item.x < 40 && item.y > 20 && item.y < 730);
    const codes = items.filter(item => item.x >= 80 && item.x < 145 && item.y > 20 && item.y < 730).sort((a, b) => b.y - a.y);
    for (let index = 0; index < codes.length; index++) {
      const code = codes[index];
      const heading = headings.filter(item => item.y > code.y).sort((a, b) => a.y - b.y)[0];
      if (heading) currentGroup = heading.text;
      if (!posToSubgroup.has(currentGroup)) throw new Error(`I106 page ${pageNumber}: unknown product category ${currentGroup}`);
      const upper = index ? (codes[index - 1].y + code.y) / 2 : 730;
      const lower = index + 1 < codes.length ? (code.y + codes[index + 1].y) / 2 : 20;
      const cellText = (left, right) => clean(items.filter(item => item.x >= left && item.x < right && item.y < upper && item.y > lower).sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text).join(' '));
      const amount = (left, right, label) => {
        const matches = items.filter(item => item.x >= left && item.x < right && Math.abs(item.y - code.y) < 0.2 && /^-?[\d,]+(?:\.\d+)?$/.test(item.text));
        if (matches.length !== 1) throw new Error(`I106 page ${pageNumber} ${code.text}: cannot read ${label}`);
        return Number(matches[0].text.replaceAll(',', ''));
      };
      const sellingPrice = amount(405, 470, 'selling price before tax');
      const sellingTax = amount(470, 525, 'tax');
      const sellingPriceWithTax = amount(525, 590, 'selling price with tax');
      close(sellingPrice + sellingTax, sellingPriceWithTax, `I106 page ${pageNumber} ${code.text}`);
      catalog.push({
        itemCode: code.text,
        menu: cellText(145, 241),
        description2: cellText(241, 332.5),
        posCategory: currentGroup,
        sellingPrice,
        sellingTax,
        sellingPriceWithTax,
        sourcePage: pageNumber,
      });
    }
    for (const total of items.filter(item => item.text === 'Total of')) {
      const group = items.find(item => item.x >= 320 && item.x < 405 && Math.abs(item.y - total.y) < 0.2)?.text;
      const countText = items.find(item => item.x >= 470 && item.x < 525 && Math.abs(item.y - total.y) < 0.2)?.text;
      if (!group || !/^\d+$/.test(countText ?? '')) throw new Error(`I106 page ${pageNumber}: cannot read category total`);
      totals.push({ group, count: Number(countText) });
    }
  }
} finally {
  await task.destroy();
}

if (totals.reduce((sum, row) => sum + row.count, 0) !== catalog.length || catalog.length !== 676) throw new Error(`I106 row count changed: ${catalog.length}`);
const actualGroupCounts = new Map();
for (const row of catalog) actualGroupCounts.set(row.posCategory, (actualGroupCounts.get(row.posCategory) ?? 0) + 1);
for (const total of totals) if (actualGroupCounts.get(total.group) !== total.count) throw new Error(`I106 ${total.group}: ${actualGroupCounts.get(total.group)} != ${total.count}`);
for (const group of posToSubgroup.keys()) if (!actualGroupCounts.has(group)) throw new Error(`I106 missing category ${group}`);
if (Object.keys(catalog[0]).join(',') !== 'itemCode,menu,description2,posCategory,sellingPrice,sellingTax,sellingPriceWithTax,sourcePage') throw new Error('Unsafe I106 catalog schema');

const duplicateMap = new Map();
for (const row of catalog) {
  const rows = duplicateMap.get(key(row.itemCode)) ?? [];
  rows.push(row);
  duplicateMap.set(key(row.itemCode), rows);
}
const duplicateCodes = [...duplicateMap.values()].filter(rows => rows.length > 1);
const mapping = catalog.map(row => ({
  itemCode: row.itemCode,
  menu: row.menu,
  subgroup: posToSubgroup.get(row.posCategory),
  sourceCategory: row.posCategory,
  sourcePage: row.sourcePage,
}));

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const catalogByCode = new Map();
for (const row of catalog) if (!catalogByCode.has(key(row.itemCode))) catalogByCode.set(key(row.itemCode), row);
const subgroupTotals = new Map(groups.map(group => [group.subgroup, 0]));
for (const row of report.S114.rows) {
  if (key(row.itemCode) === 'servicecharge') continue;
  const product = catalogByCode.get(key(row.itemCode));
  if (!product) throw new Error(`S114 ItemCode missing from I106: ${row.itemCode}`);
  const subgroup = posToSubgroup.get(product.posCategory);
  subgroupTotals.set(subgroup, (subgroupTotals.get(subgroup) ?? 0) + Number(row.price));
}
const expectedBySubgroup = new Map([
  ['PASTA & RICE', Number(at(sale, 12, 3))], ['Appetizer', Number(at(sale, 12, 4))], ['Dessert', Number(at(sale, 12, 5))], ['Other Food', Number(at(sale, 12, 6))],
  ['Water', Number(at(sale, 12, 8))], ['Soft Drink', Number(at(sale, 12, 9))], ['Mocktails', Number(at(sale, 12, 10))], ['Coffee & Tea', Number(at(sale, 12, 11))],
  ['By Glass', Number(at(sale, 12, 13))], ['Wine Bottle', Number(at(sale, 12, 14))], ['Corkage Charge', Number(at(sale, 12, 15))], ['Sake', Number(at(sale, 12, 17))], ['Beer', Number(at(sale, 12, 18))], ['Hard Liquor', Number(at(sale, 12, 19))], ['Other', Number(at(sale, 12, 22))],
]);
for (const [subgroup, expected] of expectedBySubgroup) close(subgroupTotals.get(subgroup) ?? 0, expected, `01/09/26 ${subgroup}`);
const outputTotals = new Map(outputs.map(output => [output, 0]));
for (const group of groups) outputTotals.set(group.category, outputTotals.get(group.category) + (subgroupTotals.get(group.subgroup) ?? 0));
const workbookOutputs = new Map([
  [outputs[0], Number(at(sale, 12, 7))],
  [outputs[1], Number(at(sale, 12, 12))],
  [outputs[2], Number(at(sale, 12, 16)) + Number(at(sale, 12, 20))],
  [outputs[3], Number(at(sale, 12, 22))],
]);
for (const output of outputs) close(outputTotals.get(output), workbookOutputs.get(output), `01/09/26 ${output}`);
close([...outputTotals.values()].reduce((sum, value) => sum + value, 0), Number(at(sale, 12, 23)), '01/09/26 Gross sales');
close(Number(at(dashboard, 3, 5)), workbookOutputs.get(outputs[0]), 'Dashboard Food');
close(Number(at(dashboard, 4, 5)), workbookOutputs.get(outputs[1]), 'Dashboard Beverage - Non-Alcohol');
close(Number(at(dashboard, 5, 5)), workbookOutputs.get(outputs[2]), 'Dashboard Beverage - Alcohol');
close(Number(at(dashboard, 6, 5)), workbookOutputs.get(outputs[3]), 'Dashboard Other');

const data = {
  brandId: 'lawoi',
  workbook: {
    filename: path.basename(workbookPath),
    sha256: sha256(workbookPath),
    sheets: sheetList.map(sheet => ({ name: sheet.sheet, rowsRead: sheet.data.length, cellsRead: sheet.data.reduce((sum, row) => sum + row.length, 0), nonEmptyCells: sheet.data.flat().filter(value => value !== null).length })),
    structureSheet: 'Sale Lawoi',
    businessDate: '2026-09-01',
  },
  catalogSource: {
    filename: path.basename(catalogPath),
    sha256: sha256(catalogPath),
    pages: pdf.numPages,
    sellingPriceBasis: 'ราคาก่อนรวมภาษี',
    sellingPriceDate: '2026-09-03',
  },
  outputs,
  groups,
  mapping,
  catalog,
  duplicateCodes,
  reconciliation: {
    businessDate: '2026-09-01',
    subgroups: Object.fromEntries(expectedBySubgroup),
    outputs: Object.fromEntries(workbookOutputs),
    grossSales: Number(at(sale, 12, 23)),
  },
};
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  catalogRows: catalog.length,
  uniqueItemCodes: duplicateMap.size,
  groups: groups.length,
  posCategories: totals,
  duplicateCodes: duplicateCodes.map(rows => ({ itemCode: rows[0].itemCode, rows: rows.length, categories: [...new Set(rows.map(row => row.posCategory))] })),
  reconciliation: data.reconciliation,
}, null, 2));
