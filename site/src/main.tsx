import {StrictMode,useCallback,useEffect,useState} from 'react';
import {navigate,useLocation} from './router';
import {createRoot} from 'react-dom/client';
import {api,type Me} from './api';
import {Footer,Topbar} from './Layout';
import {Home} from './Home';
import {PlayerPage} from './Player';
import {ForumPage,TopicPage} from './Forum';
import './site.css';

function App(){
 const path=useLocation();
 const [me,setMe]=useState<Me|null>(null);
 const refresh=useCallback(async()=>{try{setMe(await api.me());}catch{setMe({account:null,player:null,gameUrl:'/'});}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const signedIn=async()=>{await refresh();navigate('/jogador');};
 const logout=async()=>{await api.logout().catch(()=>{});await refresh();navigate('/');};
 const [route,query]=path.split('?');
 const topic=/^\/forum\/(\d+)$/.exec(route);
 let page:React.ReactNode;
 if(route==='/jogador')page=<PlayerPage me={me} onSignedIn={signedIn}/>;
 else if(topic)page=<TopicPage id={Number(topic[1])} me={me}/>;
 else if(route==='/forum')page=<ForumPage me={me} query={new URLSearchParams(query)}/>;
 else page=<Home me={me} onSignedIn={signedIn}/>;
 return <>
  <Topbar me={me} route={route} onLogout={logout}/>
  <main id="conteudo">{page}</main>
  <Footer/>
 </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
