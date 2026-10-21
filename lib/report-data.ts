import snapshot from '@/app/data/capricci-20260901.json';
import lawoiSnapshot from '@/app/data/lawoi-20260901.json';
import kappoSnapshot from '@/app/data/kappo-20260901.json';
import capricciFinanceSnapshot from '@/app/data/capricci-finance-20260901.json';

export type BrandKey = 'kappo' | 'capricci' | 'lawoi' | 'saryu' | 'maison';
export type ReportCode = 'A103' | 'S102' | 'S104' | 'S114' | 'S117';
export type Category = { name: string; value: number };
export type GuestMetrics = {
  guests: number | null; bills: number | null; totalPerPerson: number | null;
};
export type BrandData = {
  name: string; short: string; logo: string; date: string; month: string;
  monthlySales: number | null; dailySales: number | null;
  monthlyEntertain: number | null; dailyEntertain: number | null;
  monthlyDiscount: number | null; dailyDiscount: number | null;
  categories: Category[] | null; monthlyCategories: Category[] | null;
  dailyTrend: { day: string; sales: number }[];
  monthTrend: { month: string; sales: number }[];
  guest: GuestMetrics | null; status: string;
};

export const reportTemplates: { code: ReportCode; title: string }[] = [
  { code: 'A103', title: 'Sales Tax Report' },
  { code: 'S102', title: 'Sales Report' },
  { code: 'S104', title: 'Sales Report By Item' },
  { code: 'S114', title: 'Sales Report By Item Category /w Detail' },
  { code: 'S117', title: 'Sales Report Slip' },
];

