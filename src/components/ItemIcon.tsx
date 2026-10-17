import {useEffect,useId,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {CATALOG,isEmptyItem,weaponAssetPath,weaponIconPath,weaponVisualStage} from '../../shared/catalog';
import {getFacePortrait,getOutfitPortrait,getAccessoryPortrait,PAINTED_ACCESSORIES} from '../game/appearance';
import {FACE_REGISTRATION} from '../game/faces';
import {getWornHatPortrait,hasWornHat} from '../game/headwear';
import {getCostumePortrait} from '../game/costumes';

/** The icon and equipped face share the same composited painting and registration. */
function FaceIcon({id,size}:{id:string;size:number}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const c=ref.current!.getContext('2d')!;
  const draw=()=>{c.clearRect(0,0,160,160);const face=getFacePortrait(id)??getFacePortrait('face-brave');if(face)c.drawImage(face,...FACE_REGISTRATION.headRect,10,11,140,139);};
  draw();window.addEventListener('brasa-art-loaded',draw);return()=>window.removeEventListener('brasa-art-loaded',draw);
 },[id]);
 return <canvas className="item-art" ref={ref} width={160} height={160} style={{width:size,height:size}} role="img" aria-label={CATALOG[id].name}/>;
}

/** Complete outfit icons are composed from the exact equipped body painting. */
function OutfitIcon({id,size,accessory=false,headwear=false,costume=false}:{id:string;size:number;accessory?:boolean;headwear?:boolean;costume?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const c=ref.current!.getContext('2d')!;
  const draw=()=>{c.clearRect(0,0,160,160);const outfit=costume?getCostumePortrait(id):headwear?getWornHatPortrait(id):accessory?getAccessoryPortrait(id):getOutfitPortrait(id);if(outfit){const scale=Math.min(144/outfit.width,148/outfit.height);c.drawImage(outfit,(160-outfit.width*scale)/2,(160-outfit.height*scale)/2,outfit.width*scale,outfit.height*scale);}};
  draw();window.addEventListener('brasa-art-loaded',draw);return()=>window.removeEventListener('brasa-art-loaded',draw);
 },[id,accessory,headwear,costume]);
 return <canvas className="item-art" ref={ref} width={160} height={160} style={{width:size,height:size}} role="img" aria-label={CATALOG[id].name}/>;
}

