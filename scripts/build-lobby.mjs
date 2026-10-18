import {chromium} from '@playwright/test';
import {transformWithEsbuild} from 'vite';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Builds the parallax backdrop of Praça Celeste from Codex art (docs/lobby-art-prompts.md, "Parallax"):
//  - joins the two sky halves into one panorama (seam in sky and sea only),
//  - cuts the scenery pieces out of the magenta sheets and places them per scripts/lobby-layout.json,
//  - writes one image per depth layer (2x) plus the floating pieces, and shared/generated/lobbyParallax.ts.
// A layer with factor f moves f px for each px the camera moves, so it is 1536 + 3072·f px wide.
// Usage: npm run build:lobby [-- --src=<folder with the Codex PNGs>]
// Optional: BROWSER_EXECUTABLE=/path/to/chromium. Report in test-results/lobby-parallax/.
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const layout=JSON.parse(await readFile('scripts/lobby-layout.json','utf8'));
const src=arg('src')??layout.source,report='test-results/lobby-parallax',assets='public/assets/lobby/parallax';
await mkdir(report,{recursive:true});await mkdir(assets,{recursive:true});
const files=new Set();
for(const layer of layout.layers){(layer.panels??[]).forEach(f=>files.add(f));for(const item of layer.items??[])files.add(item.sheet);for(const row of layer.rows??[])[row.run,...(row.posts??[])].forEach(([f])=>files.add(f));}
for(const f of layout.floaters??[])files.add(f.sheet);
const images=Object.fromEntries(await Promise.all([...files].map(async f=>[f,`data:image/png;base64,${(await readFile(join(src,f))).toString('base64')}`])));
const builder=(await transformWithEsbuild(await readFile('shared/mapBuilder.ts','utf8'),'mapBuilder.ts',{loader:'ts',format:'iife',globalName:'MapBuilder'})).code;

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let out;
try{
 const page=await browser.newPage();await page.addScriptTag({content:builder});
 out=await page.evaluate(async({layout,images})=>{
  const B=window.MapBuilder,VIEW=1536,RANGE=3072,H=864,D=layout.density??2,warnings=[],sheetReports={},cut={};
  const enc=(c,type='image/webp',q=.9)=>c.toDataURL(type,q).split(',')[1];
  const piece=(sheet,n)=>{
   if(!cut[sheet])throw new Error(`folha ${sheet} não carregada`);
   const p=cut[sheet][n];if(!p)throw new Error(`${sheet}: não existe a peça ${n} (a folha tem ${cut[sheet].length})`);return p;};
  for(const [name,data] of Object.entries(images)){if(/ceu-(esquerda|direita)/.test(name))continue;const r=B.cutSheet(await B.loadImage(data));cut[name]=r.pieces;sheetReports[name]=enc(r.report,'image/png');
   r.pieces.forEach((p,n)=>{if(p.touchesEdge)warnings.push(`${name}: a peça ${n} encosta na borda da folha (pode estar cortada)`);});}
  const layers=[];
  for(const layer of layout.layers){
   const W=VIEW+RANGE*layer.factor,c=B.canvas(Math.round(W*D),H*D),g=c.getContext('2d');g.imageSmoothingQuality='high';
   let top=H,bottom=0;
   if(layer.panels){
    const {backdrop,seams}=B.joinBackdrop(await Promise.all(layer.panels.map(f=>B.loadImage(images[f]))),layer.blend??300);
    seams.forEach((d,n)=>{if(d>28)warnings.push(`${layer.id}: emenda ${n+1} com diferença média de cor ${d.toFixed(0)} (acima de 28 aparece)`);});
    const k=W/backdrop.width,h=backdrop.height*k,y=layer.horizonY-layer.horizon*h;
    if(y>0)warnings.push(`${layer.id}: o céu começa em y ${y.toFixed(0)}, abaixo do topo da tela`);
    g.drawImage(backdrop,0,y*D,W*D,h*D);top=Math.max(0,y);bottom=Math.min(H,y+h);
   }
   const place=(p,{x,bottom:b,height,flip})=>{const k=height/p.h,w=p.w*k,left=x-w/2,t=b-height;
    g.save();if(flip){g.translate((x*2)*D,0);g.scale(-1,1);}g.drawImage(p.canvas,left*D,t*D,w*D,height*D);g.restore();
    top=Math.min(top,t);bottom=Math.max(bottom,b);
    if(left+w<0||left>W)warnings.push(`${layer.id}: peça fora da camada (x ${x})`);};
   for(const row of layer.rows??[]){
    // A straight run repeated edge to edge, a post covering every joint (posts cycle through the list).
    const run=piece(...row.run),rw=run.w*row.height/run.h;
    for(let x=row.from,n=0;x<row.to;x+=rw,n++)place(run,{x:x+rw/2,bottom:row.bottom,height:row.height});
    if(row.posts)for(let x=row.from,n=0;x<=row.to+1;x+=rw,n++){const [sheet,i]=row.posts[n%row.posts.length];place(piece(sheet,i),{x,bottom:row.postBottom??row.bottom,height:row.postHeight});}
   }
   for(const item of layer.items??[])place(piece(item.sheet,item.piece),item);
   top=Math.max(0,Math.floor(top)-2);bottom=Math.min(H,Math.ceil(bottom)+2);
   const crop=B.canvas(c.width,(bottom-top)*D);crop.getContext('2d').drawImage(c,0,-top*D);
   layers.push({id:layer.id,factor:layer.factor,y:top,width:W,height:bottom-top,data:enc(crop,'image/webp',layer.panels?.88:.9)});
  }
  const floaters=(layout.floaters??[]).map(f=>{const p=piece(f.sheet,f.piece),k=f.height/p.h,c=B.canvas(Math.round(p.w*k*D),Math.round(f.height*D)),g=c.getContext('2d');
   g.imageSmoothingQuality='high';if(f.flip){g.translate(c.width,0);g.scale(-1,1);}g.drawImage(p.canvas,0,0,c.width,c.height);
   return {id:f.id,factor:f.factor,x:f.x,y:f.y,w:p.w*k,h:f.height,bob:f.bob??4,drift:f.drift??0,period:f.period??6000,data:enc(c)};});
  // Whole plaza as the player sees it walking: each column drawn with the camera that centres it.
  const whole=B.canvas(VIEW+RANGE,H),w=whole.getContext('2d'),loaded=await Promise.all(layers.map(l=>B.loadImage('data:image/webp;base64,'+l.data)));
  const items=[...layers.map((l,n)=>({...l,image:loaded[n]})),...await Promise.all(floaters.map(async f=>({...f,image:await B.loadImage('data:image/webp;base64,'+f.data),floater:true})))].sort((a,b)=>a.factor-b.factor);
  for(let x=0;x<VIEW+RANGE;x+=4){const cam=Math.max(0,Math.min(RANGE,x-VIEW/2));
   w.save();w.beginPath();w.rect(x,0,4,H);w.clip();
   for(const it of items){const left=cam*(1-it.factor);
    if(it.floater)w.drawImage(it.image,left+it.x-it.w/2,it.y-it.h/2,it.w,it.h);else w.drawImage(it.image,left,it.y,it.width,it.height);}
   w.restore();}
  return {warnings,sheetReports,layers,floaters,montage:enc(whole,'image/png')};
 },{layout,images});
}finally{await browser.close();}

