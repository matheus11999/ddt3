/**
 * Pescaria: a second social zone next to Praça Celeste (docs/fishing.md). Players walk the
 * lakeside, stand on a fishing spot and cast; a bite opens the timing bar. The server decides
 * the fish, the bar, every press and the prize; the client only draws and reports presses.
 *
 * Map coordinates are world px like the plaza (the view is 1536×864; the camera follows the player).
 * Numbers here are provisional: matheus balances them later.
 */
export * from './fishingMap';

// ── Gear ──
/**
 * control widens the bar's target, speed multiplies the wait for a bite (lower = faster),
 * luck raises the odds of the harder fish, auto adds to the automatic mode's chance.
 */
export interface FishingRod {id:string;name:string;description:string;control:number;speed:number;luck:number;auto:number;}
export interface FishingBait {id:string;name:string;description:string;/** Never runs out (the simple bait). */infinite?:boolean;speed:number;luck:number;}
export const FISHING_RODS:readonly FishingRod[]=[
 {id:'rod-bamboo',name:'Vara de Bambu',description:'Vara inicial, leve e confiável.',control:0,speed:1,luck:0,auto:0},
 {id:'rod-oak',name:'Vara de Carvalho',description:'Alvo maior na barra e peixes raros com mais frequência.',control:.18,speed:.9,luck:.12,auto:.06},
];
export const FISHING_BAITS:readonly FishingBait[]=[
 {id:'bait-simple',name:'Isca Simples',description:'Minhoca comum. Nunca acaba.',infinite:true,speed:1,luck:0},
 {id:'bait-glow',name:'Isca Brilhante',description:'Atrai peixes raros e morde mais rápido. Gasta 1 por lançamento.',speed:.8,luck:.3},
];
export const STARTER_ROD='rod-bamboo',STARTER_BAIT='bait-simple';
export const ROD_BY_ID=new Map(FISHING_RODS.map(r=>[r.id,r]));
export const BAIT_BY_ID=new Map(FISHING_BAITS.map(b=>[b.id,b]));

// ── Fish ──
/** difficulty 1–5 sets the bar (speed, target, presses); points are the Pontos de Pesca a catch is worth. */
export interface Fish {id:string;name:string;lakes:readonly string[];weight:number;difficulty:1|2|3|4|5;minKg:number;maxKg:number;points:number;color:string;}
export const FISH:readonly Fish[]=[
 {id:'bota-velha',name:'Bota Velha',lakes:['ninfeias','profundo','cristal','juncos','termal'],weight:6,difficulty:1,minKg:.3,maxKg:.9,points:1,color:'#7a5a3a'},
 {id:'lambari-dourado',name:'Lambari Dourado',lakes:['ninfeias'],weight:40,difficulty:1,minKg:.1,maxKg:.4,points:2,color:'#f2c84b'},
 {id:'tilapia-rosada',name:'Tilápia Rosada',lakes:['ninfeias','profundo'],weight:30,difficulty:1,minKg:.4,maxKg:1.6,points:3,color:'#f08aa0'},
 {id:'carpa-lua',name:'Carpa da Lua',lakes:['ninfeias'],weight:18,difficulty:2,minKg:1,maxKg:4,points:5,color:'#d8dce8'},
 {id:'baiacu-bolha',name:'Baiacu Bolha',lakes:['ninfeias'],weight:8,difficulty:3,minKg:.5,maxKg:2,points:9,color:'#8fd16a'},
 {id:'koi-celeste',name:'Koi Celeste',lakes:['ninfeias'],weight:3,difficulty:4,minKg:2,maxKg:6,points:18,color:'#ff7a3d'},
 {id:'bagre-barbudo',name:'Bagre Barbudo',lakes:['profundo'],weight:30,difficulty:2,minKg:2,maxKg:8,points:5,color:'#8a7a5c'},
 {id:'tucunare-brasa',name:'Tucunaré Brasa',lakes:['profundo'],weight:18,difficulty:3,minKg:1.5,maxKg:6,points:9,color:'#e8a020'},
 {id:'enguia-trovao',name:'Enguia do Trovão',lakes:['profundo'],weight:6,difficulty:4,minKg:1,maxKg:5,points:18,color:'#4aa8ff'},
 {id:'pirarucu-ancestral',name:'Pirarucu Ancestral',lakes:['profundo'],weight:2,difficulty:5,minKg:30,maxKg:120,points:40,color:'#b8402e'},
 {id:'peixe-vidro',name:'Peixe-Vidro',lakes:['cristal'],weight:30,difficulty:2,minKg:.2,maxKg:1,points:6,color:'#a8f0ff'},
 {id:'truta-aurora',name:'Truta Aurora',lakes:['cristal'],weight:20,difficulty:3,minKg:1,maxKg:4,points:10,color:'#c08aff'},
 {id:'dourado-real',name:'Dourado Real',lakes:['cristal'],weight:8,difficulty:4,minKg:4,maxKg:15,points:20,color:'#ffcf33'},
 {id:'traira-taboa',name:'Traíra das Taboas',lakes:['juncos'],weight:34,difficulty:2,minKg:.6,maxKg:3,points:5,color:'#6f7a3a'},
 {id:'pacu-esmeralda',name:'Pacu Esmeralda',lakes:['juncos'],weight:20,difficulty:3,minKg:1,maxKg:5,points:9,color:'#3fb07a'},
 {id:'dourado-do-junco',name:'Peixe-Junco Dourado',lakes:['juncos'],weight:5,difficulty:4,minKg:2,maxKg:7,points:18,color:'#e8c23a'},
 {id:'carpa-termal',name:'Carpa Termal',lakes:['termal'],weight:30,difficulty:2,minKg:.8,maxKg:3.5,points:6,color:'#f29a6a'},
 {id:'salamandra-vapor',name:'Salamandra do Vapor',lakes:['termal'],weight:16,difficulty:3,minKg:.3,maxKg:1.5,points:11,color:'#ff6a3a'},
 {id:'fenix-dagua',name:"Fênix d'Água",lakes:['termal'],weight:2,difficulty:5,minKg:5,maxKg:25,points:48,color:'#ff9a1a'},
 {id:'carpa-dragao',name:'Carpa-Dragão',lakes:['cristal'],weight:2,difficulty:5,minKg:10,maxKg:40,points:50,color:'#ff4a4a'},
];
export const FISH_BY_ID=new Map(FISH.map(f=>[f.id,f]));

