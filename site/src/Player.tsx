import {useEffect,useState} from 'react';
import {CalendarDays,Gem,MessageSquarePlus,Monitor,Smartphone,Swords,Trophy} from 'lucide-react';
import {api,type Me,type TopicSummary} from './api';
import {AuthCard} from './AuthCard';
import {TopicRow} from './Forum';
import {Link} from './router';

/** The big JOGAR: opens the game, which signs in with this same account. */
export function PlayButton({me,big}:{me:Me;big?:boolean}){
 return <a className={`play-btn${big?' big':''}`} href={me.gameUrl}><span className="play-glow" aria-hidden="true"/><span className="play-label">Jogar</span></a>;
}

export function PlayerPage({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 const [topics,setTopics]=useState<TopicSummary[]|null>(null);
 useEffect(()=>{if(me?.account)api.topics(null).then(p=>setTopics(p.topics.slice(0,5)),()=>setTopics([]));},[me?.account]);
 if(!me)return <div className="page-loading" aria-busy="true"/>;
 if(!me.account)return <section className="auth-page">
  <div className="auth-page-art" aria-hidden="true"><img src="/art/battle.webp" alt=""/></div>
  <AuthCard initial={location.search.includes('cadastro')?'register':'login'} onSignedIn={onSignedIn}/>
 </section>;
 const {account,player}=me;
 const since=new Date(account.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
 return <div className="player-page">
  <section className="player-hero">
   <div className="player-hero-art" aria-hidden="true"><img src="/art/hero-2.webp" alt=""/></div>
   <div className="player-hero-inner">
    <div className="player-id">
     <div className="player-crest">
      <img className="crest-hero" src={player?.gender==='female'?'/art/hero-girl.webp':'/art/hero-boy.webp'} alt=""/>
      {player&&<span className="crest-level">{player.level}</span>}
     </div>
     <div>
      <p className="eyebrow">Página do jogador</p>
      <h1 className="title-3d player-name">{player?.name??account.username}</h1>
      <p className="player-meta"><span className="beta-chip">Membro do beta</span><span><CalendarDays size={16}/> Desde {since}</span></p>
     </div>
    </div>
    <div className="player-play">
     <PlayButton me={me} big/>
     <p>{player?'Sua conta abre direto no seu personagem.':'Seu personagem nasce no primeiro Jogar: escolha e entre na praça.'}</p>
    </div>
   </div>
  </section>

  <div className="player-grid">
   <section className="panel">
    <h2 className="panel-title"><Swords size={20}/> Seu personagem</h2>
    {player
     ?<dl className="stat-grid">
       <div><dt>Nível</dt><dd>{player.level}</dd></div>
       <div><dt>Vitórias</dt><dd>{player.wins.toLocaleString('pt-BR')}</dd></div>
       <div><dt>Partidas</dt><dd>{player.matches.toLocaleString('pt-BR')}</dd></div>
       <div><dt>Aproveitamento</dt><dd>{player.matches?Math.round(player.wins/player.matches*100):0}%</dd></div>
      </dl>
     :<p className="muted">Ainda não há personagem nesta conta. Clique em <b>Jogar</b> para criar o seu: ele já nasce com o seu usuário, <b>{account.username}</b>.</p>}
   </section>

   <section className="panel panel-beta">
    <h2 className="panel-title"><Gem size={20}/> Recompensa do beta</h2>
    <p>Você está no beta. Ao final dele, os membros recebem <b>itens cosméticos exclusivos</b> direto no Correio do jogo.</p>
    <div className="beta-reward-art" aria-hidden="true"><img src="/art/heroes-beta.webp" alt=""/></div>
   </section>

   <section className="panel">
    <h2 className="panel-title"><Trophy size={20}/> Onde jogar</h2>
    <ul className="where-list">
     <li><Monitor size={20}/><div><b>PC</b><span>Teclado e mouse, em qualquer navegador moderno.</span></div></li>
     <li><Smartphone size={20}/><div><b>Celular</b><span>Gire o aparelho: o jogo é em paisagem, com toque.</span></div></li>
    </ul>
   </section>

   <section className="panel panel-wide">
    <div className="panel-head">
     <h2 className="panel-title"><MessageSquarePlus size={20}/> Últimos tópicos da comunidade</h2>
     <Link to="/forum?novo" className="btn btn-gold btn-sm">Criar tópico</Link>
    </div>
    <div className="topic-list compact">
     {topics===null?<p className="muted">Carregando…</p>
      :topics.length?topics.map(t=><TopicRow key={t.id} topic={t}/>)
      :<p className="empty">Nenhum tópico ainda. Abra o primeiro com uma sugestão para o jogo!</p>}
    </div>
    <Link to="/forum" className="more-link">Ver o fórum inteiro</Link>
   </section>
  </div>
 </div>;
}
