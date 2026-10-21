import {useEffect,useState} from 'react';
import {Crosshair,Fish,Flame,Gem,Heart,MessageCircle,Monitor,Palette,Shield,Smartphone,Sparkles,Swords,TrendingUp,Trophy,Users,X} from 'lucide-react';
import {api,type Me,type TopicSummary} from './api';
import {AuthCard} from './AuthCard';
import {PlayButton} from './Player';
import {TopicRow} from './Forum';
import {Link} from './router';

export function Home({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 const [stats,setStats]=useState<{accounts:number;topics:number}|null>(null);
 const [topics,setTopics]=useState<TopicSummary[]|null>(null);
 const [zoom,setZoom]=useState<string|null>(null);
 useEffect(()=>{if(!zoom)return;const on=(e:KeyboardEvent)=>{if(e.key==='Escape')setZoom(null);};addEventListener('keydown',on);return ()=>removeEventListener('keydown',on);},[zoom]);
 useEffect(()=>{api.stats().then(setStats,()=>{});api.topics(null).then(p=>setTopics(p.topics.slice(0,4)),()=>setTopics([]));},[]);
 useEffect(()=>{if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();},[]);
 const joinBeta=()=>{const card=document.getElementById('entrar');card?.scrollIntoView({behavior:'smooth',block:'center'});card?.querySelector<HTMLButtonElement>('.auth-switch button')?.click();};
 return <>
  <section className="hero">
   <div className="hero-art" aria-hidden="true"><img src="/art/hero-2.webp" alt="" fetchPriority="high"/></div>
   <div className="hero-sparks" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
   <div className="hero-inner">
    <div className="hero-copy">
     <img className="hero-logo" src="/art/logo.webp" alt="Bomb Masters" width="900" height="534"/>
     <h1 className="hero-title">A mesma essência, <span>só que melhor.</span></h1>
     <p className="hero-text">O jogo de artilharia por turnos que você conhece, de volta no navegador. Mira, força, vento e muita bomba. Roda no PC e no celular, sem baixar nada.</p>
     <div className="hero-cta">
      {me?.account
       ?<PlayButton me={me}/>
       :<button className="btn btn-gold btn-lg" onClick={joinBeta}>Quero jogar o beta</button>}
      <a className="btn btn-ghost btn-lg" href="#recursos">Ver o jogo</a>
     </div>
     <ul className="platforms" aria-label="Plataformas">
      <li><Monitor size={18}/> PC</li>
      <li><Smartphone size={18}/> Celular</li>
      {stats&&stats.accounts>=100&&<li><Heart size={18}/> {stats.accounts.toLocaleString('pt-BR')} no beta</li>}
     </ul>
    </div>
    <div className="hero-side" id="entrar">
     {me?.account
      ?<section className="auth-card welcome-card">
        <p className="eyebrow">Que bom te ver</p>
        <h2 className="title-3d auth-title">{me.account.username}</h2>
        <p className="welcome-text">Tá tudo pronto. É só entrar.</p>
        <Link to="/jogador" className="btn btn-ghost btn-block">Minha página</Link>
       </section>
      :<AuthCard onSignedIn={onSignedIn}/>}
    </div>
   </div>
   <a className="hero-scroll" href="#recursos" aria-label="Ver o jogo"><span/></a>
  </section>

  <section className="pillars" aria-label="Destaques">
   <div className="pillars-inner">
    <Pillar icon={<Gem/>} title="Sem pay to win" text="Ninguém compra vitória aqui"/>
    <Pillar icon={<TrendingUp/>} title="Evolução de verdade" text="Você sente cada nível"/>
    <Pillar icon={<Crosshair/>} title="Habilidade decide" text="Ângulo, força e vento"/>
    <Pillar icon={<Smartphone/>} title="PC e celular" text="Abre no navegador e pronto"/>
   </div>
  </section>

  <section className="showcase" id="recursos">
   <header className="section-head">
    <p className="eyebrow">Por dentro do jogo</p>
    <h2 className="title-3d">Do jeito que você lembra</h2>
    <p>Tudo o que aparece aqui é print do jogo, sem montagem. Clica na imagem pra ver grande.</p>
   </header>

   <Feature shots={['/shots/battle.webp']} tag="Arena PvP" icon={<Swords size={18}/>} title="Mostre sua habilidade no campo de batalha"
    text="Acertou o ângulo, contou o vento e soltou na força certa? O chão some debaixo do inimigo e a partida muda de cara. Aqui não tem atalho: é mira e cabeça."
    chips={['Ângulo, força e vento','Terreno destrutível','POW e poderes']} onZoom={setZoom}/>

   <Feature shots={['/shots/room.webp','/shots/pvp-hall.webp']} tag="Salas" icon={<Users size={18}/>} flip title="Chama a galera e monta o time"
    text="Sala com até quatro amigos, cada um com as suas ferramentas. Quando todo mundo estiver pronto, o jogo acha outro grupo do mesmo tamanho. Do 1×1 ao 4×4."
    chips={['1×1 até 4×4','Ferramentas','Chat da sala']} onZoom={setZoom}/>

   <Feature shots={['/shots/gvg.webp']} tag="Guerra de Guildas" icon={<Shield size={18}/>} title="Guilda contra guilda"
    text="Junta o pessoal da sua guilda, liga o modo GvG e vai pra cima de outra guilda. Cada vitória enche o cofre de Riqueza e faz a guilda subir de nível."
    chips={['Só contra outras guildas','Riqueza a cada vitória','Guilda até o nível 10']} onZoom={setZoom}/>

   <Feature shots={['/shots/instance.webp','/shots/expedition-room.webp']} tag="Instâncias" icon={<Sparkles size={18}/>} flip title="Explore instâncias com os amigos"
    text="Desce no Formigueiro com até quatro amigos, limpa as formigas estágio por estágio e encara a Rainha no final. Sozinho é difícil, junto fica divertido."
    chips={['Até 4 jogadores','Estágios e chefes','Recompensas']} onZoom={setZoom}/>

   <Feature shots={['/shots/boss.webp','/shots/boss-window.webp']} tag="Chefão Mundial" icon={<Flame size={18}/>} title="O servidor inteiro contra o dragão"
    text="Quando o Dragão Ancestral acorda, todo mundo bate na mesma barra de vida. Entra quantas vezes quiser e briga pelo topo do ranking de dano."
    chips={['Vida compartilhada','Ranking de dano','Evento ao vivo']} onZoom={setZoom}/>

   <Feature shots={['/shots/hall.webp']} tag="Hall da Fama" icon={<Trophy size={18}/>} flip title="Seja o melhor do ranking"
    text="Ranking de PvP do dia e da semana, de Poder, de Nível e de guildas. Os três que mais venceram no dia ficam no pódio da praça, pra todo mundo ver."
    chips={['Diário e semanal','Lendas','Prêmios pelo Correio']} onZoom={setZoom}/>

   <Feature shots={['/shots/customize.webp']} tag="Personalização" icon={<Palette size={18}/>} title="Personalize como quiser"
    text="Modifique seu personagem do jeito que quiser: rosto, cabelo, chapéu, óculos, roupa e fantasia. E se a cor não combinar, o Ticket de Cor resolve."
    chips={['Rosto, cabelo e chapéu','Roupas e fantasias','Ticket de Cor']} onZoom={setZoom}/>

   <Feature shots={['/shots/fishing.webp']} tag="Pescaria" icon={<Fish size={18}/>} flip title="Itens exclusivos até pescando AFK"
    text="Dá uma pausa nos tiros e vai pescar nos jardins suspensos. A pescaria rende itens exclusivos, e com o modo automático a vara continua trabalhando mesmo com você AFK."
    chips={['Itens exclusivos','Modo automático','Maior peixe da semana']} onZoom={setZoom}/>

   <div className="exclusives">
    <article><h3>Armas exclusivas</h3><p>Cada arma tem seu tiro, sua explosão, sua cratera e seu POW. Fortaleceu, ela muda de visual.</p></article>
    <article><h3>Pets exclusivos</h3><p>Seu pet cresce, muda de forma e entra na briga do seu lado com poderes próprios.</p></article>
    <article><h3>Evolução que aparece</h3><p>Nível, Ferreiro e aura: o que você conquista fica estampado no seu personagem.</p></article>
   </div>
  </section>

  <section className="fairplay">
   <div className="fairplay-inner">
    <p className="eyebrow">Nosso compromisso</p>
    <h2 className="title-3d">Sem pay to win. E ponto.</h2>
    <p>Aqui ninguém compra vitória. Dano, defesa e nível vêm de jogar. Na loja tem roupa e estilo, não poder.</p>
   </div>
  </section>

  <section className="beta" id="beta">
   <div className="beta-inner">
    <div className="beta-art" aria-hidden="true">
     <img className="beta-hero" src="/art/heroes-beta.webp" alt="" loading="lazy"/>
    </div>
    <div className="beta-copy">
     <p className="eyebrow">Beta aberto</p>
     <h2 className="title-3d">Jogue o beta e garanta cosméticos exclusivos</h2>
     <p>Quem jogar o beta ganha <b>itens cosméticos exclusivos</b> que não voltam depois. É o selo de quem chegou primeiro.</p>
     <ul className="beta-list">
      <li><Gem size={18}/> Cosméticos exclusivos pra quem jogou o beta</li>
      <li><MessageCircle size={18}/> Sua sugestão pode virar parte do jogo</li>
      <li><Monitor size={18}/> PC: teclado e mouse</li>
      <li><Smartphone size={18}/> Celular: na horizontal, com toque</li>
     </ul>
     {me?.account?<PlayButton me={me}/>:<button className="btn btn-gold btn-lg" onClick={joinBeta}>Quero jogar o beta</button>}
    </div>
   </div>
  </section>

  <section className="community">
   <header className="section-head">
    <p className="eyebrow">Comunidade</p>
    <h2 className="title-3d">Fala com a gente</h2>
    <p>Manda sugestão, tira dúvida, acha grupo. Muita coisa do jogo vai sair daqui.</p>
   </header>
   <div className="topic-list compact">
    {topics===null?<p className="muted center">Carregando…</p>
     :topics.length?topics.map(t=><TopicRow key={t.id} topic={t}/>)
     :<p className="empty">Ainda não tem nenhum tópico. Abre o primeiro com a sua sugestão!</p>}
   </div>
   <div className="center"><Link to="/forum" className="btn btn-gold">Ir para o fórum</Link></div>
  </section>
  {zoom&&<div className="lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onClick={()=>setZoom(null)}>
   <img src={zoom} alt=""/>
   <button className="icon-btn lightbox-close" aria-label="Fechar"><X size={22}/></button>
  </div>}
 </>;
}

function Pillar({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){
 return <div className="pillar"><span className="pillar-icon">{icon}</span><div><b>{title}</b><span>{text}</span></div></div>;
}

/** A real in-game screenshot in a framed screen; a second one overlaps the corner. Click to enlarge. */
function Feature({shots,tag,icon,title,text,chips,flip,onZoom}:{shots:string[];tag:string;icon:React.ReactNode;title:string;text:string;chips:string[];flip?:boolean;onZoom:(src:string)=>void}){
 return <article className={`feature${flip?' flip':''}${shots.length>1?' duo':''}`}>
  <div className="feature-shots">
   {shots.map((src,i)=><button key={src} className={`screen${i?' screen-small':''}`} onClick={()=>onZoom(src)} aria-label={`Ampliar imagem: ${title}`}><img src={src} alt={`Tela do jogo: ${title}`} loading="lazy" width="1536" height="864"/></button>)}
  </div>
  <div className="feature-copy">
   <p className="feature-tag">{icon}{tag}</p>
   <h3 className="title-3d">{title}</h3>
   <p>{text}</p>
   <ul className="chips">{chips.map(c=><li key={c}>{c}</li>)}</ul>
  </div>
 </article>;
}
