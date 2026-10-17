import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Measures every hair, hat and glasses item against the rig v1 zones (src/game/rig/anchors.ts),
// then every hair × hat × glasses combination and every outfit's proportions.
// Report mode by default; --strict fails when any issue remains (phase 5 of docs/cosmetics-fit.md).
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/cosmetics.
const strict=process.argv.includes('--strict');
const output=process.env.OUTPUT_DIR??'test-results/cosmetics';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let report;
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 report=await page.evaluate(async()=>{
  const A=await import('/src/game/appearance.ts');
  const {FIT_ZONES,HEAD_ANCHORS,HEAD_SCALE,HEAD_WIDTH}=await import('/src/game/rig/anchors.ts');
  const {COSMETIC_MANIFEST}=await import('/src/game/rig/manifest.ts');
  const F=await import('/src/game/rig/fit.ts');
  const {CATALOG,DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const load=path=>new Promise((resolve,reject)=>{
   const image=A.asset(path);if(image.complete&&image.naturalWidth){resolve();return;}
   const timeout=setTimeout(()=>reject(new Error(`Timed out loading ${path}`)),20000);
   image.addEventListener('load',()=>{clearTimeout(timeout);resolve();},{once:true});
   image.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error(`Cannot load ${path}`));},{once:true});
  });
  const outfits=ITEMS.filter(item=>item.slot==='outfit'&&A.PAINTED_OUTFITS[item.id]).map(item=>item.id);
  await Promise.all([...new Set(['/assets/character-base.png','/assets/adventurer.png','/assets/hair-wavy.png','/assets/hair-covered-atlas.png',
   '/assets/outfits/combat-prone.png','/assets/outfits/shop-walking-legs.png','/assets/outfits/outfit-surfer-walk.png','/assets/outfits/outfit-executive-walk.png',
   ...ITEMS.map(item=>item.visual?.asset).filter(Boolean)])].map(load));
  // headwear.ts owns its atlas; wait for the same URL to be decoded.
  await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('Cannot load headwear atlas'));image.src='/assets/headwear-worn-atlas.png';});
  await new Promise(resolve=>setTimeout(resolve,300));

  const SIZE=HEAD_ANCHORS.atlasSize,PAD=400,FULL=SIZE+PAD*2;
  const surface=()=>{const el=document.createElement('canvas');el.width=el.height=FULL;const c=el.getContext('2d',{willReadFrequently:true});c.translate(PAD+625,PAD+1225);c.scale(1/A.AVATAR_UNIT,1/A.AVATAR_UNIT);return [el,c];};
  const pixels=el=>el.getContext('2d').getImageData(0,0,FULL,FULL).data;
  const toMask=el=>F.maskFromAlpha(pixels(el),FULL,FULL,PAD,PAD);
  const eqOf=parts=>({...DEFAULT_EQUIPMENT,face:'face-brave',hat:'hat-none',hair:'hair-none',glasses:'glasses-none',...parts});
  const rig=A.avatarRig(eqOf({}));
  if(!rig?.modular)throw new Error('Universal head is not ready');
  const layers=(eq,withHead=false)=>{const [el,c]=surface();A.drawHeadRearLayers(c,eq,0,'idle',true);if(withHead)A.drawPart(c,rig.head);A.drawHeadLayers(c,eq,0,'idle',true);return el;};
  const differs=(a,b,where)=>{const pa=pixels(a),pb=pixels(b),data=new Uint8Array(FULL*FULL);for(let i=0;i<data.length;i++){if(where&&!where.data[i])continue;const n=i*4;if(Math.abs(pa[n]-pb[n])+Math.abs(pa[n+1]-pb[n+1])+Math.abs(pa[n+2]-pb[n+2])+Math.abs(pa[n+3]-pb[n+3])>40)data[i]=1;}return {width:FULL,height:FULL,originX:PAD,originY:PAD,data};};

  const ids=slot=>ITEMS.filter(item=>item.slot===slot&&!item.id.endsWith('-none')).map(item=>item.id);
  const hairs=ids('hair'),hats=ids('hat'),glasses=ids('glasses');
  const items=[];
  for(const id of hairs)items.push(F.evaluateItem(id,toMask(layers(eqOf({hair:id})))));
  for(const id of hats)items.push(F.evaluateItem(id,toMask(layers(eqOf({hat:id})))));
  for(const id of glasses)items.push(F.evaluateItem(id,toMask(layers(eqOf({glasses:id})))));

  // Combinations: hair visible under each hat must keep off the face; glasses must stay visible.
  const combinations=[];
  // Only the front (lenses, bridge, frame) must stay visible; temple arms may pass under hair and hats.
  const front=HEAD_ANCHORS.nearEye[0]-70+PAD;
  const glassesAlone=Object.fromEntries(glasses.map(id=>{const mask=toMask(layers(eqOf({glasses:id})));for(let i=0;i<mask.data.length;i++)if(i%FULL<front)mask.data[i]=0;return [id,mask];}));
  for(const hat of ['hat-none',...hats])for(const hair of ['hair-none',...hairs]){
   const base=layers(eqOf({hat})),withHair=layers(eqOf({hat,hair}));
   const issues=[];
   if(hair!=='hair-none'){
    const zone=FIT_ZONES[COSMETIC_MANIFEST[hair]?.fit];const covered=F.keepoutPixels(differs(withHair,base));
    if(zone?.keepoutTolerance!=null&&covered>zone.keepoutTolerance)issues.push({code:'keepout',message:`Cabelo visível sobre olhos/boca em ${covered}px`,measured:covered,limit:zone.keepoutTolerance});
   }
   for(const id of glasses){
    const all=layers(eqOf({hat,hair,glasses:id}));const issue=F.evaluateGlassesVisibility(id,glassesAlone[id],differs(all,withHair,glassesAlone[id]));
    if(issue)issues.push(issue);
   }
   combinations.push({hat,hair,issues});
  }

  // Outfits: standing proportions in template space.
  const bodies=[];
  for(const outfit of outfits){
   const outfitRig=A.avatarRig(eqOf({outfit}));if(!outfitRig){bodies.push({id:outfit,bounds:null,widthRatio:0,issues:[{code:'unregistered',message:'Rig da roupa não carregou',measured:0,limit:0}]});continue;}
   const [el,c]=surface();A.drawPart(c,outfitRig.stanceBody);
   // Head drawn at HEAD_SCALE around the neck pivot, as in the game; the body art is unscaled.
   const mask=toMask(el),body=F.maskBounds(mask),pivot=HEAD_ANCHORS.neckPivot[1],crown=pivot-(pivot-HEAD_ANCHORS.crown[1])*HEAD_SCALE,feet=body.y+body.height;
   const headHeight=(HEAD_ANCHORS.neckLine-HEAD_ANCHORS.crown[1])*HEAD_SCALE,bounds={...body,y:Math.round(crown),height:Math.round(feet-crown)};
   // Torso width two thirds of a head below the neck, where arms in each pose rarely reach.
   const row=HEAD_ANCHORS.neckLine+Math.round(HEAD_WIDTH*.2)+PAD;let left=-1,right=-1;
   for(let x=0;x<FULL;x++)if(mask.data[row*FULL+x]){if(left<0)left=x;right=x;}
   bodies.push({...F.evaluateBody(outfit,headHeight/(feet-crown),(right-left+1)/HEAD_WIDTH),bounds});
  }

  // Sheets: each item alone with its zone, and the hair × hat matrix with the sport glasses.
  const zoneSheet=document.createElement('canvas'),cell=240,perRow=6,all=[...hairs,...hats,...glasses];
  zoneSheet.width=perRow*cell;zoneSheet.height=Math.ceil(all.length/perRow)*cell;const zs=zoneSheet.getContext('2d');zs.fillStyle='#16233a';zs.fillRect(0,0,zoneSheet.width,zoneSheet.height);
  const view=[PAD+150,PAD-250,950,950],k=cell/view[2],headCenter=(HEAD_ANCHORS.templeNear[0]+HEAD_ANCHORS.templeFar[0])/2;
  all.forEach((id,index)=>{
   const x=index%perRow*cell,y=Math.floor(index/perRow)*cell,eq=eqOf({[CATALOG[id].slot]:id}),result=items.find(item=>item.id===id),zone=FIT_ZONES[result.fit];
   zs.drawImage(layers(eq,true),...view,x,y,cell,cell);
   if(zone){const w=zone.maxWidth*HEAD_WIDTH,top=HEAD_ANCHORS.crown[1]-zone.maxAboveCrown*HEAD_WIDTH;zs.strokeStyle=result.issues.length?'#ff4d5e':'#4dff9a';zs.lineWidth=1.5;zs.setLineDash([5,4]);zs.strokeRect(x+(PAD+headCenter-w/2-view[0])*k,y+(PAD+top-view[1])*k,w*k,(zone.maxBottom-top)*k);zs.setLineDash([]);}
   zs.fillStyle='#fff';zs.font='bold 12px sans-serif';zs.fillText(CATALOG[id].name,x+6,y+15);zs.font='11px sans-serif';zs.fillStyle=result.issues.length?'#ffb3ba':'#b8ffd6';zs.fillText(result.issues.length?`${result.issues.length} problema(s)`:'dentro da zona',x+6,y+cell-8);
  });
  const matrix=document.createElement('canvas'),rows=['hat-none',...hats],cols=['hair-none',...hairs],mc=200;
  matrix.width=cols.length*mc;matrix.height=rows.length*mc;const ms=matrix.getContext('2d');ms.fillStyle='#16233a';ms.fillRect(0,0,matrix.width,matrix.height);
  rows.forEach((hat,r)=>cols.forEach((hair,col)=>{
   ms.drawImage(layers(eqOf({hat,hair,glasses:'glasses-sport'}),true),PAD+200,PAD-150,850,850,col*mc,r*mc,mc,mc);
   const bad=combinations.find(item=>item.hat===hat&&item.hair===hair).issues.length;ms.fillStyle=bad?'#ffb3ba':'#fff';ms.font='11px sans-serif';ms.fillText(`${CATALOG[hat].name} / ${CATALOG[hair].name}${bad?' ⚠':''}`,col*mc+4,r*mc+13);
  }));
  return {items,combinations,bodies,counts:{hairs:hairs.length,hats:hats.length,glasses:glasses.length,outfits:outfits.length},sheets:{zones:zoneSheet.toDataURL('image/png'),matrix:matrix.toDataURL('image/png')}};
 });
 if(errors.length)throw new Error(`Page errors: ${errors.join('; ')}`);
}finally{await browser.close();await server.close();}

