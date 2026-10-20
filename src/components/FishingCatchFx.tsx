import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';
import {FISH_BY_ID,fishRarity} from '../../shared/fishing';
import type {FishingView,FishRarity} from '../../shared/fishing';
import {FishingIcon} from './FishingIcon';
import {CouponIcon,RewardIcon} from './RewardIcon';

/**
 * Comemoração da captura (pedido do matheus, 20/10): quanto mais raro, maior. Só arte pintada em
 * movimento: estrelas pintadas do minigame, o peixe voando para a Sacola, moedas de Ouro, Cupons e
 * Fragmentos saindo do resultado até o contador; Cupom e Fragmento ganham destaque no meio da tela;
 * Épico e Lendário ganham o letreiro 3D do jogo (o mesmo estilo do SUCESSO! do Ferreiro).
 */
export const STARS:Record<FishRarity,number>={comum:0,normal:3,raro:5,epico:8,lendario:14};
/** How long the result card stays (it overlaps the next cast, which already started on the server). */
export const RESULT_SHOW_MS:Record<FishRarity|'lost',number>={lost:2200,comum:2600,normal:2900,raro:3300,epico:4000,lendario:5000};
export const resultShowMs=(view:FishingView)=>{
 const r=view.result;if(!r?.success||!r.catch)return RESULT_SHOW_MS.lost;
 const fish=FISH_BY_ID.get(r.catch.fish);return RESULT_SHOW_MS[fish?fishRarity(fish).id:'comum'];
};

interface Flight {id:number;node:ReactNode;from:{x:number;y:number};to:{x:number;y:number}|null;delay:number;size:number;/** Arc height and sideways spread of the flight. */lift:number;spread:number;target?:string;}
const centre=(el:Element|null)=>{if(!el)return null;const r=el.getBoundingClientRect();return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;};
const TARGETS={fish:'.lobby-dock-button.fish-bag',gold:'.currency-gold',coupons:'.currency-coupons',fragments:'.lobby-dock-button.fish-bag',points:'.currency-fishing'} as const;

export function CatchFx({view}:{view:FishingView}){
 const r=view.result!,c=r.catch!,fish=FISH_BY_ID.get(c.fish),rarity=fishRarity(fish??{difficulty:1}).id;
 const [flights,setFlights]=useState<Flight[]>([]);
 const big=c.drops?.filter(d=>d.kind!=='gold')??[];
 useEffect(()=>{
  const from=centre(document.querySelector('.fishing-result-art'))??{x:innerWidth/2,y:240};
  const mid={x:innerWidth/2,y:innerHeight*.56-20};let id=0;const list:Flight[]=[];
  const add=(node:ReactNode,kind:keyof typeof TARGETS,count:number,delay:number,size:number,start=from)=>{
   const to=centre(document.querySelector(TARGETS[kind]));
   for(let i=0;i<count;i++)list.push({id:id++,node,from:start,to,delay:delay+i*70,size,lift:60+((i*37)%50),spread:(i-(count-1)/2)*26,target:TARGETS[kind]});
  };
  add(<FishingIcon id={c.fish} size={58}/>,'fish',1,rarity==='lendario'?2600:rarity==='epico'?2100:1500,58);
  if(c.sold)add(<FishingIcon id="fishing-points" size={30}/>,'points',Math.min(6,2+Math.floor(c.points/20)),1300,30);
  for(const d of c.drops??[]){
   if(d.kind==='gold')add(<RewardIcon size={30}/>,'gold',Math.min(10,3+Math.floor(d.amount/40)),700,30);
   // Cupons e Fragmentos aparecem grandes no meio da tela e depois voam para o contador.
   else add(d.kind==='coupons'?<CouponIcon size={44}/>:<FishingIcon id="fragment" size={44}/>,d.kind,Math.min(5,d.amount),1900,44,mid);
  }
  setFlights(list);
 },[view.since]);
 return <div className={`fishing-fx rarity-${rarity}`} aria-hidden>
  {rarity==='lendario'&&<div className="fishing-legend-flash"/>}
  {(rarity==='epico'||rarity==='lendario')&&<RarityBanner rarity={rarity}/>}
  {big.map((d,i)=><div key={d.kind} className={`fishing-prize-pop ${d.kind}`} style={{animationDelay:`${.35+i*.2}s`}}>
   <span className="fishing-prize-pop-art">{d.kind==='coupons'?<CouponIcon size={120}/>:<FishingIcon id="fragment" size={120}/>}</span>
   <b>+{d.amount} {d.kind==='coupons'?(d.amount===1?'Cupom':'Cupons'):d.amount===1?'Fragmento':'Fragmentos'}</b>
   <Stars count={8} burst/>
  </div>)}
  {flights.map(f=><Fly key={f.id} flight={f}/>)}
 </div>;
}

/** Painted stars of the minigame around the caught fish: twinkling, or bursting out on Épico and Lendário. */
export function Stars({count,burst}:{count:number;burst:boolean}){
 return <span className={`fishing-stars-fx ${burst?'burst':''}`}>{Array.from({length:count},(_,i)=>{
  const a=i/count*Math.PI*2+(i%2)*.3,d=(burst?90:56)+(i%3)*24;
  return <img key={i} src="/assets/fishing/ui/mini-star.webp" alt="" draggable={false} style={{'--x':`${Math.cos(a)*d}px`,'--y':`${Math.sin(a)*d*.7}px`,'--s':`${.5+(i%3)*.25}`,animationDelay:`${(i%5)*.12}s`} as CSSProperties}/>;})}</span>;
}

