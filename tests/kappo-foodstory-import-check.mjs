import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const folder=process.argv[2];if(!folder)throw new Error('Pass the KAPPO FOOD STORY REPORTS directory');
const bundle=await build({entryPoints:['lib/kappo-foodstory.ts'],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':process.cwd()}}),api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const names=['รายงานยอดขายแยกตามรายละเอียดบิล.csv','รายงานสรุปยอดขายแยกตามบิล.csv'],files=names.map(name=>({name,text:fs.readFileSync(path.join(folder,name),'utf8')})),batch=api.verifyKappoFoodstory(files,'2026-10-18'),master=api.mergeKappoFoodstoryItems(api.originalKappoFoodstoryMaster,batch),summary=api.kappoFoodstorySummary(master,[batch],{start:'2026-10-18',end:'2026-10-18',mode:'day'}),categories=Object.fromEntries(summary.categories.map(item=>[item.name,item.value]));
assert.equal(batch.items.length,7);assert.equal(batch.bills.length,1);assert.equal(summary.sales,25040);assert.equal(summary.total,29472.08);assert.equal(summary.guests,4);assert.equal(categories['Beverage - Alcohol'],250);assert.equal(batch.items.find(item=>item.name.startsWith('Komasa')).sourceCategory,'Sake');assert.doesNotMatch(JSON.stringify(batch.items),/Fruit Liqueurs/i);
const wrong=files.map(file=>({...file,text:file.text.replaceAll('Kappo Takashi','Sushi Saryu')}));assert.throws(()=>api.verifyKappoFoodstory(wrong,'2026-10-18'),/KAPPO TAKASHI/);
console.log('PASS: KAPPO FoodStory actual reports verified; Fruit Liqueurs normalized to Sake; sales 25,040; total 29,472.08; 4 guests.');

