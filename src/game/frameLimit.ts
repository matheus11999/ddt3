/**
 * Frame limit chosen in Ajustes (30, 60, 90 or 120 FPS; 60 by default), kept in this browser. The scene paints at most
 * this many frames a second; everything that eases toward a target per painted frame uses `ease` so it moves at the
 * same speed at any limit (20/10, matheus).
 */
export const FRAME_LIMITS=[30,60,90,120] as const;
export type FrameLimit=typeof FRAME_LIMITS[number];
const KEY='brasa.frameLimit';
function stored():FrameLimit{try{const n=Number(localStorage.getItem(KEY));return (FRAME_LIMITS as readonly number[]).includes(n)?n as FrameLimit:60;}catch{return 60;}}
let limit:FrameLimit=stored();
export const frameLimit={
 get():FrameLimit{return limit;},
 set(value:FrameLimit){limit=value;try{localStorage.setItem(KEY,String(value));}catch{}},
 /** Milliseconds between painted frames. */
 interval(){return 1000/limit;},
};
/** Fraction to move toward a target this frame, for an easing tuned as `k` per frame at 60 FPS, `dt` ms after the last. */
export function ease(k:number,dt:number){return 1-(1-k)**(Math.max(0,Math.min(100,dt))/(1000/60));}