const {sheets,...data}=report;
for(const [name,url] of Object.entries(sheets))await writeFile(`${output}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
await writeFile(`${output}/report.json`,JSON.stringify(data,null,1));
const failingItems=data.items.filter(item=>item.issues.length),failingCombos=data.combinations.filter(combo=>combo.issues.length),failingBodies=data.bodies.filter(body=>body.issues.length);
const lines=['# Relatório de encaixe de cosméticos (rig v1)','',
 `${data.counts.hairs} cabelos, ${data.counts.hats} chapéus, ${data.counts.glasses} óculos, ${data.counts.outfits} roupas; ${data.combinations.length} combinações de chapéu × cabelo, cada uma com todos os óculos.`,'',
 '## Peças isoladas','','| Peça | Classe | Largura | Problemas |','| --- | --- | --- | --- |',
 ...data.items.map(item=>`| ${item.id} | ${item.fit??'—'} | ${item.widthRatio}× | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Combinações com problema','',...(failingCombos.length?failingCombos.map(combo=>`- ${combo.hat} + ${combo.hair}: ${combo.issues.map(issue=>issue.message).join('; ')}`):['Nenhuma.']),'',
 '## Roupas','','| Roupa | Problemas |','| --- | --- |',...data.bodies.map(body=>`| ${body.id} | ${body.issues.map(issue=>issue.message).join('; ')||'ok'} |`),''];
await writeFile(`${output}/report.md`,lines.join('\n'));
console.log(`Itens fora da zona: ${failingItems.length}/${data.items.length}; combinações com problema: ${failingCombos.length}/${data.combinations.length}; roupas fora da proporção: ${failingBodies.length}/${data.bodies.length}`);
console.log(`Relatório: ${output}/report.md · pranchas: ${output}/zones.png, ${output}/matrix.png`);
if(strict&&(failingItems.length||failingCombos.length||failingBodies.length))process.exit(1);
