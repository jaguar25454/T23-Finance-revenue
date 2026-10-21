import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
const compile = path => ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const evidence = JSON.parse(read('app/data/capricci-menu-prices.json'));
const finance = JSON.parse(read('app/data/capricci-finance-20260901.json'));
const prices = {};
vm.runInNewContext(compile('lib/capricci-prices.ts'), { exports: prices, require: name => { assert.equal(name, '@/app/data/capricci-menu-prices.json'); return evidence; } });

test('Selling Price matches every verified Category code/menu row, with raw price evidence', () => {
  assert.equal(evidence.source.sheet, 'Category'); assert.equal(evidence.source.headerCell, 'I3');
  assert.equal(evidence.source.currency, 'THB');
  assert.equal(evidence.source.mappingReferenceSha256, finance.source.sha256);
  assert.equal(evidence.source.verifiedCodeMenuRows, 877);
  assert.equal(evidence.rows.length, finance.mapping.length);
  const original = new Map(finance.mapping.map(row => [row.sourceRow, row]));
  for (const row of evidence.rows) {
    const reference = original.get(row.sourceRow);
    assert.equal(row.itemCode, reference.itemCode); assert.equal(row.menu, reference.menu);
    assert.equal(row.cell, `I${row.sourceRow}`); assert.equal(row.formula, null);
    if (row.price !== null) { assert.equal(row.price, Number(String(row.rawPrice).replaceAll(',', ''))); assert.ok(row.price >= 0); }
  }
  for (const [code, value, cell] of [['FOD-CIC0001', 270, 'I4'], ['FOD-CIC0002', 200, 'I5'], ['FOD-CIC0003', 180, 'I6']]) {
    assert.equal(prices.capricciMenuPrice(code).value, value); assert.equal(prices.capricciMenuPrice(code).cell, cell);
  }
});

test('Reference prices cover 240 of 775 codes, do not guess missing prices, and do not mutate inputs', () => {
  const before = JSON.stringify(evidence);
  const first = new Map();
  for (const row of evidence.rows) if (!first.has(row.itemCode.trim().toLowerCase())) first.set(row.itemCode.trim().toLowerCase(), row);
  assert.equal(first.size, 775);
  let available = 0, missing = 0;
  for (const [key, row] of first) {
    const actual = prices.capricciMenuPrice(` ${key.toUpperCase()} `);
    assert.equal(actual.value, row.price);
    if (actual.value === null) missing++; else available++;
  }
  assert.equal(available, 240); assert.equal(missing, 535);
  assert.equal(prices.capricciMenuPrice('NEW-IMPORTED-CODE').value, null);
  assert.equal(prices.capricciMenuPrice('NEW-IMPORTED-CODE').cell, null);
  assert.equal(JSON.stringify(evidence), before);
});

function find(root, type) {
  const found = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (node.type === type) found.push(node); visit(node.props?.children); }
  visit(root); return found;
}
const reportData = {};
vm.runInNewContext(compile('lib/report-data.ts'), { exports: reportData, URLSearchParams, require: name => JSON.parse(read(name.replace('@/', ''))) });
const navigation = {};
vm.runInNewContext(compile('components/master-data-navigation.tsx'), { exports: navigation, require: name => {
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  if (name === '@/lib/report-data') return reportData;
  return new Proxy({}, { get: (_, key) => key });
} });

test('Master Data restaurant pages switch independently, keep five names, and preserve fragment dates', () => {
  let brand = 'capricci';
  for (const key of ['capricci', 'kappo', 'lawoi', 'saryu', 'maison', 'capricci']) {
    let tree = navigation.MasterDataNavigation({ brand, onBrandChange: value => { brand = value; } });
    const buttons = find(tree, 'Button'); assert.equal(buttons.length, 5);
    buttons.find(button => JSON.stringify(button.props.children).includes(reportData.brandData[key].name)).props.onClick();
    assert.equal(brand, key);
    tree = navigation.MasterDataNavigation({ brand, onBrandChange() {} });
    assert.equal(find(tree, 'Button').filter(button => button.props['aria-current'] === 'page').length, 1);
    const period = reportData.makePeriod('2026-09-02', 'day');
    const fragment = reportData.viewFragment({ brand, period, report: 'S117' }) + reportData.pageFragment('master-data');
    assert.equal(reportData.parseViewFragment(fragment).brand, brand);
    assert.equal(reportData.parseViewFragment(fragment).period.start, '2026-09-02');
    assert.equal(reportData.pageFromFragment(fragment, brand), 'master-data');
  }
  const home = read('app/page.tsx');
  assert.match(home, /page === 'master-data' && <MasterDataNavigation brand=\{brandKey\} onBrandChange=\{setBrandKey\}/);
  assert.match(home, /<KappoFoodstoryWorkspace active=\{brandKey==='kappo'\}/);
  assert.match(home, /hidden=\{page !== 'master-data' \|\| brandKey !== 'lawoi'\}><LawoiMasterData/);
  // The same Capricci editor remains mounted while hidden, so draft edits are not lost.
  assert.match(home, /<div hidden=\{page !== 'master-data' \|\| brandKey !== 'capricci'\}>\s*<CapricciMasterData connection=\{masterConnection\}/);
});

test('LAWOI has its own active master editor and never exposes unit cost', () => {
  const ui=read('components/lawoi-master-data.tsx');
  assert.match(ui,/Data Management \(LAWOI\)/);assert.match(ui,/Type selection/);assert.match(ui,/Selling Price/);
  assert.match(ui,/lawoiPeriodSummary/);assert.match(ui,/Apply to Dashboard/);assert.doesNotMatch(ui,/unitCost/);
  const source=read('lib/lawoi-master.ts');assert.match(source,/brandId:'lawoi'/);assert.match(source,/originalLawoiMaster/);assert.doesNotMatch(source,/unitCost/);
});

test('Capricci pricing is display-only and Type selection keeps the requested subgroup-to-output behavior', () => {
  const ui = read('components/capricci-master-data.tsx');
  assert.match(ui, /<CardTitle>Data Management \(Capricci\)<\/CardTitle>/);
  assert.match(ui, /\{draft.items.length\} รหัสไม่ซ้ำ/);
  assert.match(ui, /'Menu', 'Selling Price', 'Output'/);
  assert.match(ui, /sellingPrice: capricciMenuPrice\(row.itemCode\)/);
  assert.match(ui, /item.sellingPrice.value === null/); assert.match(ui, /Category!\$\{item.sellingPrice.cell\}/);
  const outputBox = ui.split(/\r?\n/).find(line => line.includes('<AccordionItem value="groups">')).trim();
  assert.equal(createHash('sha256').update(outputBox).digest('hex'), '3f877921510d149654e24e3a136e3f5d031f2b86cd9bcb9f5c7117b47e909294');
  for (const path of ['lib/capricci-master.ts', 'lib/runtime-reports.ts', 'lib/report-data.ts', 'lib/sales-import.ts']) assert.doesNotMatch(read(path), /capricci-menu-prices|capricciMenuPrice/);
});
