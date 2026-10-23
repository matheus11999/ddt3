import type {Equipment} from '../../../shared/catalog';
import {CATALOG} from '../../../shared/catalog';
import {asset} from '../appearance';
import {tintSkin} from '../recolor';
import {drawCell,freeAll} from '../spriteCache';
import index from './rigIndex.json';
import eyesIndex from './rigEyes.json';
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
 if(!list.every(id=>has(sex,context,id)))return null;
 return [...baseIds(sex,context),...list];
}
/** Single skin base (matheus 22/10, "era assim que eu queria desde o início"): bald head with no features, neck and body
 * painted as one piece per context; face (eyes, brows, mouth), hair and outfit only lie over it. `base-<sex>-head` is the
 * head part where heads are drawn apart (combat, plaza), `base-<sex>` the body (the whole figure in the bag). */
function baseIds(sex:Sex,context:string):string[] {
 const head=`base-${sex}-head`,body=`base-${sex}`;
 if(context==='show')return has(sex,'show',body)?[body]:[];
 if(context==='game')return [head,body].filter(id=>has(sex,'game',id));
 if(context==='virtualhead')return has(sex,'virtualhead',head)?[head]:[];
 return [];
}
const isBase=(id:string)=>id.startsWith('base-');
/** Rig v2 per sex. Off for both on 22/10 (matheus rejected the first rig art); back on for the male kit repainted on the
 * DDTank molds by the Codex MCP (kit v5, docs/codex-mcp.md). The female sheets are still the rejected ones. */
const RIG_SEXES:readonly Sex[]=['m','f'];
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
function stack(sex:Sex,context:string,ids:string[],skin:string|undefined,hatOver?:string):HTMLCanvasElement|null {
 const key=[sex,context,skin??'',hatOver??'',...ids].join('|'),known=composed.get(key);if(known)return known;
 // Under a hat the hair is cut by the hat's clip sheet (scripts/rig/hatclip.py): the hat, above it and above its band.
 const hat=hatOver??ids.find(id=>id.startsWith('hat-')),clip=hat?sheet(sex,context,`${hat}-clip`):null;
 const images=ids.map(id=>sheet(sex,context,id));if(!images.every(ready)||clip&&!ready(clip))return null;
 const out=document.createElement('canvas');out.width=images[0].naturalWidth;out.height=images[0].naturalHeight;const c=out.getContext('2d')!;
 const layer=(image:HTMLImageElement)=>{const t=document.createElement('canvas');t.width=image.naturalWidth;t.height=image.naturalHeight;t.getContext('2d')!.drawImage(image,0,0);return t;};
 ids.forEach((id,i)=>{const image=images[i];
  if(skin&&(id.startsWith('face-')||id.startsWith('outfit-')||isBase(id))){const t=layer(image);tintSkin(t,skin,true);c.drawImage(t,0,0);}
  else if(clip&&id.startsWith('hair-')&&!id.endsWith('-B')){const t=layer(image),tc=t.getContext('2d')!;tc.globalCompositeOperation='destination-out';tc.drawImage(clip,0,0);c.drawImage(t,0,0);}
  else c.drawImage(image,0,0);});
 composed.set(key,out);if(composed.size>48){const oldest=composed.keys().next().value!;composed.delete(oldest);}
 return out;
}

type Eye={box:[number,number,number,number];skin:[number,number,number]};
const EYES=eyesIndex as unknown as Record<string,Record<string,Record<string,(Eye[]|null)[]>>>;
const skinAt=new Map<string,string>();
/** Universal blink (matheus 22/10: one eye effect for every face): the eyes of each face cell are measured offline
 * (scripts/kit-v5/eyes.py -> rigEyes.json); closing one paints its box with the skin right under it, taken from the
 * stacked (tinted) face so any body color matches, and draws the lid across. Cell pixels, scaled by k from (sx, sy). */
