import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

// Cuts the all-phases sheet (phasesSheetPrompt in shared/weaponKit.ts) into the per-phase art:
// a 2×2 grid, left to right and top to bottom = +0, +10, +12, +15. Each alpha island goes to the cell
// holding its centre (objects may spill over the grid); each cell is trimmed to its pixels, centred
// on a square with a small margin and saved as held-<stage>.png (1254) and icon-<stage>.png (512) in public/assets/weapons/<id>/. Then run `npm run verify:weapons`.
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
  const bitmap=await createImageBitmap(await (await fetch(data)).blob()),W=bitmap.width,H=bitmap.height;
  const full=new OffscreenCanvas(W,H),fc=full.getContext('2d');fc.drawImage(bitmap,0,0);
  const image=fc.getImageData(0,0,W,H),px=image.data;
  // Objects often spill over the grid lines, so each alpha island goes to the cell holding its centre.
  const label=new Int32Array(W*H).fill(-1),stack=new Int32Array(W*H),cw=W/GRID[0],ch=H/GRID[1];
  const cells=Array.from({length:GRID[0]*GRID[1]},()=>({islands:[],x0:W,y0:H,x1:-1,y1:-1,opaque:0}));
  const islands=[];
  for(let start=0;start<W*H;start++){
   if(label[start]>=0||px[start*4+3]<=12)continue;
   const id=islands.length,isle={x0:W,y0:H,x1:-1,y1:-1,sx:0,sy:0,n:0,opaque:0};let top=0;stack[top++]=start;label[start]=id;
   while(top){const i=stack[--top],x=i%W,y=(i-x)/W;isle.n++;isle.sx+=x;isle.sy+=y;if(px[i*4+3]>250)isle.opaque++;
    if(x<isle.x0)isle.x0=x;if(x>isle.x1)isle.x1=x;if(y<isle.y0)isle.y0=y;if(y>isle.y1)isle.y1=y;
    for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1])if(j>=0&&label[j]<0&&px[j*4+3]>12){label[j]=id;stack[top++]=j;}}
   islands.push(isle);
  }
  // Specks smaller than 0.05% of the image are noise; they are left out of every cell.
  islands.forEach((isle,id)=>{if(isle.n<W*H*.0005)return;const cell=cells[Math.min(GRID[1]-1,Math.floor(isle.sy/isle.n/ch))*GRID[0]+Math.min(GRID[0]-1,Math.floor(isle.sx/isle.n/cw))];
   cell.islands.push(id);cell.opaque+=isle.opaque;cell.x0=Math.min(cell.x0,isle.x0);cell.y0=Math.min(cell.y0,isle.y0);cell.x1=Math.max(cell.x1,isle.x1);cell.y1=Math.max(cell.y1,isle.y1);});
  const out=[];
  for(const info of cells){
   if(info.x1<0){out.push({empty:true});continue;}
   const {x0,y0,x1,y1}=info,w=x1-x0+1,h=y1-y0+1,mine=new Set(info.islands);
   const crop=new ImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y0+y)*W+x0+x;if(mine.has(label[i]))for(let k=0;k<4;k++)crop.data[(y*w+x)*4+k]=px[i*4+k];}
   const cell=new OffscreenCanvas(w,h);cell.getContext('2d').putImageData(crop,0,0);
   const side=Math.max(w,h)/.9,files={};
   for(const [kind,size] of Object.entries(SIZES)){
    const canvas=new OffscreenCanvas(size,size),g=canvas.getContext('2d'),scale=size/side;
    g.imageSmoothingQuality='high';
    g.drawImage(cell,0,0,w,h,(size-w*scale)/2,(size-h*scale)/2,w*scale,h*scale);
    const blob=await canvas.convertToBlob({type:'image/png'});
    files[kind]=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});
   }
   out.push({files,opaqueShare:info.opaque/(cw*ch)});
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
