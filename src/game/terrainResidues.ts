import {WORLD} from '../../shared/physics';
import type {TerrainMark} from '../../shared/protocol';
import {WEAPONS} from '../../shared/catalog';
import type {WeaponEffect} from '../../shared/catalog';
import {weaponTerrainPath} from '../../shared/weaponKit';

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
  this.canvas.width=WORLD.width;this.canvas.height=WORLD.height;
  this.mask.width=WORLD.cols;this.mask.height=WORLD.rows;
  this.setTerrain(terrain);
 }
 setTerrain(terrain:Uint8Array){
  const c=this.mask.getContext('2d')!,pixels=c.createImageData(WORLD.cols,WORLD.rows);
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
   paint.clearRect(0,0,WORLD.width,WORLD.height);paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';
   for(const mark of this.marks.values()){
    const art=this.image(mark.effect),size=Math.max(56,mark.radius*4.3);if(!art?.complete||!art.naturalWidth)continue;
    paint.save();paint.translate(mark.x,mark.y);paint.rotate((mark.x*.017+mark.y*.011)%6.283);paint.globalAlpha=.82;
    paint.drawImage(art,-size/2,-size/2,size,size);paint.restore();
   }
   paint.globalCompositeOperation='destination-in';paint.drawImage(this.mask,0,0,WORLD.width,WORLD.height);paint.globalCompositeOperation='source-over';this.dirty=false;
  }
  c.drawImage(this.canvas,0,0);
 }
}
