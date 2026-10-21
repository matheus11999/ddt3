import {freeImage} from './spriteCache';

/**
 * POW ready (bar full, not yet used), as in DDTank (matheus, 21/10/2026). Paintings by Codex on black, cut by
 * scripts/build-pow-aura.py into strips of FRAMES looping frames with real alpha; the game only plays the strips and
 * moves them. Three looks, POW_READY_STYLE picks the one in the game:
 *  - gold, soft, ember: auras painted hugging the lying fighter's own silhouette (golden energy, warm holy glow, embers);
 *  - aura: a thin oval of soft golden light strands around the fighter;
 *  - mantle: golden spirit wisps rising from behind the body;
 *  - orbs: two small light spirits with comet tails circling the fighter, passing behind and in front of it;
 *  - wings, whirl, sparks, lightning, phoenix, dragon, spirit, petals, crystals: light wings, ribbons spiralling up,
 *    rising sparks, golden arcs, a flame phoenix, a light dragon, blue spirit fire, glowing petals, floating crystals
 *    (rising from the feet);
 *  - crown, stars: a small halo of light rays or three stars orbiting over the head.
 * Nothing ever shows under the fighter (matheus): every look is cut at the feet.
 */
export type PowReadyStyle=keyof typeof BODY|'aura'|'orbs'|keyof typeof RISING|keyof typeof OVERHEAD;
export const POW_READY_STYLE:PowReadyStyle='gold';
/** Auras painted around the template silhouette (2.6x the 112 px fighter, feet at y=452 of 512): strip art and light. */
const BODY={gold:{art:'aura-gold',alpha:.85},soft:{art:'aura-soft',alpha:.85},ember:{art:'aura-ember',alpha:.85}} as const;
const BODY_DRAW=512/2.6,BODY_FEET=452/512;
const FRAMES=6;
/** Looks painted rising from the ground line: drawn size around a 112 px fighter, light, frame time and how far above the feet they start (the wings grow from the back). */
const RISING={mantle:{draw:170,alpha:.72,frameMs:110,lift:0},wings:{draw:170,alpha:.7,frameMs:140,lift:22},whirl:{draw:190,alpha:.8,frameMs:100,lift:0},sparks:{draw:200,alpha:1,frameMs:120,lift:0},lightning:{draw:150,alpha:.8,frameMs:90,lift:0},
 phoenix:{draw:180,alpha:.75,frameMs:130,lift:0},dragon:{draw:180,alpha:.8,frameMs:130,lift:0},spirit:{draw:160,alpha:.72,frameMs:110,lift:0},petals:{draw:180,alpha:.9,frameMs:120,lift:0},crystals:{draw:160,alpha:.9,frameMs:150,lift:0}} as const;
/** Looks floating over the head: drawn size and height of their centre above the feet. */
const OVERHEAD={crown:{draw:88,height:74,frameMs:150},stars:{draw:104,height:76,frameMs:120}} as const;
const strip=(name:string,size=256)=>({src:`/assets/combat/pow-ready-${name}.png`,size});
const ART={aura:strip('aura'),orb:strip('orb',128),crown:strip('crown',128),mantle:strip('mantle'),wings:strip('wings'),whirl:strip('whirl'),sparks:strip('sparks'),lightning:strip('lightning'),
 phoenix:strip('phoenix'),dragon:strip('dragon'),spirit:strip('spirit'),petals:strip('petals'),crystals:strip('crystals'),stars:strip('stars',128),
 'aura-gold':strip('aura-gold'),'aura-soft':strip('aura-soft'),'aura-ember':strip('aura-ember')} as const;
type Art=keyof typeof ART;
const images=new Map<Art,HTMLImageElement>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function sheet(key:Art){let image=images.get(key);if(!image){if(typeof Image==='undefined')return undefined;image=new Image();image.decoding='async';image.src=ART[key].src;images.set(key,image);}return image.complete&&image.naturalWidth?image:undefined;}
const artFor=(style:PowReadyStyle):Art=>style==='orbs'?'orb':style in BODY?BODY[style as keyof typeof BODY].art:style as Art;

/** Warms the strip of the look in use (the loading screen awaits it). */
export function preloadPowReadyAura(style:PowReadyStyle=POW_READY_STYLE):HTMLImageElement[]{sheet(artFor(style));return [...images.values()];}
export function releasePowReadyAura(){for(const image of images.values())freeImage(image);images.clear();}

