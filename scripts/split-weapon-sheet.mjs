import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

// Cuts the all-phases sheet (phasesSheetPrompt in shared/weaponKit.ts) into the per-phase art:
// a 2×2 grid, left to right and top to bottom = +0, +10, +12, +15. Each cell is trimmed to its
// visible pixels, centred on a square with a small margin and saved as held-<stage>.png (1254) and
// icon-<stage>.png (512) in public/assets/weapons/<id>/. Then run `npm run verify:weapons`.
// npm run split:weapon-sheet -- --weapon=brick path/to/sheet.png [--only=12,15]
// Optional: BROWSER_EXECUTABLE=/path/to/chromium.
const weapon=process.argv.find(arg=>arg.startsWith('--weapon='))?.slice(9);
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',').map(Number);
const source=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
if(!weapon||!source){console.error('Uso: npm run split:weapon-sheet -- --weapon=<id> <prancha.png> [--only=0,10,12,15]');process.exit(1);}
const STAGES=[0,10,12,15],GRID=[2,2],SIZES={held:1254,icon:512};
const output=`public/assets/weapons/${weapon}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();
 const data=`data:image/png;base64,${(await readFile(source)).toString('base64')}`;
 const cells=await page.evaluate(async({data,GRID,SIZES})=>{
  const bitmap=await createImageBitmap(await (await fetch(data)).blob());
  const cw=Math.floor(bitmap.width/GRID[0]),ch=Math.floor(bitmap.height/GRID[1]),out=[];
  for(let row=0;row<GRID[1];row++)for(let col=0;col<GRID[0];col++){
   const cell=new OffscreenCanvas(cw,ch),c=cell.getContext('2d');c.drawImage(bitmap,col*cw,row*ch,cw,ch,0,0,cw,ch);
   const {data:px}=c.getImageData(0,0,cw,ch);let x0=cw,y0=ch,x1=-1,y1=-1,opaque=0;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const a=px[(y*cw+x)*4+3];if(a>250)opaque++;if(a>12){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
   if(x1<0){out.push({empty:true});continue;}
   const side=Math.max(x1-x0+1,y1-y0+1)/.9,files={};
   for(const [kind,size] of Object.entries(SIZES)){
    const canvas=new OffscreenCanvas(size,size),g=canvas.getContext('2d'),scale=size/side;
    g.imageSmoothingQuality='high';
    g.drawImage(cell,x0,y0,x1-x0+1,y1-y0+1,(size-(x1-x0+1)*scale)/2,(size-(y1-y0+1)*scale)/2,(x1-x0+1)*scale,(y1-y0+1)*scale);
    const blob=await canvas.convertToBlob({type:'image/png'});
    files[kind]=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});
   }
   out.push({files,opaqueShare:opaque/(cw*ch)});
  }
  return out;
 },{data,GRID,SIZES});
 for(const [index,stage] of STAGES.entries()){
  if(only&&!only.includes(stage))continue;
  const cell=cells[index];
  if(cell.empty){console.warn(`+${stage}: célula vazia, nada salvo`);continue;}
  if(cell.opaqueShare>.92)console.warn(`+${stage}: quase sem transparência, o fundo da prancha não é transparente?`);
  for(const kind of Object.keys(SIZES))await writeFile(`${output}/${kind}-${stage}.png`,Buffer.from(cell.files[kind],'base64'));
  console.log(`+${stage}: ${output}/held-${stage}.png e icon-${stage}.png`);
 }
}finally{await browser.close();}