function closeEyes(c:CanvasRenderingContext2D,layer:HTMLCanvasElement,sex:Sex,context:string,face:string,cell:number,cellX:number,cellY:number,sx:number,sy:number,k:number){
 // with a skin base the face sheet has no skin: the lid colour comes from the stacked head (base + face)
 const eyes=EYES[sex]?.[context]?.[face]?.[cell];if(!eyes)return;
 for(const {box:[x,y,w,h],skin} of eyes){
  const key=[sex,context,face,cell,x,y,layer.width].join('|');let fill=skinAt.get(key);
  if(!fill){
   // the cheek right under the eye: the brightest of a few points across it (one may land on an outline or shadow)
   const row=layer.getContext('2d')!.getImageData(cellX+Math.round(x),cellY+Math.min(layer.height-cellY-1,Math.round(y+h+Math.max(2,h/5))),Math.max(1,Math.round(w)),1).data;
   let best=-1,rgb=skin as number[];
   for(let i=Math.floor(w*.15);i<w*.85;i+=Math.max(1,Math.floor(w/8))){const o=i*4;if(row[o+3]>200){const l=row[o]+row[o+1]+row[o+2];if(l>best){best=l;rgb=[row[o],row[o+1],row[o+2]];}}}
   fill=`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;skinAt.set(key,fill);}
  const cx=sx+(x+w/2)*k,cy=sy+(y+h*.55)*k,rx=w*.5*k,ry=h*.42*k;
  c.save();c.fillStyle=fill;c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.fill();
  // the lid: a soft dark curve with a thicker middle, like a painted closed eye
  c.strokeStyle='rgba(58,32,24,.92)';c.lineCap='round';c.lineWidth=Math.max(1,h*.11*k);
  c.beginPath();c.moveTo(cx-rx*.92,cy-ry*.05);c.quadraticCurveTo(cx,cy+ry*.55,cx+rx*.92,cy-ry*.05);c.stroke();c.restore();
 }
}
/** Blink timing for idle heads: a short close every few seconds, not in sync between players (seeded by the look). */
export function blinking(time:number,seed=0):boolean {const p=(time+seed*997)%3600;return p<130;}
/** Head motion drawn in code over the combat cells (matheus 22/10: idle moves only the head; a hit shakes it). */
export type HeadMotion={tilt:number;dx:number;dy:number};
const pivots=new Map<string,[number,number]>();
/** The neck of a combat cell: bottom middle of the face layer there, measured once per look and cell. */
function neckOf(layer:HTMLCanvasElement,key:string,x0:number,y0:number,w:number,h:number):[number,number] {
 const known=pivots.get(key);if(known)return known;
 const data=layer.getContext('2d')!.getImageData(x0,y0,w,h).data;let l=w,r=0,b=0;
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2)if(data[(y*w+x)*4+3]>40){if(x<l)l=x;if(x>r)r=x;if(y>b)b=y;}
 const neck:[number,number]=r>l?[(l+r)/2,b]:[w/2,h/2];pivots.set(key,neck);return neck;
}
/** Combat cell at the character origin (feet), facing right, in avatar units. False while the art loads. The head
 * (face, hair, hat, glasses) is drawn apart from the outfit so `head` can tilt and nudge it about the neck. */
export function drawRigGame(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number,head?:HeadMotion,blink=false):boolean {
 const ids=pieces(eq,'game');if(!ids)return false;const sex=sexOf(eq);
 const hat=ids.find(id=>id.startsWith('hat-')),under=ids.filter(id=>id.endsWith('-head')&&isBase(id)||id.startsWith('face-')||id.startsWith('hair-'));
 const outfit=ids.filter(id=>isBase(id)&&!id.endsWith('-head')||id.startsWith('outfit-')),over=ids.filter(id=>id.startsWith('hat-')||id.startsWith('glasses-'));
 const headUnder=stack(sex,'game',under,eq.skin,hat),body=stack(sex,'game',outfit,eq.skin),headOver=over.length?stack(sex,'game',over,eq.skin):null;
 if(!headUnder||!body||over.length&&!headOver)return false;
 // Face and hair share the face's (lower) cell; the outfit follows the upper sequence (GameCharacter's faceDown/faceUp).
 const f=gameFrame(action,tick),[w,h]=GAME.cell,k=RIG_UNITS.game,[ox,oy]=FEET.game;
 const hr=cellRect(f.lower,GAME.columns,GAME.rows,GAME.cell),br=cellRect(f.upper,GAME.columns,GAME.rows,GAME.cell);
 const [nx,ny]=neckOf(headUnder,[sex,eq.face,f.lower].join('|'),hr.x,hr.y,w,h);
 const paintHead=(layer:HTMLCanvasElement)=>{c.save();
  if(head){const px=(nx-ox)*k,py=(ny-oy)*k;c.translate(px+head.dx,py+head.dy);c.rotate(head.tilt);c.translate(-px,-py);}
  drawCell(c,layer,hr.x,hr.y,w,h,-ox*k,-oy*k,w*k,h*k);
  if(blink&&layer===headUnder)closeEyes(c,headUnder,sex,'game',eq.face,f.lower,hr.x,hr.y,-ox*k,-oy*k,k);c.restore();};
 // DDTank order: face and hair, the outfit (the fists rest on the chin), then hat and glasses.
 paintHead(headUnder);drawCell(c,body,br.x,br.y,w,h,-ox*k,-oy*k,w*k,h*k);if(headOver)paintHead(headOver);
 return true;
}
/** Bag/shop/room figure with its feet at (0,0), facing right, in avatar units. False while the art loads. */
export function drawRigShow(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number):boolean {
 const ids=pieces(eq,'show');if(!ids)return false;const sex=sexOf(eq);
 const nb=ids.filter(isBase).length;
 const face=stack(sex,'show',ids.slice(0,nb+1),eq.skin),rest=stack(sex,'show',ids.slice(nb+1),eq.skin);if(!face||!rest)return false;
 const [w,h]=SHOW.cell,k=RIG_UNITS.show,[ox,oy]=FEET.show,cell=showFrame(action,tick);
 // The figure is painted facing left (DDTank's bag); mirror it so 'facing right' means right like everywhere else.
 c.save();c.scale(-1,1);
 // NORMAL_STANDBY closes the eyes on cells 1-3: drawn from cell 0 with the universal blink, so every face blinks.
 // base and face stacked in one layer (cell 0); the face sheet's own blink cells are not used
 drawCell(c,face,0,0,w,h,-ox*k,-oy*k,w*k,h*k);
 if(cell>0)closeEyes(c,face,sex,'show',eq.face,0,0,0,-ox*k,-oy*k,k);
 drawCell(c,rest,0,0,w,h,-ox*k,-oy*k,w*k,h*k);c.restore();
 return true;
}
/** Plaza/Pescaria figure with its feet at (0,0), in avatar units. `back` walks away from the viewer. */
export function drawRigVirtual(c:CanvasRenderingContext2D,eq:Equipment,action:string,tick:number):boolean {
 const ids=pieces(eq,'virtualhead');if(!ids||!has(sexOf(eq),'virtual',eq.outfit))return false;const sex=sexOf(eq);
 const bodyIds=[...(has(sex,'virtual',`base-${sex}`)?[`base-${sex}`]:[]),eq.outfit];
 const head=stack(sex,'virtualhead',ids,eq.skin),body=stack(sex,'virtual',bodyIds,eq.skin);if(!head||!body)return false;
 const frame=virtualFrame(action,tick),[w,h]=VIRTUAL.cell,k=RIG_UNITS.virtual,[ox,oy]=FEET.virtual,back=frame>=8,blink=frame===7;
 const col=blink?0:back?frame-8:frame,row=back?1:0,headCell=back?2:0,dy=(VIRTUAL.headOffsets[col]??0)*k;
 const paintBody=()=>drawCell(c,body,col*w,row*h,w,h,-ox*k,-oy*k,w*k,h*k),paintHead=()=>{drawCell(c,head,headCell*w,0,w,h,-ox*k,-oy*k+dy,w*k,h*k);
  if(blink)closeEyes(c,head,sex,'virtualhead',eq.face,0,0,0,-ox*k,-oy*k+dy,k);};
 // The front cells are painted turned to the left (DDTank's naturalWalkFront), the back ones walking away to the right:
 // mirror the front so 'facing right' walks right in both (8 directions = front/back x mirror, matheus 22/10).
 c.save();if(!back)c.scale(-1,1);
 // The neck belongs to the head (DDTank, matheus 22/10): front, the head first and the outfit's collar over its neck;
 // back, the body first and the head over it.
 // With a skin base the neck is the base's (one piece with the body): the head goes over it, front and back.
 if(back||has(sex,'virtual',`base-${sex}`)){paintBody();paintHead();}else{paintHead();paintBody();}
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
 const sex=sexOf(eq),list=ids.filter(id=>!id.startsWith('outfit-')&&!(isBase(id)&&!id.endsWith('-head'))),layer=stack(sex,context,list,eq.skin);if(!layer)return false;
 const [w,h]=context==='game'?GAME.cell:VIRTUAL.cell,[bx,by,bw,bh]=headBox(layer,[sex,context,...list].join('|'),0,w,h);
 // The battle head faces right; the plaza front head is painted turned left (mirrored like the plaza figure).
 const flip=(context==='game'?1:-1)*(facing<0?-1:1),k=size*.96/Math.max(bw,bh);
 c.save();c.translate(x+size/2,y+size/2);c.scale(flip*k,k);c.drawImage(layer,bx,by,bw,bh,-bw/2,-bh/2,bw,bh);c.restore();
 return true;
}
/** Rig sheets are for the area on screen: let go when it changes (spriteCache rules, docs/performance.md). */
export function releaseRigArt(){freeAll(composed);heads.clear();pivots.clear();skinAt.clear();}
