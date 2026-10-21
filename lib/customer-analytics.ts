import {formatBusinessDate,isBusinessDate,type BrandKey,type Period} from './report-data';

export type CustomerDay={brand:BrandKey;date:string;guests:number|null};
export type WeekdayCustomer={name:string;short:string;guests:number|null;reportDays:number};
export type CustomerCalendarDay={date:string;name:string;short:string;guests:number|null};
export type CustomerCalendarWeek={label:string;period:Period;days:CustomerCalendarDay[];guests:number|null;reportDays:number;topDates:string[];topGuests:number|null};
export type CustomerAnalytics={period:Period;weekdays:WeekdayCustomer[];topDays:string[];topGuests:number|null;weeks:CustomerCalendarWeek[];topWeeks:string[];topWeekGuests:number|null;topDates:string[];topDateGuests:number|null};

const brands:BrandKey[]=['capricci','kappo','lawoi','saryu','maison'];
const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const shorts=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const dayMs=86_400_000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const shift=(date:string,days:number)=>iso(time(date)+days*dayMs);

export function fourCalendarWeeks(end:string):Period[]{
  if(!isBusinessDate(end))return [];
  const weekday=new Date(time(end)).getUTCDay(),monday=shift(end,-((weekday+6)%7));
  return [0,1,2,3].map(index=>{const start=shift(monday,-7*index);return {start,end:index===0?end:shift(start,6),mode:'custom'};});
}

export function calendarMonthWeeks(anchor:string):Period[]{
  if(!isBusinessDate(anchor))return [];
  const monthStart=`${anchor.slice(0,7)}-01`,nextMonth=anchor.slice(5,7)==='12'?`${Number(anchor.slice(0,4))+1}-01-01`:`${anchor.slice(0,5)}${String(Number(anchor.slice(5,7))+1).padStart(2,'0')}-01`,monthEnd=shift(nextMonth,-1);
  const weeks:Period[]=[];
  let start=monthStart;
  while(start<=monthEnd){const weekday=new Date(time(start)).getUTCDay(),daysToSunday=6-((weekday+6)%7),end=shift(start,daysToSunday);weeks.push({start,end:end>monthEnd?monthEnd:end,mode:'custom'});start=shift(weeks.at(-1)!.end,1);}
  return weeks;
}

export function customerAnalytics(days:CustomerDay[],brand:BrandKey,end:string):CustomerAnalytics{
  const weeks=calendarMonthWeeks(end),period:Period=weeks.length?{start:weeks[0].start,end:weeks.at(-1)!.end,mode:'month'}:{start:end,end,mode:'month'};
  const unique=new Map<string,CustomerDay>();
  for(const row of days)if(isBusinessDate(row.date)&&brands.includes(row.brand))unique.set(`${row.brand}|${row.date}`,row);
  const rows=[...unique.values()].filter(row=>row.brand===brand&&row.date>=period.start&&row.date<=period.end);
  const weekdays:WeekdayCustomer[]=names.map((name,index)=>{const matching=rows.filter(row=>new Date(time(row.date)).getUTCDay()===index&&row.guests!==null);return {name,short:shorts[index],guests:matching.length?matching.reduce((sum,row)=>sum+row.guests!,0):null,reportDays:matching.length};});
  const observedWeekdays=weekdays.filter(day=>day.guests!==null),topGuests=observedWeekdays.length?Math.max(...observedWeekdays.map(day=>day.guests!)):null,topDays=topGuests===null?[]:observedWeekdays.filter(day=>day.guests===topGuests).map(day=>day.name);
  const calendarWeeks:CustomerCalendarWeek[]=weeks.map((week,index)=>{
    const calendarDays:CustomerCalendarDay[]=[];
    for(let date=week.start;date<=week.end;date=shift(date,1)){const row=unique.get(`${brand}|${date}`),weekday=new Date(time(date)).getUTCDay();calendarDays.push({date,name:names[weekday],short:shorts[weekday],guests:row?.guests??null});}
    const observed=calendarDays.filter(day=>day.guests!==null),weekGuests=observed.length?observed.reduce((sum,day)=>sum+day.guests!,0):null,weekTop=observed.length?Math.max(...observed.map(day=>day.guests!)):null;
    return {label:`Week ${index+1}`,period:week,days:calendarDays,guests:weekGuests,reportDays:observed.length,topGuests:weekTop,topDates:weekTop===null?[]:observed.filter(day=>day.guests===weekTop).map(day=>day.date)};
  });
  const observedWeeks=calendarWeeks.filter(week=>week.guests!==null),topWeekGuests=observedWeeks.length?Math.max(...observedWeeks.map(week=>week.guests!)):null,topWeeks=topWeekGuests===null?[]:observedWeeks.filter(week=>week.guests===topWeekGuests).map(week=>week.label);
  const observedDates=rows.filter(row=>row.guests!==null),topDateGuests=observedDates.length?Math.max(...observedDates.map(row=>row.guests!)):null,topDates=topDateGuests===null?[]:observedDates.filter(row=>row.guests===topDateGuests).map(row=>row.date).sort();
  return {period,weekdays,topDays,topGuests,weeks:calendarWeeks,topWeeks,topWeekGuests,topDates,topDateGuests};
}

export function customerWeekLabel(period:Period){return `${formatBusinessDate(period.start)} – ${formatBusinessDate(period.end)}`;}
