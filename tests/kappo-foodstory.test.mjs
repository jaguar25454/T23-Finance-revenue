import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

const bundle=await build({entryPoints:['lib/kappo-foodstory.ts'],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':process.cwd()}});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const day={start:'2026-10-18',end:'2026-10-18',mode:'day'},master=api.originalKappoFoodstoryMaster,dataset=api.kappoFoodstoryDataset([]);

test('KAPPO FoodStory is a new independent 18/10/26 dataset',()=>{const summary=api.kappoFoodstorySummary(master,dataset,day),dinner=summary.detail.find(item=>item.code==='FOD-DIN000');assert.equal(dataset.length,1);assert.equal(summary.bills.length,1);assert.equal(summary.detail.length,7);assert.equal(summary.sales,25040);assert.equal(summary.service,2504);assert.equal(summary.tax,1928.08);assert.equal(summary.total,29472.08);assert.equal(summary.guests,4);assert.equal(summary.totalPerPerson,6260);assert.deepEqual({units:dinner.quantity,unitPrice:dinner.price,total:dinner.net},{units:4,unitPrice:4500,total:18000});});
test('Fruit Liqueurs is removed and its 250 baht is classified as Sake alcohol',()=>{const summary=api.kappoFoodstorySummary(master,dataset,day),categories=Object.fromEntries(summary.categories.map(item=>[item.name,item.value]));assert.equal(api.normalizeKappoFoodstoryCategory(' Fruit  Liqueurs '),'Sake');assert.equal(categories.Food,24100);assert.equal(categories['Beverage - Non-Alcohol'],690);assert.equal(categories['Beverage - Alcohol'],250);assert.equal(categories.Other,0);assert.equal(Object.values(categories).reduce((sum,value)=>sum+value,0),25040);assert.doesNotMatch(JSON.stringify(master),/Fruit Liqueurs/i);assert.equal(summary.detail.find(item=>item.name.startsWith('Komasa')).sourceCategory,'Sake');});
test('KAPPO FoodStory backup cannot be restored as another system',()=>{assert.throws(()=>api.restoreKappoFoodstoryBackup('{"format":"saryu-foodstory-local","version":1,"imports":[]}'));assert.equal(api.kappoFoodstoryDataset([api.originalKappoFoodstoryBatch,api.originalKappoFoodstoryBatch]).length,1);});
test('KAPPO Master Data shows period item metrics without Reconciliation',()=>{const ui=readFileSync('components/kappo-foodstory-workspace.tsx','utf8');assert.match(ui,/Unit Sold/);assert.match(ui,/Unit Price/);assert.match(ui,/Total Amount/);assert.match(ui,/summary\.detail/);assert.doesNotMatch(ui,/Reconciliation · KAPPO TAKASHI/);});

