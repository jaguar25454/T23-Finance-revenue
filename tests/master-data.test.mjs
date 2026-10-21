import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const path = new URL(`../${name.replace('@/', '')}${name.endsWith('.json') ? '' : '.ts'}`, import.meta.url);
  if (name.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'));
  const exports = {}; cache.set(name, exports);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require: load, URL, URLSearchParams });
  return exports;
}
const master = load('@/lib/capricci-master');
const reports = load('@/lib/report-data');
const copy = value => JSON.parse(JSON.stringify(value));

test('ItemCode table maps Main, Sub and merged Category independently from Output', () => {
  const rows = master.masterTableRows(master.originalCapricciMaster);
  const item = rows.find(r => r.itemCode === 'FOD-CIC0002');
  assert.equal(item.type, 'Food');
  assert.equal(item.subType, 'Appetizer');
  assert.equal(item.sourceCategory, 'CICCHETTI');
  assert.equal(item.output, 'Food');
  const source = reports.capricciFinance.mapping.find(r => r.itemCode === item.itemCode);
  assert.equal(source.sourceRow, 5);
  assert.equal(source.categorySourceCell, 'D4');
  const wine = rows.find(r => r.itemCode === 'WIN-SNC0006');
  assert.equal(wine.type, 'Wine');
  assert.equal(wine.subType, 'Sparkling Champagne');
  assert.equal(wine.sourceCategory, 'SPARKLING & CHAMPAGNE');
  assert.equal(wine.output, 'Beverage - Alcohol');
  assert.equal(wine.hasConflict, true);
  assert.equal(rows.find(r => r.itemCode === 'SERVICECHARGE').sourceCategory, 'ไม่ระบุ');
  assert.equal(rows.find(r => r.itemCode === 'SERVICECHARGE').output, 'ยกเว้นจากยอดขาย');
  assert.equal(reports.capricciFinance.mapping.filter(r => r.sourceCategory).length, 240);
  assert.equal(rows.filter(r => r.sourceCategory !== 'ไม่ระบุ').length, 240);
});

test('All three dropdown filters combine with search/status without mutating Master or sales', () => {
  const seed = master.originalCapricciMaster, before = JSON.stringify(seed);
  const rows = master.masterTableRows(seed);
  assert.equal(master.filterMasterTable(rows, {}).length, 775);
  const filtered = master.filterMasterTable(rows, { type: 'Food', subType: 'Appetizer', sourceCategory: 'CICCHETTI' });
  assert.equal(filtered.length, 8);
  assert.equal(master.filterMasterTable(rows, { type: 'Food', sourceCategory: 'RED' }).length, 0);
  assert.equal(master.filterMasterTable(rows, { type: 'Food', subType: 'Appetizer', sourceCategory: 'CICCHETTI', search: '  fod-cic0002  ' })[0].itemCode, 'FOD-CIC0002');
  const conflicts = master.filterMasterTable(rows, { type: 'Wine', status: 'หมวดขัดกัน' });
  assert.equal(conflicts.length, 2);
  assert.ok(master.filterMasterTable(rows, { type: 'Wine', status: 'มีรายการขาย' }).every(r => r.hasSales && r.type === 'Wine'));
  assert.ok(master.masterFilterOptions(rows, 'type').includes('Wine'));
  assert.ok(master.masterFilterOptions(rows, 'sourceCategory').includes('CICCHETTI'));
  assert.equal(master.masterFilterOptions(rows, 'sourceCategory').at(-1), 'ไม่ระบุ');
  assert.equal(JSON.stringify(seed), before);
  assert.equal(master.calculateMasterCategories(seed).sales, 95290);
});

test('Sub Type dropdown contains only children of the selected Main Type', () => {
  const rows = master.masterTableRows(master.originalCapricciMaster);
  const before = JSON.stringify(rows);
  for (const type of master.masterFilterOptions(rows, 'type')) {
    const result = master.masterSubTypeFilter(rows, type);
    const expected = ['ทั้งหมด', ...master.masterFilterOptions(rows.filter(r => r.type === type), 'subType')];
    assert.deepEqual(copy(result.options), copy(expected));
    assert.equal(result.value, 'ทั้งหมด');
  }
  const food = master.masterSubTypeFilter(rows, 'Food').options;
  assert.deepEqual(copy(food), ['ทั้งหมด', 'A La Carte', 'Appetizer', 'Dessert', 'Other Food']);
  const wine = master.masterSubTypeFilter(rows, 'Wine').options;
  assert.ok(wine.includes('Red Bottle'));
  assert.ok(wine.includes('Sparkling Champagne'));
  assert.ok(!wine.includes('Beer'));
  const alcohol = master.masterSubTypeFilter(rows, 'Beverage - Alcohol').options;
  assert.ok(alcohol.includes('Beer'));
  assert.ok(!alcohol.includes('Red Bottle'));
  const all = master.masterSubTypeFilter(rows, 'ทั้งหมด').options;
  assert.deepEqual(copy(all), ['ทั้งหมด', ...copy(master.masterFilterOptions(rows, 'subType'))]);
  assert.ok(all.includes('Service Charge'));
  assert.equal(JSON.stringify(rows), before);
});

