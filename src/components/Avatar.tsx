import {useEffect,useRef} from 'react';
import type {Equipment} from '../../shared/catalog';
import {createAvatarMotion,drawAvatar,drawAvatarPortrait} from '../game/avatar';
import type {AvatarContext,AvatarPose} from '../game/avatar';
export function Avatar({equipment,size=210,weapon=true,walking=false,facing=1,pose='idle',angle=45,power=50,slope=0,showAura=false,animated=true,auraAnimated=false,portrait=false,weaponOffset=0,centerBody=false,weaponSide=1,weaponScale=1,weaponVerticalOffset=0,groundedShadow=false,view}:{view?:'side'|'front';equipment:Equipment;size?:number;weapon?:boolean;walking?:boolean;facing?:1|-1;pose?:AvatarPose;angle?:number;power?:number;slope?:number;showAura?:boolean;animated?:boolean;auraAnimated?:boolean;portrait?:boolean;weaponOffset?:number;centerBody?:boolean;weaponSide?:1|-1;weaponScale?:number;weaponVerticalOffset?:number;groundedShadow?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),redraw=useRef<()=>void>(()=>{}),equipmentRef=useRef(equipment),walkingRef=useRef(walking),facingRef=useRef(facing),contextRef=useRef<AvatarContext>({});equipmentRef.current=equipment;walkingRef.current=walking;facingRef.current=facing;contextRef.current={view,pose,angle,power,slope,showAura,animated,auraAnimated,weaponOffset,weaponSide,weaponScale,weaponVerticalOffset,groundedShadow};
 const continuous=!portrait&&(animated||auraAnimated&&showAura&&(equipment.upgrade??0)>=5);
 useEffect(()=>{
  let frame=0,ratio=1;
  const el=canvas.current!,c=el.getContext('2d')!,motion=createAvatarMotion(facingRef.current);
  const updateResolution=()=>{
   // The tiny HUD portrait benefits from supersampling even on a 1x screen.
   // Include the game's CSS scale without enlarging the visible head or its rig.
   const displayScale=portrait?Math.max(1,el.getBoundingClientRect().width/size):1;
   const density=window.devicePixelRatio||1;
   const requested=portrait?Math.min(4,Math.max(2,density*displayScale)):Math.min(2,density);
   const pixels=Math.round(size*requested);ratio=pixels/size;
   if(el.width!==pixels||el.height!==pixels){el.width=pixels;el.height=pixels;}
   c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  };
  const draw=(t:number)=>{
   frame=0;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,size,size);
   if(portrait)drawAvatarPortrait(c,equipmentRef.current,0,0,size,facingRef.current,view);
   else drawAvatar(c,equipmentRef.current,size/2-(centerBody?0:weaponSide*weaponOffset*size*.74/320),size*.94,size*.74,t,walkingRef.current,facingRef.current,weapon,motion,contextRef.current);
   if(continuous)frame=requestAnimationFrame(draw);
  };
  // Still portraits only redraw when their equipment or loaded artwork changes.
  // An initial draw alone can run before the rig's lazy image dependencies exist.
  const requestDraw=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const resize=()=>{updateResolution();requestDraw();};
  redraw.current=requestDraw;
  if(!continuous)window.addEventListener('brasa-art-loaded',requestDraw);
  const observer=portrait?new ResizeObserver(resize):undefined;
  observer?.observe(el);window.addEventListener('resize',resize);
  resize();
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('brasa-art-loaded',requestDraw);redraw.current=()=>{};};
 },[size,weapon,continuous,portrait,weaponOffset,centerBody,weaponSide]);
 useEffect(()=>{if(!continuous)redraw.current();},[equipment,view,walking,facing,pose,angle,power,slope,showAura,animated,auraAnimated,continuous,portrait,weaponOffset,weaponSide,weaponScale,weaponVerticalOffset,groundedShadow]);
 return <canvas ref={canvas} style={{width:size,height:size}} aria-label={portrait?'Retrato do personagem':animated?'Prévia animada do personagem':'Prévia do personagem'}/>;
}
