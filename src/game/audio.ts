import {canonicalMap, getMap} from '../../shared/maps';
import type {MapId} from '../../shared/maps';
import {createEnvironmentTrack} from './ambience';

type WeaponSound=import('../../shared/catalog').WeaponEffect;
/** Recorded layers shared by every weapon's impact: a deep boom and a mid-range crack that still reads on phone speakers. */
const IMPACT_LAYERS=[{url:'/assets/audio/sfx/impact-base.mp3',volume:.3},{url:'/assets/audio/sfx/impact-crack.mp3',volume:.3}] as const;
const variants=(name:string)=>[1,2,3].map(n=>`/assets/audio/sfx/${name}-0${n}.mp3`);
/** POW and ordinary power-ups share the activation sample supplied by the user. */
const POWERUP_CUE={urls:['/assets/audio/sfx/powerup.mp3'],volume:.22} as const;
const CUES={pow:POWERUP_CUE,boost:POWERUP_CUE,powShot:{urls:variants('pow-shot'),volume:.4},powImpact:{urls:variants('pow-impact'),volume:.45},launch:{urls:['/assets/audio/sfx/launch-throw.mp3'],volume:.3},click:{urls:['/assets/audio/sfx/ui-click.mp3'],volume:.25},turn:{urls:variants('turn-yours'),volume:.3}} as const;
export type AudioCue=keyof typeof CUES;
function readPreference(key: string) {
 try {return localStorage.getItem(key) !== 'off';} catch {return true;}
}
function savePreference(key: string, enabled: boolean) {
 try {localStorage.setItem(key, enabled ? 'on' : 'off');} catch {/* Private storage must not prevent playing. */}
}
class AudioEngine {
 enabled=readPreference('brasa-sound');
 private context:AudioContext|null=null;
 private noise:AudioBuffer|null=null;
 private environmentEnabled=readPreference('brasa-environment-sound');
 private map:MapId|null=null;
 private track:{stop():void}|null=null;
 private listening=false;
 private pageHidden=false;
 private unlocked=false;
 private samples=new Map<string,AudioBuffer>();
 private loading:AudioContext|null=null;
 private cueAt=new Map<AudioCue,number>();

