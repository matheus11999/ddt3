import {canonicalMap, getMap} from '../../shared/maps';
import type {CanonicalMapId, MapId} from '../../shared/maps';
import {createEnvironmentTrack} from './ambience';

type WeaponSound=import('../../shared/catalog').WeaponEffect;
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
 private map:CanonicalMapId|null=null;
 private track:{stop():void}|null=null;
 private listening=false;
 private pageHidden=false;
 private unlocked=false;

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
  return this.context;
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
   if(type==='click'){tone(480,260,.1,.035);return;}if(type==='turn'){tone(660,630,.18,.04);tone(880,830,.26,.035,'sine',.1);return;}
   const impact=type==='impact';
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
