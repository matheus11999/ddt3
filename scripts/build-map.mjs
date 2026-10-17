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
 out=await page.evaluate(async({layout,background,sheets,mid})=>{
  const W=layout.width??1536,H=864,CELL=3,COLS=W/CELL,ROWS=H/CELL;
  const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const png=c=>c.toDataURL('image/png').split(',')[1];

  // 1. Magenta → transparent, with a soft edge and the pink spill removed.
  const unkey=image=>{const sc=canvas(image.width,image.height),s=sc.getContext('2d');s.drawImage(image,0,0);
   const px=s.getImageData(0,0,sc.width,sc.height),d=px.data;
   for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],key=Math.min(r,b)-g;
    if(key>150){d[i+3]=0;continue;}
    if(key>40){d[i+3]=Math.round(255*(150-key)/110);d[i]=Math.min(r,g+(r-Math.min(r,b))+40);d[i+2]=Math.min(b,g+(b-Math.min(r,b))+60);}}
   s.putImageData(px,0,0);return {sc,d};};

  // 2. Connected pieces, numbered top-to-bottom by row, then left-to-right.
  const cut=async source=>{const {sc,d}=unkey(await load(source));
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
  return {pieces,report:png(sheetReport)};};
  const sheetPieces={},sheetReports={};
  for(const [name,source] of Object.entries(sheets)){const result=await cut(source);sheetPieces[name]=result.pieces;sheetReports[name]=result.report;}
  const firstSheet=Object.keys(sheets)[0];

  // 3. Place pieces. Each item may be mirrored around the centre for the other team;
  // `mirrorAs` swaps the mirrored copy for another piece so the two sides are not identical.
  const items=layout.items.flatMap(item=>layout.mirror&&item.mirror!==false?[item,{...item,...item.mirrorAs,id:`${item.id}-r`,x:W-item.x,flip:!item.flip}]:[item]);
  const world=canvas(W,H),wc=world.getContext('2d');wc.imageSmoothingQuality='high';
  const ground=canvas(W,H),gc=ground.getContext('2d');
  const regions=[],warnings=[],placed=[];
  const opaque=(data,x,y)=>x>=0&&y>=0&&x<W&&y<H&&data[(y*W+x)*4+3]>128;
  for(const item of items){const sheet=item.sheet??firstSheet,list=sheetPieces[sheet]??[],piece=list[item.piece];if(!piece){warnings.push(`${sheet}: peça ${item.piece} não existe (${list.length} peças)`);continue;}
   if(piece.touchesEdge)warnings.push(`${sheet}: peça ${item.piece} encosta na borda da folha`);
   const scale=item.scale??1,w=piece.w*scale,h=piece.h*scale,left=item.x-w/2;
   const draw=(ctx,top)=>{ctx.save();ctx.translate(item.x,top);if(item.flip)ctx.scale(-1,1);ctx.drawImage(piece.canvas,-w/2,0,w,h);ctx.restore();};
   // Props marked `rest` drop onto the terrain already placed below `top` (sinking a few px into the snow), so nothing floats.
   let top=item.top;const ground0=gc.getImageData(0,0,W,H).data;
   const probe=canvas(W,H),pc=probe.getContext('2d');draw(pc,0);const shape=pc.getImageData(0,0,W,H).data;
   const feet=[];for(let x=Math.ceil(left+w*.2);x<left+w*.8;x+=3){let y=Math.floor(h);while(y>0&&!opaque(shape,x,y))y--;if(y>0)feet.push([x,y]);}
   const surface=([x,foot])=>{for(let y=Math.max(0,Math.floor(item.top+foot));y<H;y++)if(opaque(ground0,x,y))return y-foot;return Infinity;};
   if(item.rest){const tops=feet.map(surface).filter(Number.isFinite);if(tops.length)top=Math.min(...tops)+(item.sink??8);else warnings.push(`${item.id}: não achou chão abaixo para apoiar`);}
   if(item.rest||sheet==='objetos'){const touching=feet.filter(([x,foot])=>[0,3,6,9].some(d=>opaque(ground0,x,Math.floor(top+foot+d)))).length;
    if(touching<Math.max(1,feet.length*.15))warnings.push(`${item.id}: objeto flutuando (base sem chão embaixo)`);}
   if(item.solid===false){draw(wc,top);continue;}
   const one=canvas(W,H),oc=one.getContext('2d');oc.imageSmoothingQuality='high';draw(oc,top);
   wc.drawImage(one,0,0);gc.drawImage(one,0,0);placed.push({id:item.id,left,right:left+w,top,bottom:top+h,sheet});
   const alpha=oc.getImageData(0,0,W,H).data,col=Math.max(0,Math.floor(left/CELL)),row=Math.max(0,Math.floor(top/CELL)),cols=Math.min(COLS,Math.ceil((left+w)/CELL))-col,rows=Math.min(ROWS,Math.ceil((top+h)/CELL))-row;
   const bits=new Uint8Array(Math.ceil(cols*rows/8));let solid=0;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let sum=0;for(let dy=0;dy<CELL;dy++)for(let dx=0;dx<CELL;dx++)sum+=alpha[(((row+y)*CELL+dy)*W+(col+x)*CELL+dx)*4+3];
    if(sum/(CELL*CELL)>=128){const n=y*cols+x;bits[n>>3]|=1<<(n&7);solid++;}}
   let binary='';for(const b of bits)binary+=String.fromCharCode(b);
   regions.push({id:item.id,material:item.material,destructible:item.destructible,solid,shape:{kind:'cells',col,row,cols,rows,bits:btoa(binary)}});
  }

  // A big piece mostly covered from above by another piece is hidden under it (e.g. a gate under a bridge): it has no reason to be there.
  for(const a of placed)if(a.sheet!=='objetos'){const covered=placed.filter(b=>b!==a&&b.sheet!=='objetos'&&b.bottom<a.top-10).reduce((n,b)=>n+Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),0);
   if(covered>(a.right-a.left)*.5)warnings.push(`${a.id}: peça escondida embaixo de outra (${Math.round(100*covered/(a.right-a.left))}% coberta por cima); só faz sentido se tiver motivo`);}

  // 4. Backdrop, preview and the collision overlay used for review.
  // The backdrop is ONE image. Panels painted as left/right halves are joined with a soft crossfade
  // (the prompts keep the seam strip to sky and fog); the seam report measures how well they match.
  const panels=await Promise.all(background.map(load)),blend=layout.backgroundBlend??240,ph=panels[0].height;
  const widths=panels.map(p=>p.width*ph/p.height),backdrop=canvas(Math.round(widths.reduce((a,b)=>a+b,0)-blend*(panels.length-1)),ph),bc=backdrop.getContext('2d');
  const seams=[];let at=0;
  panels.forEach((p,n)=>{const w=widths[n];
   if(n){const piece=canvas(Math.ceil(w),ph),c=piece.getContext('2d');c.drawImage(p,0,0,w,ph);c.globalCompositeOperation='destination-in';
    const fade=c.createLinearGradient(0,0,blend,0);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'#000');c.fillStyle=fade;c.fillRect(0,0,w,ph);
    const before=bc.getImageData(Math.round(at),0,8,ph).data,probe=canvas(8,ph),pr=probe.getContext('2d');pr.drawImage(p,0,0,8*p.height/ph,p.height,0,0,8,ph);const after=pr.getImageData(0,0,8,ph).data;
    let diff=0;for(let i=0;i<before.length;i+=4)diff+=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);
    seams.push(diff/(before.length/4)/3);bc.drawImage(piece,at,0);}
   else bc.drawImage(p,0,0,w,ph);
   at+=w-blend;});
  seams.forEach((d,n)=>{if(d>28)warnings.push(`fundo: emenda ${n+1} com diferença média de cor ${d.toFixed(0)} (acima de 28 aparece); gere a metade de novo`);});
  const bg=backdrop;
  const montage=canvas(W,H),mc=montage.getContext('2d'),scale=Math.max(W/bg.width,H/bg.height);
  if(bg.width*H/bg.height<W*.7)warnings.push('fundo: imagem estreita para a largura do mapa; no jogo ela só desliza pouco, mas o mapa inteiro vai cortar o céu. Use um panorama (duas metades)');
  mc.drawImage(bg,(W-bg.width*scale)/2,H-bg.height*scale,bg.width*scale,bg.height*scale);mc.fillStyle='rgba(7,13,24,.14)';mc.fillRect(0,0,W,H);mc.drawImage(world,0,0);
  // The preview shows the whole world (minimap backdrop); the loading screen crops its centre.
  const preview=canvas(768,Math.round(432*1536/W));preview.getContext('2d').imageSmoothingQuality='high';preview.getContext('2d').drawImage(montage,0,0,preview.width,preview.height);
  const collision=canvas(W,H),cc=collision.getContext('2d');cc.drawImage(montage,0,0);cc.fillStyle='rgba(0,0,0,.35)';cc.fillRect(0,0,W,H);
  for(const r of regions){const raw=atob(r.shape.bits);cc.fillStyle=r.destructible?'rgba(80,230,120,.55)':'rgba(170,170,190,.75)';
   for(let n=0;n<r.shape.cols*r.shape.rows;n++)if(raw.charCodeAt(n>>3)>>(n&7)&1)cc.fillRect((r.shape.col+n%r.shape.cols)*CELL,(r.shape.row+Math.floor(n/r.shape.cols))*CELL,CELL,CELL);}
  cc.strokeStyle='#ff3030';cc.lineWidth=3;cc.beginPath();cc.moveTo(0,H-2);cc.lineTo(W,H-2);cc.stroke();
  for(const team of layout.spawns)for(const x of team){cc.fillStyle='#ffe14a';cc.fillRect(x-2,0,4,H);}
  const midLayer=mid?unkey(await load(mid)).sc.toDataURL('image/webp',.9).split(',')[1]:null;
  const sizes=Object.fromEntries(Object.entries(sheetPieces).map(([name,list])=>[name,list.map(p=>`${p.w}x${p.h}`).join(' ')]));
  return {seams,sizes,warnings,pieces:Object.values(sheetPieces).reduce((n,list)=>n+list.length,0),regions,midLayer,sheetReports,world:png(world),backdrop:backdrop.toDataURL('image/webp',.9).split(',')[1],preview:png(preview),montage:png(montage),collision:png(collision)};
 },{layout,background:await Promise.all([layout.background].flat().map(dataUrl)),mid:layout.mid?await dataUrl(layout.mid):null,
  sheets:Object.fromEntries(await Promise.all(Object.entries(layout.sheets??{pieces:layout.pieces}).map(async([name,file])=>[name,await dataUrl(file)])))});
}finally{await browser.close();}

