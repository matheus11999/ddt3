/**
 * Choosing where to fish: the Lançar button turns this on, the scene lights up the ponds and the
 * next click on one walks the player to its nearest free spot and casts. Escape, a click elsewhere
 * or walking turns it off.
 */
let picking=false;
const EVENT='brasa-fishing-pick';
export const fishingPick={
 get:()=>picking,
 set(on:boolean){if(on===picking)return;picking=on;window.dispatchEvent(new CustomEvent(EVENT,{detail:on}));},
 listen(callback:(on:boolean)=>void){const on=(e:Event)=>callback((e as CustomEvent<boolean>).detail);window.addEventListener(EVENT,on);return()=>window.removeEventListener(EVENT,on);},
};
