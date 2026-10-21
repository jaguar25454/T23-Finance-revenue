import { capricciFinance, reportsByBrand, type Period, type ReportSnapshot } from './report-data';
import { calculateMasterCategories, type CapricciMaster } from './capricci-master';
import { financeForImportedReport, type ImportedBatch } from './sales-import';

export function reportDataset(batches:ImportedBatch[]) {
  const reports=Object.values(reportsByBrand).filter((r):r is ReportSnapshot=>!!r);
  for(const batch of batches) {
    const index=reports.findIndex(r=>r.brandId===batch.destination.brand && r.businessDate===batch.destination.date);
    if(index>=0) reports[index]=batch.report; else reports.push(batch.report);
  }
  return reports;
}
export function financeSummaryFor(master:CapricciMaster, report:ReportSnapshot, batches:ImportedBatch[]) {
  const imported=batches.some(b=>b.report===report);
  const summary=calculateMasterCategories(master,imported?financeForImportedReport(report):capricciFinance);
  if(summary.unmapped.length) {
    const value=summary.unmapped.reduce((n,r)=>n+r.value,0);
    return {...summary,categories:[...summary.categories,{name:'ยังไม่จัดหมวด',value}],sales:summary.sales+value,extendedPrice:summary.extendedPrice+summary.unmapped.reduce((n,r)=>n+r.extendedPrice,0),adjustment:summary.adjustment+summary.unmapped.reduce((n,r)=>n+r.adjustment,0)};
  }
  return summary;
}
export function periodFinanceSummary(master:CapricciMaster, batches:ImportedBatch[], period:Period) {
  const summaries=reportDataset(batches).filter(r=>r.brandId==='capricci' && r.businessDate>=period.start && r.businessDate<=period.end).map(r=>financeSummaryFor(master,r,batches));
  const empty=calculateMasterCategories(master,{...capricciFinance,rows:[]});
  return summaries.reduce((a,b)=>{
    const categories=new Map(a.categories.map(c=>[c.name,c.value])); for(const c of b.categories) categories.set(c.name,(categories.get(c.name)??0)+c.value);
    return {...a,categories:[...categories].map(([name,value])=>({name,value})),subgroups:a.subgroups.map((g,i)=>({...g,value:g.value+b.subgroups[i].value})),detail:[...a.detail,...b.detail],sales:a.sales+b.sales,extendedPrice:a.extendedPrice+b.extendedPrice,adjustment:a.adjustment+b.adjustment,includedRows:a.includedRows+b.includedRows,serviceCharge:a.serviceCharge+b.serviceCharge,excludedCustomerTotal:a.excludedCustomerTotal+b.excludedCustomerTotal,unmapped:[...a.unmapped,...b.unmapped]};
  },empty);
}
