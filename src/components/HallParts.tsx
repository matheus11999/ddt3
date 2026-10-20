import type {CharacterGender} from '../../shared/catalog';
import type {OnlinePlayer} from '../../shared/protocol';
import {LevelBadge} from './LevelBadge';
import {playerMenuProps} from './PlayerActions';

const GENDER_LABEL={male:'Masculino',female:'Feminino'} as const;

/** Painted gender medallion (2×1 sheet: male, female). */
export function GenderIcon({gender,size=22}:{gender:CharacterGender;size?:number}){
 return <span className="gender-icon" data-gender={gender} style={{width:size,height:size}} role="img" aria-label={GENDER_LABEL[gender]} title={GENDER_LABEL[gender]}/>;
}

/** Online list shared by the PvP hall and the Expedition Center. */
export function HallOnlineList({players,meId}:{players:OnlinePlayer[];meId?:string}){
 return <div className="hall-online-list wood-cream" role="table" aria-label="Lista de jogadores online">
  <div className="hall-online-row hall-online-headrow" role="row"><span role="columnheader">Nível</span><span role="columnheader">Nome</span><span role="columnheader">Gênero</span></div>
  {players.map(player=><div key={player.id} role="row" className={`hall-online-row ${player.id===meId?'is-me':''}`} {...playerMenuProps({id:player.id,name:player.name,context:'hall'})}><span role="cell" className="hall-online-level"><LevelBadge level={player.level} size={30}/></span><span role="cell" className="hall-online-name" title={player.name}>{player.name}</span><span role="cell" className="hall-online-gender"><GenderIcon gender={player.gender} size={24}/></span></div>)}
 </div>;
}

/** Empty room list: painted hall art with a short hint, centred in the list. */
export function HallEmpty({art,searching,title,hint}:{art:string;searching:boolean;title:string;hint:string}){
 return <div className="hall-empty" data-searching={searching||undefined}>
  <img className="hall-empty-art" src={art} alt="" aria-hidden="true" draggable={false}/>
  <h3>{searching?'Nenhuma sala com esse nome':title}</h3>
  <p>{searching?'Confira o nome da sala ou limpe a pesquisa para ver todas.':hint}</p>
 </div>;
}
