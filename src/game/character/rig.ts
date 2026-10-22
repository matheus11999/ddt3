import type {Equipment} from '../../../shared/catalog';
import {CATALOG} from '../../../shared/catalog';
import {asset} from '../appearance';
import {tintSkin} from '../recolor';
import {drawCell,freeAll} from '../spriteCache';
import index from './rigIndex.json';
import {cellRect,gameFrame,GAME,SHOW,showFrame,VIRTUAL,virtualFrame} from './composer';
import type {RigContext} from './composer';

/**
 * Rig v2 in the game (docs/rig-v2.md): which painted sheets a look uses in each context, composed once per look and
 * cut per frame. A look uses rig v2 only when every visible piece has rig art for that context; otherwise the old
 * renderer draws it (until the old cosmetics are removed).
 *
 * Sheets live in public/assets/rig/<sex>/<context>/<item>.png (hair: <item>-A, cut under a hat by <hat>-clip), listed in
 * rigIndex.json by scripts/rig/publish.py. Sizes in avatar units (the 160-unit figure): GAME_UNIT etc. below.
 */
type Sex='m'|'f';
const INDEX=index as unknown as Record<Sex,Partial<Record<'game'|'show'|'virtual'|'virtualhead',string[]>>>;
/** Avatar units per sheet pixel in each context (sheets at 4x the DDTank grid). The bag figure and the plaza figure are
 * as tall as the old front view (matheus, 22/10: the first rig v2 figures were too small); the bag figure 18% taller again (matheus, 22/10). */
export const RIG_UNITS={game:.5,show:.18,virtual:.34};
/** Where the feet are in a cell (sheet pixels): the drawing origin. */
// The bag figure is painted left of the cell middle: its feet origin sits under the figure so it is centered (matheus 22/10).
const FEET={game:GAME.origin as number[],show:[402,1220],virtual:[256,670]};

const sexOf=(eq:Equipment):Sex=>CATALOG[eq.outfit]?.gender==='female'||CATALOG[eq.face]?.gender==='female'?'f':'m';
const has=(sex:Sex,context:keyof (typeof INDEX)['m'],id:string)=>INDEX[sex]?.[context]?.includes(id)??false;
function visibleHat(eq:Equipment){return eq.visibility?.hat===false?'hat-none':eq.hat;}
function visibleGlasses(eq:Equipment){return eq.visibility?.glasses===false?'glasses-none':eq.glasses;}
/** Hair sheet A without a hat. Under a hat, the hair's B sheet (painted once per hair, pressed flat on the bald head, like
 * DDTank's variant B; matheus 22/10 after the code cut left edges and bald spots); a hair without B is still A cut by the
 * hat's clip sheet. */
function hairKey(eq:Equipment,context:'game'|'show'|'virtualhead'):string {
 return visibleHat(eq)!=='hat-none'&&has(sexOf(eq),context,`${eq.hair}-B`)?`${eq.hair}-B`:`${eq.hair}-A`;
}

/** The layers of a context in DDTank's painting order, or null when some visible piece has no rig art there. */
function pieces(eq:Equipment,context:'game'|'show'|'virtualhead'):string[]|null {
 const sex=sexOf(eq),hat=visibleHat(eq),glasses=visibleGlasses(eq);
 if(eq.costume!=='costume-none'&&eq.visibility?.costume!==false)return null;
 const list=[eq.face,hairKey(eq,context),...(context==='virtualhead'?[]:[eq.outfit]),...(hat!=='hat-none'?[hat]:[]),...(glasses!=='glasses-none'?[glasses]:[])];
 return list.every(id=>has(sex,context,id))?list:null;
}
/** Rig v2 per sex. Off for both on 22/10 (matheus rejected the first rig art); back on for the male kit repainted on the
 * DDTank molds by the Codex MCP (kit v5, docs/codex-mcp.md). The female sheets are still the rejected ones. */
