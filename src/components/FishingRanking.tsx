import {useState} from 'react';
import {ChevronRight,Trophy} from 'lucide-react';
import {useGame} from '../client';
import {audio} from '../game/audio';
import {FISH_BY_ID,fishRarity,fishingWeek,normalizeFishing} from '../../shared/fishing';
import {FishingIcon} from './FishingIcon';

const KEY='brasa.fishRanking.open';
const kg=(n:number)=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const readOpen=()=>{try{return localStorage.getItem(KEY)!=='0';}catch{return true;}};
/** "termina em 3 d" / "termina em 5 h": the ranking closes on Sunday night, Brasília (Monday 00:00 = 03:00 UTC). */
function endsIn(week:string,now:number){
 const [y,m,d]=week.split('-').map(Number),end=Date.UTC(y,m-1,d+7,3),left=Math.max(0,end-now),h=Math.ceil(left/36e5);
 return h>=48?`termina em ${Math.floor(h/24)} dias`:h>1?`termina em ${h} h`:'termina em menos de 1 h';
}
/**
 * Maior peixe da semana (pedido do matheus, 20/10): at the side of the Pescaria, opened and hidden by
 * the player. Only the weight counts, of any fish; each player shows their heaviest of the week.
 */
export function FishingRanking(){
 const {fishRanking,profile}=useGame();
 const [open,setOpen]=useState(readOpen);
 const toggle=()=>{const next=!open;setOpen(next);try{localStorage.setItem(KEY,next?'1':'0');}catch{/* private window */}audio.play('click');};
 const now=Date.now(),week=fishRanking?.week??fishingWeek(now),entries=fishRanking?.week===fishingWeek(now)?fishRanking.entries:[];
 const mine=normalizeFishing(profile!.fishing).week,myBest=mine?.key===week?mine:undefined,listed=entries.some(e=>e.id===profile!.id);
 if(!open)return <button className="fishing-rank-tab" onClick={toggle} title="Maior peixe da semana" aria-label="Abrir o ranking do maior peixe da semana"><Trophy size={20}/><span>Ranking</span></button>;
 return <aside className="fishing-rank" aria-label="Maior peixe da semana">
  <header><Trophy size={18}/><div><b>Maior peixe da semana</b><small>Só o peso conta · {endsIn(week,now)}</small></div>
   <button onClick={toggle} title="Ocultar o ranking" aria-label="Ocultar o ranking"><ChevronRight size={18}/></button></header>
  {entries.length?<ol>{entries.map(e=>{const fish=FISH_BY_ID.get(e.fish);
   return <li key={e.id} className={`${e.rank<=3?`top top-${e.rank}`:''} ${e.id===profile!.id?'me':''}`} title={fish?`${fish.name} (${fishRarity(fish).name})`:undefined}>
    <span className="fishing-rank-place">{e.rank}</span><span className="fishing-rank-name">{e.name}</span>
    <span className="fishing-rank-fish"><FishingIcon id={e.fish} size={24}/></span><b>{kg(e.kg)} kg</b>
   </li>;})}</ol>:<p className="fishing-rank-empty">Ninguém pescou nesta semana ainda.</p>}
  {!listed&&<footer>{myBest?<>Seu maior: <FishingIcon id={myBest.fish} size={20}/><b>{kg(myBest.kg)} kg</b></>:'Pesque para entrar no ranking.'}</footer>}
 </aside>;
}