/** One painted icon flying from the result (or the middle of the screen) to its counter, which pulses when it lands. */
function Fly({flight}:{flight:Flight}){
 const el=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const node=el.current;if(!node)return;
  const {from,to,lift,spread,size}=flight,half=size/2;
  const end=to??{x:from.x+spread,y:from.y-140};
  const frames:Keyframe[]=[
   {transform:`translate(${from.x-half}px,${from.y-half}px) scale(.4)`,opacity:0},
   {transform:`translate(${from.x-half+spread}px,${from.y-half-lift}px) scale(1.15)`,opacity:1,offset:.22},
   {transform:`translate(${from.x-half+spread}px,${from.y-half-lift*.8}px) scale(1)`,opacity:1,offset:.4},
   {transform:`translate(${end.x-half}px,${end.y-half}px) scale(${to?.45:.8})`,opacity:to?1:0},
  ];
  const anim=node.animate(frames,{duration:1100,delay:flight.delay,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'});
  anim.onfinish=()=>{node.style.display='none';const target=flight.target&&document.querySelector(flight.target);
   if(target instanceof HTMLElement){target.classList.remove('fishing-gain-pulse');void target.offsetWidth;target.classList.add('fishing-gain-pulse');}};
  return()=>anim.cancel();
 },[flight]);
 return <div ref={el} className="fishing-fly" style={{width:flight.size,height:flight.size}}>{flight.node}</div>;
}

const BANNERS={epico:{word:'ÉPICO!',light:'#fbefff',mid:'#cf8cff',deep:'#7a2fd0',side:'#5a1f9a',sideDeep:'#2a0a50',ribbon:'#8a3fe0',ribbonDeep:'#4a1690'},
 lendario:{word:'LENDÁRIO!',light:'#fffbd0',mid:'#ffd42e',deep:'#ff7a0a',side:'#d4560a',sideDeep:'#7a2604',ribbon:'#ef4a2e',ribbonDeep:'#a3210f'}} as const;
/** Letreiro 3D (camadas extrudadas, contorno grosso e brilho no topo, Lilita One), o mesmo do SUCESSO! do Ferreiro. */
function RarityBanner({rarity}:{rarity:'epico'|'lendario'}){
 const b=BANNERS[rarity],id=`fish-${rarity}`,depth=10,size=rarity==='lendario'?70:76;
 const font={fontFamily:"'Lilita One','Nunito',sans-serif",fontSize:size,textAnchor:'middle' as const,letterSpacing:2};
 const word=(props:Record<string,unknown>,key:string|number,dy=0)=><text key={key} {...font} transform={dy?`translate(0 ${dy})`:undefined}><textPath href={`#${id}-arc`} startOffset="50%" strokeLinejoin="round" {...props}>{b.word}</textPath></text>;
 return <svg className="fishing-rarity-banner" viewBox="0 0 460 190" role="img" aria-label={b.word}>
  <defs>
   <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stopColor={b.light}/><stop offset=".48" stopColor={b.mid}/><stop offset="1" stopColor={b.deep}/></linearGradient>
   <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={b.side}/><stop offset="1" stopColor={b.sideDeep}/></linearGradient>
   <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1"><stop offset=".08" stopColor="#fff" stopOpacity=".95"/><stop offset=".42" stopColor="#fff" stopOpacity=".35"/><stop offset=".43" stopColor="#fff" stopOpacity="0"/></linearGradient>
   <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={b.ribbon}/><stop offset=".55" stopColor={b.ribbon}/><stop offset="1" stopColor={b.ribbonDeep}/></linearGradient>
   <path id={`${id}-arc`} d="M28 112 Q230 36 432 112"/>
  </defs>
  <g>
   <path d="M40 124 12 144l36 4-13 26 62-25Z" fill={b.ribbonDeep} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M420 124l28 20-36 4 13 26-62-25Z" fill={b.ribbonDeep} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M60 122Q230 80 400 122l-8 44Q230 124 68 166Z" fill="#2a0f05" transform="translate(0 6)"/>
   <path d="M60 118Q230 76 400 118l-8 44Q230 120 68 162Z" fill={`url(#${id}-ribbon)`} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M70 126Q230 88 390 126" fill="none" stroke="#ffffff66" strokeWidth="4" strokeLinecap="round"/>
  </g>
  <g>
   {word({fill:'#2a0f05',stroke:'#2a0f05',strokeWidth:18},'shadow',depth+3)}
   {Array.from({length:depth},(_,i)=>word({fill:`url(#${id}-side)`,stroke:`url(#${id}-side)`,strokeWidth:12},i,depth-i))}
   {word({fill:'none',stroke:'#2a0f05',strokeWidth:12},'outline')}
   {word({fill:`url(#${id}-face)`,stroke:b.light,strokeWidth:2.5,paintOrder:'stroke'},'face')}
   {word({fill:`url(#${id}-gloss)`},'gloss')}
  </g>
 </svg>;
}