test('Changing Type clears an incompatible Sub Type and preserves a valid one', () => {
  const rows = master.masterTableRows(master.originalCapricciMaster);
  assert.equal(master.masterSubTypeFilter(rows, 'Food', 'Appetizer').value, 'Appetizer');
  const next = master.masterSubTypeFilter(rows, 'Wine', 'Appetizer');
  assert.equal(next.value, 'ทั้งหมด');
  assert.ok(master.filterMasterTable(rows, { type: 'Wine', subType: next.value === 'ทั้งหมด' ? undefined : next.value }).length > 0);
  assert.equal(master.masterSubTypeFilter(rows, 'ทั้งหมด', 'Red Bottle').value, 'Red Bottle');
  assert.equal(master.masterSubTypeFilter(rows.filter(r => r.subType !== 'Red Bottle'), 'Wine', 'Red Bottle').value, 'ทั้งหมด');
  assert.deepEqual(copy(master.masterSubTypeFilter([], 'Food', 'Appetizer')), { options: ['ทั้งหมด'], value: 'ทั้งหมด' });
  const ui = readFileSync(new URL('../components/capricci-master-data.tsx', import.meta.url), 'utf8');
  assert.match(ui, /masterSubTypeFilter\(tableRows, typeFilter, subTypeFilter\)/);
  assert.match(ui, /value=\{subTypeChoice\.value\} options=\{subTypeChoice\.options\}/);
  assert.match(ui, /setSubTypeFilter\(subTypeChoice\.value\); setPage\(0\)/);
  assert.match(ui, /subType: subTypeChoice\.value === 'ทั้งหมด' \? undefined : subTypeChoice\.value/);
});

test('Category dropdown follows both Type and Sub Type, including all and source blanks', () => {
  const rows = master.masterTableRows(master.originalCapricciMaster);
  const before = JSON.stringify(rows);
  for (const type of ['ทั้งหมด', ...master.masterFilterOptions(rows, 'type')]) {
    for (const subType of master.masterSubTypeFilter(rows, type).options) {
      const result = master.masterCategoryFilter(rows, type, subType);
      const matching = rows.filter(r => (type === 'ทั้งหมด' || r.type === type) && (subType === 'ทั้งหมด' || r.subType === subType));
      assert.deepEqual(copy(result.options), ['ทั้งหมด', ...copy(master.masterFilterOptions(matching, 'sourceCategory'))]);
      assert.equal(result.value, 'ทั้งหมด');
    }
  }
  const appetizer = master.masterCategoryFilter(rows, 'Food', 'Appetizer').options;
  assert.ok(appetizer.includes('CICCHETTI'));
  assert.ok(!appetizer.includes('DOLCI'));
  assert.ok(!appetizer.includes('RED'));
  assert.ok(master.masterCategoryFilter(rows, 'Food', 'Dessert').options.includes('DOLCI'));
  assert.deepEqual(copy(master.masterCategoryFilter(rows, 'ไม่ระบุ', 'Service Charge').options), ['ทั้งหมด', 'ไม่ระบุ']);
  assert.equal(JSON.stringify(rows), before);
});

