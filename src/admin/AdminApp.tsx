import {useCallback,useEffect,useState} from 'react';
import {BarChart3,Boxes,Castle,Flag,Flame,LogOut,Map as MapIcon,ShieldCheck,ShoppingBag,Users,CalendarDays,Lock} from 'lucide-react';
import {api,ApiError,whenSignedOut} from './api';
import {Dashboard} from './Dashboard';
import {MapList} from './MapList';
import {MapEditor} from './MapEditor';
import {LobbyEditor} from './LobbyEditor';
import {AssetLibrary} from './AssetLibrary';
import {Reports} from './Reports';
import {Players} from './Players';
import {Events} from './Events';
import {LOBBY_MAP_ID} from '../../shared/mapAdmin';

/** Tiny router over location.pathname: /admin, /admin/mapas, /admin/mapas/<id>, /admin/assets. */
export function navigate(path:string){history.pushState(null,'',path);window.dispatchEvent(new Event('admin-route'));}
function useRoute(){
 const [path,setPath]=useState(location.pathname);
 useEffect(()=>{const update=()=>setPath(location.pathname);window.addEventListener('popstate',update);window.addEventListener('admin-route',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener('admin-route',update);};},[]);
 return path.replace(/\/+$/,'')||'/admin';
}

export function AdminApp(){
 const [user,setUser]=useState<string|null|undefined>(undefined),[enabled,setEnabled]=useState(true);
 useEffect(()=>{whenSignedOut(()=>setUser(null));api.me().then(r=>{setUser(r.username);setEnabled(r.enabled);}).catch(()=>setUser(null));},[]);
 if(user===undefined)return <div className="adm-splash"><Flame className="adm-spin" size={40}/></div>;
 if(!user)return <Login enabled={enabled} onLogin={setUser}/>;
 return <Shell user={user} onLogout={async()=>{await api.logout().catch(()=>{});setUser(null);}}/>;
}

function Login({enabled,onLogin}:{enabled:boolean;onLogin:(user:string)=>void}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');
  try{const r=await api.login(username.trim(),password);setPassword('');onLogin(r.username);}catch(err){setError(err instanceof ApiError?err.message:'Sem conexão com o servidor.');}finally{setBusy(false);}};
 return <main className="adm-login">
  <div className="adm-login-glow"/>
  <form className="adm-login-card" onSubmit={submit}>
   <div className="adm-brand big"><span className="adm-brand-mark"><Flame size={30}/></span><div><b>BRASA</b><small>Painel do administrador</small></div></div>
   {!enabled&&<p className="adm-note warn">O painel está desativado neste servidor. Gere a senha com <code>npm run admin:password</code> e defina <code>ADMIN_USERNAME</code> e <code>ADMIN_PASSWORD_HASH</code> no <code>.env</code>.</p>}
   <label>Usuário<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} maxLength={64} required/></label>
   <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={512} required/></label>
   {error&&<p className="adm-error" role="alert">{error}</p>}
   <button className="adm-btn gold wide" disabled={busy||!enabled}><Lock size={16}/>{busy?'Entrando…':'Entrar'}</button>
   <p className="adm-fine"><ShieldCheck size={14}/> Sessão de 8 horas. Após 5 tentativas erradas, o acesso trava por 15 minutos.</p>
  </form>
 </main>;
}

const SOON=[{icon:ShoppingBag,label:'Loja'}];

function Shell({user,onLogout}:{user:string;onLogout:()=>void}){
 const path=useRoute(),editing=path.match(/^\/admin\/mapas\/([a-z0-9-]+)$/)?.[1];
 const link=useCallback((to:string)=>(e:React.MouseEvent)=>{e.preventDefault();navigate(to);},[]);
 const section=path.startsWith('/admin/mapas')?'maps':path.startsWith('/admin/assets')?'assets':path.startsWith('/admin/denuncias')?'reports':path.startsWith('/admin/jogadores')?'players':path.startsWith('/admin/eventos')?'events':'home';
 const report=Number(path.match(/^\/admin\/denuncias\/(\d+)$/)?.[1])||undefined;
 if(editing)return editing===LOBBY_MAP_ID?<LobbyEditor key={editing} onBack={()=>navigate('/admin/mapas')}/>:<MapEditor key={editing} id={editing} onBack={()=>navigate('/admin/mapas')}/>;
 return <div className="adm-shell">
  <aside className="adm-side">
   <div className="adm-brand"><span className="adm-brand-mark"><Flame size={22}/></span><div><b>BRASA</b><small>Painel</small></div></div>
   <nav>
    <a href="/admin" onClick={link('/admin')} className={section==='home'?'active':''}><BarChart3 size={18}/>Visão geral</a>
    <a href="/admin/jogadores" onClick={link('/admin/jogadores')} className={section==='players'?'active':''}><Users size={18}/>Jogadores</a>
    <a href="/admin/mapas" onClick={link('/admin/mapas')} className={section==='maps'?'active':''}><MapIcon size={18}/>Mapas</a>
    <a href="/admin/assets" onClick={link('/admin/assets')} className={section==='assets'?'active':''}><Boxes size={18}/>Assets</a>
    <a href="/admin/denuncias" onClick={link('/admin/denuncias')} className={section==='reports'?'active':''}><Flag size={18}/>Denúncias</a>
    <a href="/admin/eventos" onClick={link('/admin/eventos')} className={section==='events'?'active':''}><CalendarDays size={18}/>Eventos</a>
    <span className="adm-nav-title">Em breve</span>
    {SOON.map(({icon:Icon,label})=><span key={label} className="adm-nav-soon"><Icon size={18}/>{label}</span>)}
   </nav>
   <div className="adm-side-foot">
    <span className="adm-user"><Castle size={16}/>{user}</span>
    <button className="adm-btn ghost small" onClick={onLogout}><LogOut size={15}/>Sair</button>
   </div>
  </aside>
  <main className="adm-main">{section==='maps'?<MapList/>:section==='assets'?<AssetLibrary/>:section==='reports'?<Reports id={report}/>:section==='players'?<Players/>:section==='events'?<Events/>:<Dashboard/>}</main>
 </div>;
}
