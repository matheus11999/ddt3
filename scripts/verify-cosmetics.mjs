import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Measures every hair, hat and glasses item against the rig v1 zones (src/game/rig/anchors.ts),
// then every hair × hat × glasses combination, every outfit's proportions and its prone combat body,
// and the Color Ticket zone of every piece (src/game/rig/recolorZones.ts): each must have one that changes
// a visible share of the painting without swallowing the whole detail piece.
// Each outfit is also checked where the game shows it: standing and walking in the lobby (painted 6-frame walk sheet)
// and fighting (painted 12-frame combat atlas), see docs/combat-frames.md.
// Report mode by default; --strict fails when any issue remains (phase 5 of docs/cosmetics-fit.md);
// --only=id,id limits the verdict to the pieces being made.
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
   '/assets/outfits/combat-prone.png','/assets/outfits/cartographer-walk.png',
   ...ITEMS.map(item=>item.visual?.asset).filter(Boolean)])].map(load));
  // Painted lobby walk sheets and battle atlases, drawn by the sheets below.
  await Promise.all([...Object.values((await import('/src/game/walkAtlas.json')).default),...Object.values((await import('/src/game/idleAtlas.json')).default),...Object.values((await import('/src/game/combatAtlas.json')).default)].map(entry=>load(entry.path)));
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
  // The universal head alone: hair must meet its ear, hats must sit on its skull (EAR_CONTACT, HAT_SEAT_GAP).
  const headMask=(()=>{const [el,c]=surface();A.drawPart(c,rig.head);return toMask(el);})();
  for(const id of hairs){const mask=toMask(layers(eqOf({hair:id}))),report=F.evaluateItem(id,mask);if(FIT_ZONES[report.fit]===FIT_ZONES['hair-short'])report.issues.push(...F.evaluateEarContact(mask,headMask));items.push(report);}
  for(const id of hats){const mask=toMask(layers(eqOf({hat:id}))),report=F.evaluateItem(id,mask),seat=COSMETIC_MANIFEST[id]?.fit==='hat-band'?null:F.evaluateHatSeat(mask);if(seat)report.issues.push(seat);items.push(report);}
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
  // Outfits with painted combat frames (combatAtlas.json) never use the cut-out body: their frames are measured below.
  const V=await import('/src/game/avatar.ts'),paintedCombat=(await import('/src/game/combatAtlas.json')).default,prone=[];
  const proneSheet=document.createElement('canvas'),pw=230,ph=200,poses=[['idle',0],['walk',0],['charge',0],['fire',30],['fire',120]];
  proneSheet.width=pw*poses.length+130;proneSheet.height=Math.max(1,outfits.length)*ph+30;const ps=proneSheet.getContext('2d');ps.fillStyle='#16233a';ps.fillRect(0,0,proneSheet.width,proneSheet.height);
  ps.fillStyle='#fff';ps.font='bold 13px sans-serif';poses.forEach(([pose,t],i)=>ps.fillText(`${pose}${t?` ${t}ms`:''}`,130+i*pw+8,18));
  const alpha=part=>{const d=part.canvas.getContext('2d').getImageData(0,0,part.canvas.width,part.canvas.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n;};
  outfits.forEach((outfit,row)=>{
   const combat=A.avatarRig(eqOf({outfit}))?.combat;
   if(paintedCombat[outfit])prone.push({id:outfit,bounds:null,widthRatio:0,painted:true,issues:[]});
   else if(!combat?.arms||!combat.hand){prone.push({id:outfit,bounds:null,widthRatio:0,issues:[{code:'unregistered',message:'Corpo deitado sem camada de braços',measured:0,limit:0}]});}
   else{const arms=alpha(combat.arms),armShare=arms/(arms+alpha(combat.torso)),parts=[combat.farLeg,combat.nearLeg,combat.torso,combat.arms];
   const left=Math.min(...parts.map(p=>p.x)),right=Math.max(...parts.map(p=>p.x+p.width)),length=(right-left)/(HEAD_WIDTH*HEAD_SCALE);
   const a=combat.arms,d=a.canvas.getContext('2d').getImageData(0,0,a.canvas.width,a.canvas.height).data,scale=a.canvas.width/a.width;let near=Infinity;
   for(let y=0;y<a.canvas.height;y++)for(let x=0;x<a.canvas.width;x++)if(d[(y*a.canvas.width+x)*4+3]>40)near=Math.min(near,Math.hypot(a.x+x/scale-combat.hand[0],a.y+y/scale-combat.hand[1]));
   prone.push(F.evaluateProne(outfit,armShare,length,near));}
   const y=30+row*ph;ps.fillStyle='#fff';ps.font='12px sans-serif';ps.fillText(CATALOG[outfit].name,6,y+ph/2);
   poses.forEach(([pose,t],i)=>{const cell=document.createElement('canvas');cell.width=pw;cell.height=ph;const cc=cell.getContext('2d'),m=V.createAvatarMotion(1);
    for(let f=0;f<24;f++){cc.clearRect(0,0,pw,ph);V.drawAvatar(cc,eqOf({outfit,hair:'hair-undercut'}),pw/2,ph-12,190,1000+f*16,pose==='walk',1,true,m,{combat:true,pose,angle:50,power:70,poseTime:t,movementDistance:pose==='walk'?1.2:0});}
    ps.fillStyle='#ffffff0d';ps.fillRect(130+i*pw,y,pw-4,ph-4);ps.drawImage(cell,130+i*pw,y);});
   const bad=prone.at(-1).issues.length;ps.fillStyle=bad?'#ffb3ba':'#b8ffd6';ps.fillText(bad?`${bad} problema(s)`:'ok',6,y+ph/2+16);
  });

  // Lobby and battle sheets (docs/combat-frames.md): every outfit walks in the lobby on its painted 6-frame sheet
  // and fights on its painted 12-frame atlas. Each frame is measured in its atlas cell: painted, whole (not cut
  // by the cell edge), standing on the ground line, the head where the game draws it.
  const walkContract=(await import('/src/game/rig/walkFrames.json')).default,walkAtlases=(await import('/src/game/walkAtlas.json')).default;
  const combatAtlases=(await import('/src/game/combatAtlas.json')).default,CF=await import('/src/game/rig/combatFrames.ts');
  await Promise.all([...Object.values(walkAtlases),...Object.values(combatAtlases)].map(entry=>load(entry.path)));
  const sheetFrames=(path,count,{columns,cell:[cw,ch],origin:[,oy],pixelsPerUnit:ppu},head)=>{
   const image=A.asset(path),el=document.createElement('canvas');el.width=image.naturalWidth;el.height=image.naturalHeight;
   const g=el.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
   return Array.from({length:count},(_,i)=>{
    const sx=i%columns*cw,sy=Math.floor(i/columns)*ch;if(sx+cw>el.width||sy+ch>el.height)return {painted:false,cut:false,groundGap:0,head:[0,0]};
    const d=g.getImageData(sx,sy,cw,ch).data;let bottom=-1,area=0,cut=false;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(d[(y*cw+x)*4+3]>40){area++;bottom=Math.max(bottom,y);if(x===0||y===0||x===cw-1||y===ch-1)cut=true;}
    return {painted:area>200,cut,groundGap:bottom<0?0:Math.max(0,(oy-(bottom+1))/ppu),head:head(i)};
   });
  };
  const walks=[],battles=[];
  for(const outfit of outfits){
   const walk=walkAtlases[outfit];
   walks.push(F.evaluateWalkSheet(outfit,walk?sheetFrames(walk.path,walkContract.frames.length,walkContract.atlas,i=>walk.frames[i]?.head??[0,0]):null));
   const combat=combatAtlases[outfit],layout={...CF.COMBAT_ATLAS,...(combat?.cell?{cell:combat.cell}:{}),...(combat?.origin?{origin:combat.origin}:{})};
   const frames=combat?sheetFrames(combat.path,CF.COMBAT_FRAME_NAMES.length,layout,i=>combat.frames[i]?.head??[0,0]).map((frame,i)=>({...frame,hands:!!combat.frames[i]?.hands})):null;
   battles.push(F.evaluateCombatSheet(outfit,frames,CF.COMBAT_FRAME_NAMES.map(name=>CF.COMBAT_FRAMES[name].head)));
  }
  // Standing in the lobby uses the painted idle sheet from the same pass as the walk (scripts/build-walk-atlas.py --idle).
  const idleAtlases=(await import('/src/game/idleAtlas.json')).default;
  for(const outfit of outfits)if(walkAtlases[outfit]&&!idleAtlases[outfit]&&outfit!=='outfit-cartographer')walks.find(item=>item.id===outfit).issues.push({code:'missing',message:'Sem pose parada pintada junto com o andar (idleAtlas.json)',measured:0,limit:1});
  // The same outfit in every painting (19/10, matheus: "quando começa a andar a roupa muda"): the mean color of the
  // outfit's Color Ticket zone in the walk sheet and in the battle atlas must match the standing painting.
  const Rz=await import('/src/game/recolor.ts'),{RECOLOR_ZONES:ZONES}=await import('/src/game/rig/recolorZones.ts');
  const zoneMean=(path,id)=>{const image=A.asset(path),el=document.createElement('canvas');el.width=image.naturalWidth;el.height=image.naturalHeight;const g=el.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
   const d=g.getImageData(0,0,el.width,el.height).data,zone=ZONES[id];let n=0,r=0,gg=0,b=0;
   for(let i=0;i<d.length;i+=4){if(d[i+3]<200)continue;const [h,s,l]=Rz.rgbHsl(d[i],d[i+1],d[i+2]);if(Rz.zoneWeight(zone,h,s,l)<.5)continue;n++;r+=d[i];gg+=d[i+1];b+=d[i+2];}
   return n?[r/n,gg/n,b/n]:null;};
  for(const outfit of outfits){
   const zone=ZONES[outfit];if(!zone?.hue)continue;const stand=zoneMean(CATALOG[outfit].visual.asset,outfit);if(!stand)continue;
   for(const [list,entry,label] of [[walks,walkAtlases[outfit],'no andar'],[battles,combatAtlases[outfit],'na batalha']]){
    const mean=entry&&zoneMean(entry.path,outfit);if(!mean)continue;const diff=Math.round(Math.hypot(mean[0]-stand[0],mean[1]-stand[1],mean[2]-stand[2]));
    if(diff>40)list.find(item=>item.id===outfit).issues.push({code:'color',message:`Cor da roupa muda ${label}: ${diff} de diferença (${zone.label.split(";")[0].toLowerCase()})`,measured:diff,limit:40});
   }
  }

  // Lobby sheet: each outfit standing and in its six painted steps, both facings, with a hat look and a bare look.
  const looks=[{hair:'hair-undercut',hat:'hat-cap'},{hair:'hair-horizon',hat:'hat-none',glasses:'glasses-navigator'}],lw=200,lh=250;
  const lobbySheet=document.createElement('canvas');lobbySheet.width=150+lw*7;lobbySheet.height=30+outfits.length*looks.length*2*lh;const ls=lobbySheet.getContext('2d');
  ls.fillStyle='#24395c';ls.fillRect(0,0,lobbySheet.width,lobbySheet.height);ls.fillStyle='#fff';ls.font='bold 13px sans-serif';
  ['parado',...walkContract.frames.map(frame=>frame.name)].forEach((label,i)=>ls.fillText(label,150+i*lw+8,18));
  let lobbyRow=0;
  for(const outfit of outfits)for(const look of looks)for(const facing of [1,-1]){
   const y=30+lobbyRow++*lh,walk=walks.find(item=>item.id===outfit);ls.fillStyle='#fff';ls.font='12px sans-serif';ls.fillText(`${CATALOG[outfit].name} ${facing>0?'→':'←'}`,6,y+lh/2);
   ls.fillStyle=walk.issues.length?'#ffb3ba':'#b8ffd6';ls.fillText(walk.issues.length?`${walk.issues.length} problema(s)`:'ok',6,y+lh/2+16);
   [-1,0,1,2,3,4,5].forEach((frame,i)=>{const x=150+i*lw,m=V.createAvatarMotion(facing);m.walk=frame<0?0:1;m.phase=frame<0?0:(frame+.5)*walkContract.frameUnits*Math.PI*2/44;m.lastTime=1000;
    ls.fillStyle='#5b4228';ls.fillRect(x+4,y+lh-30,lw-8,26);V.drawAvatar(ls,eqOf({outfit,...look}),x+lw/2,y+lh-30,200,1016,frame>=0,facing,false,m,{movementDistance:0,animated:true,world:true});});
  }

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
  // Full-body costumes (src/game/costumes.ts): the 2×2 atlas (idle, two steps, standing combat) and,
  // when painted, a 6-frame walk cycle and a 6-frame belly-down combat sheet. Every frame must be whole
  // (not cut by the image edge); the walk keeps one height; belly-down paintings lie feet left, head right.
  const C=await import('/src/game/costumes.ts');
  await Promise.all(Object.values(C.COSTUMES).flatMap(item=>[item.path,item.walk?.path,item.prone?.path]).filter(Boolean).map(load));
  const costumes=[],costumeIds=Object.keys(C.COSTUMES),cellW=200,cellH=230,rowsPer=3;
  const costumeSheet=document.createElement('canvas'),cc=costumeSheet.getContext('2d');
  costumeSheet.width=cellW*6;costumeSheet.height=cellH*rowsPer*costumeIds.length;cc.fillStyle='#16233a';cc.fillRect(0,0,costumeSheet.width,costumeSheet.height);
  const paint=(f,column,row,label,lock)=>{
   const y0=row*cellH,base=y0+cellH-22,x=column*cellW+cellW/2,k=1.15;
   cc.strokeStyle='#ffffff40';cc.beginPath();cc.moveTo(column*cellW,base+.5);cc.lineTo(column*cellW+cellW,base+.5);cc.moveTo(x+.5,y0+22);cc.lineTo(x+.5,base);cc.stroke();
   cc.fillStyle='#fff';cc.font='12px sans-serif';cc.fillText(label,column*cellW+6,y0+15);
   if(f)cc.drawImage(f.canvas,x-f.anchor[0]*f.scale*k,base-f.anchor[1]*f.scale*k,f.canvas.width*f.scale*k,f.canvas.height*f.scale*k);
  };
  costumeIds.forEach((id,n)=>{
   const def=C.COSTUMES[id],issues=[],row=n*rowsPer;
   const atlas=[0,1,2,3].map(index=>C.getCostumeFrame(id,index));
   if(atlas.some(frame=>!frame))issues.push({code:'costume-frame',message:'Fantasia sem as 4 pinturas',measured:atlas.filter(Boolean).length,limit:4});
   atlas.forEach((frame,index)=>{if(frame?.cut)issues.push({code:'costume-cut',message:`Pintura ${index} cortada na borda da imagem`,measured:index,limit:0});});
   const standing=[0,1,2].map(i=>atlas[i]?.canvas.height??0),spread=(Math.max(...standing)-Math.min(...standing))*(atlas[0]?.scale??0);
   if(spread>12)issues.push({code:'costume-scale',message:`Pinturas em pé com alturas diferentes (${spread.toFixed(1)} un.)`,measured:spread,limit:12});
   ['parado','passo 1','passo 2','combate em pé'].forEach((label,index)=>paint(atlas[index],index,row,label));
   cc.fillStyle='#ffe4a0';cc.font='bold 13px sans-serif';cc.fillText(CATALOG[id].name,4*cellW+6,row*cellH+40);
   const walk=def.walk?[0,1,2,3,4,5].map(i=>C.getCostumeWalkFrame(id,i)):[];
   if(!def.walk)issues.push({code:'costume-walk',message:'Sem ciclo de andar pintado (6 quadros)',measured:0,limit:6});
   else{
    if(walk.some(frame=>!frame))issues.push({code:'costume-walk',message:'Ciclo de andar sem os 6 quadros',measured:walk.filter(Boolean).length,limit:6});
    walk.forEach((frame,index)=>{if(frame?.cut)issues.push({code:'costume-cut',message:`Andar ${index+1} cortado na borda da imagem`,measured:index,limit:0});});
    // The painted bob may change the figure's height; the character's size may not: the head keeps its width.
    const headWidth=f=>{const row=Math.round(f.canvas.height*.3),data=f.canvas.getContext('2d').getImageData(0,row,f.canvas.width,1).data;let l=-1,r=-1;for(let x=0;x<f.canvas.width;x++)if(data[x*4+3]>12){if(l<0)l=x;r=x;}return (r-l)*f.scale;};
    const widths=walk.filter(Boolean).map(headWidth),change=(Math.max(...widths)-Math.min(...widths))/Math.max(...widths);
    if(change>.1)issues.push({code:'costume-walk-size',message:`Tamanho da cabeça muda ${Math.round(change*100)}% no andar`,measured:change,limit:.1});
    const heights=walk.filter(Boolean).map(f=>f.canvas.height*f.scale),gap=Math.max(...heights)-Math.min(...heights);
    if(gap>30)issues.push({code:'costume-walk-height',message:`Sobe e desce ${gap.toFixed(1)} un. no andar`,measured:gap,limit:30});
    const heads=walk.filter(Boolean).map(f=>(f.head-f.anchor[0])*f.scale),drift=Math.max(...heads)-Math.min(...heads);
    if(drift>10)issues.push({code:'costume-walk-drift',message:`Cabeça anda ${drift.toFixed(1)} un. entre os quadros`,measured:drift,limit:10});
   }
   walk.forEach((f,index)=>paint(f,index,row+1,`andar ${index+1}`));
   const prone=def.prone?[0,1,2,3,4,5].map(i=>C.getCostumeProneFrame(id,i)):[];
   if(!def.prone)issues.push({code:'costume-prone',message:'Sem combate deitado pintado (6 quadros)',measured:0,limit:6});
   else{
    if(prone.some(frame=>!frame))issues.push({code:'costume-prone',message:'Combate deitado sem os 6 quadros',measured:prone.filter(Boolean).length,limit:6});
    prone.forEach((frame,index)=>{if(!frame)return;if(frame.cut)issues.push({code:'costume-cut',message:`Deitado ${index+1} cortado na borda da imagem`,measured:index,limit:0});
     if(frame.canvas.width<frame.canvas.height*1.05||frame.head<frame.canvas.width*.45)issues.push({code:'costume-prone-pose',message:`Deitado ${index+1} não está de bruços com a cabeça à direita`,measured:index,limit:0});});
   }
   ['descanso','arrastar A','arrastar B','carregar','arremessar','dor'].forEach((label,index)=>paint(prone[index],index,row+2,label,'ground'));
   costumes.push({id,walk:!!def.walk,prone:!!def.prone,issues});
   cc.fillStyle=issues.length?'#ffb3ba':'#b8ffd6';cc.font='bold 12px sans-serif';cc.fillText(issues.length?`${issues.length} problema(s)`:'ok',4*cellW+6,row*cellH+58);
  });
  // Close-ups where fitting mistakes show: every hair at the ear (EAR_CONTACT), every hat on the forehead (HAT_SEAT_GAP).
  const ears=document.createElement('canvas'),ec=300,earRows=[...hairs.map(hair=>({hair,hat:'hat-none'})),...hats.map(hat=>({hair:'hair-undercut',hat}))];
  ears.width=ec*6;ears.height=Math.ceil(earRows.length/6)*ec;const es=ears.getContext('2d');es.fillStyle='#f0dfbf';es.fillRect(0,0,ears.width,ears.height);
  earRows.forEach(({hair,hat},i)=>{const x=i%6*ec,y=Math.floor(i/6)*ec,id=hat==='hat-none'?hair:hat,result=items.find(item=>item.id===id);
   es.drawImage(layers(eqOf({hair,hat}),true),PAD+300,PAD+130,560,560,x,y,ec,ec);
   es.fillStyle=result?.issues.length?'#b3001b':'#0b6b2f';es.font='bold 13px sans-serif';es.fillText(`${CATALOG[id].name}${result?.issues.length?' ⚠':''}`,x+6,y+16);});
  const matrix=document.createElement('canvas'),rows=['hat-none',...hats],cols=['hair-none',...hairs],mc=200;
  matrix.width=cols.length*mc;matrix.height=rows.length*mc;const ms=matrix.getContext('2d');ms.fillStyle='#16233a';ms.fillRect(0,0,matrix.width,matrix.height);
  rows.forEach((hat,r)=>cols.forEach((hair,col)=>{
   ms.drawImage(layers(eqOf({hat,hair,glasses:'glasses-sport'}),true),PAD+200,PAD-150,850,850,col*mc,r*mc,mc,mc);
   const bad=combinations.find(item=>item.hat===hat&&item.hair===hair).issues.length;ms.fillStyle=bad?'#ffb3ba':'#fff';ms.font='11px sans-serif';ms.fillText(`${CATALOG[hat].name} / ${CATALOG[hair]?.name??'Sem cabelo'}${bad?' ⚠':''}`,col*mc+4,r*mc+13);
  }));
  return {items,combinations,bodies,prone,walks,battles,recolor,costumes,counts:{costumes:costumeIds.length,hairs:hairs.length,hats:hats.length,glasses:glasses.length,outfits:outfits.length},sheets:{zones:zoneSheet.toDataURL('image/png'),matrix:matrix.toDataURL('image/png'),ears:ears.toDataURL('image/png'),prone:proneSheet.toDataURL('image/png'),lobby:lobbySheet.toDataURL('image/png'),colors:colorSheet.toDataURL('image/png'),skins:skinSheet.toDataURL('image/png'),costumes:costumeSheet.toDataURL('image/png')}};
 });
 if(errors.length)throw new Error(`Page errors: ${errors.join('; ')}`);
}finally{await browser.close();await server.close();}

