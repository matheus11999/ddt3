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
 * `drops` are the rod's own extra prizes, rolled on every catch (never helped by the fisher level).
 * Iscas saíram do jogo (pedido do matheus, 20/10): a vara é a progressão da pesca.
 */
export interface FishingRod {id:string;name:string;description:string;control:number;speed:number;luck:number;auto:number;drops?:readonly RodDrop[];}
/** One extra prize a rod can bring up with a fish: `chance` per manual catch (automatic: × AUTO_EFFICIENCY per fish, slower fish). */
export type RodDrop={kind:'gold';chance:number;min:number;max:number}|{kind:'coupons';chance:number;amount:number}|{kind:'fragment';chance:number;weapon:string;amount:number};
/** The weapon whose fragments come from fishing (50 make it in the Ferreiro, shared/synthesis.ts). */
export const FISHING_WEAPON='tide-rod';
export const FISHING_RODS:readonly FishingRod[]=[
 {id:'rod-bamboo',name:'Vara de Bambu',description:'Vara inicial, leve e confiável.',control:0,speed:1,luck:0,auto:0},
 {id:'rod-oak',name:'Vara de Carvalho',description:'Alvo maior na barra e peixes raros com mais frequência. Às vezes traz Ouro.',control:.18,speed:.9,luck:.12,auto:.06,
  drops:[{kind:'gold',chance:.02,min:6,max:18}]},
 {id:'rod-coral',name:'Vara de Coral',description:'Mais Ouro e, raramente, um Fragmento da Vara das Marés.',control:.24,speed:.86,luck:.2,auto:.08,
  drops:[{kind:'gold',chance:.03,min:12,max:30},{kind:'fragment',chance:.0012,weapon:FISHING_WEAPON,amount:1}]},
 {id:'rod-crystal',name:'Vara de Cristal',description:'Peixes raros mordem bem mais; Fragmentos com mais frequência.',control:.3,speed:.82,luck:.28,auto:.1,
  drops:[{kind:'gold',chance:.03,min:18,max:48},{kind:'fragment',chance:.003,weapon:FISHING_WEAPON,amount:1}]},
 {id:'rod-aurora',name:'Vara da Aurora',description:'Pode pescar Cupons, com chance muito baixa.',control:.36,speed:.78,luck:.36,auto:.12,
  drops:[{kind:'gold',chance:.04,min:24,max:60},{kind:'coupons',chance:.0002,amount:1},{kind:'fragment',chance:.006,weapon:FISHING_WEAPON,amount:1}]},
 {id:'rod-royal',name:'Vara Real',description:'A melhor vara: mais Cupons e Fragmentos.',control:.42,speed:.74,luck:.45,auto:.14,
  drops:[{kind:'gold',chance:.04,min:30,max:90},{kind:'coupons',chance:.0004,amount:1},{kind:'fragment',chance:.012,weapon:FISHING_WEAPON,amount:1}]},
];
export const STARTER_ROD='rod-bamboo';
/**
 * What 5 marks mean on the rod card (expected Ouro per fish, chance of a Cupom, chance of a Fragmento).
 * Pedido do matheus (20/10): as varas de agora, que qualquer um consegue pescando, chegam no máximo a
 * 3 marcas de Ouro, 2 de Cupons e 3 de Fragmentos (a Vara Real); as marcas de cima ficam para varas futuras.
 */
export const ROD_MARK_TOP={gold:4,coupons:.001,fragments:.02} as const;
export const ROD_BY_ID=new Map(FISHING_RODS.map(r=>[r.id,r]));
/** Most of each rod prize one player can fish per day (Brasília): keeps the AFK from minting cash. */
export const FISHING_DAILY_CAPS={gold:2000,coupons:5,fragments:10} as const;
export type FishingDropKind=keyof typeof FISHING_DAILY_CAPS;
/** A prize that came up with a fish (what was actually given, after the daily cap). */
export interface FishingDrop {kind:FishingDropKind;amount:number;/** Fragments: the weapon they belong to. */weapon?:string;}
const DROP_ORDER={coupons:0,fragment:1,gold:2} as const;
/**
 * Rolls the rod's prize for one catch: at most one (pedido do matheus, 20/10), the rarest that comes up
 * (Cupom, then Fragmento, then Ouro). `roll` is the server's [0,1) generator.
 */
