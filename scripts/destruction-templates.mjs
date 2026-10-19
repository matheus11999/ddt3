// Templates técnicos das marcas de destruição (docs/weapon-kit.md, "Destruição"): um por arma e modo, no quadro
// 1024×1024 da pintura. Magenta = buraco que o jogo recorta (mesma forma de CRATER_MASKS, centrada no pivô),
// ciano = faixa onde a borda pintada pode aparecer, cruz = pivô (ponto de impacto). Também grava measures.json
// com medidas, pivôs e o hash da máscara física compilada de cada perfil.
// Uso: node scripts/destruction-templates.mjs  (CHROME_PATH opcional)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';

const out='docs/destruction-templates';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const chrome=process.env.CHROME_PATH??(existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?'/opt/pw-browsers/chromium-1194/chrome-linux/chrome':undefined);
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
try{
 const page=await browser.newPage();
 await page.route('**/__templates.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}));
 await page.goto(new URL('/__templates.html',server.resolvedUrls.local[0]).href);
 const result=await page.evaluate(async()=>{
  const {CRATER_MASKS,craterMask}=await import('/shared/physics.ts'),{destructionProfiles,MARK_ART}=await import('/shared/destruction.ts');
  const digest=async bits=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bits))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const templates={},measures=[];
  for(const profile of destructionProfiles().values()){
   const mask=craterMask(profile.mask,profile.radius),scale=MARK_ART.width/profile.mark.world,R=profile.radius*scale,outer=.97/(2*profile.radius/profile.mark.world);
   const shape=CRATER_MASKS[profile.mask];
   measures.push({id:profile.id,weapon:profile.weapon,mode:profile.mode,stage:profile.stage,mask:profile.mask,radius:profile.radius,
    physical:{width:mask.width,height:mask.height,pivot:[mask.pivotX,mask.pivotY],cut:mask.bits.reduce((a,b)=>a+b,0),sha256:await digest(mask.bits)},
    mark:{file:profile.mark.src,art:[MARK_ART.width,MARK_ART.height],pivot:[MARK_ART.pivotX,MARK_ART.pivotY],world:profile.mark.world,artPerWorld:Math.round(scale*1000)/1000,
     holeInArt:[Math.round(2*R),Math.round(2*R*shape.height)],bandOuterInArt:[Math.round(2*R*outer),Math.round(2*R*shape.height*outer)]}});
   const key=`${profile.weapon}-${profile.mode}`;if(templates[key])continue;
   const canvas=new OffscreenCanvas(MARK_ART.width,MARK_ART.height),c=canvas.getContext('2d'),image=c.createImageData(MARK_ART.width,MARK_ART.height),d=image.data;
   for(let y=0;y<MARK_ART.height;y++)for(let x=0;x<MARK_ART.width;x++){
    const u=(x+.5-MARK_ART.pivotX)/R,v=(y+.5-MARK_ART.pivotY)/R,i=(y*MARK_ART.width+x)*4;
    if(shape.inside(u,v)){d[i]=255;d[i+1]=0;d[i+2]=255;d[i+3]=255;}
    else if(shape.inside(u/outer,v/outer)){d[i]=40;d[i+1]=200;d[i+2]=230;d[i+3]=150;}
   }
   c.putImageData(image,0,0);
   // Pivot cross and the hole's outline, so the edge to paint against is unmistakable.
   c.strokeStyle='#000';c.lineWidth=3;c.beginPath();c.moveTo(MARK_ART.pivotX-40,MARK_ART.pivotY);c.lineTo(MARK_ART.pivotX+40,MARK_ART.pivotY);c.moveTo(MARK_ART.pivotX,MARK_ART.pivotY-40);c.lineTo(MARK_ART.pivotX,MARK_ART.pivotY+40);c.stroke();
   const blob=await canvas.convertToBlob({type:'image/png'});templates[key]=btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  }
  return {templates,measures};
 });
 for(const [key,data] of Object.entries(result.templates))await writeFile(`${out}/${key}.png`,Buffer.from(data,'base64'));
 await writeFile(`${out}/measures.json`,JSON.stringify(result.measures,null,1)+'\n');
 console.log(`${Object.keys(result.templates).length} templates e ${result.measures.length} perfis em ${out}/`);
}finally{await browser.close();await server.close();}
