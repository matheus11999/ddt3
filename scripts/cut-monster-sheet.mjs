import {chromium} from '@playwright/test';
import {transformWithEsbuild} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

// Cuts the expedition art painted by Codex on magenta (docs/expeditions.md):
//  - a creature's 2x2 sheet (left to right, top to bottom) into one horizontal 4-frame strip. Every frame
//    shares the same size and baseline. Walking frames are centred on the body's mass, so the two steps
//    do not slide back and forth and the creature stands on its own x; the attack frames (and the queen)
//    are pinned by the back (the side opposite to where it faces), so a lunge or a drawn bow reaches forward;
//  - the arrow + icons sheet into the arrow and the dock button;
//  - the cover and the room banner into webp.
// Usage: node scripts/cut-monster-sheet.mjs [--src=public/assets/expeditions/anthill/source]
// Optional: BROWSER_EXECUTABLE=/path/to/chromium.
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const src=arg('src')??'public/assets/expeditions/anthill/source',out='public/assets/expeditions/anthill';
const CREATURES=[
 {sheet:'10-formiga-operaria.png',file:'ant-worker.png',faces:1,walks:true,height:240},
 {sheet:'11-formiga-soldado.png',file:'ant-soldier.png',faces:1,walks:true,height:260},
 {sheet:'12-formiga-guerreira.png',file:'ant-brute.png',faces:1,walks:true,height:300},
 {sheet:'13-rainha.png',file:'ant-queen.png',faces:-1,height:420},
];
const builder=(await transformWithEsbuild(await readFile('shared/mapBuilder.ts','utf8'),'mapBuilder.ts',{loader:'ts',format:'iife',globalName:'MapBuilder'})).code;
const dataUrl=async path=>`data:image/png;base64,${(await readFile(path)).toString('base64')}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const files={};
try{
 const page=await browser.newPage();await page.addScriptTag({content:builder});
 Object.assign(files,await page.evaluate(async({creatures,icons,cover,banner})=>{
  const B=window.MapBuilder,files={};
  const encode=(c,type='image/png',quality)=>c.toDataURL(type,quality).split(',')[1];
  // Alpha islands of a keyed canvas, each with its box and centre; specks are dropped.
  function islands(c){
   const W=c.width,H=c.height,px=c.getContext('2d').getImageData(0,0,W,H).data,label=new Int32Array(W*H).fill(-1),stack=new Int32Array(W*H),list=[];
   for(let start=0;start<W*H;start++){
    if(label[start]>=0||px[start*4+3]<=40)continue;
    const isle={x0:W,y0:H,x1:-1,y1:-1,sx:0,sy:0,n:0,id:list.length};let top=0;stack[top++]=start;label[start]=isle.id;
    while(top){const i=stack[--top],x=i%W,y=(i-x)/W;isle.n++;isle.sx+=x;isle.sy+=y;if(x<isle.x0)isle.x0=x;if(x>isle.x1)isle.x1=x;if(y<isle.y0)isle.y0=y;if(y>isle.y1)isle.y1=y;
     for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1])if(j>=0&&label[j]<0&&px[j*4+3]>40){label[j]=isle.id;stack[top++]=j;}}
    list.push(isle);
   }
   return {list:list.filter(i=>i.n>=40),label,W,H};
  }
  // The pixels of the given islands only, cropped to their box.
  function crop(c,found,group){
   const ids=new Set(group.map(i=>i.id)),x0=Math.min(...group.map(i=>i.x0)),y0=Math.min(...group.map(i=>i.y0)),x1=Math.max(...group.map(i=>i.x1)),y1=Math.max(...group.map(i=>i.y1));
   const w=x1-x0+1,h=y1-y0+1,src=c.getContext('2d').getImageData(x0,y0,w,h),dst=new ImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(ids.has(found.label[(y0+y)*found.W+x0+x]))for(let k=0;k<4;k++)dst.data[(y*w+x)*4+k]=src.data[(y*w+x)*4+k];
   const out=B.canvas(w,h);out.getContext('2d').putImageData(dst,0,0);return {canvas:out,x0,y0,x1,y1,w,h};
  }
  // Each island goes to the grid cell holding its centre (bites and bows may cross the lines).
  const cells=(found,cols,rows)=>Array.from({length:cols*rows},(_,n)=>found.list.filter(i=>Math.min(cols-1,Math.floor(i.sx/i.n/(found.W/cols)))+Math.min(rows-1,Math.floor(i.sy/i.n/(found.H/rows)))*cols===n));
  for(const creature of creatures){
   const {sc}=B.unkey(await B.loadImage(creature.data)),found=islands(sc);
   const frames=cells(found,2,2).map(group=>{
    // The body is the biggest island; its feet set the baseline. Swooshes and sparkles ride along.
    const body=group.reduce((a,b)=>b.n>a.n?b:a),part=crop(sc,found,group);
    return {...part,feet:body.y1-part.y0,back:creature.faces===1?body.x0-part.x0:body.x1-part.x0,mass:body.sx/body.n-part.x0};
   });
   // Anchor of each frame, drawn at the frame's centre: the body's centre of mass for the walk (frames 0 and 1);
   // for the attack frames, the back plus walk A's distance from back to centre. The queen keeps her back.
   frames.forEach((f,n)=>{f.anchor=!creature.walks?f.back:n<2?f.mass:f.back+(frames[0].mass-frames[0].back);});
   const above=Math.max(...frames.map(f=>f.feet)),below=Math.max(...frames.map(f=>f.h-f.feet));
   const half=Math.max(...frames.map(f=>Math.max(f.anchor,f.w-f.anchor)));
   const fw=creature.walks?half*2+8:Math.max(...frames.map(f=>f.anchor))+Math.max(...frames.map(f=>f.w-f.anchor))+8,fh=above+below+6,scale=creature.height/fh,cw=Math.round(fw*scale),ch=creature.height;
   const strip=B.canvas(cw*4,ch),g=strip.getContext('2d');g.imageSmoothingQuality='high';
   const origin=creature.walks?4+half:4+Math.max(...frames.map(f=>f.anchor));
   frames.forEach((f,n)=>g.drawImage(f.canvas,n*cw+(origin-f.anchor)*scale,(3+above-f.feet)*scale,f.w*scale,f.h*scale));
   files[creature.file]=encode(strip);files[creature.file+'.feet']=String(((3+above)/fh).toFixed(3));
  }
  {const {sc}=B.unkey(await B.loadImage(icons)),found=islands(sc),[top,,left,right]=cells(found,2,2),upper=found.list.filter(i=>i.sy/i.n<found.H/2);
   const square=(part,size)=>{const c=B.canvas(size,size),g=c.getContext('2d'),side=Math.max(part.w,part.h)/.92,s=size/side;g.imageSmoothingQuality='high';g.drawImage(part.canvas,(size-part.w*s)/2,(size-part.h*s)/2,part.w*s,part.h*s);return c;};
   const arrow=crop(sc,found,upper),aw=256,ac=B.canvas(aw,Math.round(arrow.h*aw/arrow.w)),ag=ac.getContext('2d');ag.imageSmoothingQuality='high';ag.drawImage(arrow.canvas,0,0,ac.width,ac.height);
   files['arrow.png']=encode(ac);files['expedition-button.png']=encode(square(crop(sc,found,left),256));files['royal-chest.png']=encode(square(crop(sc,found,right),256));void top;}
  const resized=async(data,w,h)=>{const image=await B.loadImage(data),c=B.canvas(w,h),g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(image,0,0,w,h);return encode(c,'image/webp',.88);};
  files['cover.webp']=await resized(cover,768,512);files['room-banner.webp']=await resized(banner,768,1152);
  return files;
 },{creatures:await Promise.all(CREATURES.map(async c=>({...c,data:await dataUrl(`${src}/${c.sheet}`)}))),icons:await dataUrl(`${src}/14-flecha-e-icone.png`),cover:await dataUrl(`${src}/02-formigueiro-capa.png`),banner:await dataUrl(`${src}/01-sala-banner.png`)}));
}finally{await browser.close();}

const target=name=>name==='expedition-button.png'?'public/assets/ui/expedition-button.png':name==='room-banner.webp'?'public/assets/expeditions/room-banner.webp':`${out}/${name}`;
for(const [name,data] of Object.entries(files)){
 if(name.endsWith('.feet')){console.log(`${name.replace('.feet','')}: feet ${data}`);continue;}
 const path=target(name);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(data,'base64'));console.log(`gravado ${path}`);
}
