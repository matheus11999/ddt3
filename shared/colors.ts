import type {Equipment} from './catalog';

/** Pieces whose painted art has a recolorable region (src/game/rig/recolorZones.ts). */
export const COLOR_SLOTS=['hat','outfit','hair','glasses'] as const;
export type ColorSlot=typeof COLOR_SLOTS[number];
export const BODY_COLOR_PARTS=['skin','eyes'] as const;
export const isBodyColorPart=(value:string):value is BodyColorPart=>(BODY_COLOR_PARTS as readonly string[]).includes(value);
/** Most changes one paint request may carry: four pieces, skin and eyes, with room to spare. */
export const MAX_PAINT_CHANGES=8;
export type BodyColorPart=typeof BODY_COLOR_PARTS[number];
export type BodyColors=Partial<Record<BodyColorPart,string>>;
export const BODY_COLOR_NAMES:Record<BodyColorPart,string>={skin:'Cor do corpo',eyes:'Cor dos olhos'};

/** Every color change (an item, the body or the eyes) consumes one ticket, including going back to the original. */
export const COLOR_TICKET={id:'color-ticket',name:'Ticket de Cor',icon:'/assets/ui/color-ticket.png',description:'Muda a cor de uma peça visual, do corpo ou dos olhos. Cada troca gasta 1 ticket.'} as const;
export const STARTER_COLOR_TICKETS=3;
export const MAX_COLOR_TICKETS=9999;

const HEX=/^#[0-9a-f]{6}$/;
export function isHexColor(value:unknown):value is string {return typeof value==='string'&&HEX.test(value);}
export function normalizeHex(value:unknown):string|undefined {return typeof value==='string'&&HEX.test(value.toLowerCase())?value.toLowerCase():undefined;}

/** The only colors a ticket paints: mid-saturation tones that sit well on the painted art (strong neon colors
 * looked wrong in game, so there is no free picker). Colors applied before this rule keep working. */
export const COLOR_PALETTE=[{color:'#c8463d',name:'Vermelho'},{color:'#d9772f',name:'Laranja'},{color:'#d4a73a',name:'Mostarda'},{color:'#4f8a4a',name:'Verde'},{color:'#2f7f86',name:'Petróleo'},{color:'#3a6fb0',name:'Azul'},{color:'#2e3f73',name:'Marinho'},{color:'#6f4a9a',name:'Roxo'},{color:'#cf7a95',name:'Rosa'},{color:'#7a4e2f',name:'Marrom'},{color:'#3a3a42',name:'Grafite'},{color:'#eee8dc',name:'Branco'}] as const;
export const COLOR_PRESETS=COLOR_PALETTE.map(entry=>entry.color);
/** Skin is chosen only from these realistic tones; `null` is the painted skin. The server refuses any other color. */
export const SKIN_TONES=[{color:null,name:'Clara'},{color:'#ffe9da',name:'Branca'},{color:'#dea47c',name:'Morena clara'},{color:'#b77b52',name:'Morena'},{color:'#875636',name:'Morena escura'},{color:'#5a3624',name:'Negra'}] as const;
export const SKIN_PRESETS=SKIN_TONES.flatMap(tone=>tone.color?[tone.color]:[]);
export const isSkinTone=(color:string|null)=>color===null||(SKIN_PRESETS as readonly string[]).includes(color);
export const EYE_PALETTE=[{color:'#7a4a1c',name:'Castanho'},{color:'#3c2a1e',name:'Escuro'},{color:'#c08a2e',name:'Mel'},{color:'#4f8a4a',name:'Verde'},{color:'#3a78b8',name:'Azul'},{color:'#8a8f99',name:'Cinza'},{color:'#8a3a3a',name:'Rubi'},{color:'#6f4a9a',name:'Violeta'}] as const;
export const EYE_PRESETS=EYE_PALETTE.map(entry=>entry.color);
/** Faces painted with both eyes closed (happy arcs) have no iris to paint: no eye color for them. */
export const CLOSED_EYE_FACES:ReadonlySet<string>=new Set(['face-smile','face-surf']);
export function canColorEyes(face:string){return !CLOSED_EYE_FACES.has(face);}
/** Whether a ticket may paint `color` on `target` (an item copy, `skin` or `eyes`); `null` is always the original. */
export function isPaletteColor(target:string,color:string|null):boolean{
 if(color===null)return true;
 const list:readonly string[]=target==='skin'?SKIN_PRESETS:target==='eyes'?EYE_PRESETS:COLOR_PRESETS;
 return list.includes(color);
}

/** Colors as renderers read them: from the copy worn in each color slot (repeat purchases keep their own). */
export function equippedColors(equipment:Equipment,itemColors:Readonly<Record<string,string>>):Partial<Record<ColorSlot,string>> {
 const result:Partial<Record<ColorSlot,string>>={};
 for(const slot of COLOR_SLOTS){const copy=equipment.copies?.[slot],key=copy&&copy.split('~')[0]===equipment[slot]?copy:equipment[slot],color=itemColors[key];if(isHexColor(color))result[slot]=color;}
 return result;
}
export function normalizeItemColors(value:unknown,inventory:readonly string[]):Record<string,string> {
 const result:Record<string,string>={};
 if(value&&typeof value==='object')for(const [key,color] of Object.entries(value as Record<string,unknown>)){const hex=normalizeHex(color);if(hex&&inventory.includes(key))result[key]=hex;}
 return result;
}
export function normalizeBodyColors(value:unknown):BodyColors {
 const result:BodyColors={};
 if(value&&typeof value==='object')for(const part of BODY_COLOR_PARTS){const hex=normalizeHex((value as Record<string,unknown>)[part]);if(hex)result[part]=hex;}
 return result;
}
export function isColorSlot(slot:string):slot is ColorSlot {return (COLOR_SLOTS as readonly string[]).includes(slot);}
