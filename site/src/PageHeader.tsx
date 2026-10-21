/**
 * The header every inner page shares (pedido do matheus, 21/10): its own painted background (site/public/art/banner-*.webp,
 * Codex), always the same height, title on the left and optional actions on the right.
 */
export function PageHeader({art,eyebrow,title,text,children,className=''}:{art:string;eyebrow?:React.ReactNode;title:React.ReactNode;text?:React.ReactNode;children?:React.ReactNode;className?:string}){
 return <header className={`page-header ${className}`}>
  <div className="page-header-art" aria-hidden="true"><img src={`/art/banner-${art}.webp`} alt=""/></div>
  <div className="page-header-inner">
   <div className="page-header-copy">
    {eyebrow&&<p className="eyebrow">{eyebrow}</p>}
    <h1 className="title-3d">{title}</h1>
    {text&&<div className="page-header-text">{text}</div>}
   </div>
   {children&&<div className="page-header-actions">{children}</div>}
  </div>
 </header>;
}