export type ReportSnapshot = typeof snapshot | typeof lawoiSnapshot | typeof kappoSnapshot;
export const capricciReports = snapshot;
export const reportsByBrand: Record<BrandKey, ReportSnapshot | null> = {
  kappo: kappoSnapshot, capricci: snapshot, lawoi: lawoiSnapshot, saryu: null, maison: null,
};
export const hasReport = (brand: BrandKey, code: ReportCode) => {
  const report = reportsByBrand[brand];
  return report !== null && code in report.sources;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
export const capricciFinance = capricciFinanceSnapshot;
const lookupKey = (value: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Finance's S104: Q = L (ExtendedPrice) + P (Column1 adjustment).
// Preserve first-match lookup order, as in VLOOKUP. Never guess categories
// from POS names/prefixes, or turn an unknown mapping into Other.
export function calculateFinanceCategories(input = capricciFinanceSnapshot) {
  const itemMap = new Map<string, (typeof input.mapping)[number]>();
  for (const item of input.mapping) {
    const key = lookupKey(item.itemCode);
    if (!itemMap.has(key)) itemMap.set(key, item);
  }
  const groupMap = new Map<string, (typeof input.groups)[number]>();
  for (const group of input.groups) {
    const key = lookupKey(group.subgroup);
    if (!groupMap.has(key)) groupMap.set(key, group);
  }
  const categories = input.categoryNames.map(name => ({ name, value: 0 }));
  const subgroups = input.groups.map(group => ({ name: group.subgroup.trim(), category: group.category.trim().replace(/\s+/g, ' '), value: 0 }));
  const detail = input.rows.filter(row => row.businessDate === input.source.businessDate).map(row => {
    const mapping = itemMap.get(lookupKey(row.itemCode));
    const group = groupMap.get(lookupKey(mapping?.subgroup ?? null));
    const category = categories.find(item => lookupKey(item.name) === lookupKey(group?.category ?? null));
    const value = roundMoney(row.extendedPrice + row.adjustment);
    const reason = lookupKey(row.customerName) !== lookupKey(input.customerFilter) ? 'Excluded customer'
      : lookupKey(row.itemCode) === 'servicecharge' ? 'Service Charge'
      : !category ? 'Unmapped' : 'Included';
    if (reason === 'Included') {
      category!.value = roundMoney(category!.value + value);
      const subgroup = subgroups.find(item => lookupKey(item.name) === lookupKey(mapping!.subgroup));
      subgroup!.value = roundMoney(subgroup!.value + value);
    }
    return { ...row, value, reason, category: category?.name ?? null,
      subgroup: mapping?.subgroup?.trim() ?? null, mappingRow: mapping?.sourceRow ?? null };
  });
  const included = detail.filter(row => row.reason === 'Included');
  const total = (rows: typeof detail, key: 'value' | 'extendedPrice' | 'adjustment') => roundMoney(rows.reduce((sum, row) => sum + row[key], 0));
  return {
    categories, subgroups, detail, sales: roundMoney(categories.reduce((sum, item) => sum + item.value, 0)),
    extendedPrice: total(included, 'extendedPrice'), adjustment: total(included, 'adjustment'),
    includedRows: included.length,
    serviceCharge: total(detail.filter(row => row.reason === 'Service Charge'), 'value'),
    excludedCustomerTotal: total(detail.filter(row => row.reason === 'Excluded customer'), 'value'),
    unmapped: detail.filter(row => row.reason === 'Unmapped'),
  };
}
export const capricciCategorySummary = calculateFinanceCategories();
export function getReconciliation(report: ReportSnapshot) {
  const compare = (label: string, actual: number, expected: number) => ({
    label, actual: roundMoney(actual), expected: roundMoney(expected),
    delta: Math.round(actual * 100 - expected * 100) / 100,
  });
  return [
    compare('A103 Net / S117 Total Sale', report.A103.totals.net, report.S117.totalSale),
    compare('Payment Total / S117 Total Sale', report.S117.paymentTotal, report.S117.totalSale),
    compare('S102 ExtendedPriceTax / S117 Total', report.S102.totals.ExtendedPriceTax, report.S117.grandTotal),
    compare('S104 ExtendedPriceTax / S117 Total', report.S104.totals.ExtendedPriceTax, report.S117.grandTotal),
    compare('S114 Printed Net / S117 Total', report.S114.totals.net, report.S117.grandTotal),
    compare('S114 Row Sum / Printed Net', report.S114.rowSums.net, report.S114.totals.net),
  ];
}

const emptyData = {
  date: 'NO DATA', month: 'NO DATA', monthlySales: null, dailySales: null,
  monthlyEntertain: null, dailyEntertain: null,
  monthlyDiscount: null, dailyDiscount: null, categories: null, monthlyCategories: null,
  dailyTrend: [], monthTrend: [], guest: null, status: 'NO DATA',
};
export function guestMetricsFromSlip(slip: Partial<ReportSnapshot['S117']>): GuestMetrics {
  const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const guests = count(slip.guests);
  return { guests, bills: count(slip.bills), totalPerPerson: guests !== null && guests > 0 ? count(slip.totalPerPerson) : null };
}
export function entertainFromSlip(slip: Pick<ReportSnapshot['S117'], 'items'>) {
  const value = slip.items.find(item => item.label === 'Entertain')?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
// Gross merchandise sales only; don't combine overlapping reports as revenue.
function dashboardFor(report: ReportSnapshot, financeSummary = capricciCategorySummary, mapped = false) {
  const finance = report.brandId === 'capricci' || mapped ? financeSummary : null;
  const categories = finance ? finance.categories : report.S117.items.filter(item => ['Food', 'Beverage', 'Other'].includes(item.label))
    .map(item => ({ name: item.label, value: item.value }));
  const gross = finance ? finance.sales : categories.reduce((sum, item) => sum + item.value, 0);
  const discount = report.S117.items.find(item => item.label === 'Discount')!.value;
  // Gross already excludes Entertain. Show the separate printed S117 amount;
  // never subtract it again or substitute grandTotal for merchandise sales.
  const entertain = entertainFromSlip(report.S117);
  return {
    date: formatBusinessDate(report.businessDate), month: 'SEP 26 · 1 วัน', monthlySales: gross, dailySales: gross,
    monthlyEntertain: entertain, dailyEntertain: entertain, guest: guestMetricsFromSlip(report.S117),
    monthlyDiscount: discount, dailyDiscount: discount, categories, monthlyCategories: categories,
    dailyTrend: [{ day: formatBusinessDate(report.businessDate), sales: gross }], monthTrend: [{ month: 'SEP 26*', sales: gross }],
    status: report.brandId === 'lawoi' ? '5 REPORTS · CSV REVIEW'
      : getReconciliation(report).some(check => check.delta !== 0) ? '5 REPORTS · NEEDS REVIEW' : '5 REPORTS · MATCHED',
  };
}

export const brandData: Record<BrandKey, BrandData> = {
  maison: { ...emptyData, name: 'Maison Dunand', short: 'MD', logo: '/brands/maison.png' },
  saryu: { ...emptyData, name: 'SUSHI SARYU', short: 'SS', logo: '/brands/saryu.jpg' },
  kappo: { ...emptyData, name: 'KAPPO TAKASHI', short: 'KT', logo: '/brands/kappo.jpg', ...dashboardFor(kappoSnapshot) },
  capricci: { ...emptyData, name: 'Capricci', short: 'CA', logo: '/brands/capricci.png', ...dashboardFor(snapshot) },
  lawoi: { ...emptyData, name: 'LAWOI', short: 'LW', logo: '/brands/lawoi.jpg', ...dashboardFor(lawoiSnapshot) },
};

export function isRetiredReport(name: string) {
  return /(?:^|[^A-Z0-9])S107(?=[^A-Z0-9]|$)/i.test(name);
}
export function detectReportCode(name: string): ReportCode | null {
  if (isRetiredReport(name)) return null;
  const candidate = name.toUpperCase().match(/(?:^|[^A-Z0-9])(A103|S102|S104|S114|S117)(?=[^A-Z0-9]|$)/)?.[1];
  return (candidate as ReportCode | undefined) ?? null;
}

export function formatBusinessDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

export type PeriodMode = 'day' | 'week' | 'month' | 'custom';
export type Period = { start: string; end: string; mode: PeriodMode };
export type DashboardView = { brand: BrandKey; period: Period; report: ReportCode };
export const MIN_DATE = '1900-01-01';
export const MAX_DATE = '2100-12-31';
const DAY_MS = 86_400_000;
const dateMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export function isBusinessDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= MIN_DATE && value <= MAX_DATE
    && Number.isFinite(dateMs(value)) && isoDate(new Date(dateMs(value))) === value;
}
// Display uses DD/MM/YY; storage and backups remain ISO. Two-digit years use
// the selected century (2000 by default); a four-digit pasted year is explicit.
export function parseDisplayDate(value: string, reference = '2000-01-01'): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const century = isBusinessDate(reference) ? Math.floor(Number(reference.slice(0, 4)) / 100) * 100 : 2000;
  const year = match[3].length === 4 ? Number(match[3]) : century + Number(match[3]);
  const iso = `${year}-${match[2]}-${match[1]}`;
  return isBusinessDate(iso) ? iso : null;
}
export function bangkokBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function formatBusinessTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'NO DATA';
  return `${formatBusinessDate(bangkokBusinessDate(date))} ${date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })}`;
}
export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';
export function datePresetPeriod(preset: DatePreset, today = bangkokBusinessDate()): Period {
  if (!isBusinessDate(today)) throw new Error('Invalid preset date');
  const offset = (days: number) => isoDate(new Date(dateMs(today) + days * DAY_MS));
  if (preset === 'today') return makePeriod(today, 'day');
  if (preset === 'yesterday') return makePeriod(offset(-1), 'day');
  if (preset === 'thisMonth') return makePeriod(today, 'month');
  if (preset === 'lastMonth') {
    const date = new Date(dateMs(today));
    return makePeriod(isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0))), 'month');
  }
  return periodFromCalendar(offset(preset === 'last7' ? -6 : -29), today);
}
export function periodDays(period: Pick<Period, 'start' | 'end'>) {
  return Math.round((dateMs(period.end) - dateMs(period.start)) / DAY_MS) + 1;
}
export function isValidPeriod(period: Period) {
  if (!isBusinessDate(period.start) || !isBusinessDate(period.end) || period.start > period.end) return false;
  if (!['day', 'week', 'month', 'custom'].includes(period.mode)) return false;
  if (period.mode === 'day') return periodDays(period) === 1;
  if (period.mode === 'week') return periodDays(period) === 7;
  if (period.mode === 'month') {
    const date = new Date(dateMs(period.start));
    return period.start.endsWith('-01') && period.end === isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  }
  return true;
}
export function makePeriod(anchor: string, mode: Exclude<PeriodMode, 'custom'>): Period {
  if (!isBusinessDate(anchor)) throw new Error('Invalid period date');
  const date = new Date(dateMs(anchor));
  const period: Period = mode === 'month'
    ? { start: isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))), end: isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))), mode }
    : { start: anchor, end: isoDate(new Date(dateMs(anchor) + (mode === 'week' ? 6 : 0) * DAY_MS)), mode };
  if (!isValidPeriod(period)) throw new Error('Period outside supported dates');
  return period;
}
// A first calendar click is a valid one-day selection, regardless of data.
// In range mode the user can apply it immediately or extend to a second date.
export function periodFromCalendar(start: string, end?: string): Period {
  const period: Period = { start, end: end ?? start, mode: 'custom' };
  if (!isValidPeriod(period)) throw new Error('Invalid calendar selection');
  return period;
}
export function shiftPeriod(period: Period, direction: -1 | 1): Period | null {
  if (!isValidPeriod(period)) return null;
  const date = new Date(dateMs(period.start));
  const shifted: Period = period.mode === 'month'
    ? { start: isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1))), end: isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction + 1, 0))), mode: 'month' }
    : { start: isoDate(new Date(dateMs(period.start) + direction * periodDays(period) * DAY_MS)), end: isoDate(new Date(dateMs(period.end) + direction * periodDays(period) * DAY_MS)), mode: period.mode };
  return isValidPeriod(shifted) ? shifted : null;
}
export function formatPeriod(period: Period) {
  return period.start === period.end ? formatBusinessDate(period.start) : `${formatBusinessDate(period.start)} – ${formatBusinessDate(period.end)}`;
}
export function latestPeriod(brand: BrandKey): Period {
  return makePeriod(reportsByBrand[brand]?.businessDate ?? '2026-09-01', 'day');
}
export function reportsForPeriod(brand: BrandKey, period: Period, dataset?: ReportSnapshot[]) {
  const report = dataset ? dataset.filter(r=>r.brandId===brand && r.businessDate>=period.start && r.businessDate<=period.end).sort((a,b)=>a.businessDate.localeCompare(b.businessDate)).at(-1) : reportsByBrand[brand];
  return isValidPeriod(period) && report && report.businessDate >= period.start && report.businessDate <= period.end ? report : null;
}
// Current source bundles each contain one business day. Missing days stay null,
// never backfilled with another day or combined across overlapping report types.
export function dashboardForPeriod(brand: BrandKey, period: Period, financeSummary = capricciCategorySummary, runtime?: { reports: ReportSnapshot[]; financeFor: (report: ReportSnapshot) => typeof capricciCategorySummary; mappedBrands?:BrandKey[] }) {
  if (runtime) {
    const reports=isValidPeriod(period)?runtime.reports.filter(r=>r.brandId===brand && r.businessDate>=period.start && r.businessDate<=period.end).sort((a,b)=>a.businessDate.localeCompare(b.businessDate)):[];
    const mapped=runtime.mappedBrands?.includes(brand)??false;
    const days=reports.map(report=>({report,data:dashboardFor(report,brand==='capricci'||mapped?runtime.financeFor(report):financeSummary,mapped)}));
    const daily=days.find(d=>d.report.businessDate===period.end)?.data;
    const sum=(key:'dailySales'|'dailyDiscount'|'dailyEntertain')=>days.length?roundMoney(days.reduce((n,d)=>n+(d.data[key]??0),0)):null;
    const categories=new Map<string,number>(),months=new Map<string,number>();
    for (const day of days) {
      for (const item of day.data.categories) categories.set(item.name,roundMoney((categories.get(item.name)??0)+item.value));
      const month=day.report.businessDate.slice(0,7);months.set(month,roundMoney((months.get(month)??0)+(day.data.dailySales??0)));
    }
    const data:BrandData={...brandData[brand],...emptyData,date:formatBusinessDate(period.end),month:formatPeriod(period),monthlySales:sum('dailySales'),monthlyDiscount:sum('dailyDiscount'),monthlyEntertain:sum('dailyEntertain'),
      dailySales:daily?.dailySales??null,dailyDiscount:daily?.dailyDiscount??null,dailyEntertain:daily?.dailyEntertain??null,categories:daily?.categories??null,guest:daily?.guest??null,
      monthlyCategories:days.length?[...categories].map(([name,value])=>({name,value})):null,dailyTrend:days.map(d=>({day:formatBusinessDate(d.report.businessDate),sales:d.data.dailySales??0})),monthTrend:[...months].map(([month,sales])=>({month:`${month.slice(5)}/${month.slice(2,4)}`,sales})),
      status:days.length?(days.some(d=>d.data.status.includes('REVIEW'))?'VERIFIED · NEEDS REVIEW':'VERIFIED · MATCHED'):'NO DATA'};
    return {data,report:reports.at(-1)??null,daysWithData:days.length,selectedDays:isValidPeriod(period)?periodDays(period):0};
  }
  const report = reportsForPeriod(brand, period);
  const base = brand === 'capricci' ? { ...brandData[brand], ...dashboardFor(snapshot, financeSummary) } : brandData[brand];
  const daily = report?.businessDate === period.end;
  const data: BrandData = {
    ...base, ...(report ? {} : emptyData), date: formatBusinessDate(period.end), month: formatPeriod(period),
    dailySales: daily ? base.dailySales : null,
    dailyEntertain: daily ? base.dailyEntertain : null,
    guest: daily ? base.guest : null,
    dailyDiscount: daily ? base.dailyDiscount : null,
    categories: daily ? base.categories : null,
  };
  return { data, report, daysWithData: report ? 1 : 0, selectedDays: isValidPeriod(period) ? periodDays(period) : 0 };
}
// Monthly is a calendar-month view anchored to the selected endpoint, not
// the custom range. reportDataset replaces same-day imports before this sum.
export function dashboardForMonth(brand: BrandKey, selected: Period, financeSummary = capricciCategorySummary, runtime?: Parameters<typeof dashboardForPeriod>[3]) {
  const period = makePeriod(selected.end, 'month');
  return { ...dashboardForPeriod(brand, period, financeSummary, runtime), period };
}
// Operational metrics are separate from sales categories and use S117's basis,
// not the gross-sales amount displayed in the sales cards.
export function salesGuestsForPeriod(brand: BrandKey, period: Period, dataset: ReportSnapshot[]): Pick<GuestMetrics, 'guests' | 'totalPerPerson'> {
  const byDate = new Map<string, ReportSnapshot>();
  if (isValidPeriod(period)) for (const report of dataset) {
    if (report.brandId === brand && report.businessDate >= period.start && report.businessDate <= period.end) byDate.set(report.businessDate, report);
  }
  const reports = [...byDate.values()];
  const rows = reports.map(report => guestMetricsFromSlip(report.S117));
  const guests = rows.length && rows.every(row => row.guests !== null)
    ? rows.reduce((total, row) => total + row.guests!, 0) : null;
  if (guests === null || guests === 0) return { guests, totalPerPerson: null };
  // Preserve the printed figure when only one report is available. For several
  // days, divide the sum of original Total Sale amounts by all recorded guests.
  if (rows.length === 1) return { guests, totalPerPerson: rows[0].totalPerPerson };
  const completeTotals = reports.every(report => typeof report.S117.totalSale === 'number' && Number.isFinite(report.S117.totalSale) && report.S117.totalSale >= 0);
  return { guests, totalPerPerson: completeTotals ? roundMoney(reports.reduce((total, report) => total + report.S117.totalSale, 0) / guests) : null };
}
export function guestCheckInForMonth(brand: BrandKey, selected: Period, dataset: ReportSnapshot[]) {
  const period = makePeriod(selected.end, 'month');
  // Same restaurant/date is a replacement, including restored import batches.
  const byDate = new Map<string, ReportSnapshot>();
  for (const report of dataset) if (report.brandId === brand && report.businessDate >= period.start && report.businessDate <= period.end) byDate.set(report.businessDate, report);
  const reports = [...byDate.values()].sort((a,b) => a.businessDate.localeCompare(b.businessDate));
  const rows = reports.map(report => ({ date: report.businessDate, ...guestMetricsFromSlip(report.S117) }));
  const sum = (key: 'guests' | 'bills') => rows.length && rows.every(row => row[key] !== null) ? rows.reduce((total,row) => total + row[key]!, 0) : null;
  return {
    period, daysWithData: rows.length, selectedDays: periodDays(period),
    guests: sum('guests'), bills: sum('bills'), tables: null, occupancy: null,
    guestDays: rows.filter(row => row.guests !== null).length,
    billDays: rows.filter(row => row.bills !== null).length, rows,
  };
}
export type DashboardPage = 'dashboard' | 'master-data' | 'user-guide' | 'sale';
export function pageFromFragment(fragment: string, brand: BrandKey): DashboardPage {
  const page = new URLSearchParams(fragment.replace(/^#/, '')).get('page');
  if (!Object.hasOwn(brandData, brand)) return 'dashboard';
  return page === 'user-guide' || page === 'master-data' || page === 'sale' ? page : 'dashboard';
}
export function pageFragment(page: DashboardPage) {
  return page === 'dashboard' ? '' : `&page=${page}`;
}
export function viewFragment(view: DashboardView) {
  return new URLSearchParams({ brand: view.brand, from: view.period.start, to: view.period.end, mode: view.period.mode, report: view.report }).toString();
}
export function parseViewFragment(fragment: string): DashboardView | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const brand = params.get('brand') as BrandKey;
  const period = { start: params.get('from') ?? '', end: params.get('to') ?? '', mode: params.get('mode') as PeriodMode };
  if (!Object.hasOwn(brandData, brand) || !isValidPeriod(period)) return null;
  const code = params.get('report');
  const report = reportTemplates.find(item => item.code === code)?.code ?? 'S117';
  return { brand, period, report };
}
export function refreshDashboard(view: DashboardView, queueCount: number, actions: {
  confirm: (message: string) => boolean; save: (fragment: string) => void; reload: () => void;
}) {
  if (queueCount > 0 && !actions.confirm(`มีไฟล์ในคิว Import ${queueCount} ไฟล์ที่ยังไม่บันทึก การ Refresh จะล้างคิวนี้ ต้องการโหลดหน้าใหม่หรือไม่?`)) return false;
  actions.save(viewFragment(view));
  actions.reload();
  return true;
}

// Preserve raw CSV text in the snapshot; normalize only the displayed date.
export function formatSourceDate(value: string) {
  // Excel ISO values represent source civil dates, not UTC instants.
  const numeric = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if (numeric && isBusinessDate(`${numeric[1]}-${numeric[2]}-${numeric[3]}`)) {
    return `${formatBusinessDate(`${numeric[1]}-${numeric[2]}-${numeric[3]}`)}${numeric[4] ? ` ${numeric[4]}` : ''}`;
  }
  const slash = value.match(/^(\d{2})\/(\d{2})\/(\d{4}|\d{2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);
  if (slash) {
    const rawYear = Number(slash[3]);
    const year = rawYear >= 2400 ? String(rawYear - 543) : slash[3];
    const iso = parseDisplayDate(`${slash[1]}/${slash[2]}/${year}`);
    if (iso) return `${formatBusinessDate(iso)}${slash[4] ? ` ${slash[4]}` : ''}`;
  }
  const match = value.match(/^(\d{1,2}) (\S+) (\d{4}) (\d{2}:\d{2})/);
  if (!match) return value;
  const monthNames = [
    ['January', 'มกราคม'], ['February', 'กุมภาพันธ์'], ['March', 'มีนาคม'],
    ['April', 'เมษายน'], ['May', 'พฤษภาคม'], ['June', 'มิถุนายน'],
    ['July', 'กรกฎาคม'], ['August', 'สิงหาคม'], ['September', 'กันยายน'],
    ['October', 'ตุลาคม'], ['November', 'พฤศจิกายน'], ['December', 'ธันวาคม'],
  ];
  const month = monthNames.findIndex(names => names.includes(match[2])) + 1;
  if (!month) return value;
  const rawYear = Number(match[3]);
  const year = rawYear >= 2400 ? rawYear - 543 : rawYear;
  const iso = `${year}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return isBusinessDate(iso) ? `${formatBusinessDate(iso)} ${match[4]}` : value;
}
