import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RotateCw,Smartphone} from 'lucide-react';
import './MobileOrientation.css';

function readOrientation(){
 const mobile=navigator.maxTouchPoints>0&&window.matchMedia('(pointer: coarse), (hover: none)').matches;
 const portrait=mobile&&innerHeight>innerWidth;
 return {mobile,portrait,landscape:mobile&&!portrait};
}

/** Touch capability and the primary pointer distinguish phones from narrow desktop windows. */
export function useMobileOrientation(){
 const [orientation,setOrientation]=useState(readOrientation);
 useLayoutEffect(()=>{
  const media=window.matchMedia('(pointer: coarse), (hover: none)');
  const update=()=>{const next=readOrientation();setOrientation(previous=>previous.mobile===next.mobile&&previous.portrait===next.portrait?previous:next);};
  window.addEventListener('resize',update);window.addEventListener('orientationchange',update);media.addEventListener('change',update);update();
  return()=>{window.removeEventListener('resize',update);window.removeEventListener('orientationchange',update);media.removeEventListener('change',update);};
 },[]);
 return orientation;
}

export function MobileOrientationGate({visible}:{visible:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!visible)return;
  const previous=document.activeElement as HTMLElement|null;ref.current?.focus({preventScroll:true});
  const block=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const events=['keydown','keyup','pointerdown','pointermove','pointerup','wheel','touchmove'] as const;
  for(const event of events)window.addEventListener(event,block,{capture:true,passive:false});
  return()=>{for(const event of events)window.removeEventListener(event,block,true);if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[visible]);
 if(!visible)return null;
 return createPortal(<div ref={ref} tabIndex={-1} className="mobile-orientation-gate" role="alertdialog" aria-modal="true" aria-label="Vire o celular">
  <div className="orientation-medallion" aria-hidden="true"><Smartphone className="orientation-phone" size={80}/><RotateCw className="orientation-arrow" size={35}/><i/><i/></div>
  <h1>Vire o celular</h1><p>Jogue na horizontal</p>
 </div>,document.body);
}