const file=(path,base64)=>writeFile(path,Buffer.from(base64,'base64'));
await file(`${assets}/terrain-world.png`,out.world);await file(`${assets}/background.webp`,out.backdrop);await file(`public/assets/maps/${map}-preview.png`,out.preview);
for(const name of ['montage','collision'])await file(`${report}/${name}.png`,out[name]);
for(const [name,data] of Object.entries(out.sheetReports))await file(`${report}/sheet-${name}.png`,data);
if(out.midLayer)await file(`${assets}/mid.webp`,out.midLayer);
const name=`${map.toUpperCase()}_REGIONS`,generated=`shared/generated/${map}Terrain.ts`;await mkdir(dirname(generated),{recursive:true});
await writeFile(generated,`// Generated by \`npm run build:map -- --map=${map}\` from the painted terrain pieces. Do not edit.\nimport type {MapRegion} from '../maps';\n\nexport const ${name}:readonly MapRegion[]=[\n${out.regions.map(({solid,...r})=>` ${JSON.stringify(r)}`).join(',\n')}\n];\n`);
console.log(`${out.pieces} peças na folha; ${out.regions.length} regiões (${out.regions.map(r=>`${r.id}:${r.solid}`).join(', ')})`);
for(const [name,size] of Object.entries(out.sizes))console.log(`${name}: ${size}`);
for(const warning of out.warnings)console.warn(`AVISO: ${warning}`);
if(out.seams.length)console.log(`Emendas do fundo (diferença média de cor, ideal < 28): ${out.seams.map(d=>d.toFixed(0)).join(', ')}`);
console.log(`Relatório: ${report}/{montage,collision,sheet-*}.png`);
