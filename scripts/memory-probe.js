// Injected before the game: tracks every canvas, ImageBitmap and image the page makes (weakly) so a
// test can add up the pixel memory still reachable. window.__mem() -> MB by kind.
(()=>{const refs=[];const track=(kind,o)=>{refs.push([kind,new WeakRef(o)]);return o;};
 const make=document.createElement.bind(document);document.createElement=function(tag,...a){const el=make(tag,...a);const t=String(tag).toLowerCase();if(t==='canvas'||t==='img')track(t,el);return el;};
 const Img=window.Image;window.Image=function(...a){return track('img',new Img(...a));};window.Image.prototype=Img.prototype;
 const cib=window.createImageBitmap.bind(window);window.createImageBitmap=(...a)=>cib(...a).then(b=>track('bitmap',b));
 if(window.OffscreenCanvas){const O=window.OffscreenCanvas;window.OffscreenCanvas=function(w,h){return track('canvas',new O(w,h));};window.OffscreenCanvas.prototype=O.prototype;}
 window.__mem=()=>{const out={canvas:0,bitmap:0,img:0,count:0,big:[],dirs:{}};for(const [k,r] of refs){const o=r.deref();if(!o)continue;let px=0;
  if(k==='img'){if(o.getAttribute&&!o.src)continue;if(!o.complete)continue;px=o.naturalWidth*o.naturalHeight;}else px=o.width*o.height;
  out[k]+=px*4/1e6;out.count++;if(k==='img'){const f=(o.src||'').replace(location.origin,'').split('?')[0].split('/').slice(0,4).join('/');out.dirs[f]=(out.dirs[f]||0)+px*4/1e6;}if(px*4>8e6)out.big.push(`${k} ${o.width||o.naturalWidth}x${o.height||o.naturalHeight} ${(o.src||'').split('/').slice(-2).join('/')}`);}
  for(const k of ['canvas','bitmap','img'])out[k]=Math.round(out[k]);for(const d in out.dirs)out.dirs[d]=Math.round(out.dirs[d]);return out;};})();
