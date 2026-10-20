import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
const temp = await fs.mkdtemp(path.join(tmpdir(), 'pdfolio-test-'));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = ''; server.stdout.on('data', d => serverOutput += d); server.stderr.on('data', d => serverOutput += d);
let browser;
try {
let ready = false;
for (let i = 0; i < 100; i++) {
  if (server.exitCode !== null) throw Error('Vite failed: ' + serverOutput);
  try { if ((await fetch('http://127.0.0.1:4174')).ok) { ready = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 100));
}
if (!ready) throw Error('Vite did not start: ' + serverOutput);
const fixture = await PDFDocument.create(); const font = await fixture.embedFont(StandardFonts.Helvetica);
for(let i=0;i<3;i++){const p=fixture.addPage([400,600]);p.drawText(`PDFolio test page ${i+1}`,{x:30,y:550,font,size:20});}
const input=await fixture.save(); await fs.writeFile(path.join(temp, 'sample.pdf'),input);
const systemChromium = process.env.CHROMIUM_PATH ?? (await fs.access('/usr/bin/chromium').then(() => '/usr/bin/chromium').catch(() => undefined));
browser=await chromium.launch({executablePath:systemChromium,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4174');
const results=await page.evaluate(async (input)=>{
 const {processPDF}=await import('/src/processor.ts');const f=new File([new Uint8Array(input)],'sample.pdf',{type:'application/pdf'});
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='#356346';ctx.fillRect(0,0,400,200);const png=await new Promise(r=>canvas.toBlob(r,'image/png'));const img=new File([png],'image.png',{type:'image/png'});
 const tasks=[['merge',[f,f],{},6],['split',[f],{pages:'1,3'},0],['compress',[f],{},3],['rotate',[f],{angle:'90'},3],['extract',[f],{pages:'1,3'},2],['remove',[f],{pages:'2'},2],['organize',[f],{pages:'3,1,2'},3],['numbers',[f],{},3],['watermark',[f],{text:'DRAFT'},3],['edit',[f],{text:'REVIEWED'},3],['crop',[f],{margin:'20'},3],['forms',[f],{},3],['sign',[f],{signature:canvas.toDataURL('image/png')},3],['jpg-pdf',[img],{},1],['scan',[img],{},1],['pdf-jpg',[f],{},0],['markdown',[f],{},0],['compare',[f,f],{},0]];
 const results=[];for(const [id,files,opt,count]of tasks){try{const o=await processPDF(id,files,{pages:'',angle:'90',text:'',margin:'24',...opt});results.push({id,count,name:o.name,mime:o.mime,data:typeof o.data==='string'?o.data:Array.from(o.data)});}catch(e){results.push({id,error:e.message});}}
 try{await processPDF('remove',[f],{pages:'1-3'});results.push({id:'invalid-remove',error:'Did not reject all-page removal'});}catch(e){results.push({id:'invalid-remove',rejected:true});}
 try{await processPDF('extract',[f],{pages:'9'});results.push({id:'invalid-range',error:'Did not reject out of range'});}catch(e){results.push({id:'invalid-range',rejected:true});}
 return results;
},Array.from(input));
for(const r of results){if(r.error)throw Error(r.id+': '+r.error);if(r.mime==='application/pdf'){const pdf=await PDFDocument.load(new Uint8Array(r.data));if(pdf.getPageCount()!==r.count)throw Error(r.id+' page count mismatch');if(r.id==='rotate'&&pdf.getPage(0).getRotation().angle!==90)throw Error('rotation wrong');if(r.id==='crop'&&pdf.getPage(0).getCropBox().width!==360)throw Error('crop wrong');if(r.id==='forms'&&pdf.getForm().getFields().length!==1)throw Error('missing field');}if(r.id==='markdown'&&!r.data.includes('PDFolio test page 1'))throw Error('text extraction failed');if(r.id==='compare'&&!r.data.includes('文字相同'))throw Error('comparison failed');if(r.mime==='application/zip'){const zip=await JSZip.loadAsync(new Uint8Array(r.data));const expected=r.id==='split'?2:3;if(Object.keys(zip.files).length!==expected)throw Error('zip contents mismatch');}console.log('PASS',r.id);}
await page.locator('.tool-card').first().locator('.card-main').click();await page.locator('input[type=file]').last().setInputFiles([path.join(temp, 'sample.pdf'),path.join(temp, 'sample.pdf')]);
await page.getByRole('button',{name:'開始處理'}).click();await page.getByText('完成了，又一件事搞定。').waitFor();const dlPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下載檔案'}).click();const dl=await dlPromise;const dlPath=await dl.path();const out=await PDFDocument.load(await fs.readFile(dlPath));if(out.getPageCount()!==6)throw Error('UI merge failed');console.log('PASS UI merge download');
await page.getByRole('button',{name:'關閉',exact:true}).click();
const chooserPromise=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'選擇檔案開始'}).click(); const chooser=await chooserPromise;await chooser.setFiles([path.join(temp, 'sample.pdf')]);await page.locator('.quick-tools').getByRole('button',{name:'合併 PDF'}).click();await page.waitForTimeout(100);if(await page.locator('.file-row').count()!==1)throw Error('initial files duplicated');console.log('PASS staged upload');await page.getByRole('button',{name:'關閉',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
console.log('PASS mobile layout');
if(errors.length)throw Error('Browser errors: '+errors.join('; '));
console.log('All 23 functional checks passed.');
} finally { await browser?.close(); server.kill('SIGTERM'); await fs.rm(temp, { recursive: true, force: true }); }
