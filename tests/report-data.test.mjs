import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const data = JSON.parse(readFileSync(new URL('../app/data/capricci-20260901.json', import.meta.url), 'utf8'));
const lawoi = JSON.parse(readFileSync(new URL('../app/data/lawoi-20260901.json', import.meta.url), 'utf8'));
const kappo = JSON.parse(readFileSync(new URL('../app/data/kappo-20260901.json', import.meta.url), 'utf8'));
const finance = JSON.parse(readFileSync(new URL('../app/data/capricci-finance-20260901.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../lib/report-data.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
const exports = {};
vm.runInNewContext(outputText, { exports, URLSearchParams, require: name => {
  if (name === '@/app/data/capricci-20260901.json') return data;
  if (name === '@/app/data/kappo-20260901.json') return kappo;
  if (name === '@/app/data/capricci-finance-20260901.json') return finance;
  assert.equal(name, '@/app/data/lawoi-20260901.json');
  return lawoi;
} });
const { brandData, reportsByBrand, getReconciliation, reportTemplates, hasReport, detectReportCode, formatBusinessDate, formatSourceDate } = exports;
const { isBusinessDate, isValidPeriod, makePeriod, periodFromCalendar, shiftPeriod, periodDays, formatPeriod, latestPeriod, reportsForPeriod, dashboardForPeriod, viewFragment, parseViewFragment, refreshDashboard } = exports;
const sum = (rows, key) => rows.reduce((s, row) => s + Math.round(row[key] * 1_000_000), 0) / 1_000_000;
const { calculateFinanceCategories, capricciCategorySummary: financeSummary } = exports;

test('Sales-card guests use the S117 printed metrics for each restaurant and one available report', () => {
  const before = JSON.stringify([data, lawoi, kappo]);
  for (const report of [data, lawoi, kappo]) {
    for (const period of [makePeriod('2026-09-01', 'day'), makePeriod('2026-09-15', 'month'), periodFromCalendar('2026-09-01', '2026-09-02')]) {
      const result = exports.salesGuestsForPeriod(report.brandId, period, [data, lawoi, kappo]);
      assert.equal(result.guests, report.S117.guests);
      assert.equal(result.totalPerPerson, report.S117.totalPerPerson);
    }
  }
  assert.equal(JSON.stringify([data, lawoi, kappo]), before);
});

test('Sales-card guest ranges and months use weighted S117 totals, replace days, and never pool brands', () => {
  const report = (date, guests, totalSale, totalPerPerson) => ({ ...data, businessDate: date, S117: { ...data.S117, guests, totalSale, totalPerPerson } });
  const first = report('2026-09-01', 2, 100, 50), next = report('2026-09-02', 8, 1200, 150);
  const end = report('2026-09-30', 10, 700, 70), outside = report('2026-10-01', 100, 100000, 1000);
  const dataset = [first, next, end, outside, kappo, lawoi];
  const range = periodFromCalendar('2026-09-01', '2026-09-03');
  const result = exports.salesGuestsForPeriod('capricci', range, dataset);
  assert.equal(result.guests, 10); assert.equal(result.totalPerPerson, 130);
  assert.notEqual(result.totalPerPerson, (50 + 150) / 2);
  const monthly = exports.salesGuestsForPeriod('capricci', makePeriod(range.end, 'month'), dataset);
  assert.equal(monthly.guests, 20); assert.equal(monthly.totalPerPerson, 100);
  const replacement = report('2026-09-01', 4, 200, 50);
  const replaced = exports.salesGuestsForPeriod('capricci', range, [...dataset, replacement]);
  assert.equal(replaced.guests, 12); assert.equal(replaced.totalPerPerson, 116.67);
  const crossMonth = exports.salesGuestsForPeriod('capricci', periodFromCalendar('2026-09-30', '2026-10-01'), dataset);
  assert.equal(crossMonth.guests, 110); assert.equal(crossMonth.totalPerPerson, 915.45);
  assert.equal(exports.salesGuestsForPeriod('capricci', makePeriod('2026-09-03', 'day'), dataset).guests, null);
});

test('Sales-card guest metrics distinguish no data, incomplete data and zero guests', () => {
  const period = makePeriod('2026-09-01', 'month');
  const snapshot = (date, slip) => ({ ...data, businessDate: date, S117: { ...data.S117, ...slip } });
  for (const dataset of [[], [lawoi], [snapshot('2026-08-31', {})]]) {
    assert.equal(exports.salesGuestsForPeriod('capricci', period, dataset).guests, null);
    assert.equal(exports.salesGuestsForPeriod('capricci', period, dataset).totalPerPerson, null);
  }
  for (const invalid of [null, undefined, -1, NaN, Infinity]) {
    const incomplete = exports.salesGuestsForPeriod('capricci', period, [data, snapshot('2026-09-02', { guests: invalid })]);
    assert.equal(incomplete.guests, null); assert.equal(incomplete.totalPerPerson, null);
    const missingTotal = exports.salesGuestsForPeriod('capricci', period, [data, snapshot('2026-09-02', { totalSale: invalid })]);
    assert.equal(missingTotal.guests, 82); assert.equal(missingTotal.totalPerPerson, null);
  }
  const missingPrinted = exports.salesGuestsForPeriod('capricci', period, [snapshot('2026-09-01', { totalPerPerson: null })]);
  assert.equal(missingPrinted.guests, 41); assert.equal(missingPrinted.totalPerPerson, null);
  const zero = exports.salesGuestsForPeriod('capricci', period, [snapshot('2026-09-01', { guests: 0, totalSale: 0 })]);
  assert.equal(zero.guests, 0); assert.equal(zero.totalPerPerson, null);
  const invalidPeriod = exports.salesGuestsForPeriod('capricci', { start: '2026-09-02', end: '2026-09-01', mode: 'custom' }, [data]);
  assert.equal(invalidPeriod.guests, null); assert.equal(invalidPeriod.totalPerPerson, null);
});

test('S117 Guest Daily uses printed guests, bills and Total / Person without inventing tables', () => {
  for (const [brand, guests, bills, totalPerPerson] of [['capricci', 41, 12, 2629.45], ['lawoi', 19, 5, 2065.94], ['kappo', 6, 2, 5943.85]]) {
    const daily = dashboardForPeriod(brand, makePeriod('2026-09-01', 'day')).data;
    assert.equal(JSON.stringify(daily.guest), JSON.stringify({ guests, bills, totalPerPerson }));
    assert.equal('tables' in daily.guest, false);
    assert.notEqual(daily.guest.totalPerPerson, Math.round(daily.dailySales / guests * 100) / 100);
    const partial = dashboardForPeriod(brand, { start: '2026-09-01', end: '2026-09-02', mode: 'custom' }).data;
    assert.equal(partial.guest, null);
    assert.equal(partial.dailyEntertain, null);
    assert.equal(dashboardForPeriod(brand, { start: '2026-08-31', end: '2026-09-01', mode: 'custom' }).data.guest.guests, guests);
  }
  assert.equal(exports.guestMetricsFromSlip({ guests: 0, bills: 0, totalPerPerson: 0 }).totalPerPerson, null);
  assert.equal(exports.guestMetricsFromSlip({}).guests, null);
  assert.equal(exports.guestMetricsFromSlip({ guests: 1, totalPerPerson: NaN }).totalPerPerson, null);
});

test('Entertain is a separate S117 amount, never added to or subtracted again from sales', () => {
  const rawBefore = JSON.stringify([data, lawoi, kappo]);
  for (const [brand, gross, entertain] of [['capricci', 95290, 1815], ['lawoi', 33350, 0], ['kappo', 32100, 0]]) {
    const daily = dashboardForPeriod(brand, makePeriod('2026-09-01', 'day')).data;
    assert.equal(daily.monthlyEntertain, entertain);
    assert.equal(daily.dailyEntertain, entertain);
    assert.equal(daily.dailySales, gross);
    assert.equal(daily.monthlySales, gross);
    assert.equal(sum(daily.categories, 'value'), gross);
    assert.equal(daily.dailyTrend[0].sales, gross);
    assert.equal(daily.monthTrend[0].sales, gross);
    const partial = dashboardForPeriod(brand, { start: '2026-09-01', end: '2026-09-02', mode: 'custom' }).data;
    assert.equal(partial.monthlyEntertain, entertain);
    assert.equal(partial.dailyEntertain, null);
    assert.equal(partial.dailySales, null);
    assert.equal(partial.monthlySales, gross);
  }
  assert.equal(exports.entertainFromSlip({ items: [] }), null);
  assert.equal(exports.entertainFromSlip({ items: [{ label: 'Entertain', value: 0 }] }), 0);
  assert.equal(exports.entertainFromSlip({ items: [{ label: 'Entertain', value: NaN }] }), null);
  assert.equal(JSON.stringify([data, lawoi, kappo]), rawBefore);
});

test('Retired S107 cannot be selected or queued, and old S107 links fall back safely', () => {
  for (const filename of ['S107-SalesReportByDay.csv', 'KAPPO-S107-20260901.PDF', 'lawoi-s107.xlsx', 'S107-S117.csv']) {
    assert.equal(detectReportCode(filename), null);
    assert.equal(exports.isRetiredReport(filename), true);
  }
  assert.equal(exports.isRetiredReport('S1070.csv'), false);
  const view = parseViewFragment('#brand=capricci&from=2026-09-01&to=2026-09-01&mode=day&report=S107');
  assert.equal(view.report, 'S117');
  const ui = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const reportUi = readFileSync(new URL('../components/report-center.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /S107|Guest Check-in · Period|guestTrend|Guest \/ Table|Sale \/ Table/);
  assert.match(ui, /Guest · Daily/);
  assert.match(ui, /data\.guest\.totalPerPerson/);
  assert.match(ui, /data\.monthlyEntertain/);
  assert.match(ui, /data\.dailyEntertain/);
  const importer = readFileSync(new URL('../lib/sales-import-files.ts', import.meta.url), 'utf8');
  assert.match(importer, /if \(isRetiredReport\(name\)\) throw new Error/);
});

test('Capricci computes Finance categories from source rows and matches both Excel dashboard blocks', () => {
  assert.equal(finance.rows.length, 133);
  assert.equal(financeSummary.includedRows, 117);
  assert.equal(financeSummary.unmapped.length, 0);
  assert.equal(financeSummary.extendedPrice, 91666);
  assert.equal(financeSummary.adjustment, 3624);
  assert.equal(financeSummary.sales, 95290);
  assert.equal(financeSummary.serviceCharge, 9088.6);
  assert.equal(financeSummary.excludedCustomerTotal, 1815);
  assert.equal(JSON.stringify(financeSummary.categories), JSON.stringify([
    { name: 'Food', value: 71660 }, { name: 'Beverage - Non-Alcohol', value: 5380 },
    { name: 'Beverage - Alcohol', value: 18250 }, { name: 'Other', value: 0 },
  ]));
  for (const [index, item] of financeSummary.categories.entries()) {
    for (const column of ['E', 'J']) {
      const check = finance.referenceChecks.find(c => c.sheet === 'DashBord' && c.cell === `${column}${index + 3}`);
      assert.equal(item.value, check.cachedValue);
    }
  }
  for (const row of financeSummary.detail) {
    assert.equal(row.value, row.cachedTotal);
    if (row.reason === 'Included') assert.equal(row.category, row.cachedCategory.trim().replace(/\s+/g, ' '));
  }
  assert.equal(brandData.capricci.categories, financeSummary.categories);
});

test('Finance worksheet source matches original S104 transactions; no original report overwritten', () => {
  const raw = data.S104.rows.map(r => JSON.stringify([r.SaleId, r.ItemCode, r.Qty, r.ExtendedPrice])).sort();
  const reference = finance.rows.map(r => JSON.stringify([String(r.saleId), r.itemCode, r.qty, r.extendedPrice])).sort();
  assert.deepEqual(reference, raw);
  assert.equal(data.S117.items.find(r => r.label === 'Food').value, 71260);
  assert.equal(data.S117.items.find(r => r.label === 'Beverage').value, 24030);
  assert.match(finance.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(finance.duplicateConflicts.filter(c => finance.rows.some(r => r.itemCode === c.itemCode)).length, 0);
});

test('Finance first-match mapping is deterministic; unknown products are flagged and never counted as Other', () => {
  const input = structuredClone(finance);
  input.mapping.push({ sourceRow: 999, itemCode: 'BAR-BO0027', subgroup: 'A La Carte', menu: 'duplicate test' });
  assert.equal(calculateFinanceCategories(input).sales, 95290);
  assert.equal(calculateFinanceCategories(input).detail[0].category, 'Beverage - Alcohol');
  input.rows[0].itemCode = 'UNKNOWN';
  const result = calculateFinanceCategories(input);
  assert.equal(result.unmapped.length, 1);
  assert.equal(result.unmapped[0].value, 4480);
  assert.equal(result.categories.find(c => c.name === 'Other').value, 0);
  assert.equal(result.sales, 90810);
});

test('Finance excludes dates outside source day, service charge and Entertain even when category exists', () => {
  const input = structuredClone(finance);
  input.rows.push({ ...input.rows[0], businessDate: '2026-09-02' });
  assert.equal(calculateFinanceCategories(input).sales, 95290);
  assert.equal(financeSummary.detail.filter(r => r.reason === 'Excluded customer').length, 5);
  assert.equal(financeSummary.detail.filter(r => r.reason === 'Service Charge').length, 11);
  const missing = dashboardForPeriod('capricci', makePeriod('2026-09-02', 'day'));
  assert.equal(missing.data.categories, null);
  assert.equal(missing.data.dailySales, null);
  const range = dashboardForPeriod('capricci', { start: '2026-09-01', end: '2026-09-02', mode: 'custom' });
  assert.equal(range.data.monthlyCategories, financeSummary.categories);
  assert.equal(range.data.monthlySales, 95290);
  assert.equal(range.data.categories, null);
  assert.equal(range.data.dailySales, null);
});

test('five active templates for every brand; S107 retired and Guest uses S117', () => {
  assert.equal(reportTemplates.map(item => item.code).join(','), 'A103,S102,S104,S114,S117');
  for (const brand of ['kappo', 'capricci', 'lawoi']) {
    assert.equal(reportTemplates.filter(item => hasReport(brand, item.code)).length, 5);
    assert.equal(hasReport(brand, 'S107'), false);
    assert.equal(brandData[brand].guest.guests, reportsByBrand[brand].S117.guests);
    assert.equal(brandData[brand].dailyTrend.length, 1);
    assert.equal(brandData[brand].monthTrend.length, 1);
  }
  assert.equal(reportTemplates.filter(item => hasReport('capricci', item.code)).length, 5);
  assert.equal(hasReport('capricci', 'S107'), false);
  assert.equal(reportTemplates.filter(item => hasReport('lawoi', item.code)).length, 5);
  assert.equal(hasReport('lawoi', 'S107'), false);
});
test('all requested source rows included', () => {
  assert.equal(data.A103.rows.length, 11);
  assert.equal(data.S102.rows.length, 64);
  assert.equal(data.S104.rows.length, 133);
  assert.equal(data.S114.rows.length, 76);
  assert.equal(new Set(data.S114.rows.map(row => row.page)).size, 6);
  assert.equal(Object.keys(data.sources).length, 5);
  for (const source of Object.values(data.sources)) assert.match(source.sha256, /^[0-9a-f]{64}$/);
});
test('CSV precision and monetary definitions preserved', () => {
  assert.equal(sum(data.S102.rows, 'ExtendedPrice'), 93316);
  assert.equal(sum(data.S104.rows, 'ExtendedPrice'), 102569.6);
  for (const code of ['S102', 'S104']) {
    assert.equal(sum(data[code].rows, 'Tax'), 7052.822);
    assert.equal(sum(data[code].rows, 'ExtendedPriceTax'), 109622.422);
  }
  assert.equal(sum(data.S104.rows, 'Qty'), 178);
  assert.equal(sum(data.S102.rows, 'Qty'), 166);
  assert.equal(data.S104.rows.filter(row => row.ItemCode === 'SERVICECHARGE').length, 12);
});
test('A103 totals agree with invoice rows and payment total', () => {
  assert.equal(sum(data.A103.rows, 'value'), 100754.6);
  assert.equal(sum(data.A103.rows, 'tax'), 7052.83);
  assert.equal(sum(data.A103.rows, 'net'), 107807.43);
  assert.equal(sum(data.S117.payments, 'value'), data.S117.paymentTotal);
  assert.equal(data.A103.totals.net, data.S117.paymentTotal);
  assert.equal(data.A103.branchAsPrinted, null);
});
test('one-satang source differences remain visible, never overwritten', () => {
  assert.equal(Math.round((data.S117.paymentTotal - data.S117.totalSale) * 100), 1);
  assert.equal(sum(data.S114.rows, 'net'), 109622.43);
  assert.equal(data.S114.totals.net, 109622.42);
  assert.equal(sum(data.S114.categories, 'net'), 109622.42);
  assert.equal(sum(data.S114.rows, 'tax'), 7052.83);
  assert.equal(data.S114.totals.tax, 7052.82);
  assert.equal(data.S117.grandTotal, data.S114.totals.net);
});
test('dashboard has one day only and does not substitute bills for tables', () => {
  assert.equal(brandData.capricci.dailySales, 95290);
  assert.equal(brandData.capricci.monthlySales, 95290);
  assert.equal(brandData.capricci.dailyTrend.length, 1);
  assert.equal(brandData.capricci.guest.guests, 41);
  assert.equal(brandData.capricci.guest.bills, 12);
  assert.equal('tables' in brandData.capricci.guest, false);
  assert.equal(data.S117.guests, 41);
  assert.equal(data.S117.bills, 12);
  assert.equal(formatBusinessDate('2026-09-01'), '01/09/26');
});
test('filename detection identifies report type, not restaurant', () => {
  for (const name of ['S102-SalesReport-20260901.csv', 'KAPPO-S102-SalesReport.csv', 'LAWOI-S102-SalesReport.csv']) assert.equal(detectReportCode(name), 'S102');
  assert.equal(detectReportCode('A103-SalesTaxReport-20260901.PDF'), 'A103');
  assert.equal(detectReportCode('XS102.csv'), null);
  assert.equal(detectReportCode('S1020.csv'), null);
  assert.equal(detectReportCode('unknown.xlsx'), null);
});

test('LAWOI has all requested rows and source-specific branch/date', () => {
  assert.equal(lawoi.A103.rows.length, 6);
  assert.equal(lawoi.S102.rows.length, 27);
  assert.equal(lawoi.S104.rows.length, 44);
  assert.equal(lawoi.S114.rows.length, 27);
  assert.equal(lawoi.S114.pages, 3);
  assert.equal(lawoi.branchId, 'Default');
  assert.equal(lawoi.businessDate, '2026-09-01');
  assert.equal(lawoi.A103.branchAsPrinted, null);
  assert.equal(lawoi.A103.taxId, '0105568237041');
  for (const source of Object.values(lawoi.sources)) assert.match(source.sha256, /^[0-9a-f]{64}$/);
});

test('LAWOI totals reconcile without adding Service Charge twice', () => {
  for (const code of ['S102', 'S104']) {
    assert.equal(sum(lawoi[code].rows, 'Qty'), 63);
    assert.equal(sum(lawoi[code].rows, 'ExtendedPrice'), 36685);
    assert.equal(sum(lawoi[code].rows, 'Tax'), 2567.95);
    assert.equal(sum(lawoi[code].rows, 'ExtendedPriceTax'), 39252.95);
    assert.equal(lawoi[code].rows.filter(row => row.ItemCode === 'SERVICECHARGE').length, 5);
  }
  assert.equal(sum(lawoi.S102.rows, 'SVCAvg'), 3568.45);
  assert.equal(sum(lawoi.S114.rows, 'net'), 39252.95);
  assert.equal(sum(lawoi.S114.categories, 'net'), 39252.95);
  assert.equal(sum(lawoi.A103.rows, 'net'), 39252.95);
  assert.equal(sum(lawoi.S117.payments, 'value'), 39252.95);
  assert.ok(getReconciliation(lawoi).every(check => check.delta === 0));
  assert.ok(getReconciliation(data).some(check => check.delta === 0.01));
});

test('void invoice is retained separately from the replacement invoice', () => {
  const cancelled = lawoi.A103.rows.filter(row => row.status === 'VOID');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].invoice, 'FT690901003');
  assert.equal(cancelled[0].receipt, 'RC690901005');
  assert.equal(cancelled[0].net, 0);
  const replacement = lawoi.A103.rows.find(row => row.invoice === 'FT690901004');
  assert.equal(replacement.receipt, cancelled[0].receipt);
  assert.equal(replacement.status, 'ACTIVE');
  assert.equal(replacement.net, 4990.48);
  assert.equal(lawoi.A103.rows.filter(row => row.status === 'ACTIVE').length, 5);
});

test('malformed CSV descriptions are repaired only for two evidenced rows', () => {
  assert.deepEqual(lawoi.S104.parsingNotes.map(note => note.sourceLine), [10, 11]);
  const sashimi = lawoi.S104.rows.filter(row => row.ItemCode === 'FOD-BLU0009');
  assert.equal(sashimi.length, 2);
  assert.equal(sashimi[0].ItemDesc, '4 TYPES OF SASHIMI (Small Set)กะมงพร้าว, หัวเสี้ยม');
  assert.equal(sashimi[0].EngItemDesc, 'กะมงพร้าว, หัวเสี้ยม');
  assert.equal(sashimi[1].ItemDesc, '4 TYPES OF SASHIMI (Small Set)ปลาช่อนทะเล, กะมงพร้าว');
  assert.equal(sum(sashimi, 'Qty'), 2);
  assert.equal(sum(sashimi, 'ExtendedPriceTax'), 1284);
  for (const note of lawoi.S104.parsingNotes) assert.equal(note.rawFields.length, 17);
});

test('brand scopes and Buddhist Era dates cannot leak between dashboards', () => {
  assert.equal(reportsByBrand.kappo.S117.totalSale, 35663.1);
  assert.equal(reportsByBrand.capricci.S117.totalSale, 107807.42);
  assert.equal(reportsByBrand.lawoi.S117.totalSale, 39252.95);
  assert.equal(brandData.lawoi.dailySales, 33350);
  assert.equal(brandData.lawoi.monthlySales, 33350);
  assert.equal(brandData.lawoi.dailyTrend.length, 1);
  assert.equal(brandData.lawoi.guest.guests, 19);
  assert.equal(brandData.lawoi.guest.bills, 5);
  assert.equal(lawoi.S117.guests, 19);
  assert.equal(lawoi.S117.bills, 5);
  assert.equal(lawoi.S117.totalPerPerson, 2065.94);
  assert.equal(formatSourceDate('01 กันยายน 2569 19:12 19:12:55'), '01/09/26 19:12');
  assert.equal(formatSourceDate('01 September 2026 20:22 8:22:03 PM'), '01/09/26 20:22');
  assert.equal(formatSourceDate('not a date'), 'not a date');
  assert.ok(lawoi.S104.rows.every(row => row.SaleDate.startsWith('01 กันยายน 2569 ')));
});

test('KAPPO includes all five reports and preserves its actual time period and blank branch', () => {
  for (const [code, count] of [['A103', 2], ['S102', 4], ['S104', 8], ['S114', 6]]) assert.equal(kappo[code].rows.length, count);
  assert.equal(Object.keys(kappo.sources).length, 5);
  for (const file of Object.values(kappo.sources)) assert.match(file.sha256, /^[0-9a-f]{64}$/);
  assert.equal(kappo.S114.pages, 1);
  assert.equal(kappo.S114.categories.length, 4);
  assert.equal(kappo.businessDate, '2026-09-01');
  assert.equal(kappo.periodStartTime, '06:00');
  assert.equal(kappo.periodEndTime, '23:59');
  assert.equal(kappo.branchId, null);
  assert.equal(kappo.S117.branch, null);
  assert.equal(kappo.A103.branchAsPrinted, null);
  assert.equal(kappo.A103.taxId, '0105561172718');
  assert.match(kappo.A103.establishment, /สาขา 00001/);
  assert.ok(kappo.S104.rows.every(row => row.SaleDate.startsWith('01 กันยายน 2569 ')));
});

test('KAPPO monetary totals reconcile with service charge exactly once', () => {
  for (const code of ['S102', 'S104']) {
    assert.equal(sum(kappo[code].rows, 'Tax'), 2333.1);
    assert.equal(sum(kappo[code].rows, 'ExtendedPriceTax'), 35663.1);
  }
  assert.equal(sum(kappo.S102.rows, 'Qty'), 10);
  assert.equal(sum(kappo.S102.rows, 'ExtendedPrice'), 30300);
  assert.equal(sum(kappo.S102.rows, 'SVCInitAvg'), 3030);
  assert.equal(sum(kappo.S102.rows, 'SVCAvg'), 3242.1);
  assert.equal(sum(kappo.S104.rows, 'Qty'), 12);
  assert.equal(sum(kappo.S104.rows, 'ExtendedPrice'), 33330);
  assert.equal(kappo.S104.rows.filter(row => row.ItemCode === 'SERVICECHARGE').length, 2);
  assert.equal(sum(kappo.S114.rows, 'net'), 35663.1);
  assert.deepEqual(kappo.S114.rowSums, kappo.S114.totals);
  assert.deepEqual(kappo.S114.categorySums, kappo.S114.totals);
  assert.ok(getReconciliation(kappo).every(check => check.delta === 0));
  assert.equal(brandData.kappo.status, '5 REPORTS · MATCHED');
});

test('KAPPO invoice rows agree individually with S104 bills, not only the daily total', () => {
  assert.deepEqual(kappo.A103.rows.map(row => row.invoice), ['RC690901001', 'RC690901002']);
  for (const invoice of kappo.A103.rows) {
    const lines = kappo.S104.rows.filter(row => row.SaleNum === invoice.invoice);
    assert.equal(lines.length, 4);
    assert.equal(sum(lines, 'ExtendedPrice'), invoice.value);
    assert.equal(sum(lines, 'Tax'), invoice.tax);
    assert.equal(sum(lines, 'ExtendedPriceTax'), invoice.net);
  }
  assert.equal(sum(kappo.A103.rows, 'net'), 35663.1);
  assert.equal(sum(kappo.S117.payments, 'value'), 35663.1);
});

test('KAPPO source-specific item names and the extra Remark column remain intact', () => {
  assert.equal(kappo.S102.headers.length, 23);
  assert.equal(kappo.S102.headers.at(-1), 'Remark');
  assert.ok(kappo.S102.rows.every(row => Object.keys(row).length === 23 && row.Remark === ''));
  assert.equal(kappo.S104.headers.length, 15);
  assert.ok(kappo.S104.rows.every(row => Object.keys(row).length === 15));
  assert.equal(kappo.S102.rows.find(row => row.ItemCode === 'SOF-GRT001').ItemDesc, 'Hot Green Tea');
  assert.equal(kappo.S114.rows.find(row => row.itemCode === 'SOF-GRT001').itemDesc, 'Green tea powder 40 gr');
  assert.equal(kappo.S102.rows.find(row => row.ItemCode === 'SAK-PRM018').ItemDesc, 'Kakushika Junmai Daiginjo');
  assert.equal(kappo.S114.rows.find(row => row.itemCode === 'SAK-PRM018').itemDesc, 'SAKE HAKUSHIKA JUNMAI DAIGINJO 720 ML');
  assert.equal('parsingNotes' in kappo.S104, false);
});

test('KAPPO keeps S117 Other classification, gross sales, and slip-only guest counts', () => {
  assert.equal(brandData.kappo.categories.find(item => item.name === 'Other').value, 5100);
  assert.equal(brandData.kappo.categories.find(item => item.name === 'Beverage').value, 0);
  assert.equal(brandData.kappo.dailySales, 32100);
  assert.equal(brandData.kappo.monthlySales, 32100);
  assert.equal(brandData.kappo.dailyDiscount, 1800);
  assert.equal(kappo.S117.guests, 6);
  assert.equal(kappo.S117.bills, 2);
  assert.equal(kappo.S117.totalPerPerson, 5943.85);
  assert.equal(sum(kappo.S117.categories, 'value'), 35663.1);
  assert.equal(brandData.kappo.guest.guests, 6);
  assert.equal(brandData.kappo.guest.bills, 2);
});

test('Period dates reject incomplete, inverted, impossible and out-of-bounds dates', () => {
  for (const date of ['', '01/09/26', '2026-02-29', '2026-13-01', '2026-04-31', '1899-12-31', '2101-01-01']) assert.equal(isBusinessDate(date), false, date);
  assert.equal(isBusinessDate('2024-02-29'), true);
  assert.equal(isValidPeriod({ start: '2026-09-02', end: '2026-09-01', mode: 'custom' }), false);
  assert.equal(isValidPeriod({ start: '2026-09-01', end: '2026-09-02', mode: 'day' }), false);
  assert.equal(isValidPeriod({ start: '2026-09-01', end: '2026-09-08', mode: 'week' }), false);
  assert.equal(isValidPeriod({ start: '2026-09-02', end: '2026-09-30', mode: 'month' }), false);
  assert.equal(isValidPeriod({ start: '2026-09-01', end: '2026-09-30', mode: 'bad' }), false);
});

test('Previous / Next preserve custom inclusive duration across month and year boundaries', () => {
  const period = { start: '2026-12-29', end: '2027-01-03', mode: 'custom' };
  assert.equal(periodDays(period), 6);
  const next = shiftPeriod(period, 1);
  assert.equal(next.start, '2027-01-04');
  assert.equal(next.end, '2027-01-09');
  assert.equal(JSON.stringify(shiftPeriod(next, -1)), JSON.stringify(period));
  assert.equal(shiftPeriod(period, -1).end, '2026-12-28');
  assert.equal(shiftPeriod(makePeriod('2026-09-01', 'day'), -1).start, '2026-08-31');
  assert.equal(shiftPeriod(makePeriod('2026-09-01', 'week'), 1).start, '2026-09-08');
  assert.equal(shiftPeriod(makePeriod('1900-01-01', 'day'), -1), null);
  assert.equal(shiftPeriod(makePeriod('2100-12-31', 'day'), 1), null);
});

test('Month navigation follows calendar months without drift, including leap February', () => {
  const january = makePeriod('2024-01-31', 'month');
  assert.equal(january.start, '2024-01-01');
  assert.equal(january.end, '2024-01-31');
  const february = shiftPeriod(january, 1);
  assert.equal(february.start, '2024-02-01');
  assert.equal(february.end, '2024-02-29');
  assert.equal(periodDays(february), 29);
  assert.equal(shiftPeriod(february, 1).end, '2024-03-31');
  assert.equal(JSON.stringify(shiftPeriod(february, -1)), JSON.stringify(january));
  assert.equal(shiftPeriod(makePeriod('2026-12-15', 'month'), 1).start, '2027-01-01');
  assert.equal(formatPeriod(makePeriod('2026-09-01', 'month')), '01/09/26 – 30/09/26');
  assert.equal(formatPeriod(makePeriod('2026-09-01', 'day')), '01/09/26');
});

test('Period filtering is inclusive and applies consistently to all three brands', () => {
  for (const brand of ['kappo', 'capricci', 'lawoi']) {
    const daily = latestPeriod(brand);
    assert.equal(reportsForPeriod(brand, daily), reportsByBrand[brand]);
    assert.equal(reportsForPeriod(brand, { start: '2026-08-30', end: '2026-09-01', mode: 'custom' }), reportsByBrand[brand]);
    assert.equal(reportsForPeriod(brand, { start: '2026-09-01', end: '2026-09-05', mode: 'custom' }), reportsByBrand[brand]);
    for (const emptyPeriod of [shiftPeriod(daily, -1), shiftPeriod(daily, 1)]) {
      const result = dashboardForPeriod(brand, emptyPeriod);
      assert.equal(result.report, null);
      assert.equal(reportsForPeriod(brand, emptyPeriod), null);
      assert.equal(result.daysWithData, 0);
      assert.equal(result.data.status, 'NO DATA');
      for (const key of ['dailySales', 'monthlySales', 'dailyDiscount', 'monthlyDiscount', 'categories', 'monthlyCategories', 'guest', 'monthlyEntertain', 'dailyEntertain']) assert.equal(result.data[key], null);
      assert.equal(result.data.dailyTrend.length, 0);
      assert.equal(result.data.monthTrend.length, 0);
    }
    assert.equal(dashboardForPeriod(brand, daily).data.dailySales, brandData[brand].dailySales);
  }
});

test('A partial Period sums only imported days; Daily does not borrow an earlier day', () => {
  const result = dashboardForPeriod('kappo', makePeriod('2026-09-01', 'month'));
  assert.equal(result.daysWithData, 1);
  assert.equal(result.selectedDays, 30);
  assert.equal(result.data.monthlySales, 32100);
  assert.equal(result.data.monthlyDiscount, 1800);
  assert.equal(result.data.dailySales, null);
  assert.equal(result.data.categories, null);
  assert.equal(result.data.date, '30/09/26');
  assert.equal(result.data.dailyTrend.length, 1);
  assert.equal(result.data.monthTrend.length, 1);
  assert.equal(result.report.S117.totalSale, 35663.1);
  const endsWithData = dashboardForPeriod('kappo', { start: '2026-08-30', end: '2026-09-01', mode: 'custom' });
  assert.equal(endsWithData.data.dailySales, 32100);
  assert.equal(endsWithData.selectedDays, 3);
});

test('Refresh view state round-trips the restaurant, period, mode and report tab', () => {
  const view = { brand: 'lawoi', period: makePeriod('2026-09-01', 'month'), report: 'S104' };
  const saved = viewFragment(view);
  assert.equal(JSON.stringify(parseViewFragment(`#${saved}`)), JSON.stringify(view));
  assert.equal(parseViewFragment('#reports'), null);
  assert.equal(parseViewFragment(saved.replace('brand=lawoi', 'brand=__proto__')), null);
  assert.equal(parseViewFragment(saved.replace('from=2026-09-01', 'from=2026-09-31')), null);
  assert.equal(parseViewFragment(saved.replace('report=S104', 'report=unknown')).report, 'S117');
});

test('Refresh reloads the page after saving filters, without implying a POS fetch', () => {
  const view = { brand: 'capricci', period: latestPeriod('capricci'), report: 'A103' };
  const calls = [];
  assert.equal(refreshDashboard(view, 0, {
    confirm: () => { throw new Error('No queue should not prompt'); },
    save: fragment => calls.push(['save', fragment]), reload: () => calls.push(['reload']),
  }), true);
  assert.equal(calls[0][0], 'save');
  assert.equal(JSON.stringify(parseViewFragment(calls[0][1])), JSON.stringify(view));
  assert.equal(calls[1][0], 'reload');
});

test('Refresh with an unsaved import queue requires confirmation; cancelling preserves it', () => {
  const view = { brand: 'kappo', period: latestPeriod('kappo'), report: 'S117' };
  const cancelled = [];
  assert.equal(refreshDashboard(view, 2, {
    confirm: message => { assert.match(message, /2/); return false; },
    save: () => cancelled.push('save'), reload: () => cancelled.push('reload'),
  }), false);
  assert.equal(cancelled.length, 0);
  const accepted = [];
  assert.equal(refreshDashboard(view, 2, {
    confirm: () => { accepted.push('confirm'); return true; },
    save: () => accepted.push('save'), reload: () => accepted.push('reload'),
  }), true);
  assert.deepEqual(accepted, ['confirm', 'save', 'reload']);
});

test('Calendar first click is applicable even when the selected day has no reports', () => {
  for (const date of ['2026-08-31', '2026-09-02', '2030-01-15']) {
    for (const period of [makePeriod(date, 'day'), periodFromCalendar(date)]) {
      assert.equal(isValidPeriod(period), true);
      assert.equal(period.start, date);
      assert.equal(period.end, date);
      assert.equal(periodDays(period), 1);
      for (const brand of ['kappo', 'capricci', 'lawoi']) {
        const result = dashboardForPeriod(brand, period);
        assert.equal(result.daysWithData, 0);
        assert.equal(result.data.date, formatBusinessDate(date));
        assert.equal(result.data.monthlySales, null);
        assert.equal(result.data.dailySales, null);
        assert.equal(result.report, null);
        const saved = parseViewFragment(viewFragment({ brand, period, report: 'S117' }));
        assert.equal(saved.period.start, date);
        assert.equal(saved.period.end, date);
      }
    }
  }
});

test('Empty custom ranges remain selectable and navigable without snapping to source dates', () => {
  const period = periodFromCalendar('2028-02-27', '2028-03-03');
  assert.equal(isValidPeriod(period), true);
  assert.equal(periodDays(period), 6);
  for (const brand of ['kappo', 'capricci', 'lawoi']) {
    assert.equal(dashboardForPeriod(brand, period).data.status, 'NO DATA');
    assert.equal(reportsForPeriod(brand, period), null);
  }
  assert.equal(shiftPeriod(period, 1).start, '2028-03-04');
  assert.equal(shiftPeriod(period, -1).end, '2028-02-26');
  assert.equal(period.start, '2028-02-27');
  assert.equal(period.end, '2028-03-03');
  assert.throws(() => periodFromCalendar('2028-03-03', '2028-02-27'));
  assert.throws(() => periodFromCalendar('2026-02-29'));
});

test('Date picker exists once in the top header with no separate Period box or proxy click', () => {
  const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const controls = readFileSync(new URL('../components/period-controls.tsx', import.meta.url), 'utf8');
  const pageAst = ts.createSourceFile('page.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(pageAst) === 'HeaderDatePicker') {
      count++;
      let parent = node.parent;
      while (parent && !(ts.isJsxElement(parent) && parent.openingElement.tagName.getText(pageAst) === 'header')) parent = parent.parent;
      assert.ok(parent, 'Date picker must be inside the header');
    }
    ts.forEachChild(node, visit);
  }
  visit(pageAst);
  assert.equal(count, 1);
  assert.equal(pageSource.includes('<PeriodControls'), false);
  assert.equal(pageSource.includes("getElementById('period-picker-trigger')"), false);
  assert.equal(controls.includes('id="period-controls"'), false);
  assert.ok(controls.includes('id="header-date-picker"'));
  assert.ok(controls.includes('DD/MM/YY'));
});

test('DD/MM/YY entry validates real civil dates and preserves the selected century', () => {
  const {parseDisplayDate: parse} = exports;
  assert.equal(parse('03/09/26'), '2026-09-03');
  assert.equal(parse('29/02/24'), '2024-02-29');
  for (const invalid of ['', '3/9/26', '2026-09-03', '29/02/26', '31/04/26', '00/09/26', '03/13/26', '03/09/2', '03/09/2569']) assert.equal(parse(invalid), null, invalid);
  assert.equal(parse('31/12/99', '1999-01-01'), '1999-12-31');
  assert.equal(parse('01/01/00', '2100-01-01'), '2100-01-01');
  assert.equal(parse('01/01/01', '2100-01-01'), null);
  assert.equal(parse('01/01/1900'), '1900-01-01');
  assert.equal(parse('01/01/2100'), '2100-01-01');
  for (const iso of ['1900-01-01','1999-12-31','2000-02-29','2026-09-03','2099-12-31','2100-12-31']) assert.equal(parse(formatBusinessDate(iso), iso), iso);
});

test('Relative date presets use Bangkok today, inclusive days and full calendar months', () => {
  const {datePresetPeriod: preset, bangkokBusinessDate: today} = exports;
  assert.equal(today(new Date('2026-09-02T16:59:59Z')), '2026-09-02');
  assert.equal(today(new Date('2026-09-02T17:00:00Z')), '2026-09-03');
  const expected = {
    today: ['2026-09-03','2026-09-03'], yesterday: ['2026-09-02','2026-09-02'],
    last7: ['2026-08-28','2026-09-03'], last30: ['2026-08-05','2026-09-03'],
    thisMonth: ['2026-09-01','2026-09-30'], lastMonth: ['2026-08-01','2026-08-31'],
  };
  for (const [key,[start,end]] of Object.entries(expected)) {
    const p=preset(key,'2026-09-03');assert.equal(p.start,start);assert.equal(p.end,end);assert.ok(isValidPeriod(p));
  }
  assert.equal(preset('lastMonth','2026-01-05').start,'2025-12-01');
  assert.equal(preset('lastMonth','2024-03-15').end,'2024-02-29');
  assert.equal(preset('yesterday','2026-01-01').end,'2025-12-31');
  assert.equal(periodDays(preset('last7','2026-01-01')),7);
  assert.equal(periodDays(preset('last30','2026-01-01')),30);
  assert.throws(()=>preset('last30','1900-01-01'));
});

test('Report and history display dates are DD/MM/YY without mutating original date values', () => {
  assert.equal(formatSourceDate('2026-09-01T19:12:55.000Z'), '01/09/26 19:12:55');
  assert.equal(formatSourceDate('2026-09-01'), '01/09/26');
  assert.equal(formatSourceDate('01/09/2569 19:12'), '01/09/26 19:12');
  assert.equal(formatSourceDate('01/09/2026'), '01/09/26');
  assert.equal(formatSourceDate('2026-02-29'), '2026-02-29');
  assert.equal(formatSourceDate('29 February 2026 12:00'), '29 February 2026 12:00');
  assert.equal(exports.formatBusinessTimestamp('2026-09-02T17:00:01Z'), '03/09/26 00:00:01');
  assert.equal(exports.formatBusinessTimestamp('bad-date'), 'NO DATA');
  const runtime={reports:[kappo],financeFor:()=>financeSummary};
  const daily=dashboardForPeriod('kappo',makePeriod('2026-09-01','day'),undefined,runtime).data;
  assert.equal(daily.dailyTrend[0].day,'01/09/26');assert.equal(daily.monthTrend[0].month,'09/26');
  assert.equal(kappo.businessDate,'2026-09-01');
});

test('Date UI has two months, matching presets, explicit apply/cancel and shared text inputs', () => {
  const ui=readFileSync(new URL('../components/period-controls.tsx',import.meta.url),'utf8');
  assert.match(ui,/numberOfMonths=\{2\}/);assert.match(ui,/weekStartsOn=\{0\}/);
  for(const label of ['วันนี้','เมื่อวานนี้','7 วันล่าสุด','30 วันล่าสุด','เดือนนี้','เดือนที่แล้ว','ปรับแต่งเอง','>เลือก<','>ยกเลิก<']) assert.ok(ui.includes(label),label);
  assert.match(ui,/onChange\(draft\); setOpen\(false\)/);
  assert.match(ui,/onClick=\{\(\) => setOpen\(false\)\}>ยกเลิก/);
  assert.match(ui,/label="วันที่เริ่มต้น"/);assert.match(ui,/label="วันที่สิ้นสุด"/);
  const field=readFileSync(new URL('../components/date-input.tsx',import.meta.url),'utf8');
  assert.match(field,/placeholder="DD\/MM\/YY"/);assert.match(field,/aria-invalid=\{invalid\}/);
  const importer=readFileSync(new URL('../components/sales-import-panel.tsx',import.meta.url),'utf8');
  assert.match(importer,/<BusinessDatePicker value=\{date\}/);
  assert.match(readFileSync('components/business-date-picker.tsx','utf8'),/<DateInput label="Import Business Date"/);
  assert.doesNotMatch(ui+importer,/type="date"/);
  const master=readFileSync(new URL('../components/capricci-master-data.tsx',import.meta.url),'utf8');
  assert.match(master,/formatBusinessTimestamp\(value\)/);
});

test('User Guide, Sale and report Master Data page preferences survive refresh for all brands', () => {
  for (const brand of ['kappo','capricci','lawoi']) {
    const fragment = viewFragment({brand,period:makePeriod('2026-09-01','day'),report:'S117'}) + exports.pageFragment('user-guide');
    assert.equal(exports.pageFromFragment(fragment,brand),'user-guide');
    assert.equal(parseViewFragment(fragment).brand,brand);
    assert.equal(exports.pageFromFragment('#page=master-data',brand),'master-data');
    assert.equal(exports.pageFromFragment('#page=sale',brand),'sale');
    assert.equal(exports.pageFromFragment('#page=unknown',brand),'dashboard');
  }
  assert.equal(exports.pageFragment('master-data'),'&page=master-data');
  assert.equal(exports.pageFragment('sale'),'&page=sale');
  assert.equal(exports.pageFragment('dashboard'),'');
});

test('Monthly uses the endpoint calendar month, independent of range start or missing daily data', () => {
  for(const [brand,base,gross] of [['kappo',kappo,32100],['capricci',data,95290],['lawoi',lawoi,33350]]) {
    const snapshots=['2026-08-31','2026-09-01','2026-09-02','2026-09-30','2026-10-01'].map(date=>({...base,businessDate:date}));
    const runtime={reports:snapshots,financeFor:()=>financeSummary};
    for(const selected of [makePeriod('2026-09-15','day'),{start:'2026-08-01',end:'2026-09-15',mode:'custom'},makePeriod('2026-09-01','day')]) {
      const month=exports.dashboardForMonth(brand,selected,undefined,runtime);
      assert.equal(month.data.monthlySales,gross*3);
      assert.equal(month.daysWithData,3);assert.equal(month.selectedDays,30);
      assert.equal(month.period.start,'2026-09-01');assert.equal(month.period.end,'2026-09-30');
      assert.equal(Math.round(sum(month.data.monthlyCategories,'value')*100),gross*300);
      assert.equal(month.data.monthlyDiscount,3*base.S117.items.find(i=>i.label==='Discount').value);
    }
    assert.equal(dashboardForPeriod(brand,makePeriod('2026-09-15','day'),undefined,runtime).data.dailySales,null);
    assert.equal(dashboardForPeriod(brand,makePeriod('2026-09-01','day'),undefined,runtime).data.dailySales,gross);
    const empty=exports.dashboardForMonth(brand,makePeriod('2027-01-01','day'),undefined,runtime);
    assert.equal(empty.data.monthlySales,null);assert.equal(empty.data.monthlyCategories,null);assert.equal(empty.daysWithData,0);
  }
});

test('Monthly boundaries follow leap months and year transitions, without pooling restaurants', () => {
  const runtime={reports:[{...kappo,businessDate:'2024-02-29'},{...kappo,businessDate:'2024-03-01'},{...lawoi,businessDate:'2024-02-28'},{...kappo,businessDate:'2025-12-31'},{...kappo,businessDate:'2026-01-01'}],financeFor:()=>financeSummary};
  const feb=exports.dashboardForMonth('kappo',makePeriod('2024-02-10','day'),undefined,runtime);
  assert.equal(feb.selectedDays,29);assert.equal(feb.period.end,'2024-02-29');assert.equal(feb.data.monthlySales,32100);
  const jan=exports.dashboardForMonth('kappo',{start:'2025-12-01',end:'2026-01-10',mode:'custom'},undefined,runtime);
  assert.equal(jan.data.monthlySales,32100);assert.equal(jan.period.start,'2026-01-01');assert.equal(jan.period.end,'2026-01-31');
});

test('Guest Monthly follows the confirmed S117 counts, not Excel transactions or capacity assumptions', () => {
  const dataset=[data,lawoi,kappo],selected=makePeriod('2026-09-15','day');
  for(const [brand,guests,bills] of [['capricci',41,12],['lawoi',19,5],['kappo',6,2]]) {
    const result=exports.guestCheckInForMonth(brand,selected,dataset);
    assert.equal(result.guests,guests);assert.equal(result.bills,bills);
    assert.equal(result.tables,null);assert.equal(result.occupancy,null);
    assert.equal(result.daysWithData,1);assert.equal(result.selectedDays,30);
    assert.equal(result.guestDays,1);assert.equal(result.billDays,1);
    assert.equal(dashboardForPeriod(brand,selected,undefined,{reports:dataset,financeFor:()=>financeSummary}).data.guest,null);
  }
  const ui=readFileSync(new URL('../components/guest-monthly.tsx',import.meta.url),'utf8');
  for(const label of ['Guest Check-In (Monthly)','No. of Table check-in','No. of Customer check-in','No. of Bills','% Occupancy Rate','NO DATA','ไม่ใช่โต๊ะ'])assert.ok(ui.includes(label),label);
});

test('Guest Monthly updates on imported days, replaces duplicates, and does not cross brand/month boundaries',()=>{
  const selected={start:'2026-08-01',end:'2026-09-02',mode:'custom'};
  const extra={...kappo,businessDate:'2026-09-30'},nextMonth={...kappo,businessDate:'2026-10-01'};
  const replacement={...kappo,S117:{...kappo.S117,guests:7,bills:3}};
  const result=exports.guestCheckInForMonth('kappo',selected,[kappo,lawoi,data,extra,nextMonth,replacement]);
  assert.equal(result.guests,13);assert.equal(result.bills,5);assert.equal(result.daysWithData,2);
  assert.equal(result.period.start,'2026-09-01');assert.equal(result.period.end,'2026-09-30');
  assert.equal(kappo.S117.guests,6);assert.equal(kappo.S117.bills,2);
  const empty=exports.guestCheckInForMonth('capricci',makePeriod('2027-01-01','day'),[data]);
  assert.equal(empty.guests,null);assert.equal(empty.bills,null);assert.equal(empty.daysWithData,0);
  const zero=exports.guestCheckInForMonth('kappo',selected,[{...kappo,S117:{...kappo.S117,guests:0,bills:0}}]);
  assert.equal(zero.guests,0);assert.equal(zero.bills,0);assert.equal(zero.occupancy,null);
  const missing=exports.guestCheckInForMonth('kappo',selected,[kappo,{...extra,S117:{...extra.S117,guests:null}}]);
  assert.equal(missing.guests,null);assert.equal(missing.guestDays,1);assert.equal(missing.bills,4);
});