/** Frame, swell-in and light of the moment; `since` is when the bar filled, so the effect grows in instead of popping. */
function timing(time:number,since:number,frameMs:number){
 const t=motionPreference?.matches?0:time,grow=Math.min(1,Math.max(0,(time-since)/260));
 return {t,grow,beat:Math.sin(t/300),frame:Math.floor(t/frameMs)%FRAMES};
}
/** Cut at the feet: nothing below the fighter. */
function clipAboveFeet(c:CanvasRenderingContext2D,x:number,y:number){c.beginPath();c.rect(x-200,y-300,400,298);c.clip();}

/**
 * Draws the look around the fighter standing at (x, y). `layer` back goes before the avatar and front after it;
 * only the orbs use the front layer (the half of the orbit that passes in front of the body).
 */
export function drawPowReadyAura(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number,layer:'back'|'front'='back',style:PowReadyStyle=POW_READY_STYLE,facing:1|-1=1){
 if(style==='orbs'){drawOrbs(c,x,y,time,since,layer);return;}
 if(layer==='front')return;
 const key=artFor(style),art=sheet(key);if(!art)return;const {size}=ART[key];
 c.save();clipAboveFeet(c,x,y);
 if(style==='gold'||style==='soft'||style==='ember'){
  // Painted facing right around the body; turned with the fighter.
  const {grow,beat,frame}=timing(time,since,120),s=BODY_DRAW*(.94+.06*grow);
  c.translate(x,y);c.scale(facing,1);c.globalAlpha*=grow*(BODY[style].alpha+beat*.12);
  c.drawImage(art,frame*size,0,size,size,-s/2,-s*BODY_FEET,s,s);
 }else if(style==='aura'){
  const {grow,beat,frame}=timing(time,since,120),scale=(.86+.14*grow)*(1+beat*.045),w=180*scale,h=150*scale;
  c.globalAlpha*=grow*(.8+beat*.15);c.drawImage(art,frame*size,0,size,size,x-w/2,y-40-h/2,w,h);
 }else if(style==='crown'||style==='stars'){
  // Floats over the head with a slow bob.
  const look=OVERHEAD[style],{t,grow,beat,frame}=timing(time,since,look.frameMs),s=look.draw*(.85+.15*grow);
  c.globalAlpha*=grow*(.8+beat*.12);c.drawImage(art,frame*size,0,size,size,x-s/2,y-look.height-s/2+Math.sin(t/520)*2.5,s,s);
 }else{
  // The painted base sits 60 px above the bottom of a 512 px cell: it lands just under the body so the light rises from it.
  const look=RISING[style],{grow,beat,frame}=timing(time,since,look.frameMs),s=look.draw*(.9+.1*grow)*(1+beat*.03),base=s*(1-60/512);
  c.globalAlpha*=grow*(look.alpha+beat*.12);c.drawImage(art,frame*size,0,size,size,x-s/2,y+6-look.lift-base,s,s);
 }
 c.restore();
}

/** Two light spirits on a flat ellipse around the body, half a turn apart; the far half of the orbit is smaller and dimmer. */
function drawOrbs(c:CanvasRenderingContext2D,x:number,y:number,time:number,since:number,layer:'back'|'front'){
 const art=sheet('orb');if(!art)return;const {size}=ART.orb;
 const {t,grow,frame}=timing(time,since,90),rx=60*(.7+.3*grow),ry=10,cy=y-58,turn=t/2400*Math.PI*2;
 c.save();clipAboveFeet(c,x,y);
 for(let k=0;k<2;k++){
  const a=turn+k*Math.PI,front=Math.sin(a)>0;if(front!==(layer==='front'))continue;
  const ox=x+Math.cos(a)*rx,oy=cy+Math.sin(a)*ry+Math.sin(t/380+k*2)*3,depth=.78+.22*Math.sin(a);
  // The painted tail trails to the left of a spirit flying right: turn it along the orbit.
  const heading=Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx),s=62*depth;
  c.save();c.globalAlpha*=grow*(.55+.45*depth);c.translate(ox,oy);c.rotate(heading);
  // The core is painted at x=320 of 512, so the cell is shifted for the core to sit on the orbit.
  c.drawImage(art,((frame+k*3)%FRAMES)*size,0,size,size,-s*(320/512),-s/2,s,s);
  c.restore();
 }
 c.restore();
}