const RIG_SEXES:readonly Sex[]=['m'];
export const RIG_ENABLED=RIG_SEXES.length>0;
export function hasRig(eq:Equipment,context:RigContext):boolean {
 if(!RIG_SEXES.includes(sexOf(eq)))return false;
 if(context==='virtual')return !!pieces(eq,'virtualhead')&&has(sexOf(eq),'virtual',eq.outfit);
 return !!pieces(eq,context);
}

const ready=(image:HTMLImageElement)=>image.complete&&image.naturalWidth>0;
const sheet=(sex:Sex,context:string,id:string)=>asset(`/assets/rig/${sex}/${context}/${id}.png`);
const composed=new Map<string,HTMLCanvasElement>();
/** Stacks the sheets of a list of pieces into one canvas (body color applied to faces and outfits), cached per look. */
function stack(sex:Sex,context:string,ids:string[],skin:string|undefined):HTMLCanvasElement|null {
 const key=[sex,context,skin??'',...ids].join('|'),known=composed.get(key);if(known)return known;
 // Under a hat the hair is cut by the hat's clip sheet (scripts/rig/hatclip.py): the hat, above it and above its band.
 const hat=ids.find(id=>id.startsWith('hat-')),clip=hat?sheet(sex,context,`${hat}-clip`):null;
 const images=ids.map(id=>sheet(sex,context,id));if(!images.every(ready)||clip&&!ready(clip))return null;
 const out=document.createElement('canvas');out.width=images[0].naturalWidth;out.height=images[0].naturalHeight;const c=out.getContext('2d')!;
 const layer=(image:HTMLImageElement)=>{const t=document.createElement('canvas');t.width=image.naturalWidth;t.height=image.naturalHeight;t.getContext('2d')!.drawImage(image,0,0);return t;};
 ids.forEach((id,i)=>{const image=images[i];
  if(skin&&(id.startsWith('face-')||id.startsWith('outfit-'))){const t=layer(image);tintSkin(t,skin,true);c.drawImage(t,0,0);}
  else if(clip&&id.startsWith('hair-')&&!id.endsWith('-B')){const t=layer(image),tc=t.getContext('2d')!;tc.globalCompositeOperation='destination-out';tc.drawImage(clip,0,0);c.drawImage(t,0,0);}
  else c.drawImage(image,0,0);});
 composed.set(key,out);if(composed.size>48){const oldest=composed.keys().next().value!;composed.delete(oldest);}
 return out;
}