export function rollRodDrops(rod:FishingRod,auto:boolean,roll:()=>number):FishingDrop[]{
 for(const d of [...rod.drops??[]].sort((a,b)=>DROP_ORDER[a.kind]-DROP_ORDER[b.kind])){
  if(roll()>=d.chance*(auto?AUTO_EFFICIENCY:1))continue;
  if(d.kind==='gold')return [{kind:'gold',amount:d.min+Math.floor(roll()*(d.max-d.min+1))}];
  if(d.kind==='coupons')return [{kind:'coupons',amount:d.amount}];
  return [{kind:'fragments',amount:d.amount,weapon:d.weapon}];
 }
 return [];
}
const DAY=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
/** The Brasília calendar day of a time, as the daily caps count it. */
export function fishingDay(at:number):string{return DAY.format(new Date(at));}

// ── Fish ──
/** difficulty 1–5 sets the bar (speed, target, presses); points are the Pontos de Pesca a catch is worth. */
export interface Fish {id:string;name:string;lakes:readonly string[];weight:number;difficulty:1|2|3|4|5;minKg:number;maxKg:number;points:number;color:string;}
export const FISH:readonly Fish[]=[
 {id:'bota-velha',name:'Bota Velha',lakes:['ninfeias'],weight:6,difficulty:1,minKg:.3,maxKg:.9,points:1,color:'#7a5a3a'},
 {id:'lambari-dourado',name:'Lambari Dourado',lakes:['ninfeias'],weight:40,difficulty:1,minKg:.1,maxKg:.4,points:2,color:'#f2c84b'},
 {id:'tilapia-rosada',name:'Tilápia Rosada',lakes:['ninfeias'],weight:30,difficulty:1,minKg:.4,maxKg:1.6,points:3,color:'#f08aa0'},
 {id:'carpa-lua',name:'Carpa da Lua',lakes:['ninfeias'],weight:18,difficulty:2,minKg:1,maxKg:4,points:5,color:'#d8dce8'},
 {id:'baiacu-bolha',name:'Baiacu Bolha',lakes:['ninfeias'],weight:8,difficulty:3,minKg:.5,maxKg:2,points:9,color:'#8fd16a'},
 {id:'koi-celeste',name:'Koi Celeste',lakes:['ninfeias'],weight:3,difficulty:4,minKg:2,maxKg:6,points:18,color:'#ff7a3d'},
 {id:'bagre-barbudo',name:'Bagre Barbudo',lakes:['ninfeias'],weight:30,difficulty:2,minKg:2,maxKg:8,points:5,color:'#8a7a5c'},
 {id:'tucunare-brasa',name:'Tucunaré Brasa',lakes:['ninfeias'],weight:18,difficulty:3,minKg:1.5,maxKg:6,points:9,color:'#e8a020'},
 {id:'enguia-trovao',name:'Enguia do Trovão',lakes:['ninfeias'],weight:6,difficulty:4,minKg:1,maxKg:5,points:18,color:'#4aa8ff'},
 {id:'pirarucu-ancestral',name:'Pirarucu Ancestral',lakes:['ninfeias'],weight:2,difficulty:5,minKg:30,maxKg:120,points:40,color:'#b8402e'},
 {id:'peixe-vidro',name:'Peixe-Vidro',lakes:['ninfeias'],weight:30,difficulty:2,minKg:.2,maxKg:1,points:6,color:'#a8f0ff'},
 {id:'truta-aurora',name:'Truta Aurora',lakes:['ninfeias'],weight:20,difficulty:3,minKg:1,maxKg:4,points:10,color:'#c08aff'},
 {id:'dourado-real',name:'Dourado Real',lakes:['ninfeias'],weight:8,difficulty:4,minKg:4,maxKg:15,points:20,color:'#ffcf33'},
 {id:'traira-taboa',name:'Traíra das Taboas',lakes:['ninfeias'],weight:34,difficulty:2,minKg:.6,maxKg:3,points:5,color:'#6f7a3a'},
 {id:'pacu-esmeralda',name:'Pacu Esmeralda',lakes:['ninfeias'],weight:20,difficulty:3,minKg:1,maxKg:5,points:9,color:'#3fb07a'},
 {id:'dourado-do-junco',name:'Peixe-Junco Dourado',lakes:['ninfeias'],weight:5,difficulty:4,minKg:2,maxKg:7,points:18,color:'#e8c23a'},
 {id:'carpa-termal',name:'Carpa Termal',lakes:['ninfeias'],weight:30,difficulty:2,minKg:.8,maxKg:3.5,points:6,color:'#f29a6a'},
 {id:'salamandra-vapor',name:'Salamandra do Vapor',lakes:['ninfeias'],weight:16,difficulty:3,minKg:.3,maxKg:1.5,points:11,color:'#ff6a3a'},
 {id:'fenix-dagua',name:"Fênix d'Água",lakes:['ninfeias'],weight:2,difficulty:5,minKg:5,maxKg:25,points:48,color:'#ff9a1a'},
 {id:'carpa-dragao',name:'Carpa-Dragão',lakes:['ninfeias'],weight:2,difficulty:5,minKg:10,maxKg:40,points:50,color:'#ff4a4a'},
];
export const FISH_BY_ID=new Map(FISH.map(f=>[f.id,f]));

