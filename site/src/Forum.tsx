import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,Heart,MessageCircle,Pin,Plus,Send,Trash2} from 'lucide-react';
import {api,type Me,type TopicDetail,type TopicPage as Page,type TopicSummary} from './api';
import {FORUM_CATEGORIES,FORUM_LIMITS} from './forumRules';
import {Link,navigate} from './router';
import {Avatar} from './Avatar';
import type {AvatarId} from './api';

const categoryName=(id:string)=>FORUM_CATEGORIES.find(c=>c.id===id)?.name??id;
function ago(iso:string){
 const s=(Date.now()-new Date(iso).getTime())/1000;
 if(s<60)return 'agora';if(s<3600)return `há ${Math.floor(s/60)} min`;if(s<86400)return `há ${Math.floor(s/3600)} h`;if(s<86400*7)return `há ${Math.floor(s/86400)} d`;
 return new Date(iso).toLocaleDateString('pt-BR');
}
function Author({name,avatar,level}:{name:string;avatar:AvatarId;level:number|null}){
 return <span className="author"><Avatar id={avatar} size={22}/><b>{name}</b>{level!=null&&<span className="lv">Nv. {level}</span>}</span>;
}

/** One topic: author avatar, title, category and who/when on one line, counts on the right. */
export function TopicRow({topic}:{topic:TopicSummary}){
 return <Link to={`/forum/${topic.id}`} className={`topic-row cat-line-${topic.category}${topic.pinned?' pinned':''}`}>
  <Avatar id={topic.authorAvatar} size={44} className="topic-avatar"/>
  <span className="topic-main">
   <span className="topic-title">{topic.pinned&&<Pin size={14}/>}{topic.title}</span>
   <span className="topic-sub"><span className={`cat cat-${topic.category}`}>{categoryName(topic.category)}</span><span>por <b>{topic.author}</b></span><span>· {ago(topic.lastActivityAt)}</span></span>
  </span>
  <span className="topic-counts"><span title="Respostas"><MessageCircle size={16}/><b>{topic.replies}</b></span><span title="Curtidas" className={topic.liked?'liked':''}><Heart size={16}/><b>{topic.likes}</b></span></span>
 </Link>;
}

export function ForumPage({me,query}:{me:Me|null;query:URLSearchParams}){
 const category=query.get('categoria');
 const page=Math.max(1,Number(query.get('pagina'))||1);
 const [data,setData]=useState<Page|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [composing,setComposing]=useState(query.has('novo'));
 useEffect(()=>{setData(null);setError(null);api.topics(category,page).then(setData,e=>setError(e.message));},[category,page]);
 const go=(next:{categoria?:string|null;pagina?:number})=>{const p=new URLSearchParams();const c=next.categoria===undefined?category:next.categoria;if(c)p.set('categoria',c);if((next.pagina??1)>1)p.set('pagina',String(next.pagina));navigate(`/forum${p.size?`?${p}`:''}`);};
 const pages=data?Math.max(1,Math.ceil(data.total/data.pageSize)):1;
 return <div className="forum-page">
  <header className="forum-hero">
   <div className="forum-hero-art" aria-hidden="true"><img src="/art/fishing.webp" alt=""/></div>
   <div className="forum-hero-inner">
    <p className="eyebrow">Comunidade Bomb Masters</p>
    <h1 className="title-3d">Fórum</h1>
    <p>Sugestões, dúvidas, bugs do beta e recrutamento de guilda. Converse com quem joga.</p>
    {me?.account?<button className="btn btn-gold" onClick={()=>setComposing(true)}><Plus size={18}/> Criar tópico</button>:<Link to="/jogador?entrar" className="btn btn-gold">Entre para participar</Link>}
   </div>
  </header>
  <div className="forum-body">
   <nav className="cat-tabs" aria-label="Categorias">
    <button className={!category?'active':''} onClick={()=>go({categoria:null})}>Todos</button>
    {FORUM_CATEGORIES.map(c=><button key={c.id} className={category===c.id?'active':''} onClick={()=>go({categoria:c.id})} title={c.hint}>{c.name}</button>)}
   </nav>
   {composing&&me?.account&&<NewTopic initial={category} onCancel={()=>setComposing(false)}/>}
   <div className="topic-list">
    {error?<p className="form-error">{error}</p>
     :!data?<p className="muted center">Carregando…</p>
     :data.topics.length?data.topics.map(t=><TopicRow key={t.id} topic={t}/>)
     :<p className="empty">Nenhum tópico {category?`em ${categoryName(category)} `:''}ainda. Seja o primeiro!</p>}
   </div>
   {pages>1&&<div className="pager">
    <button className="btn btn-ghost btn-sm" disabled={page<=1} onClick={()=>go({pagina:page-1})}>Anterior</button>
    <span>Página {page} de {pages}</span>
    <button className="btn btn-ghost btn-sm" disabled={page>=pages} onClick={()=>go({pagina:page+1})}>Próxima</button>
   </div>}
  </div>
 </div>;
}

