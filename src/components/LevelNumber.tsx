import {LevelBadge} from './LevelBadge';

/** Legacy entry point used by room cards, halls and player information.
 * Keep every player-level display on the same numbered, animated badge. */
export function LevelNumber({level,size=40,className=''}:{level:number;size?:number;className?:string}){
 return <LevelBadge level={level} size={size} className={className}/>;
}
