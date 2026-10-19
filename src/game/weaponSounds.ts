import {WEAPONS} from '../../shared/catalog';
import type {WeaponEffect} from '../../shared/catalog';
import {weaponKit,weaponSoundPath} from '../../shared/weaponKit';
import type {WeaponSoundSlot} from '../../shared/weaponKit';
import {audio} from './audio';

// Unique recorded sounds declared in the weapon kit (shared/weaponKit.ts). A slot without its own file
// keeps the synthesized family sound from audio.ts, so every weapon always sounds like something.
// They play through the shared Web Audio context from decoded buffers: a fresh <audio> element per
// shot had to load the file again, started late and was silently refused by autoplay rules.
function soundFile(weaponId:string,slot:WeaponSoundSlot,powered:boolean){
 const kit=weaponKit(weaponId);
 if(powered&&kit?.powSounds?.includes(slot)){const pow=weaponSoundPath(weaponId,slot,true);if(audio.sampleState(pow)!=='missing')return pow;}
 return kit?.sounds?.includes(slot)?weaponSoundPath(weaponId,slot):null;
}
/** Every declared weapon file starts loading with the page, so the first shot of a match is heard. */
export function preloadWeaponSounds(){
 const urls:string[]=[];
 for(const weapon of WEAPONS){const kit=weaponKit(weapon.id);for(const slot of kit?.sounds??[])urls.push(weaponSoundPath(weapon.id,slot));for(const slot of kit?.powSounds??[])urls.push(weaponSoundPath(weapon.id,slot,true));}
 audio.preload(urls);
}
if(typeof document!=='undefined')preloadWeaponSounds();
/** Today every weapon has its own effect family, so the effect names the weapon. */
function weaponFor(effect:WeaponEffect){return WEAPONS.find(weapon=>weapon.effect===effect)?.id;}
/** Plays the weapon's own file; returns false when the caller should use the default sound. */
export function playWeaponSound(effect:WeaponEffect,slot:WeaponSoundSlot,powered=false):boolean {
 const id=weaponFor(effect),url=id?soundFile(id,slot,powered):null;
 if(!url)return false;
 return audio.playFile(url,powered?.9:.7);
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