 setEnabled(value:boolean){
  this.enabled=value;savePreference('brasa-sound',value);
  if(value)this.play('click');
  this.syncEnvironment();
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
   this.context.addEventListener('statechange',this.onContextState);
  }
  this.loadSamples(this.context);
  return this.context;
 }
 private loadSamples(context:AudioContext){
  if(this.loading===context||typeof fetch==='undefined')return;
  this.loading=context;this.samples.clear();
  for(const url of new Set([...IMPACT_LAYERS.map(layer=>layer.url),...Object.values(CUES).flatMap(cue=>cue.urls)]))void fetch(url).then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(data=>context.decodeAudioData(data)).then(buffer=>{if(this.loading===context)this.samples.set(url,buffer);}).catch(()=>{/* The synthesized impact stays as the fallback. */});
 }
 /** Plays the recorded impact layers with a small random pitch so repeated hits do not sound identical. Returns false until they are decoded. */
 private playImpactLayers(c:AudioContext,t:number,gain:number){
  if(!IMPACT_LAYERS.every(layer=>this.samples.has(layer.url)))return false;
  const rate=.95+Math.random()*.1;
  for(const layer of IMPACT_LAYERS){const source=c.createBufferSource(),g=c.createGain();source.buffer=this.samples.get(layer.url)!;source.playbackRate.value=rate;g.gain.value=layer.volume*gain;source.connect(g);g.connect(c.destination);source.start(t);}
  return true;
 }
 private playSample(c:AudioContext,buffer:AudioBuffer,volume:number,rate=1){
  const source=c.createBufferSource(),g=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;g.gain.value=volume;source.connect(g);g.connect(c.destination);source.start();
 }
 /** Plays one random recorded variation of a cue; false until its files are decoded. */
 private playCue(c:AudioContext,id:AudioCue){
  const cue=CUES[id],loaded=cue.urls.map(url=>this.samples.get(url)).filter(buffer=>buffer!==undefined);
  if(!loaded.length)return false;
  // Simultaneous projectiles (trident, volleys) share one cue instead of stacking copies.
  const now=c.currentTime;if(now-(this.cueAt.get(id)??-1)<.25)return true;this.cueAt.set(id,now);
  this.playSample(c,loaded[Math.floor(Math.random()*loaded.length)],cue.volume,.97+Math.random()*.06);return true;
 }
 /** Plays a recorded battle cue; falls back to a short synthesized chime until its files are decoded. */
 cue(id:AudioCue){
  if(!this.enabled||this.isHidden())return;
  try{
   const c=this.getContext();this.resume(c);
   if(this.playCue(c,id))return;
   const t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.setValueAtTime(id==='pow'?330:880,t);o.frequency.exponentialRampToValueAtTime(id==='pow'?990:1320,t+.25);g.gain.setValueAtTime(.04,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.32);
  }catch{/* Audio remains optional in muted or suspended browsers. */}
 }
 private resume(context:AudioContext){
  if(context.state==='suspended')void context.resume().then(()=>this.syncEnvironment()).catch(()=>{});
 }
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
   try{this.track=createEnvironmentTrack(this.context,getMap(this.map).audio.ambience);}catch{/* Unsupported audio must not interrupt a match. */}
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
 play(type:'click'|'shot'|'impact'|'turn',effect?:WeaponSound,level=0,powered=false){
  if(!this.enabled||this.isHidden())return;
  try{
   const c=this.getContext();this.resume(c);this.syncEnvironment();const t=c.currentTime,richness=level>=12?1:level>=10?.7:level>=9?.45:.2;
   const tone=(frequency:number,end:number,duration:number,volume:number,wave:OscillatorType='sine',delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=wave;o.frequency.setValueAtTime(frequency,t+delay);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+delay+duration);g.gain.setValueAtTime(volume,t+delay);g.gain.exponentialRampToValueAtTime(.001,t+delay+duration);o.start(t+delay);o.stop(t+delay+duration+.02);};
   if(type==='click'){if(!this.playCue(c,'click'))tone(480,260,.1,.035);return;}if(type==='turn'){if(!this.playCue(c,'turn')){tone(660,630,.18,.04);tone(880,830,.26,.035,'sine',.1);}return;}
   const impact=type==='impact';
   // Recorded layers replace every synthesized tone; the oscillators only play until the files are decoded,
   // because layered over real recordings they made the shots sound robotic.
   const recorded=impact?this.playImpactLayers(c,t,powered?1.15:1):!powered&&this.playCue(c,'launch');
   if(powered&&this.playCue(c,impact?'powImpact':'powShot'))return;
   if(recorded)return;
   if(powered){tone(impact?75:130,impact?26:310,.4,.035,'triangle');tone(impact?880:440,impact?220:880,.3,.018,'sine',.04);}
   if(effect==='crystal'){tone(impact?1300:850,impact?380:1200,.23+richness*.18,.035,'triangle');tone(impact?1740:1275,620,.32,.022,'sine',.035);if(richness>.5)tone(2200,1100,.38,.015,'sine',.07);}
   else if(effect==='dynamite'){tone(impact?95:720,impact?28:170,impact?.42:.13,.045,'triangle');if(impact)tone(210,45,.22,.024,'sawtooth',.035);else tone(1800,800,.1,.012,'square',.025);}
   else if(effect==='brick'){tone(impact?82:250,impact?28:95,impact?.38:.16,impact?.08:.04,'triangle');if(impact)for(let n=0;n<2+Math.round(richness*3);n++)tone(1180+n*170,820+n*90,.06,.016,'square',.05+n*.065);}
   else if(effect==='electric'){tone(impact?180:420,impact?45:85,.2+richness*.12,.035,'sawtooth');tone(1600,180,.09,.018,'square',.03);}
   else {tone(impact?100:210,impact?26:65,.28+richness*.1,impact?.1:.045,'triangle');}
   if(effect!=='crystal'){
    if(!this.noise){this.noise=c.createBuffer(1,c.sampleRate*.6,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;filter.type=effect==='electric'?'bandpass':'lowpass';filter.frequency.setValueAtTime(effect==='electric'?2100:impact?900:1500,t);source.connect(filter);filter.connect(gain);gain.connect(c.destination);gain.gain.setValueAtTime((impact?.11:.05)*(1+richness*.3),t);gain.gain.exponentialRampToValueAtTime(.001,t+.22+richness*.13);source.start(t);source.stop(t+.4);
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
