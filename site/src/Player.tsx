import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,Check,ChevronRight,Gem,Lock,MessageSquarePlus,Swords,X} from 'lucide-react';
import {api,AVATARS,type AvatarId,type Me,type ServerCharacter,type TopicSummary} from './api';
import {AuthCard} from './AuthCard';
import {TopicRow} from './Forum';
import {Link} from './router';
import {Avatar} from './Avatar';
import {PageHeader} from './PageHeader';

const STATUS:Record<ServerCharacter['server']['status'],string>={online:'Online',maintenance:'Em manutenção',soon:'Em breve'};

/** The big JOGAR, in the game's own button style: opens the server picker (one character per server). */
export function PlayButton({me,big}:{me:Me;big?:boolean}){
 const [open,setOpen]=useState(false);
 return <>
  <button className={`play-btn${big?' big':''}`} onClick={()=>setOpen(true)}><Swords className="play-icon" aria-hidden="true"/><span className="play-label">Jogar</span></button>
  {open&&createPortal(<ServerPicker servers={me.servers} onClose={()=>setOpen(false)}/>,document.body)}
 </>;
}

function ServerPicker({servers,onClose}:{servers:ServerCharacter[];onClose:()=>void}){
 useEffect(()=>{const on=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};addEventListener('keydown',on);return ()=>removeEventListener('keydown',on);},[onClose]);
 return <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="server-title" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="modal server-modal">
   <header className="modal-head"><h2 id="server-title" className="title-3d">Escolha o servidor</h2><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>
   <p className="muted">Cada servidor tem o seu personagem. Onde você ainda não joga, ele nasce no primeiro acesso.</p>
   <ul className="server-list">{servers.map(s=><ServerRow key={s.server.id} item={s}/>)}</ul>
  </section>
 </div>;
}

function ServerRow({item:{server,character}}:{item:ServerCharacter}){
 const playable=server.status==='online';
 const body=<>
  <span className={`server-dot ${server.status}`} aria-hidden="true"/>
  <span className="server-main">
   <b>{server.name}</b>
   <small>{STATUS[server.status]}</small>
  </span>
  <span className="server-char">{character
   ?<><b>{character.name}</b><small>Nível {character.level} · {character.wins.toLocaleString('pt-BR')} vitórias</small></>
   :<><b>Sem personagem</b><small>Criar no primeiro acesso</small></>}</span>
  {playable&&<ChevronRight className="server-go" size={22}/>}
 </>;
 return <li>{playable?<a className="server-row" href={server.url}>{body}</a>:<div className="server-row disabled" aria-disabled="true">{body}</div>}</li>;
}

