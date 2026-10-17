import {useEffect,useRef} from 'react';
import type {Equipment} from '../../shared/catalog';
import {createAvatarMotion,drawAvatar} from '../game/avatar';
import type {AvatarContext,AvatarPose} from '../game/avatar';
export function Avatar({equipment,size=210,weapon=true,walking=false,facing=1,pose='idle',angle=45,power=50,slope=0,showAura=false}:{equipment:Equipment;size?:number;weapon?:boolean;walking?:boolean;facing?:1|-1;pose?:AvatarPose;angle?:number;power?:number;slope?:number;showAura?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),equipmentRef=useRef(equipment),walkingRef=useRef(walking),facingRef=useRef(facing),contextRef=useRef<AvatarContext>({});equipmentRef.current=equipment;walkingRef.current=walking;facingRef.current=facing;contextRef.current={pose,angle,power,slope,showAura};
 useEffect(()=>{let frame=0;const el=canvas.current!,c=el.getContext('2d')!,motion=createAvatarMotion(facingRef.current),ratio=Math.min(2,window.devicePixelRatio||1);el.width=Math.round(size*ratio);el.height=Math.round(size*ratio);const draw=(t:number)=>{c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,size,size);drawAvatar(c,equipmentRef.current,size/2,size*.94,size*.74,t,walkingRef.current,facingRef.current,weapon,motion,contextRef.current);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[size,weapon]);
 return <canvas ref={canvas} style={{width:size,height:size}} aria-label="Prévia animada do personagem"/>;
}