const hash=data=>createHash('sha1').update(data).digest('hex').slice(0,8);
const entry=async(id,data)=>{const buffer=Buffer.from(data,'base64');await writeFile(`${assets}/${id}.webp`,buffer);return `/assets/lobby/parallax/${id}.webp?v=${hash(buffer)}`;};
const layers=[],floaters=[];
for(const {data,...l} of out.layers)layers.push({...l,file:await entry(l.id,data)});
for(const {data,...f} of out.floaters)floaters.push({...f,file:await entry(f.id,data)});
await writeFile(`${report}/montage.png`,Buffer.from(out.montage,'base64'));
for(const [name,data] of Object.entries(out.sheetReports))await writeFile(`${report}/sheet-${name}`,Buffer.from(data,'base64'));
const round=o=>JSON.stringify(o,(k,v)=>typeof v==='number'?Math.round(v*100)/100:v);
await writeFile('shared/generated/lobbyParallax.ts',`// Generated by \`npm run build:lobby\` from scripts/lobby-layout.json. Do not edit.
/** A depth layer of Praça Celeste: moves \`factor\` px per camera px; \`width\`/\`height\` in world px, top at \`y\`. */
export interface LobbyParallaxLayer {id:string;factor:number;y:number;width:number;height:number;file:string;}
/** A piece floating in the sky (airship, balloons): centre x in its layer, centre y, bobbing \`bob\` px and drifting \`drift\` px over \`period\` ms. */
export interface LobbyFloater {id:string;factor:number;x:number;y:number;w:number;h:number;bob:number;drift:number;period:number;file:string;}
export const LOBBY_PARALLAX:readonly LobbyParallaxLayer[]=[
${layers.map(l=>` ${round(l)}`).join(',\n')}
];
export const LOBBY_FLOATERS:readonly LobbyFloater[]=[
${floaters.map(f=>` ${round(f)}`).join(',\n')}
];
`);
console.log(`${layers.length} camadas (${layers.map(l=>`${l.id}×${l.factor}`).join(', ')}), ${floaters.length} peças voando`);
for(const warning of out.warnings)console.warn(`AVISO: ${warning}`);
console.log(`Relatório: ${report}/montage.png e sheet-*.png`);
