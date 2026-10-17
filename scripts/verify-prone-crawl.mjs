import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Combat prone sheet: every painted outfit lying down while idle, crawling,
// aiming and throwing, with several hair/hat/glasses sets and both facings.
// Also measures the crawl: the body must move between frames and stay low.
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/prone.
const output=process.env.OUTPUT_DIR??'test-results/prone';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,ITEMS,weaponAssetPath}=await import('/shared/catalog.ts');
  const load=path=>new Promise((resolve,reject)=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(path)),{once:true});});
  const outfits=ITEMS.filter(item=>item.slot==='outfit'&&A.PAINTED_OUTFITS[item.id]).map(item=>item.id);
  const weapons=['ember','volt','dynamite','crystal'];
  await Promise.all([...new Set(['/assets/character-base.png','/assets/hair-covered-atlas.png','/assets/outfits/combat-prone.png',...ITEMS.map(item=>item.visual?.asset).filter(Boolean),...weapons.map(w=>weaponAssetPath(w,0))])].map(path=>load(path).catch(()=>{})));
  await new Promise((resolve)=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.src='/assets/headwear-worn-atlas.png';});
  await new Promise(resolve=>setTimeout(resolve,400));
  const looks=[{hair:'hair-undercut',hat:'hat-cap',glasses:'glasses-none',face:'face-brave'},{hair:'hair-ponytail',hat:'hat-none',glasses:'glasses-sport',face:'face-smile'},{hair:'hair-wavy',hat:'hat-mage',glasses:'glasses-none',face:'face-wink'},{hair:'hair-horizon',hat:'hat-tropical',glasses:'glasses-navigator',face:'face-fierce'},{hair:'hair-undercut',hat:'hat-thunder',glasses:'glasses-cat',face:'face-serene'}];
  const columns=[['idle',0,'parado'],['walk',0,'arrastando A'],['walk',.5,'arrastando B'],['aim',0,'mirando'],['charge',0,'carregando'],['fire',30,'arremesso 30ms'],['fire',120,'arremesso 120ms'],['fire',300,'arremesso 300ms']];
  const W=210,H=190,sheet=document.createElement('canvas');sheet.width=W*columns.length+120;sheet.height=60+outfits.length*H*2;
  const c=sheet.getContext('2d');c.fillStyle='#24395c';c.fillRect(0,0,sheet.width,sheet.height);
  c.fillStyle='#ffe9a8';c.font='bold 22px Georgia';c.fillText('COMBATE DEITADO · ROUPAS × POSES · ARMA NAS COSTAS',20,34);
  c.font='13px Arial';columns.forEach(([, ,label],i)=>c.fillText(label,120+i*W+60,54));
  const metrics=[];
  outfits.forEach((outfit,row)=>{for(const facing of [1,-1]){
   const y=60+(row*2+(facing<0?1:0))*H,look=looks[row%looks.length],weapon=weapons[row%weapons.length];
   c.fillStyle='#ffe9a8';c.font='13px Arial';c.fillText(outfit.replace('outfit-',''),10,y+80);c.fillText(facing>0?'→':'←',10,y+100);
   columns.forEach(([pose,extra],col)=>{
    const cell=document.createElement('canvas');cell.width=W;cell.height=H;const cc=cell.getContext('2d'),m=V.createAvatarMotion(facing);
    const eq={...DEFAULT_EQUIPMENT,...look,outfit,weapon,upgrade:0};
    const walking=pose==='walk';let distance=0;
    for(let f=0;f<40;f++){cc.clearRect(0,0,W,H);
     // ground line
     cc.fillStyle='#5b3d2a';cc.fillRect(0,H-22,W,22);
     const step=walking?(f<39?1.1:1.1+extra*0):0;distance+=step;
     V.drawAvatar(cc,eq,W/2,H-22,170,1000+f*16,walking,facing,true,m,{combat:true,pose,angle:50,power:60,poseTime:pose==='fire'?extra:100,movementDistance:walking?(f===39?extra*40:1.1):0});}
    c.fillStyle='#ffffff10';c.fillRect(120+col*W,y,W-4,H-4);c.drawImage(cell,120+col*W,y);
   });
  }});
  // Crawl motion: sample a crawl cycle and record how the silhouette moves.
  const probe=document.createElement('canvas');probe.width=probe.height=260;const pc=probe.getContext('2d',{willReadFrequently:true});
  for(const outfit of outfits){const m=V.createAvatarMotion(1),eq={...DEFAULT_EQUIPMENT,outfit,hat:'hat-none'},frames=[];
   for(let f=0;f<48;f++){pc.clearRect(0,0,260,260);V.drawAvatar(pc,eq,130,240,170,1000+f*16,true,1,true,m,{combat:true,pose:'walk',movementDistance:1.2});const d=pc.getImageData(0,0,260,260).data;let top=260,sum=0;for(let i=3;i<d.length;i+=4)if(d[i]>20){const yy=Math.floor(i/4/260);top=Math.min(top,yy);sum+=yy;}frames.push({top,hash:sum});}
   const tops=frames.map(f=>f.top),hashes=new Set(frames.map(f=>f.hash));metrics.push({outfit,heightMin:240-Math.max(...tops),heightMax:240-Math.min(...tops),distinctFrames:hashes.size});}
  document.body.replaceChildren(sheet);sheet.id='prone-sheet';
  return {outfits,metrics};
 });
 await page.locator('#prone-sheet').screenshot({path:`${output}/prone-sheet.png`});
 await writeFile(`${output}/report.json`,JSON.stringify({...report,errors},null,2));
 console.log(JSON.stringify({...report,errors},null,2));
}finally{await browser.close();await server.close();}
