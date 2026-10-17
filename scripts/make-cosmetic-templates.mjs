import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Authoring templates: the universal head with the rig's anchors, the size zone of each fit
// class and the eye/mouth keep-out painted on top. Use them as the reference image when painting
// or generating a new hair, hat or glasses item. Regenerate whenever RIG_VERSION or a zone changes.
// node scripts/make-cosmetic-templates.mjs   (BROWSER_EXECUTABLE optional)
const output='docs/templates';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const images=await page.evaluate(async()=>{
  const A=await import('/src/game/appearance.ts');
  const {FACE_KEEPOUT,FIT_ZONES,HEAD_ANCHORS,HEAD_WIDTH,RIG_VERSION}=await import('/src/game/rig/anchors.ts');
  const {DEFAULT_EQUIPMENT}=await import('/shared/catalog.ts');
  for(const path of ['/assets/character-base.png','/assets/faces/face-brave.png','/assets/outfit-surfer-body.png'])await new Promise(resolve=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)resolve();else image.addEventListener('load',resolve,{once:true});});
  const rig=A.avatarRig({...DEFAULT_EQUIPMENT,face:'face-brave',hat:'hat-none',hair:'hair-none',glasses:'glasses-none'});
  if(!rig?.modular)throw new Error('Universal head is not ready');
  const SIZE=HEAD_ANCHORS.atlasSize,center=(HEAD_ANCHORS.templeNear[0]+HEAD_ANCHORS.templeFar[0])/2,out={};
  const labels={'hair-short':'Cabelo curto','hair-long':'Cabelo longo','hat-tight':'Chapéu justo','hat-wide':'Chapéu de aba larga','hat-band':'Faixa / óculos de testa','hat-helmet':'Elmo','glasses':'Óculos'};
  for(const [fit,zone] of Object.entries(FIT_ZONES)){
   const el=document.createElement('canvas');el.width=el.height=SIZE;const c=el.getContext('2d');
   c.save();c.translate(625,1225);c.scale(1/A.AVATAR_UNIT,1/A.AVATAR_UNIT);A.drawPart(c,rig.head);c.restore();
   const dot=([x,y],color,label)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();c.font='bold 18px sans-serif';c.fillText(label,x+10,y-8);};
   // Size zone: maximum width centred on the skull, from the highest allowed row to the lowest.
   const top=zone.minTop??HEAD_ANCHORS.crown[1]-zone.maxAboveCrown*HEAD_WIDTH,width=zone.maxWidth*HEAD_WIDTH;
   c.strokeStyle='#14c46b';c.lineWidth=4;c.setLineDash([16,10]);c.strokeRect(center-width/2,Math.max(2,top),width,zone.maxBottom-Math.max(2,top));
   if(top<2){c.fillStyle='#0d8a4b';c.font='bold 18px sans-serif';c.fillText(`zona continua ${Math.round(2-top)} px acima do quadro: pintar em atlas com pin`,center-width/2+8,48+60);}
   if(zone.minWidth){const min=zone.minWidth*HEAD_WIDTH;c.strokeStyle='#14c46b88';c.strokeRect(center-min/2,top,min,zone.maxBottom-top);}
   c.setLineDash([]);
   if(zone.keepoutTolerance!==null)for(const {center:[x,y],radius:[rx,ry]} of FACE_KEEPOUT){c.fillStyle='#ff2d4a55';c.strokeStyle='#ff2d4a';c.lineWidth=3;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();}
   c.strokeStyle='#2f8cff';c.lineWidth=2;c.setLineDash([6,6]);c.beginPath();c.moveTo(0,HEAD_ANCHORS.browLine);c.lineTo(SIZE,HEAD_ANCHORS.browLine);c.stroke();c.setLineDash([]);
   c.strokeStyle='#ffb000';c.lineWidth=2;c.strokeRect(24,24,SIZE-48,SIZE-48);
   dot(HEAD_ANCHORS.crown,'#2f8cff','topo');dot(HEAD_ANCHORS.templeNear,'#2f8cff','têmpora');dot(HEAD_ANCHORS.templeFar,'#2f8cff','têmpora');dot(HEAD_ANCHORS.neckPivot,'#2f8cff','pescoço');
   if(fit.startsWith('hat')){const [front,back]=HEAD_ANCHORS.hatSeat;c.strokeStyle='#ff7a00';c.lineWidth=5;c.beginPath();c.moveTo(...front);c.lineTo(...back);c.stroke();dot(front,'#ff7a00','assento');dot(back,'#ff7a00','assento');}
   if(fit==='glasses'){dot(HEAD_ANCHORS.nearEye,'#ff7a00','lente');dot(HEAD_ANCHORS.farEye,'#ff7a00','lente');}
   c.fillStyle='#111';c.font='bold 30px sans-serif';c.fillText(`Rig v${RIG_VERSION} · ${labels[fit]??fit}`,40,70);
   c.font='20px sans-serif';c.fillText(`Verde: zona máxima (${zone.maxWidth}× a cabeça). Vermelho: olhos/boca livres. Azul tracejado: sobrancelha. Laranja: quadro de 24 px.`,40,1210);
   out[fit]=el.toDataURL('image/png');
  }
  return out;
 });
 for(const [fit,url] of Object.entries(images))await writeFile(`${output}/${fit}.png`,Buffer.from(url.split(',')[1],'base64'));
 console.log(`Moldes em ${output}/: ${Object.keys(images).join(', ')}`);
}finally{await browser.close();await server.close();}
