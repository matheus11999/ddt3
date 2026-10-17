import {LockKeyhole,Users} from 'lucide-react';
import type {CharacterGender} from '../../shared/catalog';
import './ItemGenderBadge.css';

export const ITEM_GENDER_LABELS={male:'Masculino',female:'Feminino',unisex:'Unissex'} as const;
export function ItemGenderBadge({gender,locked=false,compact=false}:{gender:CharacterGender|'unisex';locked?:boolean;compact?:boolean}){
 const label=ITEM_GENDER_LABELS[gender];
 return <span className={`item-gender-badge ${locked?'locked':''} ${compact?'compact':''}`} data-gender={gender} title={locked?`Exclusivo para personagem ${label.toLowerCase()}`:label} aria-label={locked?`${label}, incompatível com este personagem`:label}>{gender==='unisex'?<Users size={12}/>:<span className="item-gender-symbol" aria-hidden="true">{gender==='male'?'♂':'♀'}</span>}{!compact&&<span>{label}</span>}{locked&&<LockKeyhole size={11}/>}</span>;
}
