import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Home,Images,LogOut,Menu,MessagesSquare,Monitor,Settings,Smartphone,Users,X} from 'lucide-react';
import type {Me} from './api';
import {Avatar} from './Avatar';
import {Link} from './router';

export const DISCORD_URL='https://discord.gg/NHXMXnKVe';
/** Discord's mark, drawn inline (no external request). */
function DiscordIcon({size=20}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.8a13.7 13.7 0 0 0-.63 1.3 18.4 18.4 0 0 0-5.53 0 12.6 12.6 0 0 0-.64-1.3 19.7 19.7 0 0 0-4.93 1.53C.54 9.04-.31 13.6.11 18.1a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97c.17-.12.34-.26.5-.39a14.2 14.2 0 0 0 12.18 0l.5.39c-.65.39-1.33.71-2.04.98.37.73.8 1.43 1.29 2.09a19.8 19.8 0 0 0 6.05-3.05c.5-5.2-.84-9.72-3.57-13.73ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z"/></svg>;
}

export function Topbar({me,route,onLogout}:{me:Me|null;route:string;onLogout:()=>void}){
 const [open,setOpen]=useState(false);
 const [scrolled,setScrolled]=useState(false);
 useEffect(()=>{const on=()=>setScrolled(scrollY>24);on();addEventListener('scroll',on,{passive:true});return ()=>removeEventListener('scroll',on);},[]);
 useEffect(()=>setOpen(false),[route]);
 // Liquid glass: the selected tab is a glass lens that slides to the active link.
 const nav=useRef<HTMLElement>(null);const [lens,setLens]=useState<{x:number;w:number}|null>(null);
 useLayoutEffect(()=>{
  const place=()=>{const active=nav.current?.querySelector<HTMLElement>('a.active');setLens(active?{x:active.offsetLeft,w:active.offsetWidth}:null);};
  place();addEventListener('resize',place);return ()=>removeEventListener('resize',place);
 },[route,me?.account]);
 // Signed in, the bar is the player's own: no way back to the landing page.
 const signedIn=!!me?.account;
 const links=signedIn?[['/jogador','Início',Home],['/personagens','Personagens',Users],['/forum','Fórum',MessagesSquare],['/configuracoes','Configurações',Settings]] as const:[['/#prints','Telas do jogo',Images],['/forum','Comunidade',MessagesSquare]] as const;
 return <header className={`topbar${scrolled||route!=='/'?' solid':''}${open?' open':''}`}>
  <div className="topbar-inner">
   <Link to={signedIn?'/jogador':'/'} className="brand" aria-label="Bomb Masters, página inicial"><img src="/art/logo.webp" alt="Bomb Masters" width="132" height="78"/></Link>
   <nav className="nav" aria-label="Principal" ref={nav}>
    {lens&&<span className="nav-lens" aria-hidden="true" style={{transform:`translateX(${lens.x}px)`,width:lens.w}}/>}
    {links.map(([to,label,Icon])=>to.startsWith('/#')?<a key={to} href={to} onClick={()=>setOpen(false)}><Icon size={17}/><span>{label}</span></a>:<Link key={to} to={to} className={route===to||route.startsWith(to+'/')?'active':''}><Icon size={17}/><span>{label}</span></Link>)}
   </nav>
   <div className="topbar-actions">
    <a className="discord-btn" href={DISCORD_URL} target="_blank" rel="noopener noreferrer" title="Entrar no Discord" aria-label="Discord do Bomb Masters"><DiscordIcon/><span>Discord</span></a>
    {me?.account
     ?<><Link to="/configuracoes" className="me-chip" title="Configurações"><Avatar id={me.account.avatar} size={34}/><span>{me.account.username}</span></Link><button className="icon-btn" onClick={onLogout} title="Sair" aria-label="Sair"><LogOut size={18}/></button></>
     :<><Link to="/jogador?entrar" className="btn btn-ghost btn-sm">Entrar</Link><Link to="/jogador?cadastro" className="btn btn-gold btn-sm">Criar conta</Link></>}
   </div>
   <button className="icon-btn menu-btn" onClick={()=>setOpen(!open)} aria-label={open?'Fechar menu':'Abrir menu'} aria-expanded={open}>{open?<X size={22}/>:<Menu size={22}/>}</button>
  </div>
 </header>;
}

/** Rodapé em colunas: marca, o jogo, comunidade e conta, com a faixa da recompensa da beta em cima. */
export function Footer({me}:{me:Me|null}){
 const signedIn=!!me?.account;
 const year=new Date().getFullYear();
 return <footer className="footer">
  <div className="footer-beta">
   <img src="/art/beta-reward.webp" alt="" aria-hidden="true" loading="lazy"/>
   <div><b>Recompensa da beta</b><span>Jogue durante a beta e ganhe cosméticos exclusivos que nunca mais voltam. Eles chegam no Correio do jogo quando a beta terminar.</span></div>
  </div>
  <div className="footer-grid">
   <div className="footer-brand">
    <img src="/art/logo.webp" alt="Bomb Masters" width="150" height="89" loading="lazy"/>
    <p>A mesma essência, só que melhor. Artilharia por turnos no navegador, sem pay to win.</p>
    <a className="discord-btn footer-discord" href={DISCORD_URL} target="_blank" rel="noopener noreferrer"><DiscordIcon/><span>Entrar no Discord</span></a>
    <ul className="footer-platforms"><li><Monitor size={15}/> PC</li><li><Smartphone size={15}/> Celular</li><li className="footer-beta-chip">Beta aberta</li></ul>
   </div>
   <nav className="footer-col" aria-label="O jogo">
    <h3>O jogo</h3>
    {signedIn?<Link to="/jogador">Jogar agora</Link>:<Link to="/jogador?cadastro">Criar conta</Link>}
    <a href="/#prints">Telas do jogo</a>
    {signedIn&&<Link to="/personagens">Meus personagens</Link>}
   </nav>
   <nav className="footer-col" aria-label="Comunidade">
    <h3>Comunidade</h3>
    <Link to="/forum">Fórum</Link>
    <Link to="/forum?categoria=sugestoes">Sugestões</Link>
    <Link to="/forum?categoria=duvidas">Dúvidas</Link>
    <Link to="/forum?categoria=bugs">Bugs do beta</Link>
    <Link to="/forum?categoria=guildas">Guildas</Link>
   </nav>
   <nav className="footer-col" aria-label="Conta">
    <h3>Conta</h3>
    {signedIn
     ?<><Link to="/jogador">Minha página</Link><Link to="/configuracoes">Configurações</Link></>
     :<><Link to="/jogador?entrar">Entrar</Link><Link to="/jogador?cadastro">Cadastrar</Link></>}
   </nav>
  </div>
  <div className="footer-bottom">
   <span>© {year} Bomb Masters. Todos os direitos reservados.</span>
   <span className="footer-love">Feito com <span role="img" aria-label="amor">❤️</span></span>
  </div>
 </footer>;
}