export function PlayerPage({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 const [topics,setTopics]=useState<TopicSummary[]|null>(null);
 useEffect(()=>{if(me?.account)api.topics(null).then(p=>setTopics(p.topics.slice(0,5)),()=>setTopics([]));},[me?.account]);
 if(!me)return <div className="page-loading" aria-busy="true"/>;
 if(!me.account)return <SignInPage onSignedIn={onSignedIn}/>;
 const {account}=me;
 const since=new Date(account.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
 return <div className="player-page">
  <PageHeader art="player" eyebrow="Olá de novo" title={account.username} text={<p className="player-meta"><span className="beta-chip">Membro do beta</span><span><CalendarDays size={16}/> Desde {since}</span></p>}>
   <PlayButton me={me} big/>
  </PageHeader>

  <div className="player-grid">
   <section className="panel panel-wide forum-panel">
    <div className="panel-head">
     <h2 className="panel-title"><MessageSquarePlus size={20}/> Comunidade</h2>
     <div className="panel-actions"><Link to="/forum" className="btn btn-ghost btn-sm">Ver fórum</Link><Link to="/forum?novo" className="btn btn-gold btn-sm">Criar tópico</Link></div>
    </div>
    <div className="topic-list">
     {topics===null?<p className="muted">Carregando…</p>
      :topics.length?topics.map(t=><TopicRow key={t.id} topic={t}/>)
      :<p className="empty">Ainda não tem nenhum tópico. Abre o primeiro com a sua sugestão!</p>}
    </div>
   </section>
  </div>
 </div>;
}

function SignInPage({onSignedIn}:{onSignedIn:()=>void}){
 return <section className="auth-page">
  <div className="auth-page-art" aria-hidden="true"><img src="/art/battle.webp" alt=""/></div>
  <AuthCard initial={location.search.includes('cadastro')?'register':'login'} onSignedIn={onSignedIn}/>
 </section>;
}

/** Meus personagens: one card per game server with the account's character there. */
export function CharactersPage({me,onSignedIn}:{me:Me|null;onSignedIn:()=>void}){
 if(!me)return <div className="page-loading" aria-busy="true"/>;
 if(!me.account)return <SignInPage onSignedIn={onSignedIn}/>;
 return <div className="characters-page">
  <PageHeader art="characters" eyebrow="Sua conta" title="Meus personagens" text="Cada servidor tem o seu personagem. Onde você ainda não joga, ele nasce no primeiro acesso.">
   <PlayButton me={me}/>
  </PageHeader>
  <div className="forum-body narrow"><ul className="server-list cards">{me.servers.map(s=><ServerRow key={s.server.id} item={s}/>)}</ul></div>
 </div>;
}

export function SettingsPage({me,onChanged}:{me:Me|null;onChanged:()=>void}){
 const [avatar,setAvatar]=useState<AvatarId|null>(null);
 const [saving,setSaving]=useState(false);const [avatarMsg,setAvatarMsg]=useState<string|null>(null);
 const [pw,setPw]=useState({current:'',next:'',again:''});const [pwBusy,setPwBusy]=useState(false);const [pwMsg,setPwMsg]=useState<{ok:boolean;text:string}|null>(null);
 if(!me)return <div className="page-loading" aria-busy="true"/>;
 if(!me.account)return <div className="forum-body narrow"><p>Entre na sua conta para ver as configurações.</p><Link to="/jogador?entrar" className="btn btn-gold">Entrar</Link></div>;
 const current=avatar??me.account.avatar;
 const saveAvatar=async()=>{setSaving(true);setAvatarMsg(null);try{await api.avatar(current);onChanged();setAvatarMsg('Avatar salvo.');}catch(e){setAvatarMsg((e as Error).message);}finally{setSaving(false);}};
 const savePassword=async(e:React.FormEvent)=>{
  e.preventDefault();setPwMsg(null);
  if(pw.next!==pw.again){setPwMsg({ok:false,text:'As duas senhas novas não são iguais.'});return;}
  setPwBusy(true);try{await api.password(pw.current,pw.next);setPw({current:'',next:'',again:''});setPwMsg({ok:true,text:'Senha trocada. As outras sessões foram encerradas.'});}
  catch(err){setPwMsg({ok:false,text:(err as Error).message});}finally{setPwBusy(false);}
 };
 return <div>
  <PageHeader art="settings" eyebrow="Sua conta" title="Configurações" text="Troque o seu avatar e a sua senha."/>
  <div className="forum-body narrow settings-page">
  <section className="panel">
   <h2 className="panel-title">Avatar</h2>
   <p className="muted">É a imagem que aparece no topo do site e nos seus tópicos do fórum.</p>
   <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
    {AVATARS.map(a=><button key={a.id} role="radio" aria-checked={current===a.id} className={`avatar-choice${current===a.id?' on':''}`} onClick={()=>setAvatar(a.id)}>
     <Avatar id={a.id} size={96}/>{current===a.id&&<Check className="avatar-check" size={18}/>}<span>{a.name}</span>
    </button>)}
   </div>
   <div className="composer-actions">{avatarMsg&&<span className="muted">{avatarMsg}</span>}<button className="btn btn-gold" disabled={saving||current===me.account.avatar} onClick={saveAvatar}>Salvar avatar</button></div>
  </section>
  <form className="panel composer" onSubmit={savePassword}>
   <h2 className="panel-title"><Lock size={20}/> Senha</h2>
   <label className="field"><span className="field-label">Senha atual</span><span className="field-box"><input type="password" value={pw.current} onChange={e=>setPw({...pw,current:e.target.value})} autoComplete="current-password" required maxLength={128}/></span></label>
   <div className="composer-row two">
    <label className="field"><span className="field-label">Nova senha<small>8 caracteres ou mais</small></span><span className="field-box"><input type="password" value={pw.next} onChange={e=>setPw({...pw,next:e.target.value})} autoComplete="new-password" required maxLength={128}/></span></label>
    <label className="field"><span className="field-label">Repita a nova senha</span><span className="field-box"><input type="password" value={pw.again} onChange={e=>setPw({...pw,again:e.target.value})} autoComplete="new-password" required maxLength={128}/></span></label>
   </div>
   {pwMsg&&<p className={pwMsg.ok?'form-ok':'form-error'} role="status">{pwMsg.text}</p>}
   <div className="composer-actions"><button className="btn btn-gold" disabled={pwBusy}>Trocar senha</button></div>
  </form>
  <section className="panel">
   <h2 className="panel-title">Conta</h2>
   <dl className="account-info"><div><dt>Usuário</dt><dd>{me.account.username}</dd></div><div><dt>E-mail</dt><dd>{me.account.email}</dd></div></dl>
  </section>
 </div>
 </div>;
}
