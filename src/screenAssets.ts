/**
 * Keeps half-loaded screens out of sight: a window, panel or list item that appears with
 * pictures still downloading or decoding stays invisible until they are ready (at most
 * `GATE_MS`), so nobody sees icons, frames or backgrounds popping in one by one.
 * Pictures come from <img> tags and from CSS backgrounds (also of ::before/::after).
 */
const URL_PATTERN=/url\(\s*(["']?)([^"')]+)\1\s*\)/g;
const GATE_MS=1500;
const IGNORE='.screen-curtain';
/** Every picture seen once, kept so it can be decoded again (the browser drops decoded art of a hidden tab). */
const known=new Map<string,HTMLImageElement>();
const settled=new Set<string>();

function backgrounds(style:CSSStyleDeclaration,into:Set<string>){
 const value=style.backgroundImage;if(!value||value==='none'||!value.includes('url('))return;
 for(const match of value.matchAll(URL_PATTERN))if(!match[2].startsWith('data:'))into.add(match[2]);
}
/** The pictures inside `root`: its <img> tags and the URLs of its CSS backgrounds. */
export function screenPictures(root:Element){
 const images:HTMLImageElement[]=[],urls=new Set<string>();
 const elements=[root,...root.querySelectorAll('*')];
 for(const el of elements){
  if(el.closest(IGNORE))continue;
  if(el instanceof HTMLImageElement){if(el.currentSrc||el.src)images.push(el);continue;}
  backgrounds(getComputedStyle(el),urls);backgrounds(getComputedStyle(el,'::before'),urls);backgrounds(getComputedStyle(el,'::after'),urls);
 }
 return {images,urls:[...urls]};
}
function picture(url:string){let image=known.get(url);if(!image){image=new Image();image.decoding='async';image.src=url;known.set(url,image);}return image;}
/** Decodes one CSS background picture; a broken one counts as done. */
export function decodeUrl(url:string){return picture(url).decode().then(()=>{settled.add(url);},()=>{settled.add(url);});}
function decodeImage(image:HTMLImageElement){return image.decode().catch(()=>{});}
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

/**
 * Waits (up to `timeout` ms) until every picture inside `root` is downloaded and decoded,
 * reporting progress from 0 to 1. With `again`, pictures already seen are decoded once more.
 */
export async function screenReady(root:Element,timeout:number,progress?:(share:number)=>void,again=false){
 const {images,urls}=screenPictures(root);
 const work=[...images.map(decodeImage),...urls.filter(url=>again||!settled.has(url)).map(decodeUrl)];
 if(!work.length){progress?.(1);return;}
 let done=0;progress?.(0);
 const all=Promise.all(work.map(job=>job.then(()=>{done++;progress?.(done/work.length);})));
 await Promise.race([all,pause(timeout)]);
}

/** True when something inside `el` would still pop in. */
function pending(el:Element){
 const {images,urls}=screenPictures(el);
 return images.some(image=>!image.complete)||urls.some(url=>!settled.has(url));
}
function gate(el:HTMLElement){
 if(el.closest('[data-pictures-pending]')||el.closest(IGNORE)||!pending(el))return;
 el.setAttribute('data-pictures-pending','');
 void screenReady(el,GATE_MS).then(()=>el.removeAttribute('data-pictures-pending'));
}
let installed=false;
/** Starts hiding every new piece of screen until its pictures are ready. */
export function installPictureGate(){
 if(installed||typeof MutationObserver==='undefined')return;installed=true;
 new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement&&node.isConnected)gate(node);
 }).observe(document.body,{childList:true,subtree:true});
}
