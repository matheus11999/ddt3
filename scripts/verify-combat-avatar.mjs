import {enterGame} from './character-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1680,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await enterGame(page,process.env.BASE_URL??'http://127.0.0.1:5177');await page.waitForLoadState('networkidle');
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig}=await import('/src/game/appearance.ts'),{drawAvatar,createAvatarMotion,drawAura,getUpgradeAura}=await import('/src/game/avatar.ts'),{DEFAULT_EQUIPMENT,weaponAssetPath}=await import('/shared/catalog.ts');
  const ids=['outfit-cartographer'],levels=[0,5,9,12];
  await Promise.all(['/assets/character-base.png','/assets/shop-accessories.png','/assets/faces/face-brave.png','/assets/outfits/combat-prone.png','/assets/auras/upgrade-rings.png',...ids.flatMap(id=>[`/assets/${id}-body.png`,`/assets/outfits/${id}-walk.png`]),...levels.map(n=>weaponAssetPath('ember',n))].map(path=>new Promise((resolve,reject)=>{const i=asset(path);if(i.complete&&i.naturalWidth)return resolve();i.addEventListener('load',resolve,{once:true});i.addEventListener('error',()=>reject(new Error(path)),{once:true});})));
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#172944';const sheet=document.createElement('canvas');sheet.id='combat-sheet';sheet.width=1680;sheet.height=1150;document.body.append(sheet);const c=sheet.getContext('2d');
  c.fillStyle='#172944';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#fff0bb';c.font='bold 26px Georgia';c.fillText('COMBATE CHIBI COMPACTO · SEM AURA · ARMA ATRÁS',30,42);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const id=ids[Math.floor(row/2)],direction=row%2===0?1:-1,pose=['idle','walk','aim','fire'][col],x=col*420,y=70+row*265,eq={...DEFAULT_EQUIPMENT,outfit:id,weapon:'ember',upgrade:levels[col],hat:'hat-none'},m=createAvatarMotion(direction);
   c.fillStyle='#fff0bb';c.font='16px Arial';c.fillText(`${id} · ${pose} · +${levels[col]} · ${direction>0?'→':'←'}`,x+15,y+20);
   const cell=document.createElement('canvas');cell.width=420;cell.height=240;const cc=cell.getContext('2d');for(let f=0;f<60;f++){cc.clearRect(0,0,420,240);drawAvatar(cc,eq,210,227,223,1000+f*16,pose==='walk',direction,true,m,{pose,combat:true,angle:45,power:70,poseTime:100});}
   c.drawImage(cell,x,y+28);
  }
  window.drawCombatStates=facing=>{
   sheet.width=1800;sheet.height=1050;c.fillStyle='#172944';c.fillRect(0,0,1800,1050);c.fillStyle='#fff0bb';c.font='bold 25px Georgia';c.fillText(`COMBATE · DEZ ESTADOS · ${facing>0?'DIREITA':'ESQUERDA'}`,24,38);
   const poses=['idle','walk','aim','charge','fire','hit','fall','prone','victory','defeat'],bounds=[];
   for(let i=0;i<20;i++){
    const id=ids[Math.floor(i/10)],pose=poses[i%10],x=(i%5)*360,y=60+Math.floor(i/5)*245,cell=document.createElement('canvas');cell.width=360;cell.height=220;const cc=cell.getContext('2d'),m=createAvatarMotion(facing);
    for(let f=0;f<50;f++){cc.clearRect(0,0,360,220);drawAvatar(cc,{...DEFAULT_EQUIPMENT,outfit:id,upgrade:0,weapon:'ember',hat:'hat-none'},180,215,200,1000+f*16,pose==='walk',facing,true,m,{pose,combat:true,angle:55,power:80,poseTime:100});}
    c.fillStyle='#fff0bb';c.font='16px Arial';c.fillText(`${id.replace('outfit-','')} · ${pose}`,x+20,y+16);c.drawImage(cell,x,y+20);
    const data=cc.getImageData(0,0,360,220).data;let top=220;for(let p=3;p<data.length;p+=4)if(data[p]>20){top=Math.floor(p/4/360);break;}bounds.push({id,pose,height:215-top});
   }return bounds;
  };
  const aura=[];for(const level of [0,5,9,12]){const art=getUpgradeAura(level);let centerPixels=0;if(art){const data=art.getContext('2d').getImageData(190,190,132,132).data;for(let i=3;i<data.length;i+=4)if(data[i]>16)centerPixels++;}aura.push({level,ready:!!art,centerPixels});}
  const combat=ids.map(id=>{const rig=avatarRig({...DEFAULT_EQUIPMENT,outfit:id});return {id,ready:!!rig.combat,neck:rig.combat.neck};});
  window.drawAuraComparison=()=>{
   sheet.width=1800;sheet.height=780;c.fillStyle='#172944';c.fillRect(0,0,1800,780);c.fillStyle='#fff0bb';c.font='bold 25px Georgia';c.fillText('AURA DE LUZ · SOMENTE INVENTÁRIO, PERFIL E CARTAS',24,40);
   for(let i=0;i<3;i++){
    const level=[5,9,12][i],x=300+i*600;c.fillStyle='#fff0bb';c.font='21px Arial';c.fillText(`+${level}`,x-18,85);const m=createAvatarMotion(),cell=document.createElement('canvas');cell.width=600;cell.height=670;const cc=cell.getContext('2d');
    for(let f=0;f<40;f++){cc.clearRect(0,0,600,670);drawAvatar(cc,{...DEFAULT_EQUIPMENT,outfit:'outfit-cartographer',upgrade:level,hat:'hat-none'},300,615,530,1000+f*16,false,1,false,m,{pose:'idle',showAura:true});}c.drawImage(cell,i*600,110);
   }
  };
  window.drawAuraEdges=()=>{
   sheet.width=1680;sheet.height=1200;c.fillStyle='#080f1d';c.fillRect(0,0,1680,1200);c.fillStyle='#fff0bb';c.font='bold 24px Georgia';c.fillText('AURA ISOLADA A 45° · ORIGINAL / MARGEM SUAVIZADA',24,38);
   const results=[],atlas=asset('/assets/auras/upgrade-rings.png');
   for(const [i,level] of [5,9,12].entries()){
    const [cx,cy,r]=level===12?[1790,360,340]:level===9?[1097,347,347]:[387,358,345],raw=document.createElement('canvas');raw.width=raw.height=512;raw.getContext('2d').drawImage(atlas,cx-r,cy-r,r*2,r*2,0,0,512,512);
    const final=getUpgradeAura(level),before=raw.getContext('2d').getImageData(0,0,512,512).data,after=final.getContext('2d').getImageData(0,0,512,512).data;let coreChanged=0,outerBefore=0,outerAfter=0;
    for(let p=0;p<before.length;p+=4){const x=(p/4)%512+.5,y=Math.floor(p/4/512)+.5,d=Math.hypot(x-256,y-256);if(d<234)for(let k=0;k<4;k++)if(before[p+k]!==after[p+k])coreChanged++;if(d>=256){if(before[p+3])outerBefore++;if(after[p+3])outerAfter++;}}
    for(let row=0;row<2;row++){c.fillStyle='#fff0bb';c.font='20px Arial';c.fillText(`+${level} · ${row?'margem final':'recorte original'}`,i*560+30,86+row*550);c.save();c.translate(i*560+280,345+row*550);c.rotate(Math.PI/4);c.drawImage(row?final:raw,-240,-240,480,480);c.restore();}
    results.push({level,coreChanged,outerBefore,outerAfter});
   }return results;
  };
  const scopeSample=(upgrade,context)=>{const can=document.createElement('canvas');can.width=can.height=250;drawAvatar(can.getContext('2d'),{...DEFAULT_EQUIPMENT,upgrade},125,240,200,1000,false,1,false,undefined,context);return can.toDataURL();};
  const defaultAuraDisabled=scopeSample(0,{})===scopeSample(12,{}),combatAuraDisabled=scopeSample(12,{combat:true})===scopeSample(12,{combat:true,showAura:true});
  const sample=time=>{const can=document.createElement('canvas');can.width=can.height=250;const cc=can.getContext('2d');cc.translate(125,200);drawAura(cc,12,time);return can.toDataURL();};window.sampleAura=sample;
  return {aura,combat,defaultAuraDisabled,combatAuraDisabled,animated:sample(0)!==sample(20000)};
 });
 await page.locator('#combat-sheet').screenshot({path:'test-results/combat-poses-auras.png'});
 const stateBounds=await page.evaluate(()=>window.drawCombatStates(1));await page.locator('#combat-sheet').screenshot({path:'test-results/combat-tenposes-right.png'});await page.evaluate(()=>window.drawCombatStates(-1));await page.locator('#combat-sheet').screenshot({path:'test-results/combat-tenposes-left.png'});assert.ok(stateBounds.every(v=>v.height<155),'All combat states keep their low body posture');report.states=stateBounds;
 await page.evaluate(()=>window.drawAuraComparison());await page.locator('#combat-sheet').screenshot({path:'test-results/aura-light-profile.png'});assert.ok(report.defaultAuraDisabled&&report.combatAuraDisabled,'Auras are opt-in and never appear in combat');
 report.edges=await page.evaluate(()=>window.drawAuraEdges());await page.locator('#combat-sheet').screenshot({path:'test-results/aura-edges-45deg.png'});assert.ok(report.edges.every(v=>v.coreChanged===0&&v.outerAfter===0),'Only the outer glow margin may change; no square corners remain');
 assert.ok(report.combat.every(v=>v.ready));assert.ok(report.aura.every(v=>v.level===0?!v.ready:v.ready&&v.centerPixels===0),'Rings must have empty transparent centers');assert.ok(report.animated,'Aura visibly rotates with elapsed time');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>window.sampleAura(0)===window.sampleAura(20000)),true,'Reduced motion freezes the aura rotation');
 assert.deepEqual(errors,[]);await writeFile('test-results/combat-avatar-report.json',JSON.stringify({ok:true,...report,reducedMotion:true},null,2));console.log(JSON.stringify({ok:true,...report,reducedMotion:true},null,2));
}finally{await browser.close();}
