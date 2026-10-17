import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

// Builds a painted map from Codex art (docs/maps-kit.md):
//  - cuts the terrain pieces out of a magenta sprite sheet,
//  - places them as the layout says (mirrored for the other team),
//  - writes the world terrain art, the backdrop, the preview and the collision traced from the pieces' alpha.
// Usage: npm run build:map -- --map=snow [--src=test-results/codex-maps/snow]
// Optional: BROWSER_EXECUTABLE=/path/to/chromium. Report in test-results/maps-kit/<map>/.
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const map=arg('map');if(!map)throw new Error('Use --map=<id>');
const layout=JSON.parse(await readFile(`scripts/map-layouts/${map}.json`,'utf8'));
const src=arg('src')??layout.source,report=`test-results/maps-kit/${map}`,assets=`public/assets/maps/${map}`;
await mkdir(report,{recursive:true});await mkdir(assets,{recursive:true});
const dataUrl=async file=>`data:image/png;base64,${(await readFile(join(src,file))).toString('base64')}`;

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let out;
try{
 const page=await browser.newPage();
 out=await page.evaluate(async({layout,background,sheet})=>{
  const W=1536,H=864,CELL=3,COLS=W/CELL,ROWS=H/CELL;
  const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const png=c=>c.toDataURL('image/png').split(',')[1];

  // 1. Magenta → transparent, with a soft edge and the pink spill removed.
  const sheetImage=await load(sheet),sc=canvas(sheetImage.width,sheetImage.height),s=sc.getContext('2d');s.drawImage(sheetImage,0,0);
  const px=s.getImageData(0,0,sc.width,sc.height),d=px.data;
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],key=Math.min(r,b)-g;
   if(key>150){d[i+3]=0;continue;}
   if(key>40){d[i+3]=Math.round(255*(150-key)/110);d[i]=Math.min(r,g+(r-Math.min(r,b))+40);d[i+2]=Math.min(b,g+(b-Math.min(r,b))+60);}}
  s.putImageData(px,0,0);

  // 2. Connected pieces, numbered top-to-bottom by row, then left-to-right.
  const step=4,gw=Math.ceil(sc.width/step),gh=Math.ceil(sc.height/step),grid=new Uint8Array(gw*gh),label=new Int32Array(gw*gh).fill(-1);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const i=((y*step)*sc.width+x*step)*4+3;grid[y*gw+x]=d[i]>128?1:0;}
  const boxes=[];
  for(let start=0;start<grid.length;start++){if(!grid[start]||label[start]>=0)continue;
   const box={x0:1e9,y0:1e9,x1:-1,y1:-1,area:0},stack=[start];label[start]=boxes.length;
   while(stack.length){const n=stack.pop(),x=n%gw,y=(n/gw)|0;box.area++;box.x0=Math.min(box.x0,x);box.y0=Math.min(box.y0,y);box.x1=Math.max(box.x1,x);box.y1=Math.max(box.y1,y);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,m=ny*gw+nx;if(nx>=0&&ny>=0&&nx<gw&&ny<gh&&grid[m]&&label[m]<0){label[m]=boxes.length;stack.push(m);}}}
   boxes.push(box);
  }
  const rowOf=b=>(b.y0+b.y1)/2<gh/2?0:1;
  const pieces=boxes.filter(b=>b.area>400).sort((a,b)=>rowOf(a)-rowOf(b)||a.x0-b.x0).map(b=>{
   const x=b.x0*step-step,y=b.y0*step-step,w=(b.x1-b.x0+3)*step,h=(b.y1-b.y0+3)*step,c=canvas(w,h);c.getContext('2d').drawImage(sc,x,y,w,h,0,0,w,h);
   return {canvas:c,x,y,w,h,touchesEdge:b.x0<=1||b.y0<=1||b.x1>=gw-2||b.y1>=gh-2};
  });
  const sheetReport=canvas(sc.width,sc.height),sr=sheetReport.getContext('2d');sr.fillStyle='#2b3350';sr.fillRect(0,0,sc.width,sc.height);sr.drawImage(sc,0,0);
  sr.font='bold 40px sans-serif';sr.lineWidth=3;pieces.forEach((p,n)=>{sr.strokeStyle=p.touchesEdge?'#ff4040':'#ffe680';sr.strokeRect(p.x,p.y,p.w,p.h);sr.fillStyle='#ffe680';sr.fillText(String(n),p.x+8,p.y+40);});

  // 3. Place pieces. Each item may be mirrored around the centre for the other team.
  const items=layout.items.flatMap(item=>layout.mirror&&item.mirror!==false?[item,{...item,id:`${item.id}-r`,x:W-item.x,flip:!item.flip}]:[item]);
  const world=canvas(W,H),wc=world.getContext('2d');wc.imageSmoothingQuality='high';
  const regions=[],warnings=[];
  for(const item of items){const piece=pieces[item.piece];if(!piece){warnings.push(`peça ${item.piece} não existe (${pieces.length} peças)`);continue;}
   if(piece.touchesEdge)warnings.push(`peça ${item.piece} encosta na borda da folha`);
   const scale=item.scale??1,w=piece.w*scale,h=piece.h*scale,left=item.x-w/2,top=item.top;
   const one=canvas(W,H),oc=one.getContext('2d');oc.imageSmoothingQuality='high';oc.save();oc.translate(item.x,top);if(item.flip)oc.scale(-1,1);oc.drawImage(piece.canvas,-w/2,0,w,h);oc.restore();
   wc.drawImage(one,0,0);
   const alpha=oc.getImageData(0,0,W,H).data,col=Math.max(0,Math.floor(left/CELL)),row=Math.max(0,Math.floor(top/CELL)),cols=Math.min(COLS,Math.ceil((left+w)/CELL))-col,rows=Math.min(ROWS,Math.ceil((top+h)/CELL))-row;
   const bits=new Uint8Array(Math.ceil(cols*rows/8));let solid=0;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let sum=0;for(let dy=0;dy<CELL;dy++)for(let dx=0;dx<CELL;dx++)sum+=alpha[(((row+y)*CELL+dy)*W+(col+x)*CELL+dx)*4+3];
    if(sum/(CELL*CELL)>=128){const n=y*cols+x;bits[n>>3]|=1<<(n&7);solid++;}}
   let binary='';for(const b of bits)binary+=String.fromCharCode(b);
   regions.push({id:item.id,material:item.material,destructible:item.destructible,solid,shape:{kind:'cells',col,row,cols,rows,bits:btoa(binary)}});
  }

  // 4. Backdrop, preview and the collision overlay used for review.
  const bg=await load(background),backdrop=canvas(bg.width,bg.height);backdrop.getContext('2d').drawImage(bg,0,0);
  const montage=canvas(W,H),mc=montage.getContext('2d'),scale=Math.max(W/bg.width,H/bg.height);
  mc.drawImage(bg,(W-bg.width*scale)/2,H-bg.height*scale,bg.width*scale,bg.height*scale);mc.fillStyle='rgba(7,13,24,.14)';mc.fillRect(0,0,W,H);mc.drawImage(world,0,0);
  const preview=canvas(768,432);preview.getContext('2d').imageSmoothingQuality='high';preview.getContext('2d').drawImage(montage,0,0,768,432);
  const collision=canvas(W,H),cc=collision.getContext('2d');cc.drawImage(montage,0,0);cc.fillStyle='rgba(0,0,0,.35)';cc.fillRect(0,0,W,H);
  for(const r of regions){const raw=atob(r.shape.bits);cc.fillStyle=r.destructible?'rgba(80,230,120,.55)':'rgba(170,170,190,.75)';
   for(let n=0;n<r.shape.cols*r.shape.rows;n++)if(raw.charCodeAt(n>>3)>>(n&7)&1)cc.fillRect((r.shape.col+n%r.shape.cols)*CELL,(r.shape.row+Math.floor(n/r.shape.cols))*CELL,CELL,CELL);}
  cc.strokeStyle='#ff3030';cc.lineWidth=3;cc.beginPath();cc.moveTo(0,H-2);cc.lineTo(W,H-2);cc.stroke();
  for(const team of layout.spawns)for(const x of team){cc.fillStyle='#ffe14a';cc.fillRect(x-2,0,4,H);}
  return {warnings,pieces:pieces.length,regions,world:png(world),backdrop:backdrop.toDataURL('image/webp',.9).split(',')[1],preview:png(preview),montage:png(montage),collision:png(collision),sheet:png(sheetReport)};
 },{layout,background:await dataUrl(layout.background),sheet:await dataUrl(layout.pieces)});
}finally{await browser.close();}

const file=(path,base64)=>writeFile(path,Buffer.from(base64,'base64'));
await file(`${assets}/terrain-world.png`,out.world);await file(`${assets}/background.webp`,out.backdrop);await file(`public/assets/maps/${map}-preview.png`,out.preview);
for(const name of ['montage','collision','sheet'])await file(`${report}/${name}.png`,out[name]);
const name=`${map.toUpperCase()}_REGIONS`,generated=`shared/generated/${map}Terrain.ts`;await mkdir(dirname(generated),{recursive:true});
await writeFile(generated,`// Generated by \`npm run build:map -- --map=${map}\` from the painted terrain pieces. Do not edit.\nimport type {MapRegion} from '../maps';\n\nexport const ${name}:readonly MapRegion[]=[\n${out.regions.map(({solid,...r})=>` ${JSON.stringify(r)}`).join(',\n')}\n];\n`);
console.log(`${out.pieces} peças na folha; ${out.regions.length} regiões (${out.regions.map(r=>`${r.id}:${r.solid}`).join(', ')})`);
for(const warning of out.warnings)console.warn(`AVISO: ${warning}`);
console.log(`Relatório: ${report}/{montage,collision,sheet}.png`);
