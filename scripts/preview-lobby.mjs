// Prévia da Praça Celeste sem servidor do jogo: desenha o lobby (camadas de parallax, piso, estações) com a câmera em vários pontos.
// Uso: com o Vite ligado (npx vite --port 5177), node scripts/preview-lobby.mjs  (BASE_URL, OUT, CAMS e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/lobby-preview';
const cams=(process.env.CAMS??'0,768,1536,2304,3072').split(',').map(Number);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1536,height:864}});
 await page.goto(`${base}/admin`);
 const shots=await page.evaluate(async cams=>{
  const {LobbyWorld,LOBBY_W,LOBBY_H}=await import('/src/game/lobbyWorld.ts');
  const world=new LobbyWorld(2),canvas=document.createElement('canvas');canvas.width=LOBBY_W*2;canvas.height=LOBBY_H*2;const c=canvas.getContext('2d');
  const draw=(cam,t)=>{c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,LOBBY_W,LOBBY_H);c.save();c.translate(-cam,0);world.drawBack(c,t,cam);
   for(const sprite of world.sprites(t,null).sort((a,b)=>a.y-b.y))sprite.draw(c);world.drawFront(c,t,null);c.restore();world.drawOverlay(c,t);};
  // Let every image load (layers, floor, stations) before drawing.
  for(let i=0;i<60;i++){draw(0,0);await new Promise(r=>setTimeout(r,250));if([...document.images].length===0&&i>8)break;}
  await new Promise(r=>setTimeout(r,3000));
  const out=cams.map(cam=>{draw(cam,4000);return canvas.toDataURL('image/png');});
  const whole=document.createElement('canvas');whole.width=4608;whole.height=864;const w=whole.getContext('2d');world.drawWhole(w,4000);
  for(const sprite of world.sprites(4000,null).sort((a,b)=>a.y-b.y))sprite.draw(w);world.drawFront(w,4000,null);
  return {cams:out,whole:whole.toDataURL('image/png')};
 },cams);
 for(const [n,data] of shots.cams.entries())await writeFile(`${output}/cam-${cams[n]}.png`,Buffer.from(data.split(',')[1],'base64'));
 await writeFile(`${output}/whole.png`,Buffer.from(shots.whole.split(',')[1],'base64'));
 console.log(`Prévia em ${output}/cam-*.png e whole.png`);
}finally{await browser.close();}