test('Changing Sub Type or Type resets incompatible Category, preserving a valid selection', () => {
  const rows = master.masterTableRows(master.originalCapricciMaster);
  assert.equal(master.masterCategoryFilter(rows, 'Food', 'Appetizer', 'CICCHETTI').value, 'CICCHETTI');
  const dessert = master.masterCategoryFilter(rows, 'Food', 'Dessert', 'CICCHETTI');
  assert.equal(dessert.value, 'ทั้งหมด');
  assert.ok(master.filterMasterTable(rows, { type: 'Food', subType: 'Dessert', sourceCategory: dessert.value === 'ทั้งหมด' ? undefined : dessert.value }).length > 0);
  assert.equal(master.masterCategoryFilter(rows, 'Food', 'ทั้งหมด', 'DOLCI').value, 'DOLCI');
  assert.equal(master.masterCategoryFilter(rows, 'ทั้งหมด', 'ทั้งหมด', 'DOLCI').value, 'DOLCI');
  const changedType = master.masterCategoryFilter(rows, 'Wine', 'Appetizer', 'CICCHETTI');
  assert.equal(changedType.value, 'ทั้งหมด');
  assert.ok(changedType.options.includes('RED'));
  assert.ok(!changedType.options.includes('CICCHETTI'));
  assert.deepEqual(copy(master.masterCategoryFilter([], 'Food', 'Appetizer', 'CICCHETTI')), { options: ['ทั้งหมด'], value: 'ทั้งหมด' });
  const changedDraft = rows.filter(r => r.sourceCategory !== 'CICCHETTI');
  assert.equal(master.masterCategoryFilter(changedDraft, 'Food', 'Appetizer', 'CICCHETTI').value, 'ทั้งหมด');
  const ui = readFileSync(new URL('../components/capricci-master-data.tsx', import.meta.url), 'utf8');
  assert.match(ui, /masterCategoryFilter\(tableRows, typeFilter, subTypeChoice\.value, categoryFilter\)/);
  assert.match(ui, /value=\{categoryChoice\.value\} options=\{categoryChoice\.options\}/);
  assert.match(ui, /setCategoryFilter\(categoryChoice\.value\); setPage\(0\)/);
  assert.match(ui, /sourceCategory: categoryChoice\.value === 'ทั้งหมด' \? undefined : categoryChoice\.value/);
});

test('Draft edits recalculate table Type/Output while source Category stays factual; old drafts still import', () => {
  const draft = copy(master.originalCapricciMaster);
  draft.sourceSha256 = 'bbd6f27742b69f2c90b84bbddcab2f5bccd87b6d12c1b93a91358adb48cb750a';
  draft.items.find(r => r.itemCode === 'FOD-CIC0002').subgroup = 'Red Bottle';
  draft.groups.find(g => g.subgroup === 'Red Bottle').category = 'Other';
  draft.items.push({ itemCode: 'NEW-ITEM', name: 'New item', subgroup: 'Dessert' });
  const imported = master.parseMasterJson(JSON.stringify(draft));
  assert.equal(imported.sourceSha256, reports.capricciFinance.source.sha256);
  const rows = master.masterTableRows(imported);
  const edited = rows.find(r => r.itemCode === 'FOD-CIC0002');
  assert.equal(edited.type, 'Wine');
  assert.equal(edited.subType, 'Red Bottle');
  assert.equal(edited.sourceCategory, 'CICCHETTI');
  assert.equal(edited.output, 'Other');
  assert.equal(rows.find(r => r.itemCode === 'NEW-ITEM').sourceCategory, 'ไม่ระบุ');
});

test('UI exposes three labelled filters, resets pagination, keeps code under Menu and seven-column empty state', () => {
  const ui = readFileSync(new URL('../components/capricci-master-data.tsx', import.meta.url), 'utf8');
  assert.match(ui, /\['Type', 'Sub Type', 'Category', 'Menu', 'Selling Price', 'Output', 'ปุ่มแก้ไข'\]/);
  for (const setter of ['setTypeFilter', 'setSubTypeFilter', 'setCategoryFilter']) {
    assert.ok(ui.includes(`${setter}(value); setPage(0);`));
  }
  assert.match(ui, /กรอง Type \(Main\.\)/);
  assert.match(ui, /กรอง Sub Type \(Sub\.\)/);
  assert.match(ui, /กรอง Category/);
  assert.match(ui, /ล้างตัวกรอง/);
  assert.match(ui, /colSpan=\{7\}/);
  assert.match(ui, /item\.itemCode/);
});

