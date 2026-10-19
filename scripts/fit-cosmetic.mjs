import {chromium} from '@playwright/test';
import {createServer} from 'vite';

// Finds where a hair, hat or glasses piece fits the universal head (docs/cosmetics-fit.md): it moves and scales the
// piece's pin (src/game/rig/manifest.ts) and keeps the placement with the fewest validator issues, measured exactly
// as `npm run verify:cosmetics` does (zone, eyes and mouth, ear contact, hat seat). It prints the new `to` points to
// paste into the manifest; it never changes files. Run it after painting a piece, then verify:cosmetics.
// Usage: node scripts/fit-cosmetic.mjs hair-surf hat-surf [--range=60] [--step=8]
// Optional: BROWSER_EXECUTABLE=/path/to/chromium.
const ids=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const arg=(name,fallback)=>Number(process.argv.find(item=>item.startsWith(`--${name}=`))?.split('=')[1]??fallback);
const range=arg('range',60),step=arg('step',8);
if(!ids.length)throw new Error('Uso: node scripts/fit-cosmetic.mjs <id> [<id>...]');
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const results=await page.evaluate(async({ids,range,step})=>{
  const A=await import('/src/game/appearance.ts'),F=await import('/src/game/rig/fit.ts');
  const {COSMETIC_MANIFEST}=await import('/src/game/rig/manifest.ts'),{FIT_ZONES,HEAD_ANCHORS}=await import('/src/game/rig/anchors.ts');
  const {CATALOG,DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const load=p=>new Promise(r=>{const i=A.asset(p);if(i.complete&&i.naturalWidth)return r();i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});});
  await Promise.all(['/assets/character-base.png',...ITEMS.map(i=>i.visual?.asset).filter(Boolean)].map(load));
  await new Promise(r=>setTimeout(r,600));
  const SIZE=HEAD_ANCHORS.atlasSize,PAD=400,FULL=SIZE+PAD*2,rig=A.avatarRig({...DEFAULT_EQUIPMENT,face:'face-brave'});
  const surface=()=>{const el=document.createElement('canvas');el.width=el.height=FULL;const c=el.getContext('2d',{willReadFrequently:true});c.translate(PAD+625,PAD+1225);c.scale(1/A.AVATAR_UNIT,1/A.AVATAR_UNIT);return [el,c];};
  const toMask=el=>F.maskFromAlpha(el.getContext('2d').getImageData(0,0,FULL,FULL).data,FULL,FULL,PAD,PAD);
  const head=(()=>{const [el,c]=surface();A.drawPart(c,rig.head);return toMask(el);})();
  let tick=0;
  const measure=id=>{
   const slot=CATALOG[id].slot,eq={...DEFAULT_EQUIPMENT,face:'face-brave',hat:'hat-none',hair:'hair-none',glasses:'glasses-none',[slot]:id,
    // A fresh ticket color per try rebuilds the cached cut-outs (the alpha, which is all that is measured, does not change).
    colors:{[slot]:`#${(0x200000+tick++*7919%0xdfffff).toString(16).padStart(6,'0')}`}};
   const [el,c]=surface();A.drawHeadRearLayers(c,eq,0,'idle',true);A.drawHeadLayers(c,eq,0,'idle',true);
   const mask=toMask(el),report=F.evaluateItem(id,mask),manifest=COSMETIC_MANIFEST[id];
   if(manifest.fit==='hair-short')report.issues.push(...F.evaluateEarContact(mask,head));
   if(slot==='hat'&&manifest.fit!=='hat-band'){const seat=F.evaluateHatSeat(mask);if(seat)report.issues.push(seat);}
   return {issues:report.issues,keepout:F.keepoutPixels(mask)};
  };
  const out=[];
  for(const id of ids){
   const manifest=COSMETIC_MANIFEST[id];if(!manifest?.worn){out.push({id,error:'sem arte no manifesto'});continue;}
   // Hats keep the universal seat (`to` = hatSeat, checked by evaluatePin): they move by their art points (`from`).
   const hat=manifest.slot==='hat',pin=manifest.worn.pin,key=hat?'from':'to',original=pin[key].map(p=>[...p]),mid=[(original[0][0]+original[1][0])/2,(original[0][1]+original[1][1])/2];
   const k=Math.hypot(pin.to[1][0]-pin.to[0][0],pin.to[1][1]-pin.to[0][1])/Math.hypot(pin.from[1][0]-pin.from[0][0],pin.from[1][1]-pin.from[0][1]);
   const place=(s,dx,dy)=>{pin[key]=hat?original.map(([x,y])=>[mid[0]+(x-mid[0])/s-dx/k,mid[1]+(y-mid[1])/s-dy/k]):original.map(([x,y])=>[mid[0]+(x-mid[0])*s+dx,mid[1]+(y-mid[1])*s+dy]);};
   if(hat&&pin.to!==HEAD_ANCHORS.hatSeat&&JSON.stringify(pin.to)!==JSON.stringify(HEAD_ANCHORS.hatSeat))pin.to=HEAD_ANCHORS.hatSeat;
   // Glasses are pinned to the eyes: only their size may change.
   const moves=manifest.slot==='glasses'?[0]:Array.from({length:Math.floor(range*2/step)+1},(_,i)=>-range+i*step);
   const before=measure(id);let best={score:Infinity};
   const score=({issues,keepout},s,dx,dy)=>issues.length*1e5+issues.reduce((n,i)=>n+Math.abs(i.measured-i.limit),0)*10+keepout+Math.abs(s-1)*400+(Math.abs(dx)+Math.abs(dy))*.5;
   for(const s of [.8,.85,.9,.95,1,1.05,1.1])for(const dx of moves)for(const dy of moves){place(s,dx,dy);const m=measure(id),value=score(m,s,dx,dy);if(value<best.score)best={score:value,s,dx,dy,...m};}
   place(best.s,best.dx,best.dy);const to=pin[key].map(([x,y])=>[Math.round(x*10)/10,Math.round(y*10)/10]);pin[key]=original;
   out.push({id,key,fit:manifest.fit,before:before.issues.map(i=>i.message),after:best.issues.map(i=>i.message),scale:best.s,move:[best.dx,best.dy],to});
  }
  return out;
 },{ids,range,step});
 for(const r of results){
  if(r.error){console.log(`${r.id}: ${r.error}`);continue;}
  console.log(`\n${r.id} (${r.fit}): escala ${r.scale}, deslocamento ${r.move.join(', ')}`);
  console.log(`  antes: ${r.before.join('; ')||'ok'}`);
  console.log(`  depois: ${r.after.join('; ')||'ok'}`);
  console.log(`  pin.${r.key}: ${JSON.stringify(r.to)}`);
 }
}finally{await browser.close();await server.close();}
