import { capricciFinance, type Period, type ReportSnapshot } from './report-data';
import { financeForImportedReport, type ImportedBatch } from './sales-import';
import { reportDataset } from './runtime-reports';
import { calculateLawoiCategories, type LawoiMaster } from './lawoi-master';

export function lawoiSummaryFor(master:LawoiMaster,report:ReportSnapshot){
  if(report.brandId!=='lawoi')throw new Error('LAWOI Master ใช้ได้เฉพาะรายงาน LAWOI');
  return calculateLawoiCategories(master,financeForImportedReport(report));
}
export function lawoiPeriodSummary(master:LawoiMaster,batches:ImportedBatch[],period:Period){
  const summaries=reportDataset(batches).filter(report=>report.brandId==='lawoi'&&report.businessDate>=period.start&&report.businessDate<=period.end).map(report=>lawoiSummaryFor(master,report));
  const empty=calculateLawoiCategories(master,{...capricciFinance,rows:[]});
  return summaries.reduce((current,next)=>{const categories=new Map(current.categories.map(row=>[row.name,row.value]));for(const row of next.categories)categories.set(row.name,(categories.get(row.name)??0)+row.value);return {...current,categories:[...categories].map(([name,value])=>({name,value})),subgroups:current.subgroups.map((group,index)=>({...group,value:group.value+next.subgroups[index].value})),detail:[...current.detail,...next.detail],sales:current.sales+next.sales,extendedPrice:current.extendedPrice+next.extendedPrice,adjustment:current.adjustment+next.adjustment,includedRows:current.includedRows+next.includedRows,serviceCharge:current.serviceCharge+next.serviceCharge,excludedCustomerTotal:current.excludedCustomerTotal+next.excludedCustomerTotal,unmapped:[...current.unmapped,...next.unmapped]};},empty);
}
