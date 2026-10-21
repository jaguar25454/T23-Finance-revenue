import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';

const root=path.resolve('.'),cache=new Map();
function load(name,parent=root){const file=path.resolve(name.startsWith('@/')?path.join(root,name.slice(2)):path.join(parent,name)),full=file.endsWith('.json')?file:file+'.ts';if(cache.has(full))return cache.get(full);if(full.endsWith('.json'))return JSON.parse(readFileSync(full,'utf8'));const exports={};cache.set(full,exports);const code=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,require:next=>load(next,path.dirname(full)),URLSearchParams,Date});return exports;}
const analytics=load('@/lib/customer-analytics');

test('calendar month tabs cover every real week and clip first and last weeks to the month',()=>{const weeks=analytics.calendarMonthWeeks('2026-09-01');assert.deepEqual(JSON.parse(JSON.stringify(weeks)),[
  {start:'2026-09-01',end:'2026-09-06',mode:'custom'},
  {start:'2026-09-07',end:'2026-09-13',mode:'custom'},
  {start:'2026-09-14',end:'2026-09-20',mode:'custom'},
  {start:'2026-09-21',end:'2026-09-27',mode:'custom'},
  {start:'2026-09-28',end:'2026-09-30',mode:'custom'},
]);});

test('weekday ranking totals the selected calendar month and keeps unreported weekdays as NO DATA',()=>{const result=analytics.customerAnalytics([
  {brand:'capricci',date:'2026-09-01',guests:41},{brand:'capricci',date:'2026-09-08',guests:10},{brand:'capricci',date:'2026-09-07',guests:8},{brand:'capricci',date:'2026-08-25',guests:99},
], 'capricci','2026-09-01');const monday=result.weekdays.find(day=>day.name==='Monday'),tuesday=result.weekdays.find(day=>day.name==='Tuesday'),wednesday=result.weekdays.find(day=>day.name==='Wednesday');assert.equal(monday.guests,8);assert.equal(tuesday.guests,51);assert.equal(tuesday.reportDays,2);assert.equal(wednesday.guests,null);assert.deepEqual(JSON.parse(JSON.stringify(result.topDays)),['Tuesday']);assert.equal(result.topGuests,51);});

test('summary and week tabs identify busiest week/date, isolate brands and distinguish zero from NO DATA',()=>{const result=analytics.customerAnalytics([
  {brand:'capricci',date:'2026-09-01',guests:40},{brand:'capricci',date:'2026-09-01',guests:41},{brand:'capricci',date:'2026-09-07',guests:10},{brand:'capricci',date:'2026-09-08',guests:20},{brand:'capricci',date:'2026-09-15',guests:0},{brand:'maison',date:'2026-09-01',guests:100},
], 'capricci','2026-09-01');assert.equal(result.weeks.length,5);assert.equal(result.weeks[0].guests,41);assert.equal(result.weeks[1].guests,30);assert.equal(result.weeks[2].guests,0);assert.equal(result.weeks[3].guests,null);assert.deepEqual(JSON.parse(JSON.stringify(result.topWeeks)),['Week 1']);assert.equal(result.topWeekGuests,41);assert.deepEqual(JSON.parse(JSON.stringify(result.topDates)),['2026-09-01']);assert.equal(result.topDateGuests,41);assert.deepEqual(JSON.parse(JSON.stringify(result.weeks[1].topDates)),['2026-09-08']);assert.equal(result.weeks[2].days.find(day=>day.date==='2026-09-15').guests,0);assert.equal(result.weeks[2].days.find(day=>day.date==='2026-09-14').guests,null);});

test('Dashboard mounts calendar-month Weekday Ranking after sales cards using every active POS source',()=>{const page=readFileSync('app/page.tsx','utf8'),ui=readFileSync('components/customer-traffic-analysis.tsx','utf8');assert.match(page,/customerAnalytics\(customerDays,brandKey,period\.end\)/);assert.match(page,/\.\.\.dataset\.filter\(report=>report\.brandId!==\s*'kappo'\)\.map/);assert.match(page,/\.\.\.kappoFoodstoryReports\.map/);assert.match(page,/\.\.\.saryuReports\.map/);assert.match(page,/\.\.\.maisonReports\.map/);assert.match(page,/<CustomerTrafficAnalysis brand=\{brandKey\} analytics=\{trafficAnalytics\}/);assert.match(ui,/>Weekday Ranking</);assert.match(ui,/defaultValue="summary"/);assert.match(ui,/analytics\.weeks\.map/);assert.match(ui,/Most Customers · Date/);assert.doesNotMatch(ui,/Weekday Traffic Ranking · 4 Weeks/);assert.match(ui,/วันที่ไม่มี Report แสดง NO DATA และไม่นับเป็น 0/);});