/** Combat cell at the character origin (feet), facing right, in avatar units. False while the art loads. */
export function drawRigGame(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number):boolean {
 const ids=pieces(eq,'game');if(!ids)return false;const sex=sexOf(eq);
 // Weapon and face follow the lower sequence, every other piece the upper one (GameCharacter's faceDown/faceUp).
 const lower=stack(sex,'game',ids.slice(0,1),eq.skin),upper=stack(sex,'game',ids.slice(1),eq.skin);if(!lower||!upper)return false;
 const f=gameFrame(action,tick),[w,h]=GAME.cell,k=RIG_UNITS.game,[ox,oy]=FEET.game;
 for(const [layer,frame] of [[lower,f.lower],[upper,f.upper]] as const){const r=cellRect(frame,GAME.columns,GAME.rows,GAME.cell);drawCell(c,layer,r.x,r.y,w,h,-ox*k,-oy*k,w*k,h*k);}
 return true;
}
/** Bag/shop/room figure with its feet at (0,0), facing right, in avatar units. False while the art loads. */
export function drawRigShow(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number):boolean {
 const ids=pieces(eq,'show');if(!ids)return false;const sex=sexOf(eq);
 const face=stack(sex,'show',ids.slice(0,1),eq.skin),rest=stack(sex,'show',ids.slice(1),eq.skin);if(!face||!rest)return false;
 const [w,h]=SHOW.cell,k=RIG_UNITS.show,[ox,oy]=FEET.show,cell=showFrame(action,tick);
 // The figure is painted facing left (DDTank's bag); mirror it so 'facing right' means right like everywhere else.
 c.save();c.scale(-1,1);
 drawCell(c,face,Math.min(cell,Math.floor(face.width/w)-1)*w,0,w,h,-ox*k,-oy*k,w*k,h*k);
 drawCell(c,rest,0,0,w,h,-ox*k,-oy*k,w*k,h*k);c.restore();
 return true;
}
/** Plaza/Pescaria figure with its feet at (0,0), in avatar units. `back` walks away from the viewer. */
export function drawRigVirtual(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number):boolean {
 const ids=pieces(eq,'virtualhead');if(!ids||!has(sexOf(eq),'virtual',eq.outfit))return false;const sex=sexOf(eq);
 const head=stack(sex,'virtualhead',ids,eq.skin),body=stack(sex,'virtual',[eq.outfit],eq.skin);if(!head||!body)return false;
 const frame=virtualFrame(action,tick),[w,h]=VIRTUAL.cell,k=RIG_UNITS.virtual,[ox,oy]=FEET.virtual,back=frame>=8,blink=frame===7;
 const col=blink?0:back?frame-8:frame,row=back?1:0,headCell=back?2:blink?1:0,dy=(VIRTUAL.headOffsets[col]??0)*k;
 const paintBody=()=>drawCell(c,body,col*w,row*h,w,h,-ox*k,-oy*k,w*k,h*k),paintHead=()=>drawCell(c,head,headCell*w,0,w,h,-ox*k,-oy*k+dy,w*k,h*k);
 // The front cells are painted turned to the left (DDTank's naturalWalkFront), the back ones walking away to the right:
 // mirror the front so 'facing right' walks right in both (8 directions = front/back x mirror, matheus 22/10).
 c.save();if(!back)c.scale(-1,1);
 if(back){paintBody();paintHead();}else{paintHead();paintBody();}
 c.restore();
 return true;
}
const heads=new Map<string,[number,number,number,number]>();
/** Where the head is in a cell of a stacked head sheet (its opaque box), measured once per look. */
function headBox(layer:HTMLCanvasElement,key:string,x0:number,w:number,h:number):[number,number,number,number] {
 const known=heads.get(key);if(known)return known;
 const data=layer.getContext('2d')!.getImageData(x0,0,w,h).data;let l=w,t=h,r=0,b=0;
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2)if(data[(y*w+x)*4+3]>40){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
 const box:[number,number,number,number]=r>l?[x0+l,t,r-l+2,b-t+2]:[x0,0,w,h];heads.set(key,box);return box;
}
/** HUD and list portrait: the rig head alone (face, hair, hat, glasses), framed square in (x, y, size). 'side' is the
 * battle head (combat cell 0, turned 3/4 like DDTank), otherwise the front head of the plaza. False while it loads. */
export function drawRigPortrait(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,size:number,facing:number,view?:'side'|'front'):boolean {
 const context=view==='side'?'game':'virtualhead',ids=pieces(eq,context);if(!ids)return false;
 const sex=sexOf(eq),list=ids.filter(id=>!id.startsWith('outfit-')),layer=stack(sex,context,list,eq.skin);if(!layer)return false;
 const [w,h]=context==='game'?GAME.cell:VIRTUAL.cell,[bx,by,bw,bh]=headBox(layer,[sex,context,...list].join('|'),0,w,h);
 // The battle head faces right; the plaza front head is painted turned left (mirrored like the plaza figure).
 const flip=(context==='game'?1:-1)*(facing<0?-1:1),k=size*.96/Math.max(bw,bh);
 c.save();c.translate(x+size/2,y+size/2);c.scale(flip*k,k);c.drawImage(layer,bx,by,bw,bh,-bw/2,-bh/2,bw,bh);c.restore();
 return true;
}
/** Rig sheets are for the area on screen: let go when it changes (spriteCache rules, docs/performance.md). */
export function releaseRigArt(){freeAll(composed);heads.clear();}