/** Seconds waiting for a bite, before the rod and the bait (and ×AUTO_WAIT in automatic). */
export const BITE_WAIT=[6,13] as const;
export const AUTO_WAIT=1.2;
/** After the bite the bar shows "Fisgou!" this long before the marker counts. */
export const HOOK_LEAD_MS=700;
/** The result stays on screen this long; then the line can be cast again (automatic recasts by itself). */
export const RESULT_MS=2600;
/** Presses may be stamped up to this long before they reach the server (latency). */
export const PRESS_GRACE_MS=700;
/** The bar in automatic mode resolves itself after AUTO_BASE_MS + AUTO_PER_HIT_MS per press, with a lower chance. */
export const AUTO_BASE_MS=1200,AUTO_PER_HIT_MS=900;
/** Automatic catches count as this quality (manual perfect presses go up to 1). */
export const AUTO_QUALITY=.3;

/** Small seeded generator, so the server and a test agree on every number of a bar. */
export function seeded(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/**
 * The timing bar for one fish: the marker sweeps 0→1→0 at `speed` bar lengths per second and each
 * press needs it inside the target. Harder fish move the target back and forth (`drift`).
 */
export interface FishChallenge {hits:number;speed:number;/** Centre of the target for each press, 0..1. */zones:number[];width:number;perfect:number;misses:number;limitMs:number;/** How far the target swims each way (0 = still) and the time of one full swing. */drift:number;driftMs:number;}
export function fishChallenge(fish:Fish,rod:FishingRod,seed:number):FishChallenge{
 const rand=seeded(seed),d=fish.difficulty;
 const hits=d<=2?2:d<=4?3:4,width=Math.min(.4,(.26-.03*(d-1))*(1+rod.control)),perfect=width*.34;
 const drift=d<=2?0:Math.min(.2,.07*(d-2)),driftMs=2600-220*d;
 const margin=width/2+drift+.03,zones=Array.from({length:hits},()=>margin+rand()*Math.max(0,1-2*margin));
 return {hits,speed:.8+.22*(d-1),zones,width,perfect,misses:2,limitMs:3500+2600*hits,drift,driftMs};
}
/** Marker position 0..1 after `elapsed` ms of the bar. */
export function markerAt(challenge:Pick<FishChallenge,'speed'>,elapsed:number):number{
 const p=(Math.max(0,elapsed)/1000*challenge.speed)%2;return p<=1?p:2-p;
}
/** Centre of the target for press number `press` at `elapsed` ms (it swims on harder fish). */
export function zoneAt(challenge:FishChallenge,press:number,elapsed:number):number{
 const base=challenge.zones[Math.min(press,challenge.zones.length-1)];
 if(!challenge.drift)return base;
 return base+challenge.drift*Math.sin(Math.max(0,elapsed)/challenge.driftMs*Math.PI*2+press*1.7);
}
export type PressGrade='perfect'|'hit'|'miss';
export function gradePress(challenge:FishChallenge,press:number,elapsed:number):PressGrade{
 const off=Math.abs(markerAt(challenge,elapsed)-zoneAt(challenge,press,elapsed));
 return off<=challenge.perfect/2?'perfect':off<=challenge.width/2?'hit':'miss';
}
/** Chance that the automatic mode lands this fish: always below a good manual player. */
export function autoChance(fish:Fish,rod:FishingRod):number{return Math.max(.2,Math.min(.85,.82-.11*(fish.difficulty-1)+rod.auto));}
/** Picks the fish that bites, by lake, rod and bait luck (harder fish gain weight with luck). */
export function pickFish(lake:string,rod:FishingRod,bait:FishingBait,roll:number):Fish{
 const luck=rod.luck+bait.luck,pool=FISH.filter(f=>f.lakes.includes(lake));
 const weights=pool.map(f=>f.weight*(f.difficulty>=3?1+luck*(f.difficulty-2):1)),total=weights.reduce((a,b)=>a+b,0);
 let r=roll*total;for(let i=0;i<pool.length;i++){r-=weights[i];if(r<0)return pool[i];}
 return pool[pool.length-1];
}
/** Weight in kg (2 decimals): luck of the draw plus the quality of the presses. */
export function fishWeight(fish:Fish,roll:number,quality:number):number{
 return Math.round((fish.minKg+(fish.maxKg-fish.minKg)*Math.min(1,roll*.7+quality*.3))*100)/100;
}
/** Pontos de Pesca for a catch: the fish's points plus up to half again for perfect presses. */
export function catchPoints(fish:Fish,quality:number):number{return fish.points+Math.round(fish.points*.5*quality);}
export function biteWaitMs(rod:FishingRod,bait:FishingBait,auto:boolean,roll:number):number{
 return Math.round((BITE_WAIT[0]+(BITE_WAIT[1]-BITE_WAIT[0])*roll)*1000*rod.speed*bait.speed*(auto?AUTO_WAIT:1));
}

// ── Nível de pescador ──
export const MAX_FISHING_LEVEL=50;
/** Total fishing EXP to reach `level` (level 1 starts at 0). */
export function fishingXpFor(level:number):number{return level<=1?0:Math.round(60*(level-1)**1.7);}
export function fishingLevel(xp:number):number{let level=1;while(level<MAX_FISHING_LEVEL&&xp>=fishingXpFor(level+1))level++;return level;}
export function fishingLevelProgress(xp:number){const level=fishingLevel(xp),from=fishingXpFor(level),to=fishingXpFor(level+1);return {level,current:xp-from,required:level>=MAX_FISHING_LEVEL?0:to-from,percent:level>=MAX_FISHING_LEVEL?100:Math.floor((xp-from)/(to-from)*100)};}
/** EXP for a catch (the same in manual and automatic; automatic just lands fewer fish). */
export function catchXp(fish:Fish):number{return fish.points*10;}
/** Each fisher level widens the bar's target a little and raises the odds of rare fish (and the automatic chance). */
export function levelBonus(level:number){const n=Math.max(0,Math.min(MAX_FISHING_LEVEL,level)-1);return {control:n*.008,luck:n*.006,auto:n*.002};}
/** The rod as it fishes for a player of this fisher level. */
export function effectiveRod(rod:FishingRod,level:number):FishingRod{const b=levelBonus(level);return {...rod,control:rod.control+b.control,luck:rod.luck+b.luck,auto:rod.auto+b.auto};}

// ── Profile ──
/** What a profile keeps about fishing (persisted inside the profile JSON). */
export interface FishingProfile {rod:string;bait:string;rods:string[];/** Consumable baits; the simple bait is not counted. */baits:Record<string,number>;/** Pontos de Pesca, spent at the fishing shop. */points:number;/** Catches per fish (the collection). */caught:Record<string,number>;/** Heaviest catch per fish, kg. */best:Record<string,number>;total:number;/** Fisher EXP; the level comes from it (fishingLevel). */xp:number;}
const int=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
export function normalizeFishing(raw:unknown):FishingProfile{
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<FishingProfile>;
 const rods=[...new Set([STARTER_ROD,...(Array.isArray(r.rods)?r.rods.filter(id=>ROD_BY_ID.has(id)):[])])];
 const baits=Object.fromEntries(Object.entries(r.baits??{}).filter(([id,n])=>BAIT_BY_ID.has(id)&&!BAIT_BY_ID.get(id)!.infinite&&int(n)>0).map(([id,n])=>[id,int(n,9999)]));
 const bait=typeof r.bait==='string'&&BAIT_BY_ID.has(r.bait)&&(BAIT_BY_ID.get(r.bait)!.infinite||baits[r.bait]>0)?r.bait:STARTER_BAIT;
 const caught=Object.fromEntries(Object.entries(r.caught??{}).filter(([id])=>FISH_BY_ID.has(id)).map(([id,n])=>[id,int(n)]).filter(([,n])=>(n as number)>0));
 const best=Object.fromEntries(Object.entries(r.best??{}).filter(([id,kg])=>FISH_BY_ID.has(id)&&typeof kg==='number'&&kg>0).map(([id,kg])=>[id,Math.round((kg as number)*100)/100]));
 return {rod:typeof r.rod==='string'&&rods.includes(r.rod)?r.rod:STARTER_ROD,bait,rods,baits,points:int(r.points),caught,best,total:int(r.total),xp:int(r.xp)};
}

// ── Fishing shop (Casa de Pesca): Pontos de Pesca for rewards ──
export type FishingPrize={kind:'gold';amount:number}|{kind:'stone';level:number;amount:number}|{kind:'ticket';amount:number}|{kind:'pet-food';food:string;amount:number}|{kind:'rod';rod:string}|{kind:'bait';bait:string;amount:number};
export interface FishingOffer {id:string;name:string;description:string;cost:number;prize:FishingPrize;/** Fisher level needed to buy it. */level?:number;}
export const FISHING_SHOP:readonly FishingOffer[]=[
 {id:'gold-100',name:'100 de Ouro',description:'Moedas Brasa.',cost:50,prize:{kind:'gold',amount:100}},
 {id:'bait-glow-10',name:'Isca Brilhante ×10',description:'Peixes raros mordem mais.',cost:60,prize:{kind:'bait',bait:'bait-glow',amount:10}},
 {id:'stone-1',name:'Pedra de Fortalecimento Nv. 1',description:'Para o Ferreiro.',cost:30,prize:{kind:'stone',level:1,amount:1}},
 {id:'stone-2',name:'Pedra de Fortalecimento Nv. 2',description:'Para o Ferreiro.',cost:110,prize:{kind:'stone',level:2,amount:1},level:3},
 {id:'ticket-1',name:'Ticket de Cor',description:'Troca a cor de uma peça.',cost:150,prize:{kind:'ticket',amount:1}},
 {id:'pet-food-dew',name:'Adubo de Orvalho',description:'Comida de pet.',cost:40,prize:{kind:'pet-food',food:'pet-food-dew',amount:1}},
 {id:'rod-oak',name:'Vara de Carvalho',description:'Alvo maior na barra e mais peixes raros.',cost:800,prize:{kind:'rod',rod:'rod-oak'},level:5},
];
export const FISHING_OFFER_BY_ID=new Map(FISHING_SHOP.map(o=>[o.id,o]));
export const MAX_FISHING_BUY=20;

// ── What the client sees ──
export type FishingPhase='idle'|'waiting'|'bite'|'result';
export interface FishingCatch {fish:string;kg:number;points:number;xp:number;record:boolean;first:boolean;/** Fisher level reached with this catch, when it went up. */levelUp?:number;}
/** My own fishing session: the bar runs from `start` (server time); `press`/`hits`/`misses` count the presses so far. */
export interface FishingView {spot:string;phase:FishingPhase;auto:boolean;since:number;challenge?:FishChallenge&{start:number;press:number;misses:number;grades:PressGrade[]};result?:{success:boolean;catch?:FishingCatch;fish?:string};}
/** What other players see of someone fishing (rod out, float, the fish coming out of the water). */
export interface FishingPose {spot:string;phase:FishingPhase;since:number;success?:boolean;fish?:string;}
