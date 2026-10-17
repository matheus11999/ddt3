import type {ComponentPropsWithoutRef,ReactNode} from 'react';
import './ItemCard.css';

export type ItemRarity='common'|'uncommon'|'rare'|'normal'|'epic'|'legendary';
type CardAppearance={rarity?:ItemRarity;selected?:boolean;empty?:boolean;variant?:'slot'|'detail'|'hero'|'preview';children?:ReactNode};
/** The game shows four item classes: Comum, Normal, Épico and Lendário. Incomum and Raro both read as Normal. */
export type ItemTier='common'|'normal'|'epic'|'legendary';
export function itemTier(rarity:ItemRarity='common'):ItemTier {return rarity==='legendary'?'legendary':rarity==='epic'?'epic':rarity==='common'?'common':'normal';}
export function rarityLabel(rarity:ItemRarity='common'){
 const tier=itemTier(rarity);return tier==='legendary'?'Lendário':tier==='epic'?'Épico':tier==='normal'?'Normal':'Comum';
}
export function stoneRarity(_level:number):ItemRarity{return 'common';}
function CardChrome(){return <><i className="item-card-gloss" aria-hidden="true"/><svg className="item-card-ornament" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M6 25V15q0-9 9-9h10M75 6h10q9 0 9 9v10M6 75v10q0 9 9 9h10m50 0h10q9 0 9-9V75"/><path d="m10 19 2-7 7-2m62 0 7 2 2 7M10 81l2 7 7 2m62 0 7-2 2-7" strokeWidth=".8"/></g><path d="m50 3 3 3-3 3-3-3Zm0 88 3 3-3 3-3-3Z" fill="currentColor"/></svg></>;}
function appearance({rarity='common',selected=false,empty=false,variant='slot'}:CardAppearance){const tier=itemTier(rarity);return {'data-rarity':tier==='normal'?'rare':tier,'data-tier':tier,'data-card-variant':variant,'data-card-selected':selected||undefined,'data-card-empty':empty||undefined};}

/** Shared ornamental card; passes native handlers/ARIA through without owning item behavior. */
export function ItemCard({rarity='common',selected=false,empty=false,variant='slot',className='',children,type='button',...props}:CardAppearance&ComponentPropsWithoutRef<'button'>){
 return <button {...props} type={type} {...appearance({rarity,selected,empty,variant})} className={`item-card ${className}`}><CardChrome/>{children}</button>;
}
/** The same card for non-interactive previews and drop targets, without nested buttons. */
export function ItemCardFrame({rarity='common',selected=false,empty=false,variant='detail',className='',children,...props}:CardAppearance&ComponentPropsWithoutRef<'div'>){
 return <div {...props} {...appearance({rarity,selected,empty,variant})} className={`item-card ${className}`}><CardChrome/>{children}</div>;
}
