import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// The battle pet on the terrain (src/game/petSprite.ts `petGround`): flat ground, ramps up and down, a hole opening
// under it (it falls, snapshots over time) and a cliff edge (it moves to the owner's other side). Also a close-up of
// the fighter lying down with the weapon on the back (src/game/combatBody.ts BACK_WEAPON_GAP).
// Usage: node scripts/preview-pet-terrain.mjs   Optional: BROWSER_EXECUTABLE, OUTPUT_DIR=test-results/pet-terrain.
const output=process.env.OUTPUT_DIR??'test-results/pet-terrain';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const pngs=await page.evaluate(async()=>{
  await import('/shared/petContent.ts');
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),P=await import('/src/game/petSprite.ts'),{DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts'),{weaponAssetPath}=await import('/shared/catalog.ts');
  const combat=(await import('/src/game/combatAtlas.json')).default;
  const load=img=>new Promise(resolve=>{if(img.complete&&img.naturalWidth)return resolve();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});
  const paths=['/assets/character-base.png','/assets/hair-covered-atlas.png',...Object.values(combat).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean),weaponAssetPath(DEFAULT_EQUIPMENT.weapon,0)];
  await Promise.all([...new Set(paths)].map(p=>load(A.asset(p))));
  const pet={id:'pet-preview',species:'verdalia',level:1,quality:'common',stars:0,stage:0,vitality:100,traits:{},skills:[]};
  P.drawPet(document.createElement('canvas').getContext('2d'),pet,0,0,100,1,0);
  await Promise.all([...P.petImages()].map(load));await new Promise(r=>setTimeout(r,500));
  const eq={...DEFAULT_EQUIPMENT,pet},W=320,H=260,VOID=944,scratch=document.createElement('canvas').getContext('2d');
  // Each scene: a height function (local x -> ground y; undefined = no floor) before and after `change`.
  const flat=()=>170,ramp=k=>x=>170+(x-160)*k;
  const hole=x=>x>60&&x<120?232:170,cliff=x=>x<118?undefined:170;
  const scenes=[
   {name:'chão plano',h:flat},{name:'subida',h:ramp(-.45)},{name:'descida',h:ramp(.45)},
   {name:'buraco: 0 ms',h:flat,after:hole,at:0},{name:'buraco: 120 ms',h:flat,after:hole,at:120},{name:'buraco: 400 ms',h:flat,after:hole,at:400},
   {name:'borda: troca de lado',h:cliff}];
  const out=document.createElement('canvas');out.width=4*W;out.height=2*H;const c=out.getContext('2d');c.fillStyle='#9fc3d6';c.fillRect(0,0,out.width,out.height);
  scenes.forEach((scene,i)=>{
   const ox=(i%4)*W,oy=Math.floor(i/4)*H,x=ox+160;
   const floorOf=h=>(px,start)=>{const g=h(px-ox);return g===undefined?VOID:Math.max(start,Math.ceil(g+oy));};
   const owner=floorOf(scene.h)(x,0),slope=Math.atan2(floorOf(scene.h)(x+12,0)-floorOf(scene.h)(x-12,0),24);
   // Settle on the first ground, then (for the hole) swap the ground and run `at` ms of the fall.
   let t=1000;const run=(h,ms)=>{for(const end=t+ms;t<end;t+=16)P.drawPet(scratch,pet,x,owner,112,1,t,'idle',true,floorOf(h),'s'+i);};
   run(scene.h,1500);if(scene.after)run(scene.after,scene.at);const h=scene.after??scene.h;
   c.save();c.beginPath();c.rect(ox,oy,W-2,H-2);c.clip();c.fillStyle=i%2?'#c9d9e6':'#bfd3e2';c.fillRect(ox,oy,W,H);
   c.beginPath();c.moveTo(ox,oy+H);let open=false;for(let k=0;k<=W;k+=2){const g=h(k);if(g===undefined){if(open){c.lineTo(ox+k,oy+H);open=false;}continue;}if(!open){c.lineTo(ox+k,oy+H);open=true;}c.lineTo(ox+k,oy+g);}c.lineTo(ox+W,oy+H);c.closePath();c.fillStyle='#e8f1f7';c.fill();c.strokeStyle='#7a8a9a';c.lineWidth=2;c.stroke();
   V.drawAvatar(c,eq,x,owner,112,t,false,1,true,V.createAvatarMotion(1),{combat:true,pose:'idle',angle:45,power:0,slope});
   P.drawPet(c,pet,x,owner,112,1,t,'idle',true,floorOf(h),'s'+i);
   c.fillStyle='#222';c.font='bold 14px sans-serif';c.fillText(scene.name,ox+8,oy+20);c.restore();
  });
  V.drawAvatar(scratch,{...DEFAULT_EQUIPMENT},0,0,300,1000,false,1,true,V.createAvatarMotion(1),{combat:true,pose:'idle',angle:45,power:0,slope:0});await new Promise(r=>setTimeout(r,500));
  const close=document.createElement('canvas');close.width=420;close.height=300;const d=close.getContext('2d');d.fillStyle='#c9d9e6';d.fillRect(0,0,420,300);d.fillStyle='#e8f1f7';d.fillRect(0,250,420,50);
  V.drawAvatar(d,{...DEFAULT_EQUIPMENT},230,250,300,1000,false,1,true,V.createAvatarMotion(1),{combat:true,pose:'idle',angle:45,power:0,slope:0});
  return [out.toDataURL('image/png'),close.toDataURL('image/png')];
 });
 await writeFile(`${output}/terrain.png`,Buffer.from(pngs[0].split(',')[1],'base64'));
 await writeFile(`${output}/weapon.png`,Buffer.from(pngs[1].split(',')[1],'base64'));
 if(errors.length)console.log('Erros:',errors);
 console.log(`${output}/terrain.png`,`${output}/weapon.png`);
}finally{await browser.close();await server.close();}
