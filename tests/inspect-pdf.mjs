import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const task = getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),useSystemFonts:true,isEvalSupported:false});
const doc = await task.promise;
for (let p=Number(process.argv[4]||1);p<=Math.min(doc.numPages,Number(process.argv[3]||1));p++) {
 const page=await doc.getPage(p); const content=await page.getTextContent();
 console.log('PAGE',p,page.view);
 const items=content.items.filter(x=>x.str?.trim()).map(x=>({s:x.str,x:+x.transform[4].toFixed(1),y:+x.transform[5].toFixed(1),w:+x.width.toFixed(1)}));
 console.log(JSON.stringify(items));
}
await task.destroy();
