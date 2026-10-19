// Teste no navegador das marcas de destruição (docs/weapon-kit.md, "Destruição"): composição em ordem,
// recorte pelo chão que sobrou, reconstrução igual à composição contínua, mais de 48 marcas, arte atrasada
// ou falha, armas sobrepostas nas duas ordens e chão indestrutível. Também desenha a prancha das 16 marcas.
// Uso: node scripts/test-destruction-browser.mjs  (OUT e CHROME_PATH opcionais; ART=placeholder usa marcas de teste)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';

const out=process.env.OUT??'test-results/destruction';await mkdir(out,{recursive:true});
await writeFile(`${out}/harness.html`,'<!doctype html><meta charset="utf-8"><body style="margin:0;background:#223"></body>');
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const chrome=process.env.CHROME_PATH??(await import('node:fs')).existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?'/opt/pw-browsers/chromium-1194/chrome-linux/chrome':undefined;
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
const page=await browser.newPage({viewport:{width:1400,height:900}});
page.on('pageerror',error=>{console.error(error);process.exitCode=1;});
await page.goto(`${base}/${out}/harness.html`);
const placeholder=process.env.ART==='placeholder';
const result=await page.evaluate(async placeholder=>{
 const {MAP_DEFINITIONS}=await import('/shared/maps.ts'),physics=await import('/shared/physics.ts'),{destructionProfiles,destructionProfile}=await import('/shared/destruction.ts'),{TerrainResidues}=await import('/src/game/terrainResidues.ts');
 const {WORLD,createTerrain,crater,ground}=physics;
 // A bench map: flat, slope, wall and thin bridge on breakable ground, and an unbreakable slab.
 const rect=(id,x,y,width,height,destructible=true)=>({id,material:'earth',destructible,shape:{kind:'rect',x,y,width,height}});
 MAP_DEFINITIONS.bench={...MAP_DEFINITIONS.snow,id:'bench',dimensions:{width:1536,height:864},regions:[
  rect('flat',0,600,1536,264),{id:'slope',material:'earth',destructible:true,shape:{kind:'polygon',points:[[300,600],[520,470],[520,600]]}},
  rect('wall',700,420,40,180),rect('bridge',900,500,220,8),rect('slab',1250,560,286,40,false)]};
 const profiles=[...destructionProfiles().values()],colors=['#e8603a','#f0b13a','#7bd35a','#4fb5e8','#b06ae8','#e85aa9','#5ae8d0','#e8e05a'];
 // Placeholder paintings when asked (or for profiles still without art): a coloured rim with a transparent centre, one colour per profile.
 const ring=(index,profile)=>{const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');const hole=512*profile.mark.holeShare;
  g.fillStyle=colors[index%8];g.beginPath();g.ellipse(512,512,500,500,0,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.beginPath();g.ellipse(512,512,hole*.82,hole*.82*.6,0,0,Math.PI*2);g.fill();
  g.globalCompositeOperation='source-over';g.fillStyle='#000';g.font='bold 160px sans-serif';g.textAlign='center';g.fillText(String(profile.stage),512,250);return c.toDataURL();};
 profiles.forEach((profile,index)=>{if(placeholder||!profile.painted){profile.painted=true;profile.mark.src=ring(index,profile);}});
 const settle=()=>new Promise(resolve=>setTimeout(resolve,60));
 const layer=residues=>residues.canvas.getContext('2d').getImageData(0,0,residues.canvas.width,WORLD.height).data;
 const drawAll=async residues=>{const scratch=document.createElement('canvas').getContext('2d');for(let n=0;n<40;n++){residues.draw(scratch);await settle();if(residues.drawn===residues.marks.length)break;}};
 const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message);};
 // Fires a sequence of impacts: dig then mark, like Scene does with server impacts.
 const play=async(map,shots,options={})=>{
  const terrain=createTerrain(map),residues=new TerrainResidues(terrain,map),marks=[];
  for(const [n,shot] of shots.entries()){
   const profile=destructionProfile(shot.weapon,shot.level,shot.pow),y=shot.y??ground(terrain,shot.x),radius=shot.body?Math.round(profile.radius*.75):profile.radius;
   crater(terrain,shot.x,y,radius,map,0,1,profile.mask);residues.setTerrain(terrain);
   const mark={id:`s${n}`,x:shot.x,y,radius,shape:profile.mask,profile:profile.id,effect:shot.weapon==='brick'?'brick':'boomerang',level:shot.level};marks.push(mark);residues.add(mark);
   if(options.drawEach)await drawAll(residues);
  }
  await drawAll(residues);return {terrain,residues,marks};
 };
 const sameAsRebuild=async(map,{terrain,residues,marks},label)=>{
  const again=new TerrainResidues(terrain,map);again.sync(residues.marks);await drawAll(again);
  const a=layer(residues),b=layer(again);let diff=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>2)diff++;
  check(diff===0,`${label}: reconnect differs in ${diff} channels`);
  const template=physics.terrainTemplate(map),cols=terrain.length/WORLD.rows;let floating=0,unbreakable=0;
  for(let i=0;i<terrain.length;i++){const alpha=a[i*4+3];if(!alpha)continue;if(!terrain[i])floating++;else if(!template.definition[template.regions[i]]?.destructible)unbreakable++;}
  check(floating===0,`${label}: ${floating} painted pixels over empty space`);check(unbreakable===0,`${label}: ${unbreakable} painted pixels on unbreakable ground`);
  return {residues,cols};
 };
 const cases={};
 // Every weapon × phase × mode on flat ground, slope, wall, bridge, a body hit, and the edge of the map.
 for(const weapon of ['brick','love-boomerang'])for(const level of [0,10,12,15])for(const pow of [false,true]){
  const label=`${weapon} +${level} ${pow?'POW':'normal'}`;
  const run=await play('bench',[{weapon,level,pow,x:200},{weapon,level,pow,x:430,y:540},{weapon,level,pow,x:700,y:500},{weapon,level,pow,x:1000,y:500},{weapon,level,pow,x:150,body:true},{weapon,level,pow,x:4}]);
  await sameAsRebuild('bench',run,label);cases[label]=run.residues.marks.length;
 }
 // Two weapons overlapping, in both orders: the later one paints over and cuts the earlier.
 for(const order of [['brick','love-boomerang'],['love-boomerang','brick']]){
  const run=await play('bench',[{weapon:order[0],level:12,pow:false,x:600},{weapon:order[1],level:15,pow:true,x:614}]);await sameAsRebuild('bench',run,`overlap ${order.join(' > ')}`);
 }
 // More than 48 marks: none disappears while it still has ground to paint.
 const many=await play('bench',Array.from({length:80},(_,n)=>({weapon:n%2?'brick':'love-boomerang',level:[0,10,12,15][n%4],pow:n%5===0,x:60+n*17})));
 check(many.residues.marks.length>48,`only ${many.residues.marks.length} of 80 marks kept`);await sameAsRebuild('bench',many,'80 impacts');
 // Unbreakable ground: no hole and no painted rim.
 const slab=await play('bench',[{weapon:'brick',level:0,pow:false,x:1390,y:560}]);check(slab.residues.marks.length===0||layer(slab.residues).every((v,i)=>i%4!==3||v===0),'unbreakable slab got paint');
 // A painting that arrives late holds the later marks back, then the layer equals the continuous one.
 const lateProfile=destructionProfile('brick',10,false),lateSrc=lateProfile.mark.src;lateProfile.mark.src=`${lateSrc}#late`;
 const late=await play('bench',[{weapon:'brick',level:10,pow:false,x:250},{weapon:'brick',level:0,pow:false,x:262}]);await sameAsRebuild('bench',late,'late art');lateProfile.mark.src=lateSrc;
 // A painting that fails is skipped: the hole is there, the match goes on, the other marks still paint.
 const broken=destructionProfile('love-boomerang',12,true),brokenSrc=broken.mark.src;broken.mark.src='/assets/weapons/missing/mark.png';
 const failed=await play('bench',[{weapon:'love-boomerang',level:12,pow:true,x:250},{weapon:'brick',level:0,pow:false,x:300}]);
 check(failed.residues.drawn===failed.residues.marks.length,'a failed painting blocks the queue');broken.mark.src=brokenSrc;
 // Marks are drawn once into the layer and never re-drawn per frame.
 const t0=performance.now();for(let n=0;n<120;n++)many.residues.draw(document.createElement('canvas').getContext('2d'));const frameMs=(performance.now()-t0)/120;
 // Contact sheet: the 16 marks on the same flat ground and scale, normal on top row of each weapon, POW below.
 const sheet=document.createElement('canvas'),cell=150,zoom=2;sheet.width=cell*4*zoom+20;sheet.height=cell*4*zoom+20;const s=sheet.getContext('2d');s.fillStyle='#1d2a44';s.fillRect(0,0,sheet.width,sheet.height);
 let row=0;
 for(const weapon of ['brick','love-boomerang'])for(const pow of [false,true]){
  for(const [col,level] of [0,10,12,15].entries()){
   const run=await play('bench',[{weapon,level,pow,x:200}]);const env=document.createElement('canvas');env.width=cell;env.height=cell;const e=env.getContext('2d');
   e.fillStyle='#8a6a48';const terrain=run.terrain,cols=terrain.length/WORLD.rows;const img=e.createImageData(cell,cell);
   for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const i=(y+530)*cols+x+125;if(terrain[i]){img.data[(y*cell+x)*4]=150;img.data[(y*cell+x)*4+1]=115;img.data[(y*cell+x)*4+2]=82;img.data[(y*cell+x)*4+3]=255;}}
   e.putImageData(img,0,0);e.drawImage(run.residues.canvas,125,530,cell,cell,0,0,cell,cell);
   s.imageSmoothingEnabled=false;s.drawImage(env,10+col*cell*zoom,10+row*cell*zoom,cell*zoom,cell*zoom);
   s.fillStyle='#fff';s.font='bold 18px sans-serif';s.fillText(`${weapon==='brick'?'Quebra-Tijolos':'Bumerangue'} +${level} ${pow?'POW':'normal'}`,18+col*cell*zoom,32+row*cell*zoom);
  }
  row++;
 }
 return {failures,cases,kept:many.residues.marks.length,frameMs,sheet:sheet.toDataURL('image/png')};
},placeholder);
await writeFile(`${out}/sheet.png`,Buffer.from(result.sheet.split(',')[1],'base64'));
await browser.close();await server.close();
console.log(JSON.stringify({kept:result.kept,frameMs:Math.round(result.frameMs*100)/100,cases:Object.keys(result.cases).length,failures:result.failures},null,1));
console.log(`prancha: ${out}/sheet.png`);
if(result.failures.length)process.exitCode=1;
