export function BattleText({children,className=''}:{children:string;className?:string}){
 return <span className={`battle-3d-text ${className}`} data-text={children} role="img" aria-label={children}><span aria-hidden="true">{children}</span></span>;
}
