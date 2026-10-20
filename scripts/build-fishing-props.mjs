import {chromium} from '@playwright/test';
import {transformWithEsbuild} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Cuts the Pescaria's scenery pieces out of the sheets painted for it by Codex (public/assets/fishing/source/)
// and a few of Praça Celeste's (balustrade, cypresses, airship), writes each one at up to twice the size the
// Pescaria draws it, plus shared/generated/fishingProps.ts with their sizes, the sky and the lawn texture.
// Usage: npm run build:fishing [-- --report] (the report numbers every piece of every sheet in test-results/fishing-props/).
const DENSITY=2,OUT='public/assets/fishing/props',REPORT='test-results/fishing-props';
const LOBBY='public/assets/lobby/parallax/source',ANTHILL='public/assets/maps/anthill-1/source',CODEX='public/assets/fishing/source';
/**
 * id → sheet, piece number (cutSheet order: top row first, then left to right) and the height it is drawn at in the world.
 * The Codex sheets (public/assets/fishing/source/, docs/fishing-art-prompts.md) were painted for the Pescaria;
 * the ponds' and the stair's sizes must match POND_ART and STAIR_ART in shared/fishingMap.ts.
 */
const PROPS=[
 ['cypress-pair',`${LOBBY}/08-arvores.png`,2,300],
 ['urn-pillar',`${LOBBY}/07-balaustrada.png`,0,124],
 ['lamp-pillar',`${LOBBY}/07-balaustrada.png`,1,150],
 ['balustrade',`${LOBBY}/07-balaustrada.png`,2,78],
 ['airship',`${LOBBY}/06-ceu-vivo.png`,0,190],
 ['pond-lily',`${CODEX}/2-lagos.png`,1,380],
 ['pond-well',`${CODEX}/2-lagos.png`,0,240],
 ['pond-crystal',`${CODEX}/2-lagos.png`,2,220],
 ['pond-reeds',`${CODEX}/2-lagos.png`,3,220],
 ['pier',`${CODEX}/3-pieres.png`,0,230],
 ['pier-l',`${CODEX}/3-pieres.png`,1,180],
 ['bridge',`${CODEX}/3-pieres.png`,2,140],
 ['deck-umbrella',`${CODEX}/3-pieres.png`,3,230],
 ['rowboat',`${CODEX}/3-pieres.png`,4,110],
 ['dock',`${CODEX}/3-pieres.png`,5,230],
 ['stair',`${CODEX}/4-escadas-muros.png`,0,360*.556],
 ['wall',`${CODEX}/4-escadas-muros.png`,2,190],
 ['cascade',`${CODEX}/4-escadas-muros.png`,4,230],
 ['arch',`${CODEX}/4-escadas-muros.png`,5,260],
 ['fishing-house',`${CODEX}/5-construcoes.png`,0,425],
 ['stall',`${CODEX}/5-construcoes.png`,1,250],
 ['pagoda',`${CODEX}/5-construcoes.png`,2,300],
 ['bait-kiosk',`${CODEX}/5-construcoes.png`,3,230],
 ['willow',`${CODEX}/6-enfeites.png`,0,330],
 ['cherry',`${CODEX}/6-enfeites.png`,1,320],
 ['reeds',`${CODEX}/6-enfeites.png`,2,150],
 ['hydrangea',`${CODEX}/6-enfeites.png`,3,110],
 ['pond-rocks',`${CODEX}/6-enfeites.png`,4,90],
 ['fish-basket',`${CODEX}/6-enfeites.png`,5,62],
 ['paper-lantern',`${CODEX}/6-enfeites.png`,6,150],
 ['bait-bucket',`${CODEX}/6-enfeites.png`,7,92],
 ['flower-bed',`${CODEX}/6-enfeites.png`,8,74],
 ['lake-sign',`${CODEX}/6-enfeites.png`,9,112],
 ['grass-strip',`${CODEX}/8-gramado-bordas.png`,0,60],
 ['grass-patch',`${CODEX}/8-gramado-bordas.png`,1,150],
 ['grass-patch-2',`${CODEX}/8-gramado-bordas.png`,2,115],
 ['grass-patch-3',`${CODEX}/8-gramado-bordas.png`,3,70],
 ['grass-corner',`${CODEX}/8-gramado-bordas.png`,4,120],
 ['hedge-low',`${CODEX}/8-gramado-bordas.png`,5,56],
 ['stone-trail',`${CODEX}/8-gramado-bordas.png`,6,56],
 ['tuft-1',`${CODEX}/8-gramado-bordas.png`,7,48],
 ['tuft-2',`${CODEX}/8-gramado-bordas.png`,8,46],
 ['tuft-3',`${CODEX}/8-gramado-bordas.png`,9,44],
];
/** Pieces with see-through paint over the magenta (the hot spring's steam): the magenta is taken back out of it. */
const UNMIX=new Set();
const DESPILL=new Set([`${LOBBY}/06-ceu-vivo.png`,`${CODEX}/2-lagos.png`,`${CODEX}/3-pieres.png`,`${CODEX}/8-gramado-bordas.png`]);
const report=process.argv.includes('--report');
const files=[...new Set(PROPS.map(p=>p[1]))];
const images=Object.fromEntries(await Promise.all(files.map(async f=>[f,`data:image/png;base64,${(await readFile(f)).toString('base64')}`])));
const builder=(await transformWithEsbuild(await readFile('shared/mapBuilder.ts','utf8'),'mapBuilder.ts',{loader:'ts',format:'iife',globalName:'MapBuilder'})).code;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let out;
try{
 const page=await browser.newPage();await page.addScriptTag({content:builder});
 out=await page.evaluate(async({PROPS,images,DESPILL,DENSITY,UNMIX})=>{
  const B=window.MapBuilder,cut={},reports={};
  for(const [name,data] of Object.entries(images)){const r=B.cutSheet(await B.loadImage(data));cut[name]=r.pieces;reports[name]=r.report.toDataURL('image/png').split(',')[1];
   if(DESPILL.includes(name))for(const p of r.pieces){const g=p.canvas.getContext('2d'),px=g.getImageData(0,0,p.w,p.h),d=px.data;for(let i=0;i<d.length;i+=4){const m=Math.min(d[i],d[i+2])-d[i+1];if(m>6&&d[i+3]>0){d[i]-=m;d[i+2]-=m;}}g.putImageData(px,0,0);}}
  const props=PROPS.map(([id,sheet,n,height])=>{const p=cut[sheet][n];if(!p)throw new Error(`${sheet}: não existe a peça ${n}`);
   if(UNMIX.includes(id)){const g=p.canvas.getContext('2d'),px=g.getImageData(0,0,p.w,p.h),d=px.data;
    // Paint a over magenta: r = a·c + (1−a)·255, g = a·c, so the magenta share is min(r,b) − g.
    for(let i=0;i<d.length;i+=4){const m=Math.min(d[i],d[i+2])-d[i+1];if(m<=24||d[i+3]===0)continue;const a=Math.max(.04,1-m/255);
     for(const j of [0,1,2])d[i+j]=Math.max(0,Math.min(255,Math.round((d[i+j]-(j===1?0:(1-a)*255))/a)));d[i+3]=Math.round(d[i+3]*a);}
    g.putImageData(px,0,0);}
   // Never upscale a painted piece by more than it needs: the file is at most DENSITY× its world size and at most its own size.
   const k=height/p.h,fh=Math.round(Math.min(p.h,height*DENSITY)),c=B.canvas(Math.round(p.w*fh/p.h),fh),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(p.canvas,0,0,c.width,c.height);
   return {id,w:Math.round(p.w*k),h:Math.round(height),data:c.toDataURL('image/webp',.9).split(',')[1]};});
  return {props,reports};
 },{PROPS,images,DESPILL:[...DESPILL],DENSITY,UNMIX:[...UNMIX]});
}finally{await browser.close();}
await mkdir(OUT,{recursive:true});
for(const p of out.props)await writeFile(join(OUT,`${p.id}.webp`),Buffer.from(p.data,'base64'));
// The sky behind the island, as painted.
await writeFile('public/assets/fishing/sky.webp',await sharpless(`${CODEX}/1-ceu.png`));
// The lawn, a texture that repeats without seams.
await writeFile('public/assets/fishing/grass.webp',await sharpless(`${CODEX}/7-gramado.png`));
if(report){await mkdir(REPORT,{recursive:true});for(const [name,data] of Object.entries(out.reports))await writeFile(join(REPORT,name.split('/').slice(-2).join('-')),Buffer.from(data,'base64'));}
const sizes=Object.fromEntries(out.props.map(p=>[p.id,{w:p.w,h:p.h}]));
await writeFile('shared/generated/fishingProps.ts',`// Generated by scripts/build-fishing-props.mjs; do not edit.\n/** Size each Pescaria scenery piece is drawn at (world px); the files in ${OUT}/ are up to ${DENSITY}x. */\nexport const FISHING_PROPS=${JSON.stringify(sizes,null,1)} as const;\nexport type FishingPropId=keyof typeof FISHING_PROPS;\n`);
console.log(`${out.props.length} peças em ${OUT}`);
/** A PNG re-encoded as WebP by the browser. */
async function sharpless(file){const b=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{const page=await b.newPage();const data=await page.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);return c.toDataURL('image/webp',.88).split(',')[1];},`data:image/png;base64,${(await readFile(file)).toString('base64')}`);return Buffer.from(data,'base64');}finally{await b.close();}}
