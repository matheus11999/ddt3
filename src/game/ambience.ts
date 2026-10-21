import type {MapDefinition} from '../../shared/maps';

type Ambience = MapDefinition['audio']['ambience'];
const SAMPLE_RATE = 24_000;
const buffers = new WeakMap<AudioContext, Map<Ambience, readonly [AudioBuffer, AudioBuffer]>>();

/** All sounds are synthesized here: no recordings, downloads or copyrighted music. */
function randomGenerator(seed: number) {
 return () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
 };
}

function makeBed(context: AudioContext, theme: Ambience) {
 const buffer = context.createBuffer(1, SAMPLE_RATE * 8, SAMPLE_RATE);
 const data = buffer.getChannelData(0);
 const random = randomGenerator(theme === 'birds' ? 914 : theme === 'carnival' ? 417 : 802);
 let soft = 0, deep = 0, water = 0;
 for (let i = 0; i < data.length; i++) {
  const noise = random() * 2 - 1;
  soft += (noise - soft) * .035;
  deep += (noise - deep) * .004;
  water += (noise - water) * .3;
  const phase = i / data.length;
  // Smoothly close the noise loop without a click at its seam.
  const edge = Math.min(1, phase * 25, (1 - phase) * 25);
  const breeze = .72 + .28 * Math.sin(phase * Math.PI * 4);
  data[i] = edge * (theme === 'birds'
   ? soft * .11 * breeze + (water - soft) * .026
   : theme === 'carnival' ? soft * .065 * breeze
   : (soft * .17 + deep * .3) * breeze);
 }
 return buffer;
}

interface Voice {
 at: number;
 duration: number;
 frequency: number;
 end?: number;
 volume: number;
 pan: number;
 kind: 'bird' | 'bell' | 'glass';
}

function addVoice(buffer: AudioBuffer, voice: Voice) {
 const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
 const offset = Math.floor(voice.at * SAMPLE_RATE);
 const length = Math.min(Math.ceil(voice.duration * SAMPLE_RATE), left.length - offset);
 const leftGain = Math.sqrt((1 - voice.pan) / 2), rightGain = Math.sqrt((1 + voice.pan) / 2);
 let phase = 0;
 for (let i = 0; i < length; i++) {
  const t = i / SAMPLE_RATE, progress = t / voice.duration;
  const frequency = voice.frequency + ((voice.end ?? voice.frequency) - voice.frequency) * progress;
  phase += Math.PI * 2 * frequency / SAMPLE_RATE;
  let envelope: number, tone: number;
  if (voice.kind === 'bird') {
   envelope = Math.sin(Math.PI * progress) ** 2;
   tone = Math.sin(phase + Math.sin(t * 43) * 1.3) + Math.sin(phase * 2) * .08;
  } else {
   envelope = Math.min(1, t / .012) * Math.exp(-progress * 6) * (1 - progress);
   tone = Math.sin(phase) + Math.sin(phase * (voice.kind === 'glass' ? 2.76 : 2)) * .22
    + Math.sin(phase * (voice.kind === 'glass' ? 4.07 : 3)) * .055;
  }
  const sample = tone * envelope * voice.volume;
  left[offset + i] += sample * leftGain;
  right[offset + i] += sample * rightGain;
 }
}

function makeAccents(context: AudioContext, theme: Ambience) {
 const buffer = context.createBuffer(2, SAMPLE_RATE * 24, SAMPLE_RATE);
 if (theme === 'birds') {
  // Short, distant calls alternate across the garden, leaving quiet between them.
  for (const [at, pitch, pan] of [[2.1, 1800, -.65], [7.8, 2180, .5], [14.2, 1960, -.3], [20.5, 2330, .7]]) {
   addVoice(buffer, {at, duration: .23, frequency: pitch, end: pitch * 1.35, volume: .055, pan, kind: 'bird'});
   addVoice(buffer, {at: at + .31, duration: .17, frequency: pitch * 1.22, end: pitch * .9, volume: .04, pan, kind: 'bird'});
   addVoice(buffer, {at: at + .59, duration: .12, frequency: pitch * 1.15, end: pitch, volume: .025, pan, kind: 'bird'});
  }
 } else if (theme === 'carnival') {
  // An original music-box phrase, with rests so the turn and weapon cues stay clear.
  const melody = [0, 7, 12, 9, 4, 7, 2, 4, 9, 14, 12, 7, 4, 2, 7, 0];
  melody.forEach((note, i) => {
   const at = 1.1 + i * .72 + Math.floor(i / 4) * .36;
   addVoice(buffer, {at, duration: 1.2, frequency: 523.25 * 2 ** (note / 12), volume: i % 4 ? .055 : .065, pan: Math.sin(i * .8) * .22, kind: 'bell'});
   if (i % 4 === 0) addVoice(buffer, {at, duration: 1.65, frequency: 261.63 * 2 ** ((i === 8 ? 5 : 0) / 12), volume: .035, pan: -.15, kind: 'bell'});
  });
 } else {
  for (const [at, pitch, pan] of [[1.8, 659.25, -.6], [5.2, 987.77, .5], [9.7, 1318.51, -.25], [15.4, 880, .65], [20.1, 1174.66, -.5]]) {
   addVoice(buffer, {at, duration: 3.5, frequency: pitch, volume: .055, pan, kind: 'glass'});
   addVoice(buffer, {at: at + .22, duration: 2.8, frequency: pitch * 1.5, volume: .018, pan: -pan, kind: 'glass'});
  }
 }
 return buffer;
}

/** A bounded graph of two looping sources; the audio thread needs no JS scheduler. */
export function createEnvironmentTrack(context: AudioContext, theme: Ambience, destination: AudioNode = context.destination): {stop(): void} {
 let cache = buffers.get(context);
 if (!cache) {cache = new Map(); buffers.set(context, cache);}
 let sounds = cache.get(theme);
 if (!sounds) {sounds = [makeBed(context, theme), makeAccents(context, theme)]; cache.set(theme, sounds);}
 const output = context.createGain();
 output.gain.setValueAtTime(0, context.currentTime);
 output.gain.linearRampToValueAtTime(.25, context.currentTime + .8);
 output.connect(destination);
 const sources = sounds.map(buffer => {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(output);
  source.start();
  return source;
 });
 let stopped = false;
 return {stop() {
  if (stopped) return;
  stopped = true;
  for (const source of sources) {source.stop(); source.disconnect();}
  output.disconnect();
 }};
}
