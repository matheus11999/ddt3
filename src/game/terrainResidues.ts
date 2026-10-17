import {WORLD} from '../../shared/physics';
import type {TerrainMark} from '../../shared/protocol';

/** Cosmetic world-space decals. The mask follows authoritative surviving cells. */
export class TerrainResidues {
 private marks=new Map<string,TerrainMark>();
 private canvas=document.createElement('canvas');
 private mask=document.createElement('canvas');
 private art=new Image();
 private rubble=new Image();
 private dirty=true;
 private snapshotSignature='';
 constructor(terrain:Uint8Array){
  this.canvas.width=WORLD.width;this.canvas.height=WORLD.height;
  this.mask.width=WORLD.cols;this.mask.height=WORLD.rows;
  this.art.onload=()=>{this.dirty=true;};this.art.src='/assets/vfx/terrain-residues.png';
  this.rubble.onload=()=>{this.dirty=true;};this.rubble.src='/assets/vfx/brick-residue.png';
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
 draw(c:CanvasRenderingContext2D){
  if(!this.art.complete||!this.art.naturalWidth)return;
  if(this.dirty){
   const paint=this.canvas.getContext('2d')!,cellW=this.art.naturalWidth/2,cellH=this.art.naturalHeight/2;
   paint.clearRect(0,0,WORLD.width,WORLD.height);paint.imageSmoothingEnabled=true;paint.imageSmoothingQuality='high';
   for(const mark of this.marks.values()){
    const cell=mark.effect==='fire'?0:mark.effect==='electric'?1:mark.effect==='crystal'?2:3,size=Math.max(56,mark.radius*4.3);
    paint.save();paint.translate(mark.x,mark.y);paint.rotate((mark.x*.017+mark.y*.011)%6.283);paint.globalAlpha=mark.effect==='dynamite'||mark.effect==='brick'?.82:.68;
    if(mark.effect==='brick'){if(this.rubble.naturalWidth)paint.drawImage(this.rubble,-size/2,-size/2,size,size);}
    else paint.drawImage(this.art,cell%2*cellW,Math.floor(cell/2)*cellH,cellW,cellH,-size/2,-size/2,size,size);paint.restore();
   }
   paint.globalCompositeOperation='destination-in';paint.drawImage(this.mask,0,0,WORLD.width,WORLD.height);paint.globalCompositeOperation='source-over';this.dirty=false;
  }
  c.drawImage(this.canvas,0,0);
 }
}
