import {useEffect,useState} from 'react';
import {Crosshair,Gem,Heart,MessageCircle,Monitor,Smartphone,Sparkles,Swords,TrendingUp,Trophy,Wind} from 'lucide-react';
import {api,type Me,type TopicSummary} from './api';
import {AuthCard} from './AuthCard';
import {PlayButton} from './Player';
import {TopicRow} from './Forum';
import {Link} from './router';

const WEAPONS=[['weapon-brick','Quebra-Tijolos'],['weapon-wind','Vento Celeste'],['weapon-thunder','Bobina do Trovão'],['weapon-boomerang','Bumerangue']] as const;

export function Home({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 const [stats,setStats]=useState<{accounts:number;topics:number}|null>(null);
 const [topics,setTopics]=useState<TopicSummary[]|null>(null);
 useEffect(()=>{api.stats().then(setStats,()=>{});api.topics(null).then(p=>setTopics(p.topics.slice(0,4)),()=>setTopics([]));},[]);
 useEffect(()=>{if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();},[]);
 const joinBeta=()=>{const card=document.getElementById('entrar');card?.scrollIntoView({behavior:'smooth',block:'center'});card?.querySelector<HTMLButtonElement>('.auth-switch button')?.click();};
 return <>
  <section className="hero">
   <div className="hero-art" aria-hidden="true"><img src="/art/hero.webp" alt="" fetchPriority="high"/></div>
   <div className="hero-sparks" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
   <div className="hero-inner">
    <div className="hero-copy">
     <span className="beta-ribbon"><Sparkles size={15}/> Beta aberto</span>
     <img className="hero-logo" src="/art/logo.webp" alt="Bomb Masters" width="900" height="534"/>
     <h1 className="hero-title">Mire. Leia o vento. <span>Exploda o terreno.</span></h1>
     <p className="hero-text">Artilharia por turnos com personagens que você monta peça por peça, armas exclusivas e mapas que se desfazem a cada explosão. Direto no navegador.</p>
     <div className="hero-cta">
      {me?.account
       ?<PlayButton me={me}/>
       :<button className="btn btn-gold btn-lg" onClick={joinBeta}>Participar do beta</button>}
      <a className="btn btn-ghost btn-lg" href="#recursos">Conhecer o jogo</a>
     </div>
     <ul className="platforms" aria-label="Plataformas">
      <li><Monitor size={18}/> PC</li>
      <li><Smartphone size={18}/> Celular</li>
      {stats&&stats.accounts>0&&<li><Heart size={18}/> {stats.accounts.toLocaleString('pt-BR')} no beta</li>}
     </ul>
    </div>
    <div className="hero-side" id="entrar">
     {me?.account
      ?<section className="auth-card welcome-card">
        <div className="auth-crest"><img src="/art/aura-gold.webp" alt="" aria-hidden="true"/></div>
        <p className="eyebrow">Bem-vindo de volta</p>
        <h2 className="title-3d auth-title">{me.account.username}</h2>
        <p className="welcome-text">Sua conta está pronta. A arena espera.</p>
        <Link to="/jogador" className="btn btn-ghost btn-block">Minha página</Link>
       </section>
      :<AuthCard onSignedIn={onSignedIn}/>}
    </div>
   </div>
   <a className="hero-scroll" href="#recursos" aria-label="Ver recursos"><span/></a>
  </section>

  <section className="pillars" aria-label="Destaques">
   <div className="pillars-inner">
    <Pillar icon={<Gem/>} title="Sem pay to win" text="Vitória não se compra"/>
    <Pillar icon={<TrendingUp/>} title="Sinta cada evolução" text="Conquista que pesa"/>
    <Pillar icon={<Crosshair/>} title="Pura habilidade" text="Ângulo, força e vento"/>
    <Pillar icon={<Smartphone/>} title="PC e celular" text="No navegador, sem instalar"/>
   </div>
  </section>

  <section className="showcase" id="recursos">
   <header className="section-head">
    <p className="eyebrow">O jogo</p>
    <h2 className="title-3d">Cada disparo conta</h2>
    <p>Dispute, explore, evolua. Tudo o que você conquista em Bomb Masters vem das suas jogadas.</p>
   </header>

   <Feature art="/art/battle.webp" tag="Arena PvP" icon={<Swords size={18}/>} title="Mostre sua habilidade no campo de batalha"
    text="Ajuste o ângulo, sinta a força e leia o vento antes de soltar. O terreno se desfaz a cada explosão e muda o jogo a cada turno. Monte seu grupo e jogue de 1×1 até 4×4."
    chips={['1×1 até 4×4','Ângulo, força e vento','Terreno destrutível']}/>

   <Feature art="/art/expedition.webp" tag="Instâncias" icon={<Sparkles size={18}/>} flip title="Explore instâncias com seus amigos"
    text="Expedições cooperativas para até quatro jogadores, com estágios, hordas e chefes no final. Desça ao Formigueiro e encare a Rainha Formiga."
    chips={['Até 4 jogadores','Estágios e chefes','Recompensas']}/>

   <Feature art="/art/forge.webp" tag="Arsenal" icon={<Wind size={18}/>} title="Armas exclusivas, cada uma com sua assinatura"
    text="Cada arma tem projétil, explosão, cratera e golpe especial próprios. Fortaleça no Ferreiro e veja ela mudar de visual nas fases +10, +12 e +15."
    chips={['Golpe POW próprio','Fortalecimento até +15','Crateras únicas']}>
    <ul className="weapon-row">{WEAPONS.map(([id,name])=><li key={id}><img src={`/art/${id}.webp`} alt="" loading="lazy" width="96" height="96"/><span>{name}</span></li>)}</ul>
   </Feature>

   <Feature art="/art/pets.webp" tag="Evolução" icon={<TrendingUp size={18}/>} flip title="Sinta cada evolução"
    text="Cada nível, cada aprimoramento no Ferreiro e cada pet que floresce é uma conquista sua. Seu personagem cresce com você, e todo mundo vê."
    chips={['Pets que evoluem','Aura por nível','Ferreiro e composição']}/>

   <Feature art="/art/hall-of-fame.webp" tag="Hall da Fama" icon={<Trophy size={18}/>} title="Seja o melhor do ranking"
    text="Rankings diários e semanais com recompensas, Lendas eternizadas no Hall da Fama e os três melhores do dia em pé no pódio da praça para todo mundo ver."
    chips={['Ranking diário e semanal','Pódio na praça','Recompensas']}/>
  </section>

  <section className="fairplay">
   <div className="fairplay-inner">
    <img src="/art/no-p2w.webp" alt="Selo Sem Pay to Win" width="520" height="347" loading="lazy"/>
    <div>
     <p className="eyebrow">Compromisso</p>
     <h2 className="title-3d">Sem pay to win. Nunca.</h2>
     <p>Em Bomb Masters ninguém compra vitória. Dano, defesa e evolução vêm de jogar: das batalhas, das expedições e do Ferreiro. O que se compra é estilo, não poder.</p>
    </div>
   </div>
  </section>

  <section className="more">
   <header className="section-head">
    <p className="eyebrow">E tem mais</p>
    <h2 className="title-3d">Um mundo para viver entre as batalhas</h2>
   </header>
   <div className="more-grid">
    <More art="/art/hero-girl.webp" title="Personalização" text="Rosto, cabelo, chapéu, óculos, roupa e fantasias. Monte um visual que é só seu."/>
    <More art="/art/fishing.webp" cover title="Pescaria" text="Jardins suspensos, peixes raros, coleção e o seu nível de pescador."/>
    <More art="/art/guild.webp" title="Guildas" text="Funde a sua, evolua juntos e dispute batalhas de guilda."/>
    <More art="/art/boss.webp" title="Chefão Mundial" text="Todo o servidor contra o Dragão Ancestral. Quem causa mais dano?"/>
   </div>
  </section>

  <section className="beta" id="beta">
   <div className="beta-inner">
    <div className="beta-art" aria-hidden="true">
     <img className="beta-aura" src="/art/aura-gold.webp" alt=""/>
     <img className="beta-hero" src="/art/heroes-beta.webp" alt="" loading="lazy"/>
    </div>
    <div className="beta-copy">
     <span className="beta-ribbon"><Sparkles size={15}/> Beta aberto</span>
     <h2 className="title-3d">Jogue o beta e ganhe cosméticos exclusivos</h2>
     <p>Quem participar do beta vai receber <b>itens cosméticos exclusivos</b> que nunca mais voltam. É a marca de quem chegou primeiro.</p>
     <ul className="beta-list">
      <li><Gem size={18}/> Cosméticos exclusivos dos membros do beta</li>
      <li><MessageCircle size={18}/> Sua sugestão vira mudança no jogo</li>
      <li><Monitor size={18}/> No PC com teclado e mouse</li>
      <li><Smartphone size={18}/> No celular, deitado (paisagem), com toque</li>
     </ul>
     {me?.account?<PlayButton me={me}/>:<button className="btn btn-gold btn-lg" onClick={joinBeta}>Participar do beta</button>}
    </div>
   </div>
  </section>

  <section className="community">
   <header className="section-head">
    <p className="eyebrow">Comunidade</p>
    <h2 className="title-3d">A conversa está rolando</h2>
    <p>Mande suas sugestões, tire dúvidas e encontre grupo. O beta é feito junto com quem joga.</p>
   </header>
   <div className="topic-list compact">
    {topics===null?<p className="muted center">Carregando…</p>
     :topics.length?topics.map(t=><TopicRow key={t.id} topic={t}/>)
     :<p className="empty">Nenhum tópico ainda. Que tal abrir o primeiro com uma sugestão?</p>}
   </div>
   <div className="center"><Link to="/forum" className="btn btn-gold">Ir para o fórum</Link></div>
  </section>
 </>;
}

function Pillar({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){
 return <div className="pillar"><span className="pillar-icon">{icon}</span><div><b>{title}</b><span>{text}</span></div></div>;
}

function Feature({art,tag,icon,title,text,chips,flip,children}:{art:string;tag:string;icon:React.ReactNode;title:string;text:string;chips:string[];flip?:boolean;children?:React.ReactNode}){
 return <article className={`feature${flip?' flip':''}`}>
  <div className="feature-art"><img src={art} alt="" loading="lazy"/></div>
  <div className="feature-copy">
   <p className="feature-tag">{icon}{tag}</p>
   <h3 className="title-3d">{title}</h3>
   <p>{text}</p>
   <ul className="chips">{chips.map(c=><li key={c}>{c}</li>)}</ul>
   {children}
  </div>
 </article>;
}

function More({art,title,text,cover}:{art:string;title:string;text:string;cover?:boolean}){
 return <article className="more-card"><div className={`more-art${cover?' cover':''}`}><img src={art} alt="" loading="lazy"/></div><h3>{title}</h3><p>{text}</p></article>;
}