function NewTopic({initial,onCancel}:{initial:string|null;onCancel:()=>void}){
 const [category,setCategory]=useState(FORUM_CATEGORIES.some(c=>c.id===initial)?initial!:'sugestoes');
 const [title,setTitle]=useState('');const [body,setBody]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError(null);try{const {id}=await api.createTopic(category,title,body);navigate(`/forum/${id}`);}catch(err){setError((err as Error).message);setBusy(false);}};
 return <form className="panel composer" onSubmit={submit}>
  <h2 className="panel-title"><Plus size={20}/> Novo tópico</h2>
  <div className="composer-row">
   <label className="field"><span className="field-label">Categoria</span><span className="field-box"><select value={category} onChange={e=>setCategory(e.target.value)}>{FORUM_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></span></label>
   <label className="field grow"><span className="field-label">Título</span><span className="field-box"><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={FORUM_LIMITS.titleMax} required placeholder="Sobre o que você quer falar?"/></span></label>
  </div>
  <label className="field"><span className="field-label">Mensagem<small>{body.length}/{FORUM_LIMITS.topicMax}</small></span><span className="field-box area"><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={FORUM_LIMITS.topicMax} rows={6} required placeholder="Conte os detalhes. Sugestões com exemplos ajudam muito!"/></span></label>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="composer-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button><button className="btn btn-gold" disabled={busy}><Send size={18}/> Publicar</button></div>
 </form>;
}

export function TopicPage({id,me}:{id:number;me:Me|null}){
 const [data,setData]=useState<TopicDetail|null>(null);
 const [error,setError]=useState<string|null>(null);
 const load=useCallback(()=>api.topic(id).then(setData,e=>setError(e.message)),[id]);
 useEffect(()=>{setData(null);setError(null);void load();},[load]);
 const [reply,setReply]=useState('');const [busy,setBusy]=useState(false);const [replyError,setReplyError]=useState<string|null>(null);
 const signedIn=!!me?.account;
 const like=async(kind:'topics'|'replies',targetId:number)=>{
  if(!signedIn){navigate('/jogador?entrar');return;}
  try{const r=await api.like(kind,targetId);setData(d=>d&&(kind==='topics'?{...d,topic:{...d.topic,...r}}:{...d,replies:d.replies.map(x=>x.id===targetId?{...x,...r}:x)}));}catch(e){setReplyError((e as Error).message);}
 };
 const remove=async(kind:'topics'|'replies',targetId:number)=>{
  if(!confirm(kind==='topics'?'Apagar este tópico?':'Apagar esta resposta?'))return;
  try{await api.remove(kind,targetId);if(kind==='topics')navigate('/forum');else void load();}catch(e){setReplyError((e as Error).message);}
 };
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setReplyError(null);try{await api.reply(id,reply);setReply('');await load();}catch(err){setReplyError((err as Error).message);}finally{setBusy(false);}};
 if(error)return <div className="forum-body narrow"><p className="form-error">{error}</p><Link to="/forum" className="more-link"><ArrowLeft size={16}/> Voltar ao fórum</Link></div>;
 if(!data)return <div className="page-loading" aria-busy="true"/>;
 const {topic,replies}=data;
 return <div className="forum-body narrow topic-page">
  <Link to={`/forum?categoria=${topic.category}`} className="more-link"><ArrowLeft size={16}/> {categoryName(topic.category)}</Link>
  <article className="post post-topic">
   <header><span className={`cat cat-${topic.category}`}>{categoryName(topic.category)}</span><h1 className="title-3d">{topic.title}</h1><p className="post-meta"><Author name={topic.author} avatar={topic.authorAvatar} level={topic.authorLevel}/> · {ago(topic.createdAt)}</p></header>
   <div className="post-body">{topic.body}</div>
   <footer className="post-actions">
    <button className={`like${topic.liked?' liked':''}`} onClick={()=>like('topics',topic.id)} aria-pressed={topic.liked}><Heart size={18}/> {topic.likes}</button>
    <span className="muted"><MessageCircle size={16}/> {replies.length} {replies.length===1?'resposta':'respostas'}</span>
    {topic.mine&&<button className="icon-btn danger" onClick={()=>remove('topics',topic.id)} title="Apagar tópico" aria-label="Apagar tópico"><Trash2 size={17}/></button>}
   </footer>
  </article>
  <div className="replies">
   {replies.map(r=><article key={r.id} className="post">
    <p className="post-meta"><Author name={r.author} avatar={r.authorAvatar} level={r.authorLevel}/> · {ago(r.createdAt)}</p>
    <div className="post-body">{r.body}</div>
    <footer className="post-actions">
     <button className={`like${r.liked?' liked':''}`} onClick={()=>like('replies',r.id)} aria-pressed={r.liked}><Heart size={16}/> {r.likes}</button>
     {r.mine&&<button className="icon-btn danger" onClick={()=>remove('replies',r.id)} title="Apagar resposta" aria-label="Apagar resposta"><Trash2 size={16}/></button>}
    </footer>
   </article>)}
  </div>
  {signedIn
   ?<form className="panel composer" onSubmit={send}>
     <label className="field"><span className="field-label">Responder<small>{reply.length}/{FORUM_LIMITS.replyMax}</small></span><span className="field-box area"><textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={FORUM_LIMITS.replyMax} rows={4} required placeholder="Escreva sua resposta"/></span></label>
     {replyError&&<p className="form-error" role="alert">{replyError}</p>}
     <div className="composer-actions"><button className="btn btn-gold" disabled={busy||!reply.trim()}><Send size={18}/> Responder</button></div>
    </form>
   :<div className="panel center"><p>Entre na sua conta para responder e curtir.</p><Link to="/jogador?entrar" className="btn btn-gold">Entrar</Link></div>}
 </div>;
}
