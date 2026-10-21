import {canonicalMap, getMap} from '../../shared/maps';
import type {MapId} from '../../shared/maps';
import {createEnvironmentTrack} from './ambience';

type WeaponSound=import('../../shared/catalog').WeaponEffect;
/** Recorded layers shared by every weapon's impact: a deep boom and a mid-range crack that still reads on phone speakers. */
const IMPACT_LAYERS=[{url:'/assets/audio/sfx/impact-base.mp3',volume:.3},{url:'/assets/audio/sfx/impact-crack.mp3',volume:.3}] as const;
const variants=(name:string)=>[1,2,3].map(n=>`/assets/audio/sfx/${name}-0${n}.mp3`);
/** POW and ordinary power-ups share the activation sample supplied by the user. */
const POWERUP_CUE={urls:['/assets/audio/sfx/powerup.mp3'],volume:.22} as const;
/** Same short tick for raising and lowering the angle (DDTank Sound006 study, docs/hitbox-aim.md); original
 * sound made by scripts/make-angle-click.py. `gap` lets it repeat at the 90 ms key repeat. */
const ANGLE_CUE={urls:['/assets/audio/sfx/angle-change.mp3'],volume:.28,gap:.06} as const;
const CUES={angleChange:ANGLE_CUE,pow:POWERUP_CUE,boost:POWERUP_CUE,powShot:{urls:variants('pow-shot'),volume:.4},powImpact:{urls:variants('pow-impact'),volume:.45},launch:{urls:['/assets/audio/sfx/launch-throw.mp3'],volume:.3},click:{urls:['/assets/audio/sfx/ui-click.mp3'],volume:.25},turn:{urls:variants('turn-yours'),volume:.3}} as const;
export type AudioCue=keyof typeof CUES;
/** Encoded files fetched once per page, before any AudioContext exists, so the first cue of a match is never late. */
const encoded=new Map<string,Promise<ArrayBuffer|null>>();
function fetchEncoded(url:string){
 let pending=encoded.get(url);
 if(!pending){pending=typeof fetch==='undefined'?Promise.resolve(null):fetch(url).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);encoded.set(url,pending);}
 return pending;
}
/** Every recorded cue shared by all weapons; weapon files are added by `audio.preload`. */
const BUILT_IN_SAMPLES=[...new Set([...IMPACT_LAYERS.map(layer=>layer.url),...Object.values(CUES).flatMap(cue=>cue.urls)])];
function readPreference(key: string) {
 try {return localStorage.getItem(key) !== 'off';} catch {return true;}
}
/** Overall game volume (Ajustes → Som), 0 to 1; 40% until the player moves the slider (matheus, 21/10/2026). */
export const DEFAULT_VOLUME=.4;
function readVolume(){
 try{const raw=localStorage.getItem('brasa-volume');const value=raw===null?NaN:Number(raw);return Number.isFinite(value)?Math.min(1,Math.max(0,value)):DEFAULT_VOLUME;}catch{return DEFAULT_VOLUME;}
}
/** Ajustes → Som de batalha: shots, impacts, battle cues and the map ambience, 0 to 1, on top of the overall volume. */
export const DEFAULT_BATTLE_VOLUME=1;
function readBattleVolume(){
 try{const raw=localStorage.getItem('brasa-battle-volume');const value=raw===null?NaN:Number(raw);return Number.isFinite(value)?Math.min(1,Math.max(0,value)):DEFAULT_BATTLE_VOLUME;}catch{return DEFAULT_BATTLE_VOLUME;}
}
/** 'general' sounds (menus, forge, shop) follow only the overall volume; 'battle' sounds also follow the battle volume. */
export type AudioBus='general'|'battle';
function savePreference(key: string, enabled: boolean) {
 try {localStorage.setItem(key, enabled ? 'on' : 'off');} catch {/* Private storage must not prevent playing. */}
}
class AudioEngine {
 enabled=readPreference('brasa-sound');
 volume=readVolume();
 battleVolume=readBattleVolume();
 private context:AudioContext|null=null;
 /** Every sound goes through this node, so the volume slider scales all of them at once. */
 private master:GainNode|null=null;
 /** Battle sounds pass through this node before the master, for the Som de batalha slider. */
 private battleGain:GainNode|null=null;
 private noise:AudioBuffer|null=null;
 private environmentEnabled=readPreference('brasa-environment-sound');
 private map:MapId|null=null;
 private track:{stop():void}|null=null;
 private listening=false;
 private pageHidden=false;
 private unlocked=false;
 /** Decoded files for the current context; null marks a file that failed to load or decode. */
 private samples=new Map<string,AudioBuffer|null>();
 private requested=new Set<string>(BUILT_IN_SAMPLES);
 private decoding=new Set<string>();
 private cueAt=new Map<AudioCue,number>();
 private voices=new Map<AudioCue,AudioBufferSourceNode[]>();
 constructor(){
  if(typeof document==='undefined')return;
  for(const url of this.requested)void fetchEncoded(url);
  // Any trusted gesture anywhere in the game unlocks (or wakes) the audio, not only inside a battle:
  // browsers keep an AudioContext created without one suspended, which silenced the first sounds.
  for(const type of ['pointerdown','keydown','touchend'])document.addEventListener(type,this.onUnlock,{capture:true,passive:true});
  document.addEventListener('visibilitychange',this.onWake);
 }
 /** Starts fetching and decoding files that will be needed soon (a weapon's own sounds). */
 preload(urls:readonly string[]){
  for(const url of urls){if(this.requested.has(url))continue;this.requested.add(url);void fetchEncoded(url);if(this.context&&this.context.state!=='closed')this.decode(this.context,url);}
 }
 /** 'ready' once decoded, 'missing' when the file does not exist or cannot be decoded. */
 sampleState(url:string):'ready'|'loading'|'missing'{
  const buffer=this.samples.get(url);return buffer?'ready':buffer===null?'missing':'loading';
 }
 /** Plays a preloaded file through the shared context; false while it is not decoded yet. */
 playFile(url:string,volume:number,bus:AudioBus='battle'){
  if(!this.enabled||this.isHidden())return true;
  try{
   const c=this.getContext();this.resume(c);
   const buffer=this.samples.get(url);if(!buffer){this.preload([url]);return false;}
   this.playSample(c,buffer,volume,.98+Math.random()*.04,bus);return true;
  }catch{return false;}
 }

