import {terrainCols,terrainTemplate,WORLD} from '../../shared/physics';
import type {MapId} from '../../shared/maps';
import type {TerrainMark} from '../../shared/protocol';
import {WEAPONS} from '../../shared/catalog';
import {destructionProfile,destructionProfileById} from '../../shared/destruction';
import type {DestructionProfile} from '../../shared/destruction';
import {weaponTerrainPath} from '../../shared/weaponKit';
import {keepVisibleMarks,terrainMarkBox} from '../../shared/terrainMarks';
import {freeAll,freeSurface,imageReady,visibleArea} from './spriteCache';

/** Same mark, same shape on every client and after a reload. */
function seeded(seed:number){let state=Math.floor(Math.abs(seed))%2147483646+1;return ()=>(state=state*16807%2147483647)/2147483647;}
/** Where nothing breaks there is no hole to frame, so the shot leaves soot: overlapping soft blotches flattened
 * against the surface, a few burn streaks thrown outward and loose specks. Never a circle. */
function scorch(c:CanvasRenderingContext2D,mark:TerrainMark){
 const random=seeded(mark.x*73+mark.y*151),r=Math.max(14,mark.radius*1.2)*(mark.stretch??1)**.5,tilt=(random()-.5)*.5;
 c.save();c.translate(mark.x,mark.y);c.rotate(tilt);
 const blot=(x:number,y:number,radius:number,alpha:number)=>{const g=c.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,`rgba(38,22,14,${alpha})`);g.addColorStop(.55,`rgba(52,32,20,${alpha*.6})`);g.addColorStop(1,'rgba(60,38,24,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,radius,0,6.283);c.fill();};
 for(let n=0,count=6+Math.floor(random()*4);n<count;n++){const a=random()*6.283,d=r*.75*Math.sqrt(random());blot(Math.cos(a)*d*1.25,Math.sin(a)*d*.6,r*(.35+random()*.35),.32+random()*.18);}
 blot(0,0,r*.55,.45);
 // Burn streaks: tapered, uneven lengths, mostly sideways along the surface.
 c.fillStyle='rgba(40,24,16,.34)';
 for(let n=0,count=5+Math.floor(random()*4);n<count;n++){
  const a=n/count*6.283+(random()-.5)*.7,length=r*(.9+random()*.9),width=r*(.08+random()*.08),cos=Math.cos(a),sin=Math.sin(a)*.62;
  c.beginPath();c.moveTo(-sin*width,cos*width*.62);c.quadraticCurveTo(cos*length*.6+sin*width*.4,sin*length*.6,cos*length,sin*length);c.quadraticCurveTo(cos*length*.6-sin*width*.4,sin*length*.6,sin*width,-cos*width*.62);c.closePath();c.fill();
 }
 for(let n=0;n<7;n++){const a=random()*6.283,d=r*(1+random()*.7);c.fillStyle=`rgba(36,22,14,${.25+random()*.25})`;c.beginPath();c.ellipse(Math.cos(a)*d*1.2,Math.sin(a)*d*.6,1+random()*2,1+random()*1.4,a,0,6.283);c.fill();}
 c.restore();
}

/** Mark paintings shared by every battle: loaded once, `null` once a file failed (that mark is then skipped, the hole is unaffected). */
const art=new Map<string,HTMLImageElement|null>();
function markImage(src:string){
 if(art.has(src))return art.get(src)!;
 const image=new Image();image.decoding='async';image.onerror=()=>art.set(src,null);image.src=src;art.set(src,image);return image;
}
/** The painting a mark uses: its profile's when approved; the weapon's legacy terrain.png on purpose while the
 * profile is not painted yet, and for marks saved before profiles existed (picked by effect, as they were). */
function profileSource(profile:DestructionProfile){return profile.painted?{src:profile.mark.src,legacy:false}:{src:weaponTerrainPath(profile.weapon),legacy:true};}
function markSource(mark:TerrainMark,profile:DestructionProfile|undefined):{src:string;legacy:boolean}|undefined{
 if(profile)return profileSource(profile);
 const weapon=WEAPONS.find(item=>item.effect===mark.effect);return weapon?{src:weaponTerrainPath(weapon.id),legacy:true}:undefined;
}
/** Starts loading the marks a battle can leave: each fighter's weapon at its level, normal and POW. */
/** The ground marks' paintings are battle-only: let go when the battle ends (the next one warms its own). */
export function releaseTerrainMarks(){freeAll(art);}
export function preloadTerrainMarks(weapons:readonly {weapon:string;upgrade:number}[]):Promise<unknown>{
 const images=weapons.flatMap(({weapon,upgrade})=>[false,true].map(powered=>destructionProfile(weapon,upgrade,powered))).flatMap(profile=>profile?[markImage(profileSource(profile).src)]:[]);
 return Promise.all([...new Set(images)].filter((image):image is HTMLImageElement=>!!image).map(image=>image.decode().catch(()=>undefined)));
}

/**
 * World-space marks left by impacts, composed like DDTank's craterBrink (docs/weapon-kit.md, "Destruição"):
 * marks are painted into one accumulated layer in the order the impacts happened, each clipped by the ground
 * that survived it (destructible ground only; soot also lands on unbreakable ground), and every later hole erases
 * the paint where it removed ground. Only the pixels that changed are touched. Rebuilding from the ordered history
 * on the final terrain gives the same picture (each mark ∩ the ground left at the end), which is how a reconnect,
 * a snapshot that restores ground or a painting that loads late is handled.
 */
export class TerrainResidues {
 private marks:TerrainMark[]=[];private ids=new Set<string>();
 /** marks[0..drawn) are in the layer; the next one waits for its painting. */
 private drawn=0;
 /** The box (canvas px) that holds paint; null while the layer is empty. */
 private area:{x0:number;y0:number;x1:number;y1:number}|null=null;
 private canvas=document.createElement('canvas');
 private scratch=document.createElement('canvas');
 private terrain:Uint8Array;private cols:number;
 constructor(terrain:Uint8Array,private map:MapId){
  this.cols=terrainCols(terrain);this.canvas.width=this.cols*WORLD.cell;this.canvas.height=WORLD.height;this.terrain=terrain.slice();
 }
 setTerrain(terrain:Uint8Array){
  const before=this.terrain,cols=this.cols;this.terrain=terrain.slice();
  if(before.length!==terrain.length){this.rebuild();return;}
  let minX=cols,minY=WORLD.rows,maxX=-1,maxY=-1;
  for(let i=0;i<terrain.length;i++)if(before[i]!==terrain[i]){
   // Ground that comes back (a resync) cannot be un-erased: repaint the whole history on it.
   if(terrain[i]){this.rebuild();return;}
   const x=i%cols,y=(i-x)/cols;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  }
  if(maxX<0)return;
  // The new holes take the paint with them.
  const w=maxX-minX+1,h=maxY-minY+1,c=this.canvas.getContext('2d')!,hole=new ImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(minY+y)*cols+minX+x;if(before[i]&&!terrain[i])hole.data[(y*w+x)*4+3]=255;}
  const k=WORLD.cell,patch=this.patch(w,h);patch.getContext('2d')!.putImageData(hole,0,0);
  c.save();c.globalCompositeOperation='destination-out';c.imageSmoothingEnabled=false;c.drawImage(patch,0,0,w,h,minX*k,minY*k,w*k,h*k);c.restore();
 }
 add(mark:TerrainMark){
  if(this.ids.has(mark.id))return;
  this.marks.push(mark);this.ids.add(mark.id);this.prune();
 }
 /** Same bound as the server: marks with nothing left to paint leave the history. They show nothing, so the layer stays as it is. */
 private prune(){
  const kept=new Set(keepVisibleMarks(this.marks,this.terrain,this.map));if(kept.size===this.marks.length)return;
  this.drawn-=this.marks.slice(0,this.drawn).filter(mark=>!kept.has(mark)).length;
  this.marks=this.marks.filter(mark=>kept.has(mark));this.ids=new Set(this.marks.map(mark=>mark.id));
 }
 /** The server's ordered history (full snapshots). Marks it adds after the ones known here are appended; any other difference repaints from it. */
 sync(marks:readonly TerrainMark[]|undefined){
  if(!marks)return;
  const known=marks.filter(mark=>this.ids.has(mark.id));
  if(known.length===this.marks.length&&known.every((mark,index)=>mark.id===this.marks[index].id)){for(const mark of marks)if(!this.ids.has(mark.id))this.add(mark);return;}
  // A local mark is missing from the server's list, or the order differs: the server is right.
  const missing=this.marks.filter(mark=>!marks.some(item=>item.id===mark.id));
  if(!missing.length&&known.length===marks.length)return;
  this.marks=[...marks];this.ids=new Set(marks.map(mark=>mark.id));this.rebuild();
 }
 /** Number of marks in the history (tests, perf probe). */
 get size(){return this.marks.length;}
 private rebuild(){this.drawn=0;this.area=null;this.canvas.getContext('2d')!.clearRect(0,0,this.canvas.width,this.canvas.height);}
 private patch(w:number,h:number){if(this.scratch.width<w)this.scratch.width=w;if(this.scratch.height<h)this.scratch.height=h;this.scratch.getContext('2d')!.clearRect(0,0,w,h);return this.scratch;}
 /** Paints marks in order until one waits for its painting. */
 private flush(){
  while(this.drawn<this.marks.length){const state=this.paint(this.marks[this.drawn]);if(state==='wait')return;this.drawn++;}
 }
 private paint(mark:TerrainMark):'done'|'wait'{
  const profile=mark.scorch?undefined:destructionProfileById(mark.profile),box=terrainMarkBox(mark),k=WORLD.cell;
  const left=Math.max(0,Math.floor(box.x/k)),top=Math.max(0,Math.floor(box.y/k)),right=Math.min(this.cols,Math.ceil((box.x+box.width)/k)),bottom=Math.min(WORLD.rows,Math.ceil((box.y+box.height)/k));
  if(right<=left||bottom<=top)return 'done';
  const w=right-left,h=bottom-top,buffer=document.createElement('canvas');buffer.width=w*k;buffer.height=h*k;const b=buffer.getContext('2d')!;
  b.imageSmoothingEnabled=true;b.imageSmoothingQuality='high';b.translate(-left*k,-top*k);
  if(mark.scorch)scorch(b,mark);
  else{
   const source=markSource(mark,profile);if(!source)return 'done';
   const image=markImage(source.src);if(!image)return 'done';
   if(!imageReady(image))return image.complete&&!image.naturalWidth?'done':'wait';
   if(source.legacy){
    // The pre-profile look, kept as is until the weapon's own paintings are approved.
    const size=Math.max(56,mark.radius*4.3);
    b.translate(mark.x,mark.y);b.rotate((mark.x*.017+mark.y*.011)%6.283);b.globalAlpha=.82;b.drawImage(image,-size/2,-size/2,size,size);
   }else{
    // Never rotated: the painting's pivot sits on the hole's anchor, scaled and stretched like the dig itself (CRATER_STRETCH).
    // Drawn straight from the decoded file (once per mark, never per frame), so a rebuild paints exactly the same pixels.
    b.drawImage(image,box.x,box.y,box.width,box.height);
   }
  }
  // Clip by the ground that is left (only breakable ground for a painted mark), then add it on top of the older marks.
  const template=terrainTemplate(this.map),onlyBreakable=!mark.scorch,keep=new ImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0,i=(top+y)*this.cols+left;x<w;x++,i++)if(this.terrain[i]&&(!onlyBreakable||template.definition[template.regions[i]]?.destructible))keep.data[(y*w+x)*4+3]=255;
  const patch=this.patch(w,h);patch.getContext('2d')!.putImageData(keep,0,0);
  b.setTransform(1,0,0,1,0,0);b.globalAlpha=1;b.globalCompositeOperation='destination-in';b.imageSmoothingEnabled=false;b.drawImage(patch,0,0,w,h,0,0,w*k,h*k);
  this.canvas.getContext('2d')!.drawImage(buffer,left*k,top*k);freeSurface(buffer);
  const a=this.area;this.area={x0:Math.min(a?.x0??Infinity,left*k),y0:Math.min(a?.y0??Infinity,top*k),x1:Math.max(a?.x1??-Infinity,right*k),y1:Math.max(a?.y1??-Infinity,bottom*k)};
  return 'done';
 }
 /** Only the painted part that is on screen: the layer is as wide as the map and mostly empty, so drawing it whole each frame cost as much as the terrain. */
 draw(c:CanvasRenderingContext2D){
  this.flush();const area=this.area;if(!area)return;
  const [vx0,vy0,vx1,vy1]=visibleArea(c),x=Math.max(area.x0,Math.floor(vx0)-2),y=Math.max(area.y0,Math.floor(vy0)-2),right=Math.min(area.x1,Math.ceil(vx1)+2),bottom=Math.min(area.y1,Math.ceil(vy1)+2);
  if(right<=x||bottom<=y)return;
  const quality=c.imageSmoothingQuality;c.imageSmoothingQuality='low';c.drawImage(this.canvas,x,y,right-x,bottom-y,x,y,right-x,bottom-y);c.imageSmoothingQuality=quality;
 }
 /** Gives the marks' canvases back at once when the battle ends. */
 dispose(){freeSurface(this.canvas);freeSurface(this.scratch);}
}
