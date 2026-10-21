'use client';

import { useEffect, useMemo, useState } from 'react';
import { SaryuWorkspace } from '@/components/saryu-workspace';
import { originalSaryuMaster, saryuDataset, saryuSelection, saryuSummary, saryuGuestMonth, type FoodstoryBatch } from '@/lib/saryu';
import { MaisonWorkspace } from '@/components/maison-workspace';
import { originalMaisonMaster, maisonDataset, maisonSelection, maisonSummary, maisonGuestMonth } from '@/lib/maison';
import { KappoFoodstoryWorkspace } from '@/components/kappo-foodstory-workspace';
import { originalKappoFoodstoryMaster, kappoFoodstoryDataset, kappoFoodstorySelection, kappoFoodstorySummary, kappoFoodstoryGuestMonth } from '@/lib/kappo-foodstory';
import { CustomerTrafficAnalysis } from '@/components/customer-traffic-analysis';
import { customerAnalytics } from '@/lib/customer-analytics';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  BookOpen,
  Database,
  ChevronRight,
  CircleHelp,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  ShoppingBag,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportCenter } from '@/components/report-center';
import { ReportDetailsPage } from '@/components/report-details-page';
import { GuestMonthly } from '@/components/guest-monthly';
import { SalesCategoryRows, unmappedColor } from '@/components/sales-category-rows';
import { RefreshDialog } from '@/components/refresh-dialog';
import { usePageRefresh } from '@/hooks/use-page-refresh';
import { SalesImportPanel } from '@/components/sales-import-panel';
import { reportDataset, financeSummaryFor, periodFinanceSummary } from '@/lib/runtime-reports';
import type { Destination, ImportedBatch } from '@/lib/sales-import';
import type { CapricciMaster } from '@/lib/capricci-master';
import { UserGuide } from '@/components/user-guide';
import { CapricciMasterData } from '@/components/capricci-master-data';
import { MasterDataNavigation } from '@/components/master-data-navigation';
import { useCapricciMaster } from '@/hooks/use-capricci-master';
import { KappoMasterData } from '@/components/kappo-master-data';
import { originalKappoMaster, type KappoMaster } from '@/lib/kappo-master';
import { kappoSummaryFor } from '@/lib/kappo-runtime';
import { LawoiMasterData } from '@/components/lawoi-master-data';
import { originalLawoiMaster, type LawoiMaster } from '@/lib/lawoi-master';
import { lawoiSummaryFor } from '@/lib/lawoi-runtime';
import { masterChangeCount } from '@/lib/capricci-master';
import { HeaderDatePicker } from '@/components/period-controls';
import { dashboardForMonth, dashboardForPeriod, formatPeriod, guestCheckInForMonth, salesGuestsForPeriod, latestPeriod, makePeriod, pageFragment, pageFromFragment, parseViewFragment, viewFragment, type BrandKey, type Category, type DashboardPage, type GuestMetrics, type Period, type ReportCode } from '@/lib/report-data';

const categoryColors = ['#4475c4', '#ef7d32', '#a8a8a2', '#f1bd21', '#b75b93'];

const chartConfig = {
  sales: { label: 'ยอดขาย', color: '#4475c4' },
} satisfies ChartConfig;

