import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
// O mapa inteiro da Pescaria numa imagem (Vite rodando): npx tsx scripts/preview-fishing-map.mjs [pasta].
// Usa o layout do repositório (não o publicado no /admin) e o mesmo desenho do editor (drawWhole).
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-map';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();
await page.goto(`${base}/admin`);await page.waitForTimeout(1500);
const png=await page.evaluate(async()=>{
 const {FishingWorld}=await import('/src/game/fishingWorld.ts'),{FISHING_WIDTH:W,FISHING_HEIGHT:H}=await import('/shared/fishingMap.ts');
 const world=new FishingWorld();world.load();
 for(let n=0;n<200&&!world.ready(1);n++)await new Promise(r=>setTimeout(r,100));
 await new Promise(r=>setTimeout(r,800));
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
 world.drawWhole(c,0);await new Promise(r=>setTimeout(r,300));world.drawWhole(c,0);
 return canvas.toDataURL('image/png');
});
const {writeFile}=await import('node:fs/promises');await writeFile(`${dir}/mapa.png`,Buffer.from(png.split(',')[1],'base64'));
await browser.close();console.log(`${dir}/mapa.png`);
