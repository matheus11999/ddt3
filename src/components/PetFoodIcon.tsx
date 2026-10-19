import {Apple} from 'lucide-react';
import {PET_FOODS} from '../../shared/pets';

/** A pet food's painted icon (shared/pets.ts PET_FOODS), or an apple when it has none. */
export function PetFoodIcon({food,size=48}:{food:string;size?:number}){
 const icon=PET_FOODS.get(food)?.icon;
 return icon?<img src={icon} width={size} height={size} alt="" draggable={false} style={{flexShrink:0,objectFit:'contain'}}/>:<Apple size={size*.6} aria-hidden="true"/>;
}