function money(value: number | null) {
  if (value === null) return 'NO DATA';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function NoData({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50/70 text-center ${compact ? 'min-h-28 p-4' : 'min-h-52 p-8'}`}
    >
      <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-stone-200 text-stone-500">
        <FileBarChart className="size-4" />
      </span>
      <p className="text-sm font-bold tracking-[0.12em] text-stone-600">NO DATA</p>
      <p className="mt-1 text-xs text-stone-500">ยังไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
    </div>
  );
}

function CategoryPanel({
  date,
  items,
  guest,
}: {
  date?: string;
  items: Category[] | null;
  guest: Pick<GuestMetrics, 'guests' | 'totalPerPerson'>;
}) {
  const total = items?.reduce((sum, item) => sum + item.value, 0) ?? 0;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(170px,0.8fr)_minmax(250px,1.2fr)] gap-4 max-xl:grid-cols-1">
      <div className="min-w-0">
        {items ? (
          <div className="relative mx-auto h-[170px] max-w-[230px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={items.filter((item) => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={53}
                  outerRadius={75}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {items
                    .filter((item) => item.value > 0)
                    .map((item) => (
                      <Cell key={item.name} fill={item.name === 'ยังไม่จัดหมวด' ? unmappedColor : categoryColors[items.indexOf(item)]} />
                    ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Category</span>
              <span className="mt-1 text-lg font-bold text-stone-800">{money(total)}</span>
            </div>
          </div>
        ) : (
          <NoData compact />
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between border-b border-stone-200 pb-3">
          <h3 className="text-sm font-bold text-stone-800">Sale by Category</h3>
          {date && <span className="text-xs font-semibold text-stone-500">{date}</span>}
        </div>
        <SalesCategoryRows items={items} guest={guest} colors={categoryColors} formatValue={money} />
      </div>
    </section>
  );
}

function SalesCard({
  tone,
  period,
  value,
  discount,
  categories,
  guest,
  date,
  note,
  basis = 'Gross sales',
}: {
  tone: 'monthly' | 'daily';
  period: string;
  value: number | null;
  discount: number | null;
  categories: Category[] | null;
  guest: Pick<GuestMetrics, 'guests' | 'totalPerPerson'>;
  date?: string;
  note?: string;
  basis?: string;
}) {
  const monthly = tone === 'monthly';
  return (
    <Card className="gap-0 overflow-hidden border-0 py-0 shadow-[0_12px_35px_rgb(27_39_31/8%)] ring-1 ring-stone-200/80">
      <div className="grid grid-cols-[190px_minmax(0,1fr)] max-xl:grid-cols-[170px_minmax(0,1fr)] max-lg:grid-cols-1">
        <div className={monthly ? 'bg-[#f5b916]' : 'bg-[#87ca45]'}>
          <div className="border-b border-black/10 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/55">{period}</p>
            <h2 className="mt-1 text-lg font-bold text-[#17211b]">{monthly ? 'Sale (Monthly)' : 'Sales (Daily)'}</h2>
          </div>
          <div className="flex min-h-[220px] flex-col justify-between px-5 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/50">{basis}</p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight text-[#143f31] tabular-nums">{money(value)}</p>
              <p className="mt-2 text-xs font-medium text-black/50">THB</p>
            </div>
            <div className="rounded-lg bg-white/55 px-3 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/45">Discount</p>
              <p className={`mt-1 text-base font-bold tabular-nums ${discount === null ? 'text-stone-500' : 'text-red-600'}`}>
                {discount === null ? 'NO DATA' : `(${money(discount)})`}
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <CategoryPanel date={date} items={categories} guest={guest} />
          {note && <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">{note}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const [brandKey, setBrandKey] = useState<BrandKey>('kappo');
  const [period, setPeriod] = useState<Period>(() => makePeriod('2026-10-18','day'));
  const [reportCode, setReportCode] = useState<ReportCode>('S117');
  const [ready, setReady] = useState(false);
  const [loadedAt, setLoadedAt] = useState('');
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [page, setPage] = useState<DashboardPage>('dashboard');
  const [capricciDirty, setMasterDirty] = useState(false);
  const [kappoDirty, setKappoDirty] = useState(false);
  const [kappoMaster, setKappoMaster] = useState<KappoMaster>(originalKappoMaster);
  const [lawoiDirty, setLawoiDirty] = useState(false);
  const [lawoiMaster, setLawoiMaster] = useState<LawoiMaster>(originalLawoiMaster);
  const [saryuMaster,setSaryuMaster]=useState(originalSaryuMaster);
  const [saryuImports,setSaryuImports]=useState<FoodstoryBatch[]>([]);
  const [saryuDirty,setSaryuDirty]=useState(false);
  const [saryuQueue,setSaryuQueue]=useState(0);
  const saryuReports=useMemo(()=>saryuDataset(saryuImports),[saryuImports]);
  const saryuChanged=JSON.stringify(saryuMaster)!==JSON.stringify(originalSaryuMaster)||saryuImports.length>0;
  const [maisonMaster,setMaisonMaster]=useState(originalMaisonMaster);
  const [maisonImports,setMaisonImports]=useState<FoodstoryBatch[]>([]);
  const [maisonDirty,setMaisonDirty]=useState(false);
  const [maisonQueue,setMaisonQueue]=useState(0);
  const maisonReports=useMemo(()=>maisonDataset(maisonImports),[maisonImports]);
  const maisonChanged=JSON.stringify(maisonMaster)!==JSON.stringify(originalMaisonMaster)||maisonImports.length>0;
  const [kappoFoodstoryMaster,setKappoFoodstoryMaster]=useState(originalKappoFoodstoryMaster);
  const [kappoFoodstoryImports,setKappoFoodstoryImports]=useState<FoodstoryBatch[]>([]);
  const [kappoFoodstoryDirty,setKappoFoodstoryDirty]=useState(false);
  const [kappoFoodstoryQueue,setKappoFoodstoryQueue]=useState(0);
  const kappoFoodstoryReports=useMemo(()=>kappoFoodstoryDataset(kappoFoodstoryImports),[kappoFoodstoryImports]);
  const kappoFoodstoryChanged=JSON.stringify(kappoFoodstoryMaster)!==JSON.stringify(originalKappoFoodstoryMaster)||kappoFoodstoryImports.length>0;
  const foodstoryBrand=brandKey==='kappo'||brandKey==='saryu'||brandKey==='maison';
  const masterDirty = capricciDirty || kappoDirty || lawoiDirty || saryuDirty || maisonDirty || kappoFoodstoryDirty;
  const kappoChanged = JSON.stringify(kappoMaster) !== JSON.stringify(originalKappoMaster);
  const lawoiChanged = JSON.stringify(lawoiMaster) !== JSON.stringify(originalLawoiMaster);
  const masterConnection = useCapricciMaster();
  const [batches,setBatches]=useState<ImportedBatch[]>([]);
  const { refreshing, refreshError, requestReload } = usePageRefresh(masterDirty || saryuChanged || maisonChanged || kappoFoodstoryChanged || saryuQueue > 0 || maisonQueue > 0 || kappoFoodstoryQueue > 0 || kappoChanged || lawoiChanged || masterConnection.previewActive || batches.length > 0 || queueCount > 0);
  const dataset=useMemo(()=>reportDataset(batches),[batches]);
  const customerDays=useMemo(()=>[
    ...dataset.filter(report=>report.brandId!=='kappo').map(report=>({brand:report.brandId as BrandKey,date:report.businessDate,guests:typeof report.S117.guests==='number'?report.S117.guests:null})),
    ...kappoFoodstoryReports.map(batch=>({brand:'kappo' as const,date:batch.date,guests:batch.bills.reduce((sum,bill)=>sum+bill.guests,0)})),
    ...saryuReports.map(batch=>({brand:'saryu' as const,date:batch.date,guests:batch.bills.reduce((sum,bill)=>sum+bill.guests,0)})),
    ...maisonReports.map(batch=>({brand:'maison' as const,date:batch.date,guests:batch.bills.reduce((sum,bill)=>sum+bill.guests,0)})),
  ],[dataset,kappoFoodstoryReports,saryuReports,maisonReports]);
  const trafficAnalytics=useMemo(()=>customerAnalytics(customerDays,brandKey,period.end),[customerDays,brandKey,period.end]);
  const financeSummary = useMemo(() => periodFinanceSummary(masterConnection.record.master,batches,period), [masterConnection.record.master,batches,period]);
  const selection = useMemo(() => dashboardForPeriod(brandKey, period, financeSummary,{reports:dataset,mappedBrands:['kappo','lawoi'],financeFor:r=>r.brandId==='kappo'?kappoSummaryFor(kappoMaster,r):r.brandId==='lawoi'?lawoiSummaryFor(lawoiMaster,r):financeSummaryFor(masterConnection.record.master,r,batches)}), [brandKey, period, financeSummary,dataset,masterConnection.record.master,kappoMaster,lawoiMaster,batches]);
  const monthlyPeriod = useMemo(() => makePeriod(period.end, 'month'), [period.end]);
  const monthlyFinanceSummary = useMemo(() => periodFinanceSummary(masterConnection.record.master, batches, monthlyPeriod), [masterConnection.record.master, batches, monthlyPeriod]);
  const monthlySelection = useMemo(() => dashboardForMonth(brandKey, period, monthlyFinanceSummary, { reports: dataset,mappedBrands:['kappo','lawoi'], financeFor: r => r.brandId==='kappo'?kappoSummaryFor(kappoMaster,r):r.brandId==='lawoi'?lawoiSummaryFor(lawoiMaster,r):financeSummaryFor(masterConnection.record.master, r, batches) }), [brandKey, period, monthlyFinanceSummary, dataset, masterConnection.record.master,kappoMaster,lawoiMaster, batches]);
  const monthlyLabel = formatPeriod(monthlyPeriod);
  const monthlyGuests = useMemo(() => guestCheckInForMonth(brandKey, period, dataset), [brandKey, period, dataset]);
  const monthlySalesGuests = useMemo(() => salesGuestsForPeriod(brandKey, monthlyPeriod, dataset), [brandKey, monthlyPeriod, dataset]);
  const selectedSalesGuests = useMemo(() => salesGuestsForPeriod(brandKey, period, dataset), [brandKey, period, dataset]);
  function openImport() {
    setPage('master-data');
    const target=brandKey==='kappo'?'kappo-foodstory-import-files':brandKey==='saryu'?'saryu-import-files':brandKey==='maison'?'maison-import-files':'import-files';
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' }), 0);
  }
  function applyImport(next:ImportedBatch[],master:CapricciMaster,destination?:Destination,nextKappo?:KappoMaster,nextLawoi?:LawoiMaster){
    setBatches(next);masterConnection.preview(master);if(nextKappo)setKappoMaster(nextKappo);if(nextLawoi)setLawoiMaster(nextLawoi);
    if(destination){setBrandKey(destination.brand);setPeriod({start:destination.date,end:destination.date,mode:'day'});setReportCode('S117');}
    setPage('dashboard');
  }
  const activeSelection=brandKey==='kappo'?kappoFoodstorySelection(kappoFoodstoryMaster,kappoFoodstoryReports,period):brandKey==='saryu'?saryuSelection(saryuMaster,saryuReports,period):brandKey==='maison'?maisonSelection(maisonMaster,maisonReports,period):selection;
  const activeMonthly=brandKey==='kappo'?kappoFoodstorySelection(kappoFoodstoryMaster,kappoFoodstoryReports,monthlyPeriod):brandKey==='saryu'?saryuSelection(saryuMaster,saryuReports,monthlyPeriod):brandKey==='maison'?maisonSelection(maisonMaster,maisonReports,monthlyPeriod):monthlySelection;
  const activeMonthlyGuests=brandKey==='kappo'?kappoFoodstoryGuestMonth(kappoFoodstoryMaster,kappoFoodstoryReports,period):brandKey==='saryu'?saryuGuestMonth(saryuMaster,saryuReports,period):brandKey==='maison'?maisonGuestMonth(maisonMaster,maisonReports,period):monthlyGuests;
  const activeMonthlySalesGuests=brandKey==='kappo'?kappoFoodstorySummary(kappoFoodstoryMaster,kappoFoodstoryReports,monthlyPeriod):brandKey==='saryu'?saryuSummary(saryuMaster,saryuReports,monthlyPeriod):brandKey==='maison'?maisonSummary(maisonMaster,maisonReports,monthlyPeriod):monthlySalesGuests;
  const activeSelectedSalesGuests=brandKey==='kappo'?kappoFoodstorySummary(kappoFoodstoryMaster,kappoFoodstoryReports,period):brandKey==='saryu'?saryuSummary(saryuMaster,saryuReports,period):brandKey==='maison'?maisonSummary(maisonMaster,maisonReports,period):selectedSalesGuests;
  const { data, daysWithData, selectedDays } = activeSelection;
  const periodLabel = formatPeriod(period);
  // URL fragment holds only local view preferences, so file:// refresh works
  // without browser storage permissions and never persists report contents.
  function saveFragment(fragment: string) {
    try { window.history.replaceState(null, '', `#${fragment}`); }
    catch { window.location.hash = fragment; }
  }
  useEffect(() => {
    const saved = parseViewFragment(window.location.hash);
    if (saved) { setBrandKey(saved.brand); setPeriod(saved.period); setReportCode(saved.report); }
    if (saved) { const savedPage=pageFromFragment(window.location.hash, saved.brand);setPage(saved.brand==='kappo'&&(savedPage==='sale'||savedPage==='user-guide')?'dashboard':savedPage); }
    setLoadedAt(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveFragment(viewFragment({ brand: brandKey, period, report: reportCode }) + pageFragment(page));
  }, [brandKey, period, reportCode, ready, page]);
  useEffect(()=>{if(brandKey==='kappo'&&(page==='sale'||page==='user-guide'))setPage('dashboard');},[brandKey,page]);
  function handleRefresh() {
    setRefreshOpen(true);
  }
  const overviewStatus = !daysWithData && activeMonthly.daysWithData ? `${activeMonthly.data.status} · MONTHLY ONLY` : data.status;
  const statusTone = !overviewStatus.includes('REVIEW') && overviewStatus !== 'NO DATA' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-[#17211b]">
      {refreshOpen && <RefreshDialog key={`${batches.length}-${queueCount}-${saryuQueue}-${maisonQueue}-${kappoFoodstoryQueue}-${masterDirty}-${masterConnection.previewActive}-${kappoChanged}-${lawoiChanged}-${saryuChanged}-${maisonChanged}-${kappoFoodstoryChanged}`} importedDays={batches.length+saryuImports.length+maisonImports.length+kappoFoodstoryImports.length} queueCount={queueCount+saryuQueue+maisonQueue+kappoFoodstoryQueue} masterDirty={masterDirty} masterPreview={masterConnection.previewActive || kappoChanged || lawoiChanged || saryuChanged || maisonChanged || kappoFoodstoryChanged}
        onClose={() => setRefreshOpen(false)} onConfirm={() => { setRefreshOpen(false); requestReload(() => saveFragment(viewFragment({ brand: brandKey, period, report: reportCode }) + pageFragment(page))); }}
        onBackup={() => { setRefreshOpen(false); openImport(); }} onMaster={() => { setRefreshOpen(false); setBrandKey(kappoFoodstoryDirty?'kappo':saryuDirty?'saryu':maisonDirty?'maison':brandKey); setPage('master-data'); }} />}
      <div className="grid min-h-screen grid-cols-[76px_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="sticky top-0 flex h-screen flex-col items-center border-r border-white/10 bg-[#173c30] py-5 text-white max-md:hidden">
          <div className="flex h-12 w-14 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-lg">
            <img src={data.logo} alt={`${data.name} logo`} className="h-full w-full object-contain" />
          </div>
          <nav aria-label="เมนูหลัก" className="mt-10 flex flex-1 flex-col gap-2">
            {[ 
              { icon: LayoutDashboard, label: 'Dashboard', active: page === 'dashboard' },
              { icon: Database, label: 'Master Data', active: page === 'master-data' },
              { icon: BookOpen, label: 'User Guide', active: page === 'user-guide' },
              { icon: ShoppingBag, label: 'Sale', active: page === 'sale' },
              { icon: Settings, label: 'Settings' },
            ].filter(({label})=>brandKey!=='kappo'||(label!=='User Guide'&&label!=='Sale')).map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                aria-label={label}
                title={label}
                onClick={() => { if (label === 'Sale') setPage('sale'); else if (label === 'User Guide') setPage('user-guide'); else if (label === 'Master Data') setPage('master-data'); else if (label === 'Dashboard') setPage('dashboard'); }}
                className={`flex size-11 items-center justify-center rounded-xl transition-colors ${active ? 'bg-white text-[#173c30] shadow-lg' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="size-[18px]" />
              </button>
            ))}
          </nav>
          <button aria-label="ออกจากระบบ" title="ออกจากระบบ" className="flex size-11 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="size-[18px]" />
          </button>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 px-6 py-4 backdrop-blur-xl lg:px-8">
            <div className="mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-stone-400">
                  Finance revenue <ChevronRight className="size-3" /> {page === 'sale' ? 'Sale' : page === 'user-guide' ? 'User Guide' : page === 'master-data' ? 'Master Data' : 'Overview'}
                </div>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-[#17211b]">Revenue Control Center</h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="hidden h-10 bg-[#173c30] px-3 text-white shadow-sm hover:bg-[#245b43] sm:inline-flex"
                  onClick={openImport}
                >
                  <Upload className="size-4" /> Import File
                </Button>
                <Select value={brandKey} onValueChange={(value) => { setBrandKey(value as BrandKey); }}>
                  <SelectTrigger aria-label="เลือกแบรนด์" className="h-10 min-w-[190px] border-stone-200 bg-white px-3 shadow-sm">
                    <img src={data.logo} alt="" className="h-5 w-8 rounded bg-white object-contain" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kappo"><img src="/brands/kappo.jpg" alt="" className="h-5 w-8 object-contain" /> KAPPO TAKASHI</SelectItem>
                    <SelectItem value="capricci"><img src="/brands/capricci.png" alt="" className="h-5 w-8 object-contain" /> Capricci</SelectItem>
                    <SelectItem value="lawoi"><img src="/brands/lawoi.jpg" alt="" className="h-5 w-8 object-contain" /> LAWOI</SelectItem>
                    <SelectItem value="saryu"><img src="/brands/saryu.jpg" alt="" className="h-5 w-8 object-contain" /> SUSHI SARYU</SelectItem>
                    <SelectItem value="maison"><img src="/brands/maison.png" alt="" className="h-5 w-8 object-contain" /> Maison Dunand</SelectItem>
                  </SelectContent>
                </Select>
                <HeaderDatePicker period={period} onChange={setPeriod} latest={brandKey==='kappo'?makePeriod(kappoFoodstoryReports.at(-1)?.date??'2026-10-18','day'):brandKey==='saryu'?makePeriod(saryuReports.at(-1)?.date??'2026-09-01','day'):brandKey==='maison'?makePeriod(maisonReports.at(-1)?.date??'2026-09-01','day'):{start:dataset.filter(r=>r.brandId===brandKey).map(r=>r.businessDate).sort().at(-1)??latestPeriod(brandKey).end,end:dataset.filter(r=>r.brandId===brandKey).map(r=>r.businessDate).sort().at(-1)??latestPeriod(brandKey).end,mode:'day'}} daysWithData={daysWithData} />
                <Button variant="outline" size="icon" aria-label="รีเฟรชข้อมูล" title="โหลดหน้าและข้อมูลที่แนบใหม่ · คงร้านและ Period · ไม่ดึงข้อมูล POS" onClick={handleRefresh} disabled={!ready || refreshing} aria-busy={refreshing} className="size-10 border-stone-200 bg-white shadow-sm">
                  <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" aria-label="การแจ้งเตือน" className="relative size-10 border-stone-200 bg-white shadow-sm">
                  <Bell className="size-4" />
                  <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
                </Button>
                <div className="hidden items-center gap-3 border-l border-stone-200 pl-4 xl:flex">
                  <div className="text-right">
                    <p className="text-xs font-bold text-stone-800">Administrator</p>
                    <p className="text-[10px] text-stone-400">Full access</p>
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#173c30] text-xs font-bold text-white">AD</div>
                </div>
              </div>
            </div>
          </header>

          <div className="dashboard-grid px-6 py-6 lg:px-8">
            <div className="mx-auto max-w-[1540px] space-y-6">
              {refreshError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{refreshError}</p>}
              {page === 'sale' && !foodstoryBrand && <ReportDetailsPage key={`sale-${brandKey}`} view="sale" brandKey={brandKey} period={period} dataset={dataset} />}
              {page === 'sale' && !foodstoryBrand && <ReportCenter key={`reports-${brandKey}`} brandKey={brandKey} period={period} code={reportCode} onCodeChange={setReportCode} dataset={dataset} />}
              {page === 'master-data' && <MasterDataNavigation brand={brandKey} onBrandChange={setBrandKey} />}
              <div hidden={page !== 'master-data' || brandKey !== 'lawoi'}><LawoiMasterData master={lawoiMaster} batches={batches} period={period} onApply={setLawoiMaster} onDirty={setLawoiDirty}/></div>
              {page === 'master-data' && !foodstoryBrand && <ReportDetailsPage key={`reconciliation-${brandKey}`} view="reconciliation" brandKey={brandKey} period={period} dataset={dataset} />}
              <div hidden={page !== 'master-data' || brandKey !== 'capricci'}>
                <CapricciMasterData connection={masterConnection} period={period} batches={batches} onDirty={setMasterDirty} onDashboard={() => setPage('dashboard')} />
              </div>
              {page === 'user-guide' && <UserGuide brand={brandKey} onBrandChange={setBrandKey} onDashboard={() => setPage('dashboard')} onImport={openImport} monthlyPeriod={monthlyPeriod} selectedPeriod={period} monthlyDaysWithData={activeMonthly.daysWithData} monthlySelectedDays={activeMonthly.selectedDays} daysWithData={daysWithData} selectedDays={selectedDays} financeSummary={monthlyFinanceSummary} masterChanged={masterChangeCount(masterConnection.record.master) > 0} imported={batches.some(b => b.destination.brand === 'capricci' && b.destination.date >= monthlyPeriod.start && b.destination.date <= monthlyPeriod.end)} />}
              <div hidden={page !== 'dashboard'} className="space-y-6">
              <section className="flex items-end justify-between gap-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-28 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
                    <img src={data.logo} alt={`${data.name} logo`} className="h-full w-full object-contain" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#17211b]">{data.name}</h2>
                    <p className="mt-0.5 text-xs text-stone-500">Sales overview · {periodLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`border-0 px-3 py-1.5 font-semibold ${statusTone}`}>{overviewStatus}</Badge>
                  <span className="hidden text-xs text-stone-400 md:inline">Source snapshot · ไม่ใช่ข้อมูลสด</span>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500" role="status">
                <span>{refreshing ? 'กำลังโหลดหน้าใหม่…' : loadedAt ? `โหลดหน้าเมื่อ ${loadedAt} (เวลาไทย)` : 'กำลังเตรียมหน้า…'}</span>
                <span>Refresh โหลดข้อมูลที่แนบกับหน้าใหม่ · ไม่ดึงไฟล์ใหม่จาก POS</span>
              </div>

              <section className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
                <SalesCard
                  tone="monthly"
                  basis={foodstoryBrand?'Item net sales':'Gross sales'}
                  period={monthlyLabel}
                  value={activeMonthly.data.monthlySales}
                  discount={activeMonthly.data.monthlyDiscount}
                  categories={activeMonthly.data.monthlyCategories}
                  guest={activeMonthlySalesGuests}
                  date={monthlyLabel}
                  note={`ยอดสะสมจากรายงาน ${activeMonthly.daysWithData} / ${activeMonthly.selectedDays} วันในเดือนนี้ · นำเข้าวันเดิมแทนชุดเดิม ไม่บวกซ้ำ`}
                />
                <SalesCard
                  tone="daily"
                  basis={foodstoryBrand?'Item net sales':'Gross sales'}
                  period={periodLabel}
                  value={data.monthlySales}
                  discount={data.monthlyDiscount}
                  categories={data.monthlyCategories}
                  guest={activeSelectedSalesGuests}
                  date={periodLabel}
                  note={`รวมยอดตามวันที่เลือก · มีรายงาน ${daysWithData} / ${selectedDays} วัน · ไม่เติมวันที่ขาด`}
                />
              </section>

              <section className="grid grid-cols-[1.55fr_0.85fr] gap-6 max-lg:grid-cols-1">
                <Card className="border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80">
                  <CardHeader className="flex-row items-center justify-between px-5">
                    <div>
                      <CardTitle className="text-sm font-bold">Total Sale by Daily</CardTitle>
                      <p className="mt-1 text-xs text-stone-400">{foodstoryBrand?'Item net sales จาก FoodStory + Master':brandKey === 'capricci' ? 'Gross sales S104 + Category (Finance)' : 'Gross sales S117'} · เฉพาะวันใน Period · ไม่เติมวันที่ขาด</p>
                    </div>
                    <span className="rounded-md bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-orange-700">{data.month}</span>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    {data.dailyTrend.length ? (
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <LineChart data={data.dailyTrend} margin={{ top: 12, right: 10, left: 2, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#ecefe9" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
                        <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value) => `${value / 1000}k`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={3} dot={{ r: 4, fill: '#4475c4', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ChartContainer>
                    ) : <NoData />}

                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80">
                  <CardHeader className="flex-row items-center justify-between px-5">
                    <div>
                      <CardTitle className="text-sm font-bold">Total Sale by Month</CardTitle>
                      <p className="mt-1 text-xs text-stone-400">เฉพาะวันที่ใน Period · อาจต่างจาก Sale (Monthly) ที่รวมทั้งเดือน</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-700">THB</Badge>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    {data.monthTrend.length ? (
                    <ChartContainer config={chartConfig} className="h-[260px] w-full">
                      <BarChart data={data.monthTrend} margin={{ top: 20, right: 16, left: 4, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#ecefe9" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(value) => `${value / 1000}k`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="sales" fill="#6ca743" radius={[7, 7, 0, 0]} maxBarSize={90} />
                      </BarChart>
                    </ChartContainer>
                    ) : <NoData />}

                  </CardContent>
                </Card>
              </section>

              <CustomerTrafficAnalysis brand={brandKey} analytics={trafficAnalytics}/>

              <section aria-label="Guest indicators" className="grid grid-cols-[1.1fr_0.9fr] gap-6 pb-6 max-lg:grid-cols-1">
                <GuestMonthly summary={activeMonthlyGuests} source={foodstoryBrand?'FoodStory':'S117'} />
                <Card className="border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80">
                  <CardHeader className="flex-row items-center justify-between border-b border-stone-100 px-5 pb-4">
                    <div>
                      <CardTitle className="text-sm font-bold">Guest · Daily</CardTitle>
                      <p className="mt-1 text-xs text-stone-400">Operational indicators · {data.date}</p>
                    </div>
                    <span className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-700">{foodstoryBrand?'FoodStory':'S117'}</span>
                  </CardHeader>
                  <CardContent className="px-5">
                    {data.guest ? (
                      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                        {[
                          ['Guests', money(data.guest.guests), 'Person'],
                          ['Bills', money(data.guest.bills), 'Bills'],
                          ['Total / Person', money(data.guest.totalPerPerson), 'Baht / Person'],
                        ].map(([label, value, unit]) => (
                          <div key={label} className="relative overflow-hidden rounded-xl bg-[#eef6f2] p-4">
                            <span className="absolute -right-3 -top-3 size-12 rounded-full bg-[#39755a]/8" />
                            <p className="text-[11px] font-semibold text-stone-500">{label}</p>
                            <p className="mt-3 text-xl font-bold tabular-nums text-[#245b43]">{value}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-stone-400">{unit}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <NoData />
                    )}
                    <p className="mt-4 text-[11px] leading-relaxed text-stone-500">{foodstoryBrand?`Guests / Bills จาก FoodStory ของวันสิ้นสุดช่วง · Total / Person = ยอดก่อนลด ÷ Guests ตาม Logic FoodStory${brandKey==='maison'?' / Template Guest Alpea':brandKey==='saryu'?' / Template Guest kinn1':''} · Bills ไม่ใช่จำนวนโต๊ะ`:'Guests, Bills และ Total / Person ตาม S117 ของวันสิ้นสุดช่วง · Bills ไม่ใช่จำนวนโต๊ะ · Total / Person ใช้ยอด Total Sale หลัง Discount รวม Service Charge / Tax ไม่ใช่ Gross sales ÷ Guests'}</p>
                  </CardContent>
                </Card>
              </section>

              <section aria-label="Entertain">
                <Card className="border-0 shadow-[0_12px_35px_rgb(27_39_31/6%)] ring-1 ring-stone-200/80">
                  <CardHeader className="flex-row items-center justify-between border-b border-stone-100 px-5 pb-4">
                    <div>
                      <CardTitle className="text-sm font-bold">Entertain</CardTitle>
                      <p className="mt-1 text-xs text-stone-400">ยอด Entertain ตามรายงาน ไม่รวมใน Sales / Sale by Category</p>
                    </div>
                    <Badge variant="outline" className="border-amber-200 text-amber-700">{foodstoryBrand?'FoodStory':'S117'}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5">
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-stone-600">Period · {periodLabel}</p><p className="mt-3 text-xl font-bold tabular-nums text-amber-800">{money(data.monthlyEntertain)}</p><p className="mt-1 text-[10px] text-stone-500">บาท · เฉพาะวันที่มีรายงาน</p></div>
                      <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-stone-600">Daily · {data.date}</p><p className="mt-3 text-xl font-bold tabular-nums text-amber-800">{money(data.dailyEntertain)}</p><p className="mt-1 text-[10px] text-stone-500">บาท · วันสิ้นสุดช่วง</p></div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-stone-500">{brandKey==='kappo'||brandKey==='saryu'?'รายงาน FoodStory ชุดนี้ไม่มี Entertain แยก จึงแสดง NO DATA ไม่เดาจากส่วนลดหรือชื่อเมนู':brandKey==='maison'?'ใช้ยอดสินค้าหลังส่วนลดของบิลที่ Payment = Entertain และแยกออกจาก Sales / Sale by Category โดยไม่รวม Service Charge หรือ VAT':'ใช้บรรทัด Entertain ใน S117 ตามมูลค่าที่พิมพ์ ซึ่งอาจรวม Service Charge ตามรายงาน ไม่ใช่ฐาน Gross sales · ยอดขายด้านบนแยก Entertain แล้ว จึงไม่หักซ้ำ'}</p>
                  </CardContent>
                </Card>
              </section>

              </div>
              <KappoFoodstoryWorkspace active={brandKey==='kappo'} page={page} master={kappoFoodstoryMaster} dataset={kappoFoodstoryReports} imported={kappoFoodstoryImports} period={period} onApply={setKappoFoodstoryMaster} onImport={(master,reports)=>{setKappoFoodstoryMaster(master);setKappoFoodstoryImports(reports);}} onDirty={setKappoFoodstoryDirty} onQueue={setKappoFoodstoryQueue}/>
              <SaryuWorkspace active={brandKey==='saryu'} page={page} master={saryuMaster} dataset={saryuReports} imported={saryuImports} period={period} onApply={setSaryuMaster} onImport={(m,b)=>{setSaryuMaster(m);setSaryuImports(b);}} onDirty={setSaryuDirty} onQueue={setSaryuQueue}/>
              <MaisonWorkspace active={brandKey==='maison'} page={page} master={maisonMaster} dataset={maisonReports} imported={maisonImports} period={period} onApply={setMaisonMaster} onImport={(m,b)=>{setMaisonMaster(m);setMaisonImports(b);}} onDirty={setMaisonDirty} onQueue={setMaisonQueue}/>
              <div hidden={foodstoryBrand || page!=='master-data'}><SalesImportPanel batches={batches} master={masterConnection.record.master} kappoMaster={kappoMaster} lawoiMaster={lawoiMaster} masterDirty={masterDirty} onApply={applyImport} onQueueCount={setQueueCount}/></div>

              <footer className="flex items-center justify-between border-t border-stone-200 py-4 text-[11px] text-stone-400">
                <span>Finance Revenue · {foodstoryBrand?'FoodStory':'Easy Restaurant'}</span>
                <span className="flex items-center gap-1.5"><CircleHelp className="size-3.5" /> ข้อมูลต้นแบบ + Import {batches.length+kappoFoodstoryImports.length+saryuImports.length+maisonImports.length} ชุดรายวัน · Local backup</span>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
