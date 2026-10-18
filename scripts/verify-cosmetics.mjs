import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Measures every hair, hat and glasses item against the rig v1 zones (src/game/rig/anchors.ts),
// then every hair × hat × glasses combination, every outfit's proportions and its prone combat body,
// and the Color Ticket zone of every piece (src/game/rig/recolorZones.ts): each must have one that changes
// a visible share of the painting without swallowing the whole detail piece.
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

  // Prone combat bodies: universal arms layer, hand point and body length (docs/prone-combat.md).
  const V=await import('/src/game/avatar.ts'),prone=[];
  const proneSheet=document.createElement('canvas'),pw=230,ph=200,poses=[['idle',0],['walk',0],['charge',0],['fire',30],['fire',120]];
  proneSheet.width=pw*poses.length+130;proneSheet.height=Math.max(1,outfits.length)*ph+30;const ps=proneSheet.getContext('2d');ps.fillStyle='#16233a';ps.fillRect(0,0,proneSheet.width,proneSheet.height);
  ps.fillStyle='#fff';ps.font='bold 13px sans-serif';poses.forEach(([pose,t],i)=>ps.fillText(`${pose}${t?` ${t}ms`:''}`,130+i*pw+8,18));
  const alpha=part=>{const d=part.canvas.getContext('2d').getImageData(0,0,part.canvas.width,part.canvas.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n;};
  outfits.forEach((outfit,row)=>{
   const combat=A.avatarRig(eqOf({outfit}))?.combat;
   if(!combat?.arms||!combat.hand){prone.push({id:outfit,bounds:null,widthRatio:0,issues:[{code:'unregistered',message:'Corpo deitado sem camada de braços',measured:0,limit:0}]});return;}
   const arms=alpha(combat.arms),armShare=arms/(arms+alpha(combat.torso)),parts=[combat.farLeg,combat.nearLeg,combat.torso,combat.arms];
   const left=Math.min(...parts.map(p=>p.x)),right=Math.max(...parts.map(p=>p.x+p.width)),length=(right-left)/(HEAD_WIDTH*HEAD_SCALE);
   const a=combat.arms,d=a.canvas.getContext('2d').getImageData(0,0,a.canvas.width,a.canvas.height).data,scale=a.canvas.width/a.width;let near=Infinity;
   for(let y=0;y<a.canvas.height;y++)for(let x=0;x<a.canvas.width;x++)if(d[(y*a.canvas.width+x)*4+3]>40)near=Math.min(near,Math.hypot(a.x+x/scale-combat.hand[0],a.y+y/scale-combat.hand[1]));
   prone.push(F.evaluateProne(outfit,armShare,length,near));
   const y=30+row*ph;ps.fillStyle='#fff';ps.font='12px sans-serif';ps.fillText(CATALOG[outfit].name,6,y+ph/2);
   poses.forEach(([pose,t],i)=>{const cell=document.createElement('canvas');cell.width=pw;cell.height=ph;const cc=cell.getContext('2d'),m=V.createAvatarMotion(1);
    for(let f=0;f<24;f++){cc.clearRect(0,0,pw,ph);V.drawAvatar(cc,eqOf({outfit,hair:'hair-undercut'}),pw/2,ph-12,190,1000+f*16,pose==='walk',1,true,m,{combat:true,pose,angle:50,power:70,poseTime:t,movementDistance:pose==='walk'?1.2:0});}
    ps.fillStyle='#ffffff0d';ps.fillRect(130+i*pw,y,pw-4,ph-4);ps.drawImage(cell,130+i*pw,y);});
   const bad=prone.at(-1).issues.length;ps.fillStyle=bad?'#ffb3ba':'#b8ffd6';ps.fillText(bad?`${bad} problema(s)`:'ok',6,y+ph/2+16);
  });

  // Color tickets: every hair, hat, glasses and outfit has a recolor zone of sensible size.
  const {RECOLOR_ZONES,RECOLOR_COVERAGE}=await import('/src/game/rig/recolorZones.ts');
  const R=await import('/src/game/recolor.ts'),H=await import('/src/game/headwear.ts');
  const portrait=(id,color)=>CATALOG[id].slot==='hat'?H.getWornHatPortrait(id,color):CATALOG[id].slot==='outfit'?A.getOutfitPortrait(id,color):A.getAccessoryPortrait(id,color);
  const colorItems=[...hairs,...hats,...glasses,...outfits],recolor=[];
  for(const id of colorItems){
   const zone=RECOLOR_ZONES[id],art=portrait(id),issues=[];
   if(!zone)issues.push({code:'no-color-zone',message:'Sem região de cor (RECOLOR_ZONES)',measured:0,limit:0});
   const coverage=zone&&art?Math.round(R.zoneCoverage(art,id)*100)/100:0;
   if(zone&&coverage<RECOLOR_COVERAGE.min)issues.push({code:'color-zone-small',message:`Região de cor cobre só ${Math.round(coverage*100)}% da peça`,measured:coverage,limit:RECOLOR_COVERAGE.min});
   if(zone?.hue!==undefined&&coverage>RECOLOR_COVERAGE.max)issues.push({code:'color-zone-large',message:`Região de detalhe cobre ${Math.round(coverage*100)}% da peça`,measured:coverage,limit:RECOLOR_COVERAGE.max});
   recolor.push({id,label:zone?.label??'—',coverage,issues});
  }
  const swatches=['#e8332f','#1fa94f','#2b3fb8','#f4f1ea','#2b2b33'],cw=150,colorSheet=document.createElement('canvas');
  colorSheet.width=cw*(swatches.length+1)+170;colorSheet.height=(colorItems.length+2+outfits.length)*cw+30;const cs=colorSheet.getContext('2d');cs.fillStyle='#16233a';cs.fillRect(0,0,colorSheet.width,colorSheet.height);
  cs.fillStyle='#fff';cs.font='bold 13px sans-serif';['original',...swatches].forEach((label,i)=>cs.fillText(label,170+i*cw+6,18));
  const fitIn=(art,x,y)=>{if(!art)return;const k=Math.min((cw-10)/art.width,(cw-10)/art.height);cs.drawImage(art,x+(cw-art.width*k)/2,y+(cw-art.height*k)/2,art.width*k,art.height*k);};
  colorItems.forEach((id,row)=>{const y=30+row*cw,result=recolor.find(item=>item.id===id);cs.fillStyle='#fff';cs.font='12px sans-serif';cs.fillText(CATALOG[id].name,6,y+cw/2-8);cs.fillStyle=result.issues.length?'#ffb3ba':'#b8ffd6';cs.fillText(result.issues.length?`${result.issues.length} problema(s)`:`${Math.round(result.coverage*100)}% muda`,6,y+cw/2+10);
   [undefined,...swatches].forEach((color,i)=>{cs.fillStyle='#ffffff0d';cs.fillRect(170+i*cw,y,cw-4,cw-4);fitIn(portrait(id,color),170+i*cw,y);});});
  // Body and eye colors on the universal head (Ticket de Cor in the character settings).
  const bodyRow=(row,label,options)=>{const y=30+row*cw;cs.fillStyle='#fff';cs.font='12px sans-serif';cs.fillText(label,6,y+cw/2);options.forEach((option,i)=>{const head=A.getFacePortrait('face-brave',option.skin,option.eyes);cs.fillStyle='#ffffff0d';cs.fillRect(170+i*cw,y,cw-4,cw-4);if(head)cs.drawImage(head,380,150,520,520,170+i*cw,y,cw-4,cw-4);});};
  const {SKIN_TONES}=await import('/shared/colors.ts');
  bodyRow(colorItems.length,'Cor do corpo',SKIN_TONES.map(tone=>({skin:tone.color??undefined})));
  // Whole bodies: the outfit's painted arms and legs follow the skin color, its clothes stay.
  const skins=SKIN_TONES.map(tone=>tone.color??undefined),bodyStart=colorItems.length+2;
  outfits.forEach((outfit,row)=>{const y=30+(bodyStart+row)*cw;cs.fillStyle='#fff';cs.font='12px sans-serif';cs.fillText(`Corpo · ${CATALOG[outfit].name}`,6,y+cw/2);
   skins.forEach((skin,i)=>{const cell=document.createElement('canvas');cell.width=cell.height=cw;const cc=cell.getContext('2d');V.drawAvatar(cc,{...eqOf({outfit,hair:'hair-undercut'}),skin},cw/2,cw-6,cw-12,1000,false,1,false);cs.fillStyle='#ffffff0d';cs.fillRect(170+i*cw,y,cw-4,cw-4);cs.drawImage(cell,170+i*cw,y);});});
  // Large sheet of every outfit and face in each skin tone, front and lying down, to spot pieces of skin that keep the old tone.
  const sc=300,faces=ITEMS.filter(item=>item.slot==='face'&&!item.id.endsWith('-none')).map(item=>item.id),skinSheet=document.createElement('canvas');
  skinSheet.width=170+sc*skins.length;skinSheet.height=30+sc*outfits.length+Math.ceil(faces.length)*160;const ks=skinSheet.getContext('2d');ks.fillStyle='#16233a';ks.fillRect(0,0,skinSheet.width,skinSheet.height);
  ks.fillStyle='#fff';ks.font='bold 13px sans-serif';SKIN_TONES.forEach((tone,i)=>ks.fillText(tone.name,170+i*sc+8,20));
  outfits.forEach((outfit,row)=>{const y=30+row*sc;ks.fillStyle='#fff';ks.font='13px sans-serif';ks.fillText(CATALOG[outfit].name,8,y+sc/2);
   skins.forEach((skin,i)=>{const cell=document.createElement('canvas');cell.width=cell.height=sc;V.drawAvatar(cell.getContext('2d'),{...eqOf({outfit,hair:'hair-undercut'}),skin},sc/2,sc-8,sc-16,1000,false,1,false);ks.fillStyle='#ffffff0d';ks.fillRect(170+i*sc,y,sc-4,sc-4);ks.drawImage(cell,170+i*sc,y);});});
  faces.forEach((face,row)=>{const y=30+outfits.length*sc+row*160;ks.fillStyle='#fff';ks.font='13px sans-serif';ks.fillText(CATALOG[face].name,8,y+80);
   skins.forEach((skin,i)=>{const head=A.getFacePortrait(face,skin,undefined);ks.fillStyle='#ffffff0d';ks.fillRect(170+i*sc,y,sc-4,156);if(head)ks.drawImage(head,290,20,720,720,170+i*sc+70,y,156,156);});});
  bodyRow(colorItems.length+1,'Cor dos olhos',[{},{eyes:'#2f7fd8'},{eyes:'#1f9c6b'},{eyes:'#c43a3a'},{eyes:'#8a3fd6'},{eyes:'#8b8f99'}]);

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
  // Full-body costumes (src/game/costumes.ts): four paintings, two of them the walking contacts.
  // Each frame must be whole (not cut by the atlas cell) and the head must not jump between walking paintings.
  const C=await import('/src/game/costumes.ts');
  await Promise.all(Object.values(C.COSTUMES).map(item=>load(item.path)));
  const costumes=[],costumeSheet=document.createElement('canvas'),cc=costumeSheet.getContext('2d'),cellW=230,cellH=260,costumeIds=Object.keys(C.COSTUMES);
  costumeSheet.width=cellW*5;costumeSheet.height=cellH*costumeIds.length;cc.fillStyle='#16233a';cc.fillRect(0,0,costumeSheet.width,costumeSheet.height);
  costumeIds.forEach((id,row)=>{
   const issues=[],framesOf=[0,1,2,3].map(index=>C.getCostumeFrame(id,index));
   if(framesOf.some(frame=>!frame))issues.push({code:'costume-frame',message:'Fantasia sem as 4 pinturas',measured:framesOf.filter(Boolean).length,limit:4});
   const ok=framesOf.filter(Boolean);
   framesOf.forEach((frame,index)=>{if(frame?.cut)issues.push({code:'costume-cut',message:`Pintura ${index} cortada na borda da imagem`,measured:index,limit:0});});
   const heights=ok.map(f=>f.canvas.height);
   const [a,b]=C.COSTUME_WALK_FRAMES,drift=framesOf[a]&&framesOf[b]?Math.abs((framesOf[a].canvas.height-framesOf[b].canvas.height))*framesOf[a].scale:0;
   if(drift>6)issues.push({code:'costume-walk-height',message:`Altura muda ${drift.toFixed(1)} un. entre os passos`,measured:drift,limit:6});
   const standing=[0,1,2].map(i=>framesOf[i]?.canvas.height??0),spread=(Math.max(...standing)-Math.min(...standing))*(framesOf[0]?.scale??0);
   if(spread>12)issues.push({code:'costume-scale',message:`Pinturas em pé com alturas diferentes (${spread.toFixed(1)} un.)`,measured:spread,limit:12});
   costumes.push({id,heights,walkFrames:C.COSTUME_WALK_FRAMES,issues});
   // Sheet: the four paintings on their measured origin, then the two steps overlaid (onion skin).
   const y0=row*cellH,base=y0+cellH-24;
   framesOf.forEach((f,index)=>{if(!f)return;const x=index*cellW+cellW/2,k=1.25*f.scale*160/155;cc.drawImage(f.canvas,x-f.anchor[0]*k,base-f.anchor[1]*k,f.canvas.width*k,f.canvas.height*k);cc.fillStyle='#fff';cc.font='12px sans-serif';cc.fillText(['parado','passo 1','passo 2','combate'][index],index*cellW+6,y0+16);});
   cc.globalAlpha=.5;for(const index of C.COSTUME_WALK_FRAMES){const f=framesOf[index];if(!f)continue;const x=4*cellW+cellW/2,k=1.25*f.scale*160/155;cc.drawImage(f.canvas,x-f.anchor[0]*k,base-f.anchor[1]*k,f.canvas.width*k,f.canvas.height*k);}cc.globalAlpha=1;
   cc.strokeStyle='#ffffff55';cc.beginPath();cc.moveTo(0,base+.5);cc.lineTo(costumeSheet.width,base+.5);cc.stroke();
   for(let i=0;i<5;i++){cc.beginPath();cc.moveTo(i*cellW+cellW/2+.5,y0+24);cc.lineTo(i*cellW+cellW/2+.5,base);cc.stroke();}
   cc.fillStyle=issues.length?'#ffb3ba':'#b8ffd6';cc.font='bold 12px sans-serif';cc.fillText(`${CATALOG[id].name}: ${issues.length?issues.length+' problema(s)':'ok'}`,4*cellW+6,y0+16);
  });
  const matrix=document.createElement('canvas'),rows=['hat-none',...hats],cols=['hair-none',...hairs],mc=200;
  matrix.width=cols.length*mc;matrix.height=rows.length*mc;const ms=matrix.getContext('2d');ms.fillStyle='#16233a';ms.fillRect(0,0,matrix.width,matrix.height);
  rows.forEach((hat,r)=>cols.forEach((hair,col)=>{
   ms.drawImage(layers(eqOf({hat,hair,glasses:'glasses-sport'}),true),PAD+200,PAD-150,850,850,col*mc,r*mc,mc,mc);
   const bad=combinations.find(item=>item.hat===hat&&item.hair===hair).issues.length;ms.fillStyle=bad?'#ffb3ba':'#fff';ms.font='11px sans-serif';ms.fillText(`${CATALOG[hat].name} / ${CATALOG[hair].name}${bad?' ⚠':''}`,col*mc+4,r*mc+13);
  }));
  return {items,combinations,bodies,prone,recolor,costumes,counts:{costumes:costumeIds.length,hairs:hairs.length,hats:hats.length,glasses:glasses.length,outfits:outfits.length},sheets:{zones:zoneSheet.toDataURL('image/png'),matrix:matrix.toDataURL('image/png'),prone:proneSheet.toDataURL('image/png'),colors:colorSheet.toDataURL('image/png'),skins:skinSheet.toDataURL('image/png'),costumes:costumeSheet.toDataURL('image/png')}};
 });
 if(errors.length)throw new Error(`Page errors: ${errors.join('; ')}`);
}finally{await browser.close();await server.close();}

