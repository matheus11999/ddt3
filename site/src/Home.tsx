import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,Gem,Monitor,Smartphone,Sparkles,X} from 'lucide-react';
import type {Me} from './api';
import {AuthCard} from './AuthCard';

/** Real screenshots (simulated data on a test server, docs/site.md), shown under "Ver o jogo". */
const SHOTS=[
 {src:'/shots/battle.webp',title:'Batalha PvP',text:'Ângulo, força e vento. O terreno se desfaz a cada explosão.'},
 {src:'/shots/plaza.webp',title:'Praça Celeste',text:'Encontre os amigos na praça e veja quem lidera o dia.'},
 {src:'/shots/gvg.webp',title:'Guerra de Guildas',text:'Sua guilda contra outra, valendo Riqueza.'},
 {src:'/shots/instance.webp',title:'Instâncias',text:'Até quatro amigos contra a Rainha Formiga.'},
 {src:'/shots/boss.webp',title:'Chefão Mundial',text:'O servidor inteiro contra o Dragão Ancestral.'},
 {src:'/shots/hall.webp',title:'Hall da Fama',text:'Ranking diário e semanal, com pódio na praça.'},
 {src:'/shots/customize.webp',title:'Personalize como quiser',text:'Rosto, cabelo, chapéu, óculos, roupa e fantasia.'},
 {src:'/shots/fishing.webp',title:'Pescaria',text:'Itens exclusivos, até pescando AFK.'},
 {src:'/shots/room.webp',title:'Salas',text:'Monte o time, do 1×1 ao 4×4.'},
 {src:'/shots/pvp-hall.webp',title:'Salão PvP',text:'Ache uma sala ou crie a sua.'},
];

export function Home({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 const [zoom,setZoom]=useState<number|null>(null);
 useEffect(()=>{
  if(zoom===null)return;
  const on=(e:KeyboardEvent)=>{if(e.key==='Escape')setZoom(null);if(e.key==='ArrowRight')setZoom(z=>z===null?z:(z+1)%SHOTS.length);if(e.key==='ArrowLeft')setZoom(z=>z===null?z:(z+SHOTS.length-1)%SHOTS.length);};
  addEventListener('keydown',on);return ()=>removeEventListener('keydown',on);
 },[zoom]);
 const joinBeta=()=>{const card=document.getElementById('entrar');card?.scrollIntoView({behavior:'smooth',block:'center'});card?.querySelector<HTMLButtonElement>('[data-tab="register"]')?.click();};
 return <>
  <section className="hero">
   <div className="hero-art" aria-hidden="true"><img src="/art/hero-4.webp" alt="" fetchPriority="high"/></div>
   <div className="hero-glow" aria-hidden="true"/>
   <div className="hero-inner">
    <div className="hero-copy">
     <span className="beta-badge"><Sparkles size={16}/> Beta aberta</span>
     <img className="hero-logo" src="/art/logo.webp" alt="Bomb Masters" width="900" height="534"/>
     <h1 className="hero-title">A mesma essência, <span>só que melhor.</span></h1>
     <p className="hero-text">Artilharia por turnos no navegador: mira, força, vento e muita bomba. Sem pay to win, no PC e no celular.</p>
     <p className="hero-perk"><Gem size={17}/> Participe do beta e ganhe itens exclusivos.</p>
     <div className="hero-cta">
      <button className="btn btn-gold btn-lg" onClick={joinBeta}>Quero jogar</button>
      <a className="btn btn-ghost btn-lg" href="#prints">Ver o jogo</a>
     </div>
     <ul className="platforms" aria-label="Plataformas"><li><Monitor size={18}/> PC</li><li><Smartphone size={18}/> Celular</li></ul>
    </div>
    <div className="hero-side" id="entrar">{!me?.account&&<AuthCard onSignedIn={onSignedIn}/>}</div>
   </div>
  </section>

  <section className="prints" id="prints">
   <header className="section-head">
    <p className="eyebrow">Por dentro do jogo</p>
    <h2 className="title-3d">Telas do jogo</h2>
    <p>Prints de verdade, sem montagem. Clica na tela para ver grande.</p>
   </header>
   <ShotCarousel onZoom={setZoom}/>
  </section>

  {zoom!==null&&<div className="lightbox" role="dialog" aria-modal="true" aria-label={SHOTS[zoom].title} onClick={()=>setZoom(null)}>
   <figure onClick={e=>e.stopPropagation()}>
    <img src={SHOTS[zoom].src} alt=""/>
    <figcaption><b>{SHOTS[zoom].title}</b> {SHOTS[zoom].text}</figcaption>
   </figure>
   <button className="icon-btn lightbox-prev" aria-label="Anterior" onClick={e=>{e.stopPropagation();setZoom((zoom+SHOTS.length-1)%SHOTS.length);}}><ChevronLeft size={24}/></button>
   <button className="icon-btn lightbox-next" aria-label="Próxima" onClick={e=>{e.stopPropagation();setZoom((zoom+1)%SHOTS.length);}}><ChevronRight size={24}/></button>
   <button className="icon-btn lightbox-close" aria-label="Fechar"><X size={22}/></button>
  </div>}
 </>;
}

/** Telas do jogo: one big slide that advances by itself (pauses on hover), arrows, and the thumbnails below. */
function ShotCarousel({onZoom}:{onZoom:(index:number)=>void}){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false);
 const go=(next:number)=>setIndex((next+SHOTS.length)%SHOTS.length);
 useEffect(()=>{if(paused)return;const timer=window.setTimeout(()=>go(index+1),5000);return ()=>clearTimeout(timer);},[index,paused]);
 const shot=SHOTS[index];
 return <div className="carousel" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
  <div className="carousel-stage">
   {SHOTS.map((s,i)=><button key={s.src} className={`carousel-slide${i===index?' on':''}`} onClick={()=>onZoom(i)} aria-hidden={i!==index} tabIndex={i===index?0:-1} aria-label={`Ampliar: ${s.title}`}>
    <img src={s.src} alt={`Tela do jogo: ${s.title}`} loading={i===0?'eager':'lazy'} width="1536" height="864"/>
   </button>)}
   <div className="carousel-caption" key={index}><b>{shot.title}</b><span>{shot.text}</span></div>
   <button className="carousel-arrow prev" aria-label="Tela anterior" onClick={()=>go(index-1)}><ChevronLeft size={28}/></button>
   <button className="carousel-arrow next" aria-label="Próxima tela" onClick={()=>go(index+1)}><ChevronRight size={28}/></button>
   {!paused&&<span className="carousel-progress" key={`p${index}`} aria-hidden="true"/>}
  </div>
  <div className="carousel-thumbs" role="tablist" aria-label="Telas">
   {SHOTS.map((s,i)=><button key={s.src} role="tab" aria-selected={i===index} className={`carousel-thumb${i===index?' on':''}`} onClick={()=>go(i)} aria-label={s.title}><img src={s.src} alt="" loading="lazy"/><span>{s.title}</span></button>)}
  </div>
 </div>;
}