/** Original item illustrations. Rarity chrome belongs to ItemCard. */
export function ItemIcon({id,size=60,upgrade=0}:{id:string;size?:number;upgrade?:number}){
 const uid=useId().replace(/[^a-zA-Z0-9]/g,'');const [missing,setMissing]=useState<readonly string[]>([]);
 const item=CATALOG[id];if(!item||isEmptyItem(item))return null;
 if(item.slot==='costume')return <OutfitIcon id={id} size={size} costume/>;
 if(item.slot==='face')return <FaceIcon id={id} size={size}/>;
 if(hasWornHat(id))return <OutfitIcon id={id} size={size} headwear/>;
 if(PAINTED_ACCESSORIES[id])return <OutfitIcon id={id} size={size} accessory/>;
 if(item.slot==='outfit')return <OutfitIcon id={id} size={size}/>;
 // Body and hair atlases include registration whitespace for the avatar. The bag uses dedicated illustrations.
 // Weapons show their DDTank-style icon, then the held art while the icon is not painted yet.
 const asset=item.slot==='weapon'?[weaponIconPath(id,upgrade),weaponAssetPath(id,upgrade)].find(path=>!missing.includes(path)):item.slot==='hair'?undefined:item.visual?.asset??(id==='hat-cap'||id==='hat-mage'?`/assets/${id}.png`:undefined);
 if(asset&&!missing.includes(asset))return <img className={`item-art ${item.slot==='weapon'?`weapon-tier-${weaponVisualStage(upgrade)}`:''}`} data-weapon-super={item.slot==='weapon'&&upgrade>=9||undefined} src={asset} alt={item.name} draggable={false} onError={()=>setMissing(list=>[...list,asset])} style={{width:size,height:size}}/>;
 const g=`item-${uid}`,paint=`url(#${g}-body)`,metal=`url(#${g}-metal)`,glass=`url(#${g}-glass)`,variant=item.visual?.variant??id;
 let art:ReactNode;
 if(variant==='none')art=<><ellipse cx="40" cy="67" rx="24" ry="5" fill="#132d3333"/><circle cx="40" cy="37" r="24" fill="#a9b7b326" stroke="#d6dbcb" strokeWidth="2"/><path d="M27 37h26" stroke="#cdd2c3" strokeWidth="5" strokeLinecap="round"/><path d="M24 23q12-10 25-3" fill="none" stroke="#fff9d5" strokeWidth="2" opacity=".65"/></>;
 else switch(item.slot){
  case 'hair':art=<><ellipse cx="40" cy="69" rx="24" ry="4" fill="#17263633"/><path d={variant==='wavy'?'M14 61Q1 48 12 31-1 18 20 14q3-12 22-7 22-6 27 17 15 18-1 29 11 20-9 21-13-7-9-26-7-1-9-10-6 12-16 12 7 20-11 11Z':'m11 59 1-22-8 1 10-15-6-9 18 1L33 4l8 9L56 5l-1 12 16-4-4 14 9 12-9 1-3 24-12-16-10-9-11 12-7-10-13 18Z'} fill={paint} stroke={id==='hair-silver'?'#6e6d86':'#57372e'} strokeWidth="2"/><path d="M20 28q10-15 21-10M46 18q13 4 16 15M18 44q4-10 12-14m17-4q5 12 13 18" stroke={id==='hair-silver'?'#f9f1e8':'#e7bb77'} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".7"/></>;break;
  case 'glasses':art=<><path d="m8 32-4-4m68 4 4-4M33 37q7-5 14 0" stroke="#eed79d" strokeWidth="4" strokeLinecap="round"/>{variant==='pilot'?<><path d="M9 29q9-7 23 1v17q-10 19-22 0Z" fill={glass} stroke={metal} strokeWidth="4"/><path d="M48 30q14-8 23-1l-1 18q-12 19-22 0Z" fill={glass} stroke={metal} strokeWidth="4"/></>:<><circle cx="21" cy="40" r="16" fill={glass} stroke={metal} strokeWidth="4"/><circle cx="59" cy="40" r="16" fill={glass} stroke={metal} strokeWidth="4"/></>}<path d="m12 38 11-8m28 8 11-8" stroke="#f2ffff" strokeWidth="3" strokeLinecap="round" opacity=".8"/><path d="m17 44 8-6m30 6 8-6" stroke="#f2ffff" strokeWidth="1.5" opacity=".6"/></>;break;
  case 'hat':art=id==='hat-mage'?<><path d="M22 54 36 10q18-5 16 12L60 54" fill={paint} stroke="#e0b574" strokeWidth="2"/><ellipse cx="40" cy="56" rx="30" ry="10" fill={paint} stroke="#e0b574" strokeWidth="2"/><path d="m41 24 3 7 8 1-6 5 1 8-6-4-7 4 2-8-6-5 8-1Z" fill="#ffe6a6"/><path d="m31 47 25-2" stroke="#d9bb70" strokeWidth="5"/></>:id==='hat-pilot'?<><path d="M8 34q32-17 64 0v18H8Z" fill="#835332"/><circle cx="24" cy="41" r="16" fill={metal} stroke="#714826" strokeWidth="3"/><circle cx="56" cy="41" r="16" fill={metal} stroke="#714826" strokeWidth="3"/><circle cx="24" cy="41" r="11" fill={glass}/><circle cx="56" cy="41" r="11" fill={glass}/><path d="m16 41 9-7m22 7 9-7" stroke="#d0faff" strokeWidth="3"/></>:id==='hat-cap'?<><path d="M12 47q1-28 28-29t27 30Z" fill={paint} stroke="#6e5138" strokeWidth="2"/><path d="M14 46q40-8 56 5-9 18-55 7Z" fill={metal} stroke="#6e5138" strokeWidth="2"/><path d="M42 19v26M19 44q4-21 19-22" stroke="#fff0ba" strokeWidth="2" opacity=".6"/></>:<><path d="M14 61V35Q14 12 40 12T66 35v26L52 48H28Z" fill={metal} stroke="#d4d6b6" strokeWidth="2"/><path d="M35 17Q27-3 52 6L44 18" fill="#d67465"/><path d="M32 36h16v24H32Z" fill="#546774"/><path d="M36 39v17m8-17v17" stroke="#d1e9de" strokeWidth="3"/><path d="M22 28q9-11 21-8" stroke="#ffffdd" strokeWidth="3" fill="none" opacity=".7"/></>;break;
  case 'wristband':
  case 'bracelet':art=<><ellipse cx="40" cy="69" rx="28" ry="5" fill="#2d203229"/><ellipse cx="40" cy="42" rx="27" ry="23" fill="none" stroke="#70503c" strokeWidth="13"/><ellipse cx="40" cy="40" rx="27" ry="23" fill="none" stroke={variant==='sun'?metal:paint} strokeWidth="10"/>{variant==='braid'?<><path d="M15 31q8-8 12-11m-13 21 9-10m-7 21 9-9m-2 18 9-9m2 13 7-9m5 8 5-11m6 6 3-13m5 1-3-14m-1-7-10-6" stroke="#ebc794" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M17 26q-11 27 17 37" stroke="#fff0c7" strokeWidth="1.5" fill="none" opacity=".6"/></>:<><path d="M15 29q6-13 20-13M45 61q13-2 18-13" fill="none" stroke="#fff4cb" strokeWidth="3" strokeLinecap="round"/><path d="m40 10 4 5 6-2 1 7 6 3-4 5 1 7-7 1-4 5-5-5-7 1-1-7-5-4 4-5-1-6 7-1Z" fill={metal} stroke="#98703e" strokeWidth="1.5"/><circle cx="40" cy="25" r="8" fill={paint} stroke="#fff2be" strokeWidth="2"/><path d="m37 20 5-2-4 7-4 1Z" fill="#fff2c4" opacity=".8"/></>}</>;break;
  case 'ring':art=<><ellipse cx="40" cy="71" rx="22" ry="4" fill="#2d203229"/><ellipse cx="40" cy="49" rx="21" ry="17" fill="none" stroke="#6b4a2c" strokeWidth="11"/><ellipse cx="40" cy="47" rx="21" ry="17" fill="none" stroke={metal} strokeWidth="8"/><path d="M24 40q4-7 11-9" fill="none" stroke="#fffbe6" strokeWidth="2.5" strokeLinecap="round" opacity=".8"/><path d="m40 9 12 9-4 13H32l-4-13Z" fill={glass} stroke="#6b4a2c" strokeWidth="2.5" strokeLinejoin="round"/><path d="m40 9 4 9-4 13-4-13Z" fill="#fff" opacity=".45"/><path d="M28 18h24" stroke="#fff" strokeWidth="1.5" opacity=".5"/><path d="m59 12 1.5 3.5 3.5 1.5-3.5 1.5L59 22l-1.5-3.5L54 17l3.5-1.5Z" fill="#fff8d0"/></>;break;
  case 'necklace':art=<><path d="M14 10q2 30 26 36 24-6 26-36" fill="none" stroke="#6b4a2c" strokeWidth="6" strokeLinecap="round"/><path d="M14 10q2 30 26 36 24-6 26-36" fill="none" stroke={metal} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 5.5"/><circle cx="40" cy="46" r="4" fill={metal} stroke="#6b4a2c" strokeWidth="2"/><path d="m40 48 6.5 9.5 11 2.5-7.5 8.5 1 11.5L40 75l-11 5 1-11.5-7.5-8.5 11-2.5Z" transform="translate(0 -4) scale(1 .92)" fill={paint} stroke="#6b4a2c" strokeWidth="2.5" strokeLinejoin="round"/><path d="m40 52 3 5 5 1-3.5 3.5" fill="none" stroke="#fffbe0" strokeWidth="2" strokeLinecap="round" opacity=".85"/><path d="m63 52 1.5 3.5 3.5 1.5-3.5 1.5L63 62l-1.5-3.5L58 57l3.5-1.5Z" fill="#fff8d0"/></>;break;
  case 'bubble':art=<><ellipse cx="40" cy="72" rx="22" ry="4" fill="#2d203229"/><path d="M18 50q-12-3-10-15 1-11 13-11 3-12 16-11 10-8 21 0 14 0 14 13 9 7 3 17-5 8-16 7-9 7-20 2-5 3-11 1l-12 9 3-9Z" fill={paint} stroke="#2c5a86" strokeWidth="3" strokeLinejoin="round"/><path d="M20 30q2-7 10-7m14-5q6-3 11 1" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8"/><circle cx="30" cy="40" r="3.5" fill="#2c5a86"/><circle cx="42" cy="40" r="3.5" fill="#2c5a86"/><circle cx="54" cy="40" r="3.5" fill="#2c5a86"/></>;break;
  default:art=<path d="m20 50 27-29 15 15-27 29H20Z" fill={paint} stroke="#edc786" strokeWidth="2"/>;
 }
 return <svg className="item-illustration" viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={item.name}><defs><linearGradient id={`${g}-body`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff0cc"/><stop offset=".23" stopColor={item.color}/><stop offset=".7" stopColor={item.color}/><stop offset="1" stopColor="#493743"/></linearGradient><linearGradient id={`${g}-metal`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#fff6d6"/><stop offset=".33" stopColor="#e8c78c"/><stop offset=".55" stopColor="#b18a56"/><stop offset="1" stopColor="#ece0b9"/></linearGradient><linearGradient id={`${g}-glass`} x2="1" y2="1"><stop stopColor="#e8fcf7" stopOpacity=".85"/><stop offset=".4" stopColor={item.color} stopOpacity=".8"/><stop offset="1" stopColor="#32667f" stopOpacity=".8"/></linearGradient><radialGradient id={`${g}-iris`} cx=".4" cy=".7"><stop stopColor="#fff0b7"/><stop offset=".45" stopColor={item.color}/><stop offset="1" stopColor="#4d3547"/></radialGradient><radialGradient id={`${g}-skin`} cx=".4" cy=".3"><stop stopColor="#fff0d4"/><stop offset="1" stopColor="#e9ba91"/></radialGradient></defs><g style={{filter:'drop-shadow(0 2px 1px #1b233740)'}}>{art}</g></svg>;
}