/** Raridade dos peixes (pedido do matheus, 20/10): sai da dificuldade, 1 Comum a 5 Lendário. */
export type FishRarity='comum'|'normal'|'raro'|'epico'|'lendario';
export interface FishRarityInfo {id:FishRarity;name:string;color:string;/** Épico e Lendário são anunciados no chat Mundo do canal. */announce:boolean;}
export const FISH_RARITIES:readonly FishRarityInfo[]=[
 {id:'comum',name:'Comum',color:'#c9d3de',announce:false},
 {id:'normal',name:'Normal',color:'#7ee07a',announce:false},
 {id:'raro',name:'Raro',color:'#5ab4ff',announce:false},
 {id:'epico',name:'Épico',color:'#c07aff',announce:true},
 {id:'lendario',name:'Lendário',color:'#ffc93a',announce:true},
];
export const fishRarity=(fish:Pick<Fish,'difficulty'>):FishRarityInfo=>FISH_RARITIES[Math.max(1,Math.min(5,fish.difficulty))-1];

/** Seconds waiting for a bite, before the rod (and ×AUTO_WAIT in automatic). */
export const BITE_WAIT=[6,13] as const;
/**
 * Pedido do matheus (20/10, segunda vez): no automático o peixe demora bem mais para morder (×AUTO_WAIT) e
 * cada peixe vale AUTO_EFFICIENCY do manual, então por hora o AFK rende cerca de 25% de quem está jogando
 * (`autoHourlyShare`, conferido em tests/fishing.test.ts).
 */
export const AUTO_WAIT=2.2;
/** After the bite the bar shows "Fisgou!" this long before the marker counts. */
export const HOOK_LEAD_MS=700;
/** The result stays on screen this long; then the line goes back into the water by itself (manual and automatic). */
export const RESULT_MS=2600;
/** Manual bars in a row left without a single press before the line stops recasting by itself (the player walked off). */
export const FISHING_IGNORED_STOP=2;
/** Presses may be stamped up to this long before they reach the server (latency). */
export const PRESS_GRACE_MS=700;
/** The bar in automatic mode resolves itself after AUTO_BASE_MS + AUTO_PER_HIT_MS per press, with a lower chance. */
export const AUTO_BASE_MS=1200,AUTO_PER_HIT_MS=900;
/** Automatic catches count as this quality for the weight (manual perfect presses go up to 1). */
export const AUTO_QUALITY=.3;
/** Each automatic fish is worth this share of a manual one (Pontos, EXP, the rod's prizes); with the slower bites the hour comes to ~25%. */
export const AUTO_EFFICIENCY=.5;
/** Points and EXP of an automatic catch: AUTO_EFFICIENCY of the manual value of the same fish and weight, never zero. */
export function autoReward(fish:Fish,kg:number){return {points:Math.max(1,Math.round(catchPoints(fish,kg,0)*AUTO_EFFICIENCY)),xp:Math.max(1,Math.round(catchXp(fish,kg)*AUTO_EFFICIENCY))};}

