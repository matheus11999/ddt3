import type {AvatarId} from './api';

/** The account's painted avatar (site/public/avatars, chosen in Configurações). */
export function Avatar({id,size=40,className=''}:{id:AvatarId;size?:number;className?:string}){
 return <img className={`avatar-img ${className}`} src={`/avatars/${id}.webp`} alt="" width={size} height={size} style={{width:size,height:size}}/>;
}