const {sheets,...data}=report;
for(const [name,url] of Object.entries(sheets))await writeFile(`${output}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
await writeFile(`${output}/report.json`,JSON.stringify(data,null,1));
const failingItems=data.items.filter(item=>item.issues.length),failingCombos=data.combinations.filter(combo=>combo.issues.length),failingBodies=data.bodies.filter(body=>body.issues.length),failingProne=data.prone.filter(body=>body.issues.length),failingColors=data.recolor.filter(item=>item.issues.length),failingCostumes=data.costumes.filter(item=>item.issues.length);
const lines=['# Relatório de encaixe de cosméticos (rig v1)','',
 `${data.counts.hairs} cabelos, ${data.counts.hats} chapéus, ${data.counts.glasses} óculos, ${data.counts.outfits} roupas; ${data.combinations.length} combinações de chapéu × cabelo, cada uma com todos os óculos.`,'',
 '## Peças isoladas','','| Peça | Classe | Largura | Problemas |','| --- | --- | --- | --- |',
 ...data.items.map(item=>`| ${item.id} | ${item.fit??'—'} | ${item.widthRatio}× | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Combinações com problema','',...(failingCombos.length?failingCombos.map(combo=>`- ${combo.hat} + ${combo.hair}: ${combo.issues.map(issue=>issue.message).join('; ')}`):['Nenhuma.']),'',
 '## Roupas','','| Roupa | Problemas |','| --- | --- |',...data.bodies.map(body=>`| ${body.id} | ${body.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Combate deitado','','| Roupa | Comprimento | Problemas |','| --- | --- | --- |',...data.prone.map(body=>`| ${body.id} | ${body.widthRatio}× | ${body.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Ticket de Cor','','| Peça | O que muda | Área | Problemas |','| --- | --- | --- | --- |',...data.recolor.map(item=>`| ${item.id} | ${item.label} | ${Math.round(item.coverage*100)}% | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Fantasias','','| Fantasia | Problemas |','| --- | --- |',...data.costumes.map(item=>`| ${item.id} | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),''];
await writeFile(`${output}/report.md`,lines.join('\n'));
console.log(`Itens fora da zona: ${failingItems.length}/${data.items.length}; combinações com problema: ${failingCombos.length}/${data.combinations.length}; roupas fora da proporção: ${failingBodies.length}/${data.bodies.length}; corpos deitados com problema: ${failingProne.length}/${data.prone.length}; regiões de cor com problema: ${failingColors.length}/${data.recolor.length}; fantasias com problema: ${failingCostumes.length}/${data.costumes.length}`);
console.log(`Relatório: ${output}/report.md · pranchas: ${output}/zones.png, ${output}/matrix.png, ${output}/prone.png, ${output}/colors.png, ${output}/skins.png, ${output}/costumes.png`);
if(strict&&(failingItems.length||failingCombos.length||failingBodies.length||failingProne.length||failingColors.length||failingCostumes.length))process.exit(1);