/** Small seeded generator, so the server and a test agree on every number of a bar. */
export function seeded(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/**
 * The timing bar for one fish: the marker sweeps 0→1→0 at `speed` bar lengths per second and each
 * press needs it inside the target. Harder fish move the target back and forth (`drift`).
 */
export interface FishChallenge {hits:number;speed:number;/** Centre of the target for each press, 0..1. */zones:number[];width:number;perfect:number;misses:number;limitMs:number;/** How far the target swims each way (0 = still) and the time of one full swing. */drift:number;driftMs:number;}
/** Marker speed of the bar: base for the easiest fish, plus this per difficulty step (the HUD reads the stars back from it). */
export const BAR_SPEED=[.72,.2] as const;
export function fishChallenge(fish:Fish,rod:FishingRod,seed:number):FishChallenge{
 const rand=seeded(seed),d=fish.difficulty;
 // Pedido do matheus (20/10): um pouco mais fácil (alvo ~15% mais largo, barra ~10% mais lenta, peixe fugindo menos).
 const hits=d<=2?2:d<=4?3:4,width=Math.min(.44,(.3-.03*(d-1))*(1+rod.control)),perfect=width*.36;
 const drift=d<=2?0:Math.min(.17,.06*(d-2)),driftMs=2800-220*d;
 const margin=width/2+drift+.03,zones=Array.from({length:hits},()=>margin+rand()*Math.max(0,1-2*margin));
 return {hits,speed:BAR_SPEED[0]+BAR_SPEED[1]*(d-1),zones,width,perfect,misses:2,limitMs:3500+2600*hits,drift,driftMs};
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
/** Picks the fish that bites, by lake and the rod's luck (with the fisher level; harder fish gain weight with luck). */
export function pickFish(lake:string,rod:FishingRod,roll:number):Fish{
 const luck=rod.luck,pool=FISH.filter(f=>f.lakes.includes(lake));
 const weights=pool.map(f=>f.weight*(f.difficulty>=3?1+luck*(f.difficulty-2):1)),total=weights.reduce((a,b)=>a+b,0);
 let r=roll*total;for(let i=0;i<pool.length;i++){r-=weights[i];if(r<0)return pool[i];}
 return pool[pool.length-1];
}
/**
 * Weight in kg (2 decimals). Pedido do matheus (20/10): peixe pesado é muito difícil em qualquer raridade.
 * The draw is skewed hard toward the light end (roll^WEIGHT_SKEW: half the catches sit in the lightest 0.4%
 * of the range, one in twelve passes half of it, about one in eighty passes 90%) and only perfect presses
 * (quality 1) can reach the top; automatic catches (AUTO_QUALITY) stop at 79%.
 */
export const WEIGHT_SKEW=8;
export function fishWeight(fish:Fish,roll:number,quality:number):number{
 const share=Math.max(0,Math.min(1,roll))**WEIGHT_SKEW*(.7+.3*Math.max(0,Math.min(1,quality)));
 return Math.round((fish.minKg+(fish.maxKg-fish.minKg)*share)*100)/100;
}
/** How heavy a catch is for its kind: 0 the lightest it comes, 1 the heaviest. */
export function weightShare(fish:Pick<Fish,'minKg'|'maxKg'>,kg:number):number{return Math.max(0,Math.min(1,(kg-fish.minKg)/(fish.maxKg-fish.minKg||1)));}
/**
 * Pontos de Pesca a catch is worth (pedido do matheus: o valor vem da raridade e do peso). The fish's
 * points (its rarity) times ×0.5 for the lightest up to ×3 for the heaviest, plus up to a quarter for perfect presses.
 */
export function catchPoints(fish:Fish,kg:number,quality:number):number{
 return Math.max(1,Math.round(fish.points*(.5+2.5*weightShare(fish,kg))*(1+.25*Math.max(0,Math.min(1,quality)))));
}
/** Rough share of a manual player's hourly Pontos the automatic mode makes on a fish of difficulty `d` (wait, pull, result, chance and value). */
export function autoHourlyShare(d:number,rod:FishingRod=ROD_BY_ID.get(STARTER_ROD)!,manualChance=.85){
 const fish={difficulty:d} as Fish,hits=d<=2?2:d<=4?3:4,wait=(BITE_WAIT[0]+BITE_WAIT[1])/2*1000*rod.speed;
 const manual=wait+HOOK_LEAD_MS+hits*1300+RESULT_MS,auto=wait*AUTO_WAIT+AUTO_BASE_MS+AUTO_PER_HIT_MS*hits+RESULT_MS;
 return autoChance(fish,rod)*AUTO_EFFICIENCY/auto/(manualChance/manual);
}
export function biteWaitMs(rod:FishingRod,auto:boolean,roll:number):number{
 return Math.round((BITE_WAIT[0]+(BITE_WAIT[1]-BITE_WAIT[0])*roll)*1000*rod.speed*(auto?AUTO_WAIT:1));
}

// ── Nível de pescador ──
export const MAX_FISHING_LEVEL=50;
/** Total fishing EXP to reach `level` (level 1 starts at 0). */
// Progressão lenta (pedido do matheus, 20/10): Nv. 5 ≈ 100 peixes, Nv. 12 ≈ 700, Nv. 50 ≈ 12 mil.
export function fishingXpFor(level:number):number{return level<=1?0:Math.round(100*(level-1)**1.9);}
export function fishingLevel(xp:number):number{let level=1;while(level<MAX_FISHING_LEVEL&&xp>=fishingXpFor(level+1))level++;return level;}
export function fishingLevelProgress(xp:number){const level=fishingLevel(xp),from=fishingXpFor(level),to=fishingXpFor(level+1);return {level,current:xp-from,required:level>=MAX_FISHING_LEVEL?0:to-from,percent:level>=MAX_FISHING_LEVEL?100:Math.floor((xp-from)/(to-from)*100)};}
/** Fisher EXP of a manual catch by rarity, a little more for a heavy one (automatic gets AUTO_EFFICIENCY of it, `autoReward`). */
export const RARITY_XP=[6,10,18,32,60] as const;
export function catchXp(fish:Fish,kg:number):number{return Math.round(RARITY_XP[Math.max(1,Math.min(5,fish.difficulty))-1]*(.8+.6*weightShare(fish,kg)));}

// ── Ranking semanal do maior peixe (pedido do matheus, 20/10): só o peso conta, de qualquer raridade ──
/** The Brasília week of a time, named by its Monday (YYYY-MM-DD); the ranking starts over every Monday at 00:00. */
export function fishingWeek(at:number):string{
 const [y,m,d]=fishingDay(at).split('-').map(Number),day=new Date(Date.UTC(y,m-1,d)),back=(day.getUTCDay()+6)%7;
 day.setUTCDate(day.getUTCDate()-back);return day.toISOString().slice(0,10);
}
/** One line of the week's ranking: each player's heaviest fish of the week. */
export interface FishRankEntry {rank:number;id:string;name:string;fish:string;kg:number;}
export interface FishRanking {week:string;entries:FishRankEntry[];}
export const FISH_RANKING_SIZE=10;
/** Each fisher level widens the bar's target a little and raises the odds of rare fish (and the automatic chance); never the rod's prizes. */
export function levelBonus(level:number){const n=Math.max(0,Math.min(MAX_FISHING_LEVEL,level)-1);return {control:n*.008,luck:n*.006,auto:n*.002};}
/** The rod as it fishes for a player of this fisher level. */
export function effectiveRod(rod:FishingRod,level:number):FishingRod{const b=levelBonus(level);return {...rod,control:rod.control+b.control,luck:rod.luck+b.luck,auto:rod.auto+b.auto};}

// ── Profile ──
/** What a profile keeps about fishing (persisted inside the profile JSON). */
export interface FishingProfile {rod:string;rods:string[];/** Pontos de Pesca, spent at the fishing shop. */points:number;/** Catches per fish (the collection). */caught:Record<string,number>;/** Heaviest catch per fish, kg. */best:Record<string,number>;total:number;/** Fisher EXP; the level comes from it (fishingLevel). */xp:number;/** The last catches, newest first (FISHING_HISTORY at most). */history:FishingHistoryEntry[];/** Rod prizes fished today (Brasília), against FISHING_DAILY_CAPS. */daily:{day:string;gold:number;coupons:number;fragments:number};/** The heaviest fish of this week (fishingWeek), for the ranking. */week?:{key:string;fish:string;kg:number};/** Fish kept in the Sacola, one by one, until sold at the Casa de Pesca (newest first). */bag:BagFish[];}
/**
 * One fish in the Sacola (pedido do matheus, 20/10): each catch is its own fish with its weight; two of the
 * same kind with different weights are two fish worth different amounts. `value` is fixed at the catch
 * (rarity × weight × presses, catchPoints; a quarter in automatic) and paid in Pontos de Pesca when sold.
 */
export interface BagFish {id:string;fish:string;kg:number;value:number;at:number;auto?:boolean;}
/** The Sacola holds this many fish; a catch with the Sacola full is sold on the spot. */
export const FISH_BAG_MAX=200;
/** At most this many fish per sale. */
export const MAX_FISH_SELL=FISH_BAG_MAX;
/** One catch in the history window. */
export interface FishingHistoryEntry {fish:string;kg:number;points:number;xp:number;at:number;auto?:boolean;drops?:FishingDrop[];}
export const FISHING_HISTORY=30;
/** Pontos de Pesca given back per leftover Isca Brilhante (60 points bought 10). */
const BAIT_REFUND=6;
const int=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
export function normalizeFishing(raw:unknown):FishingProfile{
 const r=(raw&&typeof raw==='object'?raw:{}) as Partial<FishingProfile>;
 const rods=[...new Set([STARTER_ROD,...(Array.isArray(r.rods)?r.rods.filter(id=>ROD_BY_ID.has(id)):[])])];
 const caught=Object.fromEntries(Object.entries(r.caught??{}).filter(([id])=>FISH_BY_ID.has(id)).map(([id,n])=>[id,int(n)]).filter(([,n])=>(n as number)>0));
 const best=Object.fromEntries(Object.entries(r.best??{}).filter(([id,kg])=>FISH_BY_ID.has(id)&&typeof kg==='number'&&kg>0).map(([id,kg])=>[id,Math.round((kg as number)*100)/100]));
 const history=(Array.isArray(r.history)?r.history:[]).filter((h):h is FishingHistoryEntry=>!!h&&typeof h==='object'&&FISH_BY_ID.has(h.fish)&&typeof h.at==='number').slice(0,FISHING_HISTORY)
  .map(h=>{const drops=(Array.isArray(h.drops)?h.drops:[]).filter(d=>d&&typeof d==='object'&&Object.hasOwn(FISHING_DAILY_CAPS,d.kind)&&int(d.amount)>0).map(d=>({kind:d.kind,amount:int(d.amount),...(typeof d.weapon==='string'?{weapon:d.weapon}:{})}));
   return {fish:h.fish,kg:typeof h.kg==='number'?Math.round(h.kg*100)/100:0,points:int(h.points),xp:int(h.xp),at:h.at,...(h.auto?{auto:true}:{}),...(drops.length?{drops}:{})};});
 // Iscas saíram do jogo (20/10): cada Isca Brilhante que sobrou volta como Pontos de Pesca (o preço dela na Casa de Pesca).
 const legacy=(raw&&typeof raw==='object'?raw:{}) as {baits?:Record<string,unknown>};
 const refund=int(legacy.baits?.['bait-glow'],9999)*BAIT_REFUND;
 const d=r.daily&&typeof r.daily==='object'?r.daily:undefined;
 const daily={day:typeof d?.day==='string'?d.day:'',gold:int(d?.gold),coupons:int(d?.coupons),fragments:int(d?.fragments)};
 const w=r.week&&typeof r.week==='object'?r.week:undefined;
 const week=w&&typeof w.key==='string'&&FISH_BY_ID.has(w.fish)&&typeof w.kg==='number'&&w.kg>0?{key:w.key,fish:w.fish,kg:Math.round(w.kg*100)/100}:undefined;
 const seen=new Set<string>();
 const bag=(Array.isArray(r.bag)?r.bag:[]).filter((b):b is BagFish=>!!b&&typeof b==='object'&&typeof b.id==='string'&&/^[a-z0-9-]{1,40}$/.test(b.id)&&FISH_BY_ID.has(b.fish)&&typeof b.kg==='number'&&b.kg>0&&!seen.has(b.id)&&!!seen.add(b.id))
  .slice(0,FISH_BAG_MAX).map(b=>({id:b.id,fish:b.fish,kg:Math.round(b.kg*100)/100,value:Math.max(1,int(b.value)),at:typeof b.at==='number'?b.at:0,...(b.auto?{auto:true}:{})}));
 return {rod:typeof r.rod==='string'&&rods.includes(r.rod)?r.rod:STARTER_ROD,rods,points:int(r.points)+refund,caught,best,total:int(r.total),xp:int(r.xp),history,daily,...(week?{week}:{}),bag};
}

// ── Fishing shop (Casa de Pesca): Pontos de Pesca for rewards ──
export type FishingPrize={kind:'gold';amount:number}|{kind:'stone';level:number;amount:number}|{kind:'ticket';amount:number}|{kind:'pet-food';food:string;amount:number}|{kind:'rod';rod:string}|{kind:'fragment';weapon:string;amount:number};
export interface FishingOffer {id:string;name:string;description:string;cost:number;prize:FishingPrize;/** Fisher level needed to buy it. */level?:number;}
export const FISHING_SHOP:readonly FishingOffer[]=[
 {id:'gold-100',name:'100 de Ouro',description:'Moedas Brasa.',cost:50,prize:{kind:'gold',amount:100}},
 {id:'stone-1',name:'Pedra Nv. 1',description:'Pedra de Fortalecimento, para o Ferreiro.',cost:30,prize:{kind:'stone',level:1,amount:1}},
 {id:'stone-2',name:'Pedra Nv. 2',description:'Pedra de Fortalecimento, para o Ferreiro.',cost:110,prize:{kind:'stone',level:2,amount:1},level:3},
 {id:'ticket-1',name:'Ticket de Cor',description:'Troca a cor de uma peça.',cost:150,prize:{kind:'ticket',amount:1}},
 {id:'pet-food-dew',name:'Adubo de Orvalho',description:'Comida de pet.',cost:40,prize:{kind:'pet-food',food:'pet-food-dew',amount:1}},
 {id:'stone-3',name:'Pedra Nv. 3',description:'Pedra de Fortalecimento, para o Ferreiro.',cost:400,prize:{kind:'stone',level:3,amount:1},level:10},
 // Fragmentos da Vara das Marés (pedido do matheus, 20/10): 50 = a arma na Síntese do Ferreiro.
 {id:'fragment-tide',name:'Fragmento da Vara das Marés',description:'Junte 50 e forje a Vara das Marés na Síntese do Ferreiro.',cost:300,prize:{kind:'fragment',weapon:FISHING_WEAPON,amount:1},level:12},
 {id:'gold-1000',name:'1000 de Ouro',description:'Moedas Brasa.',cost:450,prize:{kind:'gold',amount:1000},level:15},
 {id:'rod-oak',name:'Vara de Carvalho',description:'Alvo maior na barra e mais peixes raros; às vezes traz Ouro.',cost:800,prize:{kind:'rod',rod:'rod-oak'},level:5},
 {id:'rod-coral',name:'Vara de Coral',description:'Mais Ouro e, raramente, Fragmentos da Vara das Marés.',cost:2500,prize:{kind:'rod',rod:'rod-coral'},level:12},
 {id:'rod-crystal',name:'Vara de Cristal',description:'Mais peixes raros e mais Fragmentos.',cost:5000,prize:{kind:'rod',rod:'rod-crystal'},level:20},
 {id:'rod-aurora',name:'Vara da Aurora',description:'Pode pescar Cupons (chance muito baixa).',cost:10000,prize:{kind:'rod',rod:'rod-aurora'},level:30},
 {id:'rod-royal',name:'Vara Real',description:'A melhor vara: mais Cupons e Fragmentos.',cost:20000,prize:{kind:'rod',rod:'rod-royal'},level:40},
];
export const FISHING_OFFER_BY_ID=new Map(FISHING_SHOP.map(o=>[o.id,o]));
export const MAX_FISHING_BUY=20;

// ── What the client sees ──
export type FishingPhase='idle'|'waiting'|'bite'|'result';
/** `points`: what the fish is worth when sold at the Casa de Pesca; `sold`: the Sacola was full, so it was sold on the spot. */
export interface FishingCatch {fish:string;kg:number;points:number;xp:number;record:boolean;first:boolean;sold?:boolean;/** Its place in the Sacola. */bagId?:string;/** Rod prizes that came up with the fish (old catches; now a prize replaces the fish). */drops?:FishingDrop[];/** Fisher level reached with this catch, when it went up. */levelUp?:number;}
/** What one run of automatic fishing brought (shown when it is switched off): time, each fish by kind, the prizes. */
export interface AutoFishingSummary {since:number;until:number;casts:number;missed:number;fish:Record<string,number>;points:number;xp:number;gold:number;coupons:number;fragments:number;best?:{fish:string;kg:number};}
/** My own fishing session: the bar runs from `start` (server time); `press`/`hits`/`misses` count the presses so far. */
export interface FishingView {spot:string;phase:FishingPhase;auto:boolean;since:number;challenge?:FishChallenge&{start:number;press:number;misses:number;grades:PressGrade[]};result?:{success:boolean;catch?:FishingCatch;fish?:string;/** The rod's prize came up instead of the fish. */prize?:FishingDrop;xp?:number;levelUp?:number};}
/** What other players see of someone fishing (rod out, float, the fish coming out of the water). */
export interface FishingPose {spot:string;phase:FishingPhase;since:number;success?:boolean;fish?:string;/** Fishing in automatic mode: everyone sees the seal over this fisher. */auto?:boolean;}
