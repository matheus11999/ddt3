import {terrainCols,WORLD} from '../../shared/physics';
import type {TerrainMark} from '../../shared/protocol';
import {WEAPONS} from '../../shared/catalog';
import type {WeaponEffect} from '../../shared/catalog';
import {weaponTerrainPath} from '../../shared/weaponKit';

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

/** Cosmetic world-space decals. The mask follows authoritative surviving cells. */
export class TerrainResidues {
 private marks=new Map<string,TerrainMark>();
 private canvas=document.createElement('canvas');
 private mask=document.createElement('canvas');
 /** One painted mark per weapon (public/assets/weapons/<id>/terrain.png), loaded on first use. */
 private art=new Map<WeaponEffect,HTMLImageElement|null>();
 private dirty=true;
 private snapshotSignature='';
 constructor(terrain:Uint8Array){
  this.canvas.width=terrainCols(terrain)*WORLD.cell;this.canvas.height=WORLD.height;
  this.mask.width=terrainCols(terrain);this.mask.height=WORLD.rows;
  this.setTerrain(terrain);
 }
 setTerrain(terrain:Uint8Array){
  const c=this.mask.getContext('2d')!,pixels=c.createImageData(this.mask.width,WORLD.rows);
  for(let i=0;i<terrain.length;i++){pixels.data[i*4]=255;pixels.data[i*4+1]=255;pixels.data[i*4+2]=255;pixels.data[i*4+3]=terrain[i]?255:0;}
  c.putImageData(pixels,0,0);this.dirty=true;
 }
 add(mark:TerrainMark){
  if(this.marks.has(mark.id))return;
  this.marks.set(mark.id,mark);while(this.marks.size>48)this.marks.delete(this.marks.keys().next().value!);this.dirty=true;
 }
 sync(marks:readonly TerrainMark[]=[]){
  const signature=marks.map(mark=>mark.id).join('|');if(signature===this.snapshotSignature)return;
  this.snapshotSignature=signature;for(const mark of marks)this.add(mark);
 }
 private image(effect:WeaponEffect){
  if(this.art.has(effect))return this.art.get(effect)!;
  const weapon=WEAPONS.find(item=>item.effect===effect),image=weapon?new Image():null;
  if(image){image.onload=()=>{this.dirty=true;};image.onerror=()=>this.art.set(effect,null);image.src=weaponTerrainPath(weapon!.id);}
  this.art.set(effect,image);return image;
 }
 draw(c:CanvasRenderingContext2D){
  if(this.dirty){
   const paint=this.canvas.getContext('2d')!;
   paint.clearRect(0,0,this.canvas.width,WORLD.height);paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';
   for(const mark of this.marks.values()){
    if(mark.scorch){scorch(paint,mark);continue;}
    const art=this.image(mark.effect),size=Math.max(56,mark.radius*4.3);if(!art?.complete||!art.naturalWidth)continue;
    paint.save();paint.translate(mark.x,mark.y);paint.rotate((mark.x*.017+mark.y*.011)%6.283);paint.globalAlpha=.82;
    paint.drawImage(art,-size/2,-size/2,size,size);paint.restore();
   }
   paint.globalCompositeOperation='destination-in';paint.drawImage(this.mask,0,0,this.canvas.width,WORLD.height);paint.globalCompositeOperation='source-over';this.dirty=false;
  }
  c.drawImage(this.canvas,0,0);
 }
}
