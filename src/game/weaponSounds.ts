import {WEAPONS} from '../../shared/catalog';
import type {WeaponEffect} from '../../shared/catalog';
import {weaponKit,weaponSoundPath} from '../../shared/weaponKit';
import type {WeaponSoundSlot} from '../../shared/weaponKit';
import {audio} from './audio';

// Unique recorded sounds declared in the weapon kit (shared/weaponKit.ts). A slot without its own file
// keeps the synthesized family sound from audio.ts, so every weapon always sounds like something.
const samples=new Map<string,HTMLAudioElement|null>();
function sample(weaponId:string,slot:WeaponSoundSlot,powered=false){
 const kit=weaponKit(weaponId),pow=powered&&!!kit?.powSounds?.includes(slot),key=`${weaponId}:${pow?'pow:':''}${slot}`;if(samples.has(key))return samples.get(key)!;
 const element=(pow||kit?.sounds?.includes(slot))&&typeof Audio!=='undefined'?new Audio(weaponSoundPath(weaponId,slot,pow)):null;
 if(element){element.preload='auto';element.addEventListener('error',()=>samples.set(key,null),{once:true});}
 samples.set(key,element);return element;
}
/** Today every weapon has its own effect family, so the effect names the weapon. */
function weaponFor(effect:WeaponEffect){return WEAPONS.find(weapon=>weapon.effect===effect)?.id;}
/** Plays the weapon's own file; returns false when the caller should use the default sound. */
export function playWeaponSound(effect:WeaponEffect,slot:WeaponSoundSlot,powered=false):boolean {
 const id=weaponFor(effect),element=id?(sample(id,slot,powered)||(powered?sample(id,slot):null)):null;
 if(!element)return false;
 if(!audio.enabled||document.hidden)return true;
 const voice=element.cloneNode(true) as HTMLAudioElement;voice.volume=powered?.9:.7;
 void voice.play().catch(()=>{});return true;
}
/** Shot launch: own fire (and flight) sound, else the synthesized default. */
export function playShotSound(effect:WeaponEffect,level:number,powered=false){
 if(!playWeaponSound(effect,'fire',powered))audio.play('shot',effect,level,powered);
 playWeaponSound(effect,'flight',powered);
}
/** Impact: own collision sound, else the default; terrain breaking only plays when it has its own file. */
export function playImpactSound(effect:WeaponEffect,level:number,powered=false,destroysTerrain=false){
 if(!playWeaponSound(effect,'impact',powered))audio.play('impact',effect,level,powered);
 if(destroysTerrain)playWeaponSound(effect,'terrain',powered);
}