test('Master seed deduplicates source codes and exactly reproduces Finance totals', () => {
  const seed = master.validateCapricciMaster(master.originalCapricciMaster);
  assert.equal(new Set(seed.items.map(row => master.masterKey(row.itemCode))).size, seed.items.length);
  assert.equal(seed.items.length, 775);
  assert.deepEqual(copy(master.calculateMasterCategories(seed).categories), copy(reports.capricciCategorySummary.categories));
  assert.equal(master.masterChangeCount(seed), 0);
  assert.equal(seed.items.find(item => item.itemCode === 'WIN-SNC0006').subgroup, 'Sparkling Champagne');
});
test('Item reassignment changes Dashboard category panels, not gross sales, raw reports or other brands', () => {
  const original = JSON.stringify(master.originalCapricciMaster);
  const edited = copy(master.originalCapricciMaster);
  edited.items.find(i => i.itemCode === 'BAR-BO0027').subgroup = 'A La Carte';
  const calculated = master.calculateMasterCategories(master.validateCapricciMaster(edited));
  assert.equal(calculated.sales, 95290);
  assert.equal(calculated.categories[0].value, 76140);
  assert.equal(calculated.categories[2].value, 13770);
  const period = reports.makePeriod('2026-09-01', 'day');
  const view = reports.dashboardForPeriod('capricci', period, calculated);
  assert.equal(view.data.categories[0].value, 76140);
  assert.equal(view.data.monthlyCategories[0].value, 76140);
  for (const brand of ['kappo', 'lawoi']) assert.deepEqual(copy(reports.dashboardForPeriod(brand, period, calculated)), copy(reports.dashboardForPeriod(brand, period)));
  assert.equal(reports.capricciReports.S117.items.find(i => i.label === 'Food').value, 71260);
  assert.equal(JSON.stringify(master.originalCapricciMaster), original);
  assert.equal(master.masterChangeCount(edited), 1);
});
test('Subgroup reassignment moves all matching items, retains exclusions and conserves total', () => {
  const edited = copy(master.originalCapricciMaster);
  edited.groups.find(g => g.subgroup === 'Water').category = 'Food';
  const summary = master.calculateMasterCategories(master.validateCapricciMaster(edited));
  assert.equal(summary.categories[0].value, 76700);
  assert.equal(summary.categories[1].value, 340);
  assert.equal(summary.sales, 95290);
  assert.equal(summary.serviceCharge, 9088.6);
  assert.equal(summary.excludedCustomerTotal, 1815);
  assert.equal(summary.unmapped.length, 0);
  assert.equal(summary.includedRows, 117);
});
test('Modified Master still respects empty, partial and endpoint date ranges', () => {
  const edited = copy(master.originalCapricciMaster);
  edited.groups.find(g => g.subgroup === 'Water').category = 'Food';
  const calculated = master.calculateMasterCategories(edited);
  assert.equal(reports.dashboardForPeriod('capricci', reports.makePeriod('2026-09-02', 'day'), calculated).data.categories, null);
  const period = { start: '2026-09-01', end: '2026-09-02', mode: 'custom' };
  const view = reports.dashboardForPeriod('capricci', period, calculated);
  assert.equal(view.data.monthlyCategories[0].value, 76700);
  assert.equal(view.data.categories, null);
  assert.equal(view.data.dailySales, null);
  assert.equal(view.data.monthlySales, 95290);
});
test('Master rejects cross-brand/source data, duplicate codes, deletions and invalid groups', () => {
  for (const change of [m => m.brandId = 'lawoi', m => m.sourceSha256 = 'stale', m => m.items.push({ ...m.items[0], itemCode: ` ${m.items[0].itemCode.toLowerCase()} ` }), m => m.items.pop(), m => m.groups.pop(), m => m.groups[0].category = 'Unknown', m => m.items[0].subgroup = '', m => m.items.find(i => i.itemCode === 'SERVICECHARGE').subgroup = 'Other']) {
    const edited = copy(master.originalCapricciMaster); change(edited);
    assert.throws(() => master.validateCapricciMaster(edited));
  }
  assert.throws(() => master.parseMasterJson('{bad'));
  assert.throws(() => master.parseMasterJson(' '.repeat(3_000_001)));
});
test('Draft JSON round trips; adding unsold codes does not invent sales or accept money edits', () => {
  const edited = copy(master.originalCapricciMaster);
  edited.items.push({ itemCode: 'NEW-CODE', name: 'New product', subgroup: 'Dessert', value: 999999 });
  edited.sales = 999999;
  const imported = master.parseMasterJson(JSON.stringify(edited));
  assert.equal(imported.items.length, 776);
  assert.equal(imported.items.at(-1).value, undefined);
  assert.equal(imported.sales, undefined);
  assert.equal(master.calculateMasterCategories(imported).sales, 95290);
  assert.deepEqual(copy(master.parseMasterJson('\uFEFF' + JSON.stringify(imported))), copy(imported));
});
test('Pre-final preview never calls a database or silently saves product data to browser storage', () => {
  const hook = readFileSync(new URL('../hooks/use-capricci-master.ts', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../components/capricci-master-data.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(hook, /localStorage|sessionStorage|fetch\(/);
  assert.match(hook, /canEdit: false/);
  assert.match(ui, /ทดลองใช้กับ Dashboard/);
  assert.match(ui, /ยังไม่เชื่อมต่อ/);
  assert.match(ui, /parseMasterJson/);
  assert.match(home, /usePageRefresh\(masterDirty \|\| saryuChanged \|\| maisonChanged \|\| kappoFoodstoryChanged/);
  assert.match(readFileSync('hooks/use-page-refresh.ts','utf8'), /beforeunload/);
  assert.match(home, /masterConnection\.previewActive/);
  assert.match(home, /pageFragment\(page\)/);
  assert.match(home, /pageFromFragment\(window.location.hash, saved.brand\)/);
});
