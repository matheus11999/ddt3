import type {ComponentPropsWithoutRef,ReactNode} from 'react';
import './ItemCard.css';

type CardAppearance={selected?:boolean;empty?:boolean;variant?:'slot'|'detail'|'hero'|'preview';children?:ReactNode};
function CardChrome(){return <><i className="item-card-gloss" aria-hidden="true"/><svg className="item-card-ornament" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M6 25V15q0-9 9-9h10M75 6h10q9 0 9 9v10M6 75v10q0 9 9 9h10m50 0h10q9 0 9-9V75"/><path d="m10 19 2-7 7-2m62 0 7 2 2 7M10 81l2 7 7 2m62 0 7-2 2-7" strokeWidth=".8"/></g><path d="m50 3 3 3-3 3-3-3Zm0 88 3 3-3 3-3-3Z" fill="currentColor"/></svg></>;}
/** Every item uses the same neutral slot: the game has no rarity classes. */
function appearance({selected=false,empty=false,variant='slot'}:CardAppearance){return {'data-card':'','data-card-variant':variant,'data-card-selected':selected||undefined,'data-card-empty':empty||undefined};}

/** Shared ornamental card; passes native handlers/ARIA through without owning item behavior. */
export function ItemCard({selected=false,empty=false,variant='slot',className='',children,type='button',...props}:CardAppearance&ComponentPropsWithoutRef<'button'>){
 return <button {...props} type={type} {...appearance({selected,empty,variant})} className={`item-card ${className}`}><CardChrome/>{children}</button>;
}
/** The same card for non-interactive previews and drop targets, without nested buttons. */
export function ItemCardFrame({selected=false,empty=false,variant='detail',className='',children,...props}:CardAppearance&ComponentPropsWithoutRef<'div'>){
 return <div {...props} {...appearance({selected,empty,variant})} className={`item-card ${className}`}><CardChrome/>{children}</div>;
}