const {sheets,...data}=report;
for(const [name,url] of Object.entries(sheets))await writeFile(`${output}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
await writeFile(`${output}/report.json`,JSON.stringify(data,null,1));
// --only=id,id limits the verdict (and --strict) to the pieces being made; the report still lists everything.
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
const mine=id=>!only||only.includes(id),bad=list=>list.filter(item=>item.issues.length&&mine(item.id));
const failingItems=bad(data.items);
// A combination fails a piece being made when that piece causes it: its hair over the face, its hat hiding
// glasses, or its glasses hidden where the other glasses are not.
const blames=combo=>combo.issues.some(issue=>issue.code==='keepout'?mine(combo.hair):mine(combo.hat)||only.some(id=>issue.message.startsWith(`${id}:`))&&combo.issues.filter(other=>other.code==='hidden').length===1);
const failingCombos=data.combinations.filter(combo=>combo.issues.length&&(!only||blames(combo))),failingBodies=bad(data.bodies),failingProne=bad(data.prone),failingWalks=bad(data.walks),failingBattles=bad(data.battles),failingColors=bad(data.recolor),failingCostumes=bad(data.costumes);
const lines=['# Relatório de encaixe de cosméticos (rig v1)','',
 `${data.counts.hairs} cabelos, ${data.counts.hats} chapéus, ${data.counts.glasses} óculos, ${data.counts.outfits} roupas; ${data.combinations.length} combinações de chapéu × cabelo, cada uma com todos os óculos.`,'',
 '## Peças isoladas','','| Peça | Classe | Largura | Problemas |','| --- | --- | --- | --- |',
 ...data.items.map(item=>`| ${item.id} | ${item.fit??'—'} | ${item.widthRatio}× | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Combinações com problema','',...(failingCombos.length?failingCombos.map(combo=>`- ${combo.hat} + ${combo.hair}: ${combo.issues.map(issue=>issue.message).join('; ')}`):['Nenhuma.']),'',
 '## Roupas em pé (lobby)','','| Roupa | Problemas |','| --- | --- |',...data.bodies.map(body=>`| ${body.id} | ${body.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Andar do lobby (folha pintada)','','| Roupa | Sobe e desce | Problemas |','| --- | --- | --- |',...data.walks.map(walk=>`| ${walk.id} | ${walk.widthRatio} un. | ${walk.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Batalha (quadros pintados)','','| Roupa | Desvio da cabeça | Problemas |','| --- | --- | --- |',...data.battles.map(battle=>`| ${battle.id} | ${battle.widthRatio} un. | ${battle.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Combate deitado recortado (roupas sem quadros pintados)','','| Roupa | Comprimento | Problemas |','| --- | --- | --- |',...data.prone.map(body=>`| ${body.id} | ${body.painted?'—':`${body.widthRatio}×`} | ${body.painted?'usa os quadros pintados':body.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Ticket de Cor','','| Peça | O que muda | Área | Problemas |','| --- | --- | --- | --- |',...data.recolor.map(item=>`| ${item.id} | ${item.label} | ${Math.round(item.coverage*100)}% | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),'',
 '## Fantasias','','| Fantasia | Problemas |','| --- | --- |',...data.costumes.map(item=>`| ${item.id} | ${item.issues.map(issue=>issue.message).join('; ')||'ok'} |`),''];
await writeFile(`${output}/report.md`,lines.join('\n'));
console.log(`Itens fora da zona: ${failingItems.length}/${data.items.length}; combinações com problema: ${failingCombos.length}/${data.combinations.length}; roupas fora da proporção: ${failingBodies.length}/${data.bodies.length}; corpos deitados com problema: ${failingProne.length}/${data.prone.length}; andar do lobby com problema: ${failingWalks.length}/${data.walks.length}; batalha com problema: ${failingBattles.length}/${data.battles.length}; regiões de cor com problema: ${failingColors.length}/${data.recolor.length}; fantasias com problema: ${failingCostumes.length}/${data.costumes.length}`);
console.log(`Relatório: ${output}/report.md · pranchas: ${output}/ears.png, ${output}/zones.png, ${output}/matrix.png, ${output}/prone.png, ${output}/lobby.png, ${output}/colors.png, ${output}/skins.png, ${output}/costumes.png`);
if(strict&&(failingItems.length||failingCombos.length||failingBodies.length||failingProne.length||failingWalks.length||failingBattles.length||failingColors.length||failingCostumes.length))process.exit(1);