 setEnabled(value:boolean){
  this.enabled=value;savePreference('brasa-sound',value);
  if(value)this.play('click');
  this.syncEnvironment();
 }
 setVolume(value:number){
  this.volume=Math.min(1,Math.max(0,value));
  try{localStorage.setItem('brasa-volume',String(this.volume));}catch{/* Private storage must not prevent playing. */}
  if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.02);
 }
 setBattleVolume(value:number){
  this.battleVolume=Math.min(1,Math.max(0,value));
  try{localStorage.setItem('brasa-battle-volume',String(this.battleVolume));}catch{/* Private storage must not prevent playing. */}
  if(this.battleGain&&this.context)this.battleGain.gain.setTargetAtTime(this.battleVolume,this.context.currentTime,.02);
 }
 getEnvironmentEnabled(){return this.environmentEnabled;}
 setEnvironmentEnabled(value:boolean){
  this.environmentEnabled=value;savePreference('brasa-environment-sound',value);
  if(value)this.activate();
  this.syncEnvironment();
 }
 startEnvironment(map:MapId){
  const next=canonicalMap(map);
  if(this.map!==next){this.stopTrack();this.map=next;}
  if(!this.listening&&typeof document!=='undefined'){
   this.listening=true;this.pageHidden=false;
   document.addEventListener('pointerdown',this.onGesture);
   document.addEventListener('keydown',this.onGesture);
   document.addEventListener('visibilitychange',this.onVisibility);
   window.addEventListener('pagehide',this.onPageHide);
   window.addEventListener('pageshow',this.onPageShow);
  }
  this.activate();
  this.syncEnvironment();
 }
 stopEnvironment(){
  this.map=null;this.pageHidden=false;this.stopTrack();
  if(!this.listening)return;
  this.listening=false;
  document.removeEventListener('pointerdown',this.onGesture);
  document.removeEventListener('keydown',this.onGesture);
  document.removeEventListener('visibilitychange',this.onVisibility);
  window.removeEventListener('pagehide',this.onPageHide);
  window.removeEventListener('pageshow',this.onPageShow);
 }
 private stopTrack(){this.track?.stop();this.track=null;}
 private isHidden(){return this.pageHidden||(typeof document!=='undefined'&&document.hidden);}
 private getContext(){
  if(!this.context||this.context.state==='closed'){
   this.context=new AudioContext();
   this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);
   this.battleGain=this.context.createGain();this.battleGain.gain.value=this.battleVolume;this.battleGain.connect(this.master);
   this.context.addEventListener('statechange',this.onContextState);
   this.samples.clear();this.decoding.clear();
   for(const url of this.requested)this.decode(this.context,url);
  }
  return this.context;
 }
 /** Where every voice connects: the battle volume (then the master) or straight to the master volume. */
 private out(c:AudioContext,bus:AudioBus='general'){
  if(this.context!==c||!this.master)return c.destination;
  return bus==='battle'&&this.battleGain?this.battleGain:this.master;
 }
 private decode(context:AudioContext,url:string){
  if(this.decoding.has(url))return;this.decoding.add(url);
  // decodeAudioData detaches its input, so each context decodes its own copy of the fetched bytes.
  void fetchEncoded(url).then(data=>data?context.decodeAudioData(data.slice(0)):null).then(buffer=>{if(this.context===context)this.samples.set(url,buffer);},()=>{if(this.context===context)this.samples.set(url,null);});
 }
 /** Plays the recorded impact layers with a small random pitch so repeated hits do not sound identical. Returns false until they are decoded. */
 private playImpactLayers(c:AudioContext,t:number,gain:number,bus:AudioBus){
  if(!IMPACT_LAYERS.every(layer=>this.samples.get(layer.url)))return false;
  const rate=.95+Math.random()*.1;
  for(const layer of IMPACT_LAYERS){const source=c.createBufferSource(),g=c.createGain();source.buffer=this.samples.get(layer.url)!;source.playbackRate.value=rate;g.gain.value=layer.volume*gain;source.connect(g);g.connect(this.out(c,bus));source.start(t);}
  return true;
 }
 private playSample(c:AudioContext,buffer:AudioBuffer,volume:number,rate=1,bus:AudioBus='general'){
  const source=c.createBufferSource(),g=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;g.gain.value=volume;source.connect(g);g.connect(this.out(c,bus));source.start();
  return source;
 }
 /** Plays one random recorded variation of a cue; false until its files are decoded. */
 private playCue(c:AudioContext,id:AudioCue,bus:AudioBus){
  const cue=CUES[id],loaded=cue.urls.map(url=>this.samples.get(url)).filter((buffer):buffer is AudioBuffer=>!!buffer);
  if(!loaded.length)return false;
  // Simultaneous projectiles (trident, volleys) share one cue instead of stacking copies.
  const now=c.currentTime;if(now-(this.cueAt.get(id)??-1)<('gap' in cue?cue.gap:.25))return true;this.cueAt.set(id,now);
  const source=this.playSample(c,loaded[Math.floor(Math.random()*loaded.length)],cue.volume,.97+Math.random()*.06,bus);
  // A repeating cue keeps at most two voices: the oldest still ringing is cut.
  if('gap' in cue){const voices=this.voices.get(id)??[];voices.push(source);source.onended=()=>{const at=voices.indexOf(source);if(at>=0)voices.splice(at,1);};while(voices.length>2)try{voices.shift()!.stop();}catch{/* already ended */}this.voices.set(id,voices);}
  return true;
 }
 /** Plays a recorded battle cue; falls back to a short synthesized chime until its files are decoded. */
 cue(id:AudioCue,bus:AudioBus='battle'){
  if(!this.enabled||this.isHidden())return;
  try{
   const c=this.getContext();this.resume(c);
   if(this.playCue(c,id,bus))return;
   if(id==='angleChange'){const t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(2600,t);o.frequency.exponentialRampToValueAtTime(1100,t+.05);g.gain.setValueAtTime(.03,t);g.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(g);g.connect(this.out(c,bus));o.start(t);o.stop(t+.07);return;}
   const t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(id==='pow'?330:880,t);o.frequency.exponentialRampToValueAtTime(id==='pow'?990:1320,t+.25);g.gain.setValueAtTime(.04,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(this.out(c,bus));o.start(t);o.stop(t+.32);
  }catch{/* Audio remains optional in muted or suspended browsers. */}
 }
 private resume(context:AudioContext){
  // 'interrupted' is Safari's state after a call, an alarm or locking the phone.
  if(context.state==='suspended'||(context.state as string)==='interrupted')void context.resume().then(()=>this.syncEnvironment()).catch(()=>{});
 }
 private onUnlock=(event:Event)=>{
  if(!event.isTrusted||!this.enabled)return;
  this.unlocked=true;
  try{this.resume(this.getContext());}catch{/* Audio is optional. */}
 };
 /** Back from another tab: wake the context even when the ambience is off, so the next cue is not swallowed. */
 private onWake=()=>{
  if(this.isHidden()||!this.enabled||!this.context||!this.hasActivation())return;
  this.resume(this.context);
 };
 private hasActivation(){return this.unlocked||(typeof navigator!=='undefined'&&navigator.userActivation?.hasBeenActive);}
 private activate(){
  if(!this.enabled||!this.environmentEnabled||!this.map||this.isHidden())return;
  if(!this.hasActivation())return;
  try{const context=this.getContext();this.resume(context);}catch{/* Audio is optional. */}
 }
 private syncEnvironment(){
  if(!this.map||!this.enabled||!this.environmentEnabled||!this.hasActivation()||this.isHidden()||this.context?.state!=='running'){
   this.stopTrack();return;
  }
  if(!this.track){
   try{this.track=createEnvironmentTrack(this.context,getMap(this.map).audio.ambience,this.out(this.context,'battle'));}catch{/* Unsupported audio must not interrupt a match. */}
  }
 }
 private onGesture=(event:Event)=>{
  if(!event.isTrusted)return;
  this.unlocked=true;this.activate();this.syncEnvironment();
 };
 private onContextState=()=>this.syncEnvironment();
 private onVisibility=()=>{
  if(this.isHidden()){
   this.stopTrack();
   if(this.context?.state==='running')void this.context.suspend().catch(()=>{});
  }else{this.activate();this.syncEnvironment();}
 };
 private onPageHide=()=>{this.pageHidden=true;this.onVisibility();};
 private onPageShow=()=>{this.pageHidden=false;this.onVisibility();};
 /** `bus` defaults to 'general' for the menu click and 'battle' for the rest; menus that reuse a battle sound pass 'general'. */
 play(type:'click'|'shot'|'impact'|'turn',effect?:WeaponSound,level=0,powered=false,bus:AudioBus=type==='click'?'general':'battle'){
  if(!this.enabled||this.isHidden())return;
  try{
   const c=this.getContext();this.resume(c);this.syncEnvironment();const t=c.currentTime,richness=level>=12?1:level>=10?.7:level>=9?.45:.2;
   const tone=(frequency:number,end:number,duration:number,volume:number,wave:OscillatorType='sine',delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(this.out(c,bus));o.type=wave;o.frequency.setValueAtTime(frequency,t+delay);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+delay+duration);g.gain.setValueAtTime(volume,t+delay);g.gain.exponentialRampToValueAtTime(.001,t+delay+duration);o.start(t+delay);o.stop(t+delay+duration+.02);};
   if(type==='click'){if(!this.playCue(c,'click',bus))tone(480,260,.1,.035);return;}if(type==='turn'){if(!this.playCue(c,'turn',bus)){tone(660,630,.18,.04);tone(880,830,.26,.035,'sine',.1);}return;}
   const impact=type==='impact';
   // Recorded layers replace every synthesized tone; the oscillators only play until the files are decoded,
   // because layered over real recordings they made the shots sound robotic.
   const recorded=impact?this.playImpactLayers(c,t,powered?1.15:1,bus):!powered&&this.playCue(c,'launch',bus);
   if(powered&&this.playCue(c,impact?'powImpact':'powShot',bus))return;
   if(recorded)return;
   if(powered){tone(impact?75:130,impact?26:310,.4,.035,'triangle');tone(impact?880:440,impact?220:880,.3,.018,'sine',.04);}
   if(effect==='crystal'){tone(impact?1300:850,impact?380:1200,.23+richness*.18,.035,'triangle');tone(impact?1740:1275,620,.32,.022,'sine',.035);if(richness>.5)tone(2200,1100,.38,.015,'sine',.07);}
   else if(effect==='dynamite'){tone(impact?95:720,impact?28:170,impact?.42:.13,.045,'triangle');if(impact)tone(210,45,.22,.024,'sawtooth',.035);else tone(1800,800,.1,.012,'square',.025);}
   else if(effect==='brick'){tone(impact?82:250,impact?28:95,impact?.38:.16,impact?.08:.04,'triangle');if(impact)for(let n=0;n<2+Math.round(richness*3);n++)tone(1180+n*170,820+n*90,.06,.016,'square',.05+n*.065);}
   else if(effect==='electric'){tone(impact?180:420,impact?45:85,.2+richness*.12,.035,'sawtooth');tone(1600,180,.09,.018,'square',.03);}
   else {tone(impact?100:210,impact?26:65,.28+richness*.1,impact?.1:.045,'triangle');}
   if(effect!=='crystal'){
    if(!this.noise){this.noise=c.createBuffer(1,c.sampleRate*.6,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type=effect==='electric'?'bandpass':'lowpass';filter.frequency.setValueAtTime(effect==='electric'?2100:impact?900:1500,t);source.connect(filter);filter.connect(gain);gain.connect(this.out(c,bus));gain.gain.setValueAtTime((impact?.11:.05)*(1+richness*.3),t);gain.gain.exponentialRampToValueAtTime(.001,t+.22+richness*.13);source.start(t);source.stop(t+.4);
   }
  }catch{/* Audio remains optional in muted or suspended browsers. */}
 }
}
export const audio=new AudioEngine();

/** Select a map on battle entry/change; repeated calls for the same map are safe. */
export const startEnvironmentAudio=(map:MapId)=>audio.startEnvironment(map);
/** Releases all ambient sources and page/gesture listeners on battle exit. */
export const stopEnvironmentAudio=()=>audio.stopEnvironment();
export const getEnvironmentAudioEnabled=()=>audio.getEnvironmentEnabled();
export const setEnvironmentAudioEnabled=(enabled:boolean)=>audio.setEnvironmentEnabled(enabled);
