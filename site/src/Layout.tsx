import {useEffect,useState} from 'react';
import {LogOut,Menu,X} from 'lucide-react';
import type {Me} from './api';
import {Avatar} from './Avatar';
import {Link} from './router';

export function Topbar({me,route,onLogout}:{me:Me|null;route:string;onLogout:()=>void}){
 const [open,setOpen]=useState(false);
 const [scrolled,setScrolled]=useState(false);
 useEffect(()=>{const on=()=>setScrolled(scrollY>24);on();addEventListener('scroll',on,{passive:true});return ()=>removeEventListener('scroll',on);},[]);
 useEffect(()=>setOpen(false),[route]);
 // Signed in, the bar is the player's own: no way back to the landing page.
 const signedIn=!!me?.account;
 const links=signedIn?[['/jogador','Início'],['/forum','Fórum'],['/configuracoes','Configurações']] as const:[['/#recursos','Recursos'],['/#beta','Beta'],['/forum','Comunidade']] as const;
 return <header className={`topbar${scrolled||route!=='/'?' solid':''}${open?' open':''}`}>
  <div className="topbar-inner">
   <Link to={signedIn?'/jogador':'/'} className="brand" aria-label="Bomb Masters, página inicial"><img src="/art/logo.webp" alt="Bomb Masters" width="132" height="78"/></Link>
   <nav className="nav" aria-label="Principal">
    {links.map(([to,label])=>to.startsWith('/#')?<a key={to} href={to} onClick={()=>setOpen(false)}>{label}</a>:<Link key={to} to={to} className={route===to||route.startsWith(to+'/')?'active':''}>{label}</Link>)}
   </nav>
   <div className="topbar-actions">
    {me?.account
     ?<><Link to="/configuracoes" className="me-chip" title="Configurações"><Avatar id={me.account.avatar} size={34}/><span>{me.account.username}</span></Link><button className="icon-btn" onClick={onLogout} title="Sair" aria-label="Sair"><LogOut size={18}/></button></>
     :<><Link to="/jogador?entrar" className="btn btn-ghost btn-sm">Entrar</Link><Link to="/jogador?cadastro" className="btn btn-gold btn-sm">Criar conta</Link></>}
   </div>
   <button className="icon-btn menu-btn" onClick={()=>setOpen(!open)} aria-label={open?'Fechar menu':'Abrir menu'} aria-expanded={open}>{open?<X size={22}/>:<Menu size={22}/>}</button>
  </div>
 </header>;
}

export function Footer(){
 return <footer className="footer">
  <div className="footer-inner">
   <img src="/art/logo.webp" alt="" width="120" height="71" loading="lazy"/>
   <p>Bomb Masters está em <b>beta</b>. Viu algo pra melhorar? Conta no <Link to="/forum?categoria=sugestoes">fórum de sugestões</Link>.</p>
   <p className="footer-small">© {new Date().getFullYear()} Bomb Masters. PC e celular, direto no navegador.</p>
  </div>
 </footer>;
}
