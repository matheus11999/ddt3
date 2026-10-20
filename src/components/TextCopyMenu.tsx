import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Copy} from 'lucide-react';
import {BagContextMenu} from './ColorStudio';

/** Where the game lets text be selected (see `user-select` in styles.css): the chat log and text fields. */
export const SELECTABLE_TEXT='.chat-messages,.battle-chat-log';

/** Text the player selected under the right click, or '' when the click is not on a selection the game allows. */
export function selectedTextAt(target:EventTarget|null,doc:Document=document):string{
 if(!(target instanceof Element))return '';
 if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement){
  const {selectionStart:start,selectionEnd:end}=target;
  return target.type==='password'||start==null||end==null||start===end?'':target.value.slice(start,end);
 }
 const area=target.closest(SELECTABLE_TEXT),selection=doc.getSelection();
 if(!area||!selection||selection.isCollapsed||!selection.rangeCount)return '';
 const range=selection.getRangeAt(0);
 return area.contains(range.commonAncestorContainer)?selection.toString().trim():'';
}

async function copyText(text:string){
 try{await navigator.clipboard.writeText(text);}
 catch{const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;opacity:0';document.body.append(field);field.select();document.execCommand('copy');field.remove();}
}

/** The game's own "Copiar" menu: right click on selected chat text or on selected text in a field. */
export function TextCopyMenu(){
 const [menu,setMenu]=useState<{x:number;y:number;text:string}|null>(null);
 useEffect(()=>{
  // Bubble phase: a game menu that already answered the click (player menu…) stops propagation first.
  const open=(event:MouseEvent)=>{const text=selectedTextAt(event.target);if(text)setMenu({x:event.clientX,y:event.clientY,text});};
  window.addEventListener('contextmenu',open);return()=>window.removeEventListener('contextmenu',open);
 },[]);
 return menu?createPortal(<BagContextMenu x={menu.x} y={menu.y} title="Texto" onClose={()=>setMenu(null)} actions={[{id:'copy',label:'Copiar',icon:<Copy size={16}/>,onSelect:()=>void copyText(menu.text)}]}/>,document.body):null;
}
