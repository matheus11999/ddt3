import type {Equipment} from './catalog';

/** Pieces whose painted art has a recolorable region (src/game/rig/recolorZones.ts). */
export const COLOR_SLOTS=['hat','outfit','hair','glasses'] as const;
export type ColorSlot=typeof COLOR_SLOTS[number];
export const BODY_COLOR_PARTS=['skin','eyes'] as const;
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

/** Quick picks in the color window; any other color comes from the RGB picker. */
export const COLOR_PRESETS=['#e8332f','#f26b21','#ffc21a','#7ccf2c','#1fa94f','#19c2c9','#1f7fe0','#2b3fb8','#8a3fd6','#e04aa8','#f4f1ea','#8a8f99','#2b2b33','#7a4a26','#c9a063','#f0b7c6'] as const;
export const SKIN_PRESETS=['#fde0c8','#f8cfae','#efb98f','#d99a6c','#b97a4f','#8d5534','#6a3b22','#4a2716','#f6d7e4','#cfe7c9','#c9dcf6','#d9cdf2'] as const;
export const EYE_PRESETS=['#7a4a1c','#3c2414','#2f7fd8','#1f9c6b','#7fb33a','#8b8f99','#c43a3a','#8a3fd6','#e58a1f','#e04aa8','#1fb7c9','#ffd23a'] as const;

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
