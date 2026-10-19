import {recolorItem} from './recolor';
import type {Equipment} from '../../shared/catalog';
import {cutRegion,drawPinned} from './rig/draw';
import {COSMETIC_MANIFEST,coversHair} from './rig/manifest';
import type {ArtRegion} from './rig/manifest';

export type HeadwearProfile='covered'|'open';
/** Wearing art is registered to the scalp through its manifest pin, independently from shop icon bounds. */
const wornRegion=(id:string):ArtRegion|undefined=>{const manifest=COSMETIC_MANIFEST[id];return manifest?.slot==='hat'?manifest.worn:undefined;};
const atlases=new Map<string,HTMLImageElement>();
const atlasFor=(path:string)=>{let image=atlases.get(path);if(!image){image=new Image();image.src=path;image.onload=()=>window.dispatchEvent(new Event('brasa-art-loaded'));atlases.set(path,image);}return image;};
export const headwearImages=()=>atlases.values();
if(typeof window!=='undefined')for(const manifest of Object.values(COSMETIC_MANIFEST))if(manifest.slot==='hat'&&manifest.worn)atlasFor(manifest.worn.atlas);
const ready=(image:HTMLImageElement)=>image.complete&&image.naturalWidth>0;
const portraits=new Map<string,HTMLCanvasElement>();

export const hasWornHat=(id:string):boolean=>!!wornRegion(id);
/** The hat cut from its atlas, in its ticket color when it has one. */
export function getWornHatPortrait(id:string,color?:string):HTMLCanvasElement|null {
 const region=wornRegion(id);if(!region)return null;const atlas=atlasFor(region.atlas);if(!ready(atlas))return null;
 const key=`${id}:${color??''}`;let portrait=portraits.get(key);
 if(!portrait){portrait=cutRegion(atlas,region);recolorItem(portrait,id,color);portraits.set(key,portrait);if(portraits.size>48)portraits.delete(portraits.keys().next().value!);}
 return portrait;
}

export function getHeadwearProfile(eq:Equipment):HeadwearProfile {
 return coversHair(COSMETIC_MANIFEST[eq.hat]?.profile)?'covered':'open';
}

/** True means the painted hat owns this item, including while its image loads. */
export function drawWornHat(c:CanvasRenderingContext2D,eq:Equipment):boolean {
 const region=wornRegion(eq.hat);if(!region)return false;
 const color=eq.colors?.hat;if(!color){const atlas=atlasFor(region.atlas);if(ready(atlas))drawPinned(c,atlas,region);return true;}
 const art=getWornHatPortrait(eq.hat,color);if(art)drawPinned(c,art,region,true);
 return true;
}
