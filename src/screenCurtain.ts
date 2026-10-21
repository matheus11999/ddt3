import {client,ZONE_GOING} from './client';
import type {Zone} from '../shared/fishing';
import {completeFrame} from './game/scenePaint';
import {screenReady} from './screenAssets';

/**
 * The full-screen loading cover. It stays up while the game has nothing complete to show:
 * - boot: until the server's welcome, the fonts, every picture on screen and a complete canvas frame;
 * - resume: back to a tab hidden for a while (the browser dropped its decoded art), until it is all decoded again;
 * - reconnect: while the connection is down and until the new welcome is on screen;
 * - zone: going to the Pescaria or back to the plaza, until the new zone's scenery and buttons are complete.
 */
export type CurtainReason='boot'|'resume'|'reconnect'|'zone';
export interface CurtainState {reason:CurtainReason|null;progress:number;leaving:boolean;/** The zone a 'zone' cover is taking the player to. */to:Zone|null}
/** Hidden for less than this, the tab comes back as it was: no cover. */
export const RESUME_AFTER_MS=1500;
const MIN_MS={boot:700,resume:450,reconnect:450,zone:450} as const;
const PICTURES_MS={boot:8000,resume:4000,reconnect:6000,zone:6000} as const;
/** The server never answered the zone change (refused it): the cover leaves anyway. */
const ZONE_WAIT_MS=5000;
const FADE_MS=260;

let state:CurtainState={reason:'boot',progress:0,leaving:false,to:null};
const listeners=new Set<()=>void>();
let shownAt=0,run=0,settling=-1,hiddenAt=0,started=false,fadeTimer=0,zoneTimer=0;
/** The zone change still on its way from the server (the cover waits for it). */
let zoneTarget:Zone|null=null;
const set=(patch:Partial<CurtainState>)=>{state={...state,...patch};for(const listener of listeners)listener();};
const mark=(reason:CurtainReason|null)=>{if(reason)document.documentElement.dataset.curtain=reason;else delete document.documentElement.dataset.curtain;};
const frames=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export const curtain={
 subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 snapshot:()=>state,
 /** Covers the screen at once (the attribute shows it before React renders). */
 show(reason:CurtainReason,to:Zone|null=null){
  clearTimeout(fadeTimer);run++;
  // The first load keeps its own words until the game is on screen.
  if(state.reason==='boot'&&!state.leaving)reason='boot';
  shownAt=performance.now();mark(reason);set({reason,progress:0,leaving:false,to});
 },
 hide(){run++;clearTimeout(fadeTimer);mark(null);set({reason:null,progress:0,leaving:false,to:null});},
 /** Waits for everything on screen to be complete, then fades the cover out. */
 async settle(){
  const reason=state.reason;if(!reason||state.leaving||settling===run)return;const mine=run;settling=run;
  await document.fonts?.ready;await frames();if(mine!==run)return;
  const root=document.getElementById('root')??document.body;
  await screenReady(root,PICTURES_MS[reason],share=>{if(mine===run)set({progress:Math.max(state.progress,share*.85)});},reason==='resume');
  if(mine!==run)return;set({progress:Math.max(state.progress,.9)});
  await completeFrame(3000);await frames();if(mine!==run)return;
  set({progress:1});
  await wait(Math.max(0,MIN_MS[reason]-(performance.now()-shownAt)));if(mine!==run)return;
  mark(null);set({leaving:true});fadeTimer=window.setTimeout(()=>{if(mine===run)curtain.hide();},FADE_MS);
 }
};

/** Follows the connection and the tab's visibility. Call once. */
export function startCurtain(){
 if(started)return;started=true;
 if(state.reason)mark(state.reason);
 const check=()=>{
  const s=client.state;
  if(s.status==='replaced'||s.status==='signed-out'||s.needsCharacter&&!s.profile){if(state.reason)curtain.hide();return;}
  if(!s.profile)return;
  if(s.status!=='online'){if(state.reason!=='reconnect'&&state.reason!=='boot')curtain.show('reconnect');return;}
  // Online: boot and reconnect wait for a welcome that arrived after the cover went up.
  if(zoneTarget&&s.zone===zoneTarget){zoneTarget=null;clearTimeout(zoneTimer);}
  if(zoneTarget)return;
  if(state.reason&&!state.leaving&&(state.reason==='resume'||state.reason==='zone'||s.welcomeAt>0&&s.welcomeAt>=shownAt))void curtain.settle();
 };
 client.subscribe(check);check();
 window.addEventListener(ZONE_GOING,event=>{
  const to=(event as CustomEvent<Zone>).detail;
  zoneTarget=to;clearTimeout(zoneTimer);zoneTimer=window.setTimeout(()=>{zoneTarget=null;check();},ZONE_WAIT_MS);
  curtain.show('zone',to);
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=performance.now();return;}
  if(!hiddenAt||performance.now()-hiddenAt<RESUME_AFTER_MS)return;hiddenAt=0;
  if(!client.state.profile)return;
  curtain.show('resume');check();
 });
}
