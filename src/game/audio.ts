type WeaponSound='fire'|'electric'|'crystal';
class AudioEngine {
 enabled=localStorage.getItem('brasa-sound')!=='off';private context:AudioContext|null=null;private noise:AudioBuffer|null=null;
 setEnabled(value:boolean){this.enabled=value;localStorage.setItem('brasa-sound',value?'on':'off');if(value)this.play('click');}
 play(type:'click'|'shot'|'impact'|'turn',effect?:WeaponSound,level=0){
  if(!this.enabled)return;
  try{
   const c=this.context??(this.context=new AudioContext());if(c.state==='suspended')void c.resume();const t=c.currentTime,richness=level>=12?1:level>=10?.7:level>=9?.45:.2;
   const tone=(frequency:number,end:number,duration:number,volume:number,wave:OscillatorType='sine',delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=wave;o.frequency.setValueAtTime(frequency,t+delay);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+delay+duration);g.gain.setValueAtTime(volume,t+delay);g.gain.exponentialRampToValueAtTime(.001,t+delay+duration);o.start(t+delay);o.stop(t+delay+duration+.02);};
   if(type==='click'){tone(480,260,.1,.035);return;}if(type==='turn'){tone(660,630,.18,.04);tone(880,830,.26,.035,'sine',.1);return;}
   const impact=type==='impact';
   if(effect==='crystal'){tone(impact?1300:850,impact?380:1200,.23+richness*.18,.035,'triangle');tone(impact?1740:1275,620,.32,.022,'sine',.035);if(richness>.5)tone(2200,1100,.38,.015,'sine',.07);}
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
