import type {MatchLoading} from '../../shared/protocol';
import {WEAPONS} from '../../shared/catalog';
import {preloadEnvironment} from './environment';
import {preloadMonsters} from './monsters';
import {appearanceImages} from './appearance';
import {headwearImages} from './headwear';
import {petImages,drawPet} from './petSprite';
import {tombstoneImage} from './tombstone';
import {drawAvatar} from './avatar';
import {preloadWeaponEffects} from './weaponEffects';
import {aimImages} from './aimIndicator';
import {preloadTerrainMarks} from './terrainResidues';
import {preloadConsumables,preloadItemUse} from './consumableEffects';

/**
 * What the loading screen waits for (docs/loading-screen.md): only what this battle draws. The map's
 * paintings, the fighters as they appear lying down (outfit combat atlas, head, hair, hat, weapon, pet),
 * their weapons' effects, Enfurecer and Gelo, the aim art, the tombstone, and the monsters only in an expedition. Everything is decoded
 * before the battle opens, so its first frames have no hitch.
 */
const MIN_MS=1200;
function settle(image:HTMLImageElement):Promise<void>{
 const decoded=()=>image.decode().then(()=>undefined,()=>undefined);
 if(image.complete)return image.naturalWidth?decoded():Promise.resolve();
 return new Promise(resolve=>{const done=()=>{image.removeEventListener('load',done);image.removeEventListener('error',done);resolve(decoded());};image.addEventListener('load',done);image.addEventListener('error',done);});
}
/** Draws every fighter once off screen: each part asks for its file, which is then awaited. Repeated because a loaded atlas can ask for more (hair under a hat, the pet's sheet). */
async function warmFighters(loading:MatchLoading){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
 for(let round=0;round<3;round++){
  for(const player of loading.players){
   c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,256,256);
   try{drawAvatar(c,player.equipment,128,200,96,0,false,1,true,undefined,{combat:true});drawPet(c,player.equipment.pet,90,200,96,1,0);}catch{}
  }
  const pending=[...appearanceImages(),...headwearImages(),...petImages()].filter(image=>!image.complete);
  await Promise.all([...appearanceImages(),...headwearImages(),...petImages()].map(settle));
  if(!pending.length&&round>0)break;
 }
}
/** Loads the battle, calling `progress` (0-100) as each part finishes; resolves once all is ready. */
export async function preloadBattle(loading:MatchLoading,progress:(percent:number)=>void){
 const started=performance.now();
 const effects=new Set(loading.players.flatMap(player=>WEAPONS.filter(weapon=>weapon.id===player.equipment.weapon).map(weapon=>weapon.effect)));
 const tasks:[number,()=>Promise<unknown>][]=[
  [5,()=>preloadEnvironment(loading.map)],
  [3,()=>warmFighters(loading)],
  [1,()=>preloadWeaponEffects([...effects])],
  // The ground marks of each fighter's weapon at its level (normal and POW): they are composed in impact order, so a late file would hold the later marks back.
  [1,()=>preloadTerrainMarks(loading.players.map(player=>({weapon:player.equipment.weapon,upgrade:player.equipment.upgrade})))],
  [1,()=>settle(tombstoneImage()!)],
  [1,()=>Promise.all([...preloadConsumables(),...preloadItemUse()].map(settle))],
  [1,()=>Promise.all(aimImages().map(settle))],
  ...loading.kind==='expedition'?[[2,()=>Promise.all(preloadMonsters().map(settle))] as [number,()=>Promise<unknown>]]:[],
 ];
 const total=tasks.reduce((sum,[weight])=>sum+weight,0);let done=0;
 // The bar never reaches 100 before MIN_MS: the versus screen stays long enough to be read.
 const report=()=>progress(Math.min(99,Math.floor(done/total*99*Math.min(1,(performance.now()-started)/MIN_MS))));
 const timer=setInterval(report,150);
 await Promise.all(tasks.map(([weight,run])=>run().catch(()=>undefined).then(()=>{done+=weight;report();})));
 const wait=MIN_MS-(performance.now()-started);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
 clearInterval(timer);progress(100);
}
