import { capricciFinance, type Period, type ReportSnapshot } from './report-data';
import { financeForImportedReport, type ImportedBatch } from './sales-import';
import { reportDataset } from './runtime-reports';
import { calculateKappoCategories, type KappoMaster } from './kappo-master';

export function kappoSummaryFor(master:KappoMaster,report:ReportSnapshot){
  if(report.brandId!=='kappo')throw new Error('KAPPO Master ใช้ได้เฉพาะรายงาน KAPPO');
  return calculateKappoCategories(master,financeForImportedReport(report));
}
export function kappoPeriodSummary(master:KappoMaster,batches:ImportedBatch[],period:Period){
  const summaries=reportDataset(batches).filter(r=>r.brandId==='kappo'&&r.businessDate>=period.start&&r.businessDate<=period.end).map(r=>kappoSummaryFor(master,r));
  const empty=calculateKappoCategories(master,{...capricciFinance,rows:[]});
  return summaries.reduce((a,b)=>{
    const categories=new Map(a.categories.map(c=>[c.name,c.value]));for(const c of b.categories)categories.set(c.name,(categories.get(c.name)??0)+c.value);
    return {...a,categories:[...categories].map(([name,value])=>({name,value})),subgroups:a.subgroups.map((g,i)=>({...g,value:g.value+b.subgroups[i].value})),detail:[...a.detail,...b.detail],sales:a.sales+b.sales,extendedPrice:a.extendedPrice+b.extendedPrice,adjustment:a.adjustment+b.adjustment,includedRows:a.includedRows+b.includedRows,serviceCharge:a.serviceCharge+b.serviceCharge,excludedCustomerTotal:a.excludedCustomerTotal+b.excludedCustomerTotal,unmapped:[...a.unmapped,...b.unmapped]};
  },empty);
}
