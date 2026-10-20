import type {Equipment} from '../../shared/catalog';
import {asset} from './appearance';
import {recolorItem,tintSkin} from './recolor';
import contract from './rig/walkFrames.json';
import atlases from './walkAtlas.json';
import idleAtlases from './idleAtlas.json';
import {freeAll,freeSurface} from './spriteCache';

/** DDTank-style lobby walk (docs/walk-frames.md): the outfit's painted walk cycle, hands included, picked by
 * the distance walked; the universal head goes on top where each painting expects it. */
interface WalkAtlasEntry {path:string;standing:[number,number];frames:{head:[number,number]}[];}
const ATLASES=atlases as unknown as Record<string,WalkAtlasEntry>;
/** The standing (idle) painting from the same Codex pass and scale as the walk sheet (scripts/build-walk-atlas.py --idle),
 * so the outfit does not change when the character starts or stops walking. */
const IDLE=idleAtlases as unknown as Record<string,WalkAtlasEntry>;
const {columns,cell:[cw,ch],origin:[ox,oy],pixelsPerUnit:ppu}=contract.atlas;
const tinted=new Map<string,HTMLCanvasElement>();

export const hasWalkFrames=(outfit:string)=>!!ATLASES[outfit];
export const hasIdleFrames=(outfit:string)=>!!IDLE[outfit];
/** The outfit's walk atlas with its Color Ticket and the body color applied, or null while it loads. */
function walkAtlas(eq:Equipment,sheets:Record<string,WalkAtlasEntry>=ATLASES):HTMLCanvasElement|null {
 const entry=sheets[eq.outfit];if(!entry)return null;
 const image=asset(entry.path);if(!image.complete||!image.naturalWidth)return null;
 const key=`${entry.path}:${eq.colors?.outfit??''}:${eq.skin??''}`,known=tinted.get(key);if(known)return known;
 const out=document.createElement('canvas');out.width=image.naturalWidth;out.height=image.naturalHeight;out.getContext('2d')!.drawImage(image,0,0);
 recolorItem(out,eq.outfit,eq.colors?.outfit);tintSkin(out,eq.skin,true);
 tinted.set(key,out);if(tinted.size>24){const oldest=tinted.keys().next().value!;freeSurface(tinted.get(oldest));tinted.delete(oldest);}return out;
}
/** The tinted walk sheets are for the plaza and the Pescaria: let go while a battle covers them. */
export function releaseWalkBodies(){freeAll(tinted);}
/** Frame for a distance walked in avatar units: each painting holds for `frameUnits`, so the feet never slide. */
export const walkFrameIndex=(distance:number)=>{const n=contract.frames.length;return ((Math.floor(distance/contract.frameUnits)%n)+n)%n;};
/** Draws the walking body facing right in avatar units from the contact point and returns how far the head
 * moves from where the standing avatar wears it, or null when the outfit has no walk atlas (yet). */
export function drawWalkBody(c:CanvasRenderingContext2D,eq:Equipment,distance:number):[number,number]|null {
 const atlas=walkAtlas(eq),entry=ATLASES[eq.outfit];if(!atlas||!entry)return null;
 const index=walkFrameIndex(distance),sx=(index%columns)*cw,sy=Math.floor(index/columns)*ch,head=entry.frames[index].head;
 c.drawImage(atlas,sx,sy,cw,ch,-ox/ppu,-oy/ppu,cw/ppu,ch/ppu);
 return [head[0]-entry.standing[0],head[1]-entry.standing[1]];
}
/** Draws the outfit's painted idle pose like a walk frame (frame 0 of the idle sheet); returns the head shift or null. */
export function drawIdleBody(c:CanvasRenderingContext2D,eq:Equipment):[number,number]|null {
 const atlas=walkAtlas(eq,IDLE),entry=IDLE[eq.outfit];if(!atlas||!entry)return null;
 c.drawImage(atlas,0,0,cw,ch,-ox/ppu,-oy/ppu,cw/ppu,ch/ppu);
 const head=entry.frames[0].head;return [head[0]-entry.standing[0],head[1]-entry.standing[1]];
}
