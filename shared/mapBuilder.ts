/**
 * Map assembly from painted pieces (docs/maps-kit.md), shared by `npm run build:map`
 * (run inside a headless browser) and the admin map editor (run in the admin page).
 * Browser-only: it draws on canvases. Keep it free of imports so build-map can inject it as one script.
 */

export interface LayoutItem {
 id:string;sheet?:string;piece:number;x:number;top:number;scale?:number;material?:string;destructible?:boolean;
 /** false keeps the item on one side only (centre pieces). */
 mirror?:boolean;flip?:boolean;
 /** Replaces fields of the mirrored copy, usually its piece, so the two sides are not identical. */
 mirrorAs?:{sheet?:string;piece?:number;scale?:number;top?:number};
 /** Drops onto the ground already placed below `top`, sinking `sink` px (default 8). */
 rest?:boolean;sink?:number;
 /** false draws the art without collision. */
 solid?:boolean;
}
export interface MapLayout {
 name:string;source?:string;background:string|string[];backgroundBlend?:number;mid?:string;mirror?:boolean;width?:number;
 spawns:number[][];items:LayoutItem[];sheets?:Record<string,string>;pieces?:string;
 /** Editor fields, ignored by build:map. */
 subtitle?:string;kind?:string;
}
export interface Piece {canvas:HTMLCanvasElement;x:number;y:number;w:number;h:number;touchesEdge:boolean;}
/** An item as placed on the map: mirror copies expanded, `top` resolved for props that rest on the ground. */
export interface PlacedItem {id:string;source:number;mirrored:boolean;item:LayoutItem;sheet:string;piece?:Piece;left:number;right:number;top:number;bottom:number;w:number;h:number;}
export interface CellsShape {kind:'cells';col:number;row:number;cols:number;rows:number;bits:string;}
export interface BuiltRegion {id:string;material:string;destructible:boolean;solid:number;shape:CellsShape;}
/** A problem the map maker must fix; `item` is the layout index it points at, when there is one. */
export interface BuildWarning {text:string;item?:number;spawn?:[number,number];}
export interface Assembly {
 width:number;world:HTMLCanvasElement;regions:BuiltRegion[];warnings:BuildWarning[];placed:PlacedItem[];
 /** First solid pixel row of each x column (height when none). */
 surface:Int16Array;
}

export const MAP_HEIGHT=864,MAP_CELL=3;
export const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Não carregou ${src.slice(0,80)}`));image.src=src;});
const ctx=(c:HTMLCanvasElement)=>c.getContext('2d',{willReadFrequently:true})!;
interface Band {bx:number;bw:number;h:number;data:Uint8ClampedArray;}
/** The pixels of columns x0..x1 (clamped to the canvas), full height `h`. */
function band(c:CanvasRenderingContext2D,x0:number,x1:number,h:number):Band{const bx=Math.max(0,Math.min(c.canvas.width-1,Math.floor(x0))),bw=Math.max(1,Math.min(c.canvas.width,Math.ceil(x1))-bx);return {bx,bw,h,data:c.getImageData(bx,0,bw,h).data};}
const opaqueIn=(b:Band,x:number,y:number)=>x>=b.bx&&x<b.bx+b.bw&&y>=0&&y<b.h&&b.data[(y*b.bw+(x-b.bx))*4+3]>128;

/** Magenta → transparent, with a soft edge and the pink spill removed. */
export function unkey(image:CanvasImageSource&{width:number;height:number}){
 const sc=canvas(image.width,image.height),s=ctx(sc);s.drawImage(image,0,0);
 const px=s.getImageData(0,0,sc.width,sc.height),d=px.data;
 for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],key=Math.min(r,b)-g;
  if(key>150){d[i+3]=0;continue;}
  if(key>40){d[i+3]=Math.round(255*(150-key)/110);d[i]=Math.min(r,g+(r-Math.min(r,b))+40);d[i+2]=Math.min(b,g+(b-Math.min(r,b))+60);}}
 s.putImageData(px,0,0);return {sc,d};
}

/** Connected pieces of a magenta sheet, numbered top row first, then left to right; plus the numbered report image. */
export function cutSheet(image:HTMLImageElement){
 const {sc,d}=unkey(image);
 const step=4,gw=Math.ceil(sc.width/step),gh=Math.ceil(sc.height/step),grid=new Uint8Array(gw*gh),label=new Int32Array(gw*gh).fill(-1);
 for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const i=((y*step)*sc.width+x*step)*4+3;grid[y*gw+x]=d[i]>128?1:0;}
 const boxes:{x0:number;y0:number;x1:number;y1:number;area:number}[]=[];
 for(let start=0;start<grid.length;start++){if(!grid[start]||label[start]>=0)continue;
  const box={x0:1e9,y0:1e9,x1:-1,y1:-1,area:0},stack=[start];label[start]=boxes.length;
  while(stack.length){const n=stack.pop()!,x=n%gw,y=(n/gw)|0;box.area++;box.x0=Math.min(box.x0,x);box.y0=Math.min(box.y0,y);box.x1=Math.max(box.x1,x);box.y1=Math.max(box.y1,y);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,m=ny*gw+nx;if(nx>=0&&ny>=0&&nx<gw&&ny<gh&&grid[m]&&label[m]<0){label[m]=boxes.length;stack.push(m);}}}
  boxes.push(box);
 }
 const rowOf=(b:{y0:number;y1:number})=>(b.y0+b.y1)/2<gh/2?0:1;
 const pieces:Piece[]=boxes.filter(b=>b.area>400).sort((a,b)=>rowOf(a)-rowOf(b)||a.x0-b.x0).map(b=>{
  const x=b.x0*step-step,y=b.y0*step-step,w=(b.x1-b.x0+3)*step,h=(b.y1-b.y0+3)*step,c=canvas(w,h);ctx(c).drawImage(sc,x,y,w,h,0,0,w,h);
  return {canvas:c,x,y,w,h,touchesEdge:b.x0<=1||b.y0<=1||b.x1>=gw-2||b.y1>=gh-2};
 });
 const report=canvas(sc.width,sc.height),sr=ctx(report);sr.fillStyle='#2b3350';sr.fillRect(0,0,sc.width,sc.height);sr.drawImage(sc,0,0);
 sr.font='bold 40px sans-serif';sr.lineWidth=3;pieces.forEach((p,n)=>{sr.strokeStyle=p.touchesEdge?'#ff4040':'#ffe680';sr.strokeRect(p.x,p.y,p.w,p.h);sr.fillStyle='#ffe680';sr.fillText(String(n),p.x+8,p.y+40);});
 return {pieces,report};
}

/** The layout's items with the other team's mirrored copies, in drawing order. */
export function expandItems(layout:MapLayout){
 const W=layout.width??1536;
 return layout.items.flatMap((item,source)=>{
  const own={item,source,mirrored:false};
  if(!layout.mirror||item.mirror===false)return [own];
  return [own,{item:{...item,...item.mirrorAs,id:`${item.id}-r`,x:W-item.x,flip:!item.flip},source,mirrored:true}];
 });
}

/**
 * Places the pieces as the layout says and traces the collision from their alpha.
 * Props marked `rest` drop onto the ground below; the warnings are the build:map review rules.
 */
export function assemble(layout:MapLayout,sheetPieces:Record<string,Piece[]>):Assembly{
 const W=layout.width??1536,H=MAP_HEIGHT,CELL=MAP_CELL,COLS=W/CELL,ROWS=H/CELL;
 const firstSheet=Object.keys(layout.sheets??{pieces:''})[0];
 const world=canvas(W,H),wc=ctx(world);wc.imageSmoothingQuality='high';
 const ground=canvas(W,H),gc=ctx(ground);
 const regions:BuiltRegion[]=[],warnings:BuildWarning[]=[],placed:PlacedItem[]=[];
 const opaque=(data:Uint8ClampedArray,x:number,y:number)=>x>=0&&y>=0&&x<W&&y<H&&data[(y*W+x)*4+3]>128;
 for(const {item,source,mirrored} of expandItems(layout)){
  const sheet=item.sheet??firstSheet,list=sheetPieces[sheet]??[],piece=list[item.piece];
  if(!piece){warnings.push({text:`${sheet}: peça ${item.piece} não existe (${list.length} peças)`,item:source});continue;}
  if(piece.touchesEdge)warnings.push({text:`${sheet}: peça ${item.piece} encosta na borda da folha`,item:source});
  const scale=item.scale??1,w=piece.w*scale,h=piece.h*scale,left=item.x-w/2;
  const draw=(c:CanvasRenderingContext2D,top:number)=>{c.save();c.translate(item.x,top);if(item.flip)c.scale(-1,1);c.drawImage(piece.canvas,-w/2,0,w,h);c.restore();};
  // Props marked `rest` drop onto the terrain already placed below `top` (sinking a few px into the snow), so nothing floats.
  // Pixels are read only in the item's own columns, which keeps the editor responsive on wide maps.
  let top=item.top;const ground0=band(gc,left,left+w+1,H);
  const ph=Math.ceil(h)+1,probe=canvas(W,ph),pc=ctx(probe);draw(pc,0);const shape=band(pc,left,left+w+1,ph);
  const feet:[number,number][]=[];for(let x=Math.ceil(left+w*.2);x<left+w*.8;x+=3){let y=Math.floor(h);while(y>0&&!opaqueIn(shape,x,y))y--;if(y>0)feet.push([x,y]);}
  // A foot that starts inside the ground (the editor drags props by where they are drawn) climbs to the surface instead.
  const surface=([x,foot]:[number,number])=>{let y=Math.max(0,Math.floor(item.top+foot));if(opaqueIn(ground0,x,y)){while(y>0&&opaqueIn(ground0,x,y-1))y--;return y-foot;}
   for(;y<H;y++)if(opaqueIn(ground0,x,y))return y-foot;return Infinity;};
  if(item.rest){const tops=feet.map(surface).filter(Number.isFinite);if(tops.length)top=Math.min(...tops)+(item.sink??8);else warnings.push({text:`${item.id}: não achou chão abaixo para apoiar`,item:source});}
  if(item.rest||sheet==='objetos'){const touching=feet.filter(([x,foot])=>[0,3,6,9].some(d=>opaqueIn(ground0,x,Math.floor(top+foot+d)))).length;
   if(touching<Math.max(1,feet.length*.15))warnings.push({text:`${item.id}: objeto flutuando (base sem chão embaixo)`,item:source});}
  const entry:PlacedItem={id:item.id,source,mirrored,item,sheet,piece,left,right:left+w,top,bottom:top+h,w,h};
  if(item.solid===false){draw(wc,top);placed.push(entry);continue;}
  const one=canvas(W,H),oc=ctx(one);oc.imageSmoothingQuality='high';draw(oc,top);
  wc.drawImage(one,0,0);gc.drawImage(one,0,0);placed.push(entry);
  const col=Math.max(0,Math.floor(left/CELL)),row=Math.max(0,Math.floor(top/CELL)),cols=Math.min(COLS,Math.ceil((left+w)/CELL))-col,rows=Math.min(ROWS,Math.ceil((top+h)/CELL))-row;
  if(cols<=0||rows<=0){warnings.push({text:`${item.id}: fora do mapa`,item:source});continue;}
  const alpha=oc.getImageData(col*CELL,row*CELL,cols*CELL,rows*CELL).data,stride=cols*CELL;
  const bits=new Uint8Array(Math.ceil(cols*rows/8));let solid=0;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let sum=0;for(let dy=0;dy<CELL;dy++)for(let dx=0;dx<CELL;dx++)sum+=alpha[((y*CELL+dy)*stride+x*CELL+dx)*4+3];
   if(sum/(CELL*CELL)>=128){const n=y*cols+x;bits[n>>3]|=1<<(n&7);solid++;}}
  let binary='';for(const b of bits)binary+=String.fromCharCode(b);
  regions.push({id:item.id,material:item.material??'earth',destructible:item.destructible!==false,solid,shape:{kind:'cells',col,row,cols,rows,bits:btoa(binary)}});
 }

 // A big piece mostly covered from above by another piece is hidden under it (e.g. a gate under a bridge): it has no reason to be there.
 const solidPlaced=placed.filter(p=>p.item.solid!==false);
 for(const a of solidPlaced)if(a.sheet!=='objetos'){const covered=solidPlaced.filter(b=>b!==a&&b.sheet!=='objetos'&&b.bottom<a.top-10).reduce((n,b)=>n+Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),0);
  if(covered>(a.right-a.left)*.5)warnings.push({text:`${a.id}: peça escondida embaixo de outra (${Math.round(100*covered/(a.right-a.left))}% coberta por cima); só faz sentido se tiver motivo`,item:a.source});}

 // Spawns stand on open terrain: never on or against a prop, with room to walk both ways and nothing overhead.
 const groundData=gc.getImageData(0,0,W,H).data,surface=new Int16Array(W);
 for(let x=0;x<W;x++){let y=0;while(y<H&&!opaque(groundData,x,y))y++;surface[x]=y;}
 const top=(x:number)=>x>=0&&x<W?surface[Math.floor(x)]:H;
 layout.spawns.forEach((team,t)=>team.forEach((x,slot)=>{const name=`spawn time ${t+1} jogador ${slot+1} (x ${x})`,spawn:[number,number]=[t,slot];
  const y=top(x);if(y>=H){warnings.push({text:`${name}: sem chão, cai no abismo`,spawn});return;}
  const prop=solidPlaced.find(p=>p.sheet==='objetos'&&x>p.left-40&&x<p.right+40);if(prop)warnings.push({text:`${name}: colado em ${prop.id}`,spawn});
  // The column's top pixel is the floor, so "obstructed" means a wall or bump rising beside the body, or a drop right next to it.
  for(let dx=-40;dx<=40;dx+=4){if(!dx)continue;const g=top(x+dx);
   if(g<y-24){warnings.push({text:`${name}: obstáculo a ${Math.abs(dx)} px (${y-g} px mais alto)`,spawn});break;}
   if(g>y+30){warnings.push({text:`${name}: beirada a ${Math.abs(dx)} px`,spawn});break;}}
 }));
 return {width:W,world,regions,warnings,placed,surface};
}

/** One backdrop from panels painted as left/right halves, joined with a soft crossfade; `seams` measures how well they match. */
export function joinBackdrop(panels:HTMLImageElement[],blend=240){
 const ph=panels[0].height,widths=panels.map(p=>p.width*ph/p.height);
 const backdrop=canvas(Math.round(widths.reduce((a,b)=>a+b,0)-blend*(panels.length-1)),ph),bc=ctx(backdrop);
 const seams:number[]=[];let at=0;
 panels.forEach((p,n)=>{const w=widths[n];
  if(n){const piece=canvas(Math.ceil(w),ph),c=ctx(piece);c.drawImage(p,0,0,w,ph);c.globalCompositeOperation='destination-in';
   const fade=c.createLinearGradient(0,0,blend,0);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'#000');c.fillStyle=fade;c.fillRect(0,0,w,ph);
   const before=bc.getImageData(Math.round(at),0,8,ph).data,probe=canvas(8,ph),pr=ctx(probe);pr.drawImage(p,0,0,8*p.height/ph,p.height,0,0,8,ph);const after=pr.getImageData(0,0,8,ph).data;
   let diff=0;for(let i=0;i<before.length;i+=4)diff+=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);
   seams.push(diff/(before.length/4)/3);bc.drawImage(piece,at,0);}
  else bc.drawImage(p,0,0,w,ph);
  at+=w-blend;});
 return {backdrop,seams};
}

/** The whole map as players see it: backdrop scaled to cover, the parallax shade, then the terrain. */
export function montage(width:number,backdrop:CanvasImageSource&{width:number;height:number},world:CanvasImageSource){
 const W=width,H=MAP_HEIGHT,out=canvas(W,H),mc=ctx(out),scale=Math.max(W/backdrop.width,H/backdrop.height);
 mc.drawImage(backdrop,(W-backdrop.width*scale)/2,H-backdrop.height*scale,backdrop.width*scale,backdrop.height*scale);mc.fillStyle='rgba(7,13,24,.14)';mc.fillRect(0,0,W,H);mc.drawImage(world,0,0);
 return out;
}

/** Minimap/loading preview: the whole world scaled down. */
export function preview(width:number,whole:HTMLCanvasElement){
 const out=canvas(768,Math.round(432*1536/width)),c=ctx(out);c.imageSmoothingQuality='high';c.drawImage(whole,0,0,out.width,out.height);return out;
}

/** Collision review image: green breaks, grey does not, yellow spawns, red the death line. */
export function collisionImage(whole:HTMLCanvasElement,regions:BuiltRegion[],spawns:number[][]){
 const W=whole.width,H=MAP_HEIGHT,CELL=MAP_CELL,out=canvas(W,H),cc=ctx(out);cc.drawImage(whole,0,0);cc.fillStyle='rgba(0,0,0,.35)';cc.fillRect(0,0,W,H);
 for(const r of regions){const raw=atob(r.shape.bits);cc.fillStyle=r.destructible?'rgba(80,230,120,.55)':'rgba(170,170,190,.75)';
  for(let n=0;n<r.shape.cols*r.shape.rows;n++)if(raw.charCodeAt(n>>3)>>(n&7)&1)cc.fillRect((r.shape.col+n%r.shape.cols)*CELL,(r.shape.row+Math.floor(n/r.shape.cols))*CELL,CELL,CELL);}
 cc.strokeStyle='#ff3030';cc.lineWidth=3;cc.beginPath();cc.moveTo(0,H-2);cc.lineTo(W,H-2);cc.stroke();
 for(const team of spawns)for(const x of team){cc.fillStyle='#ffe14a';cc.fillRect(x-2,0,4,H);}
 return out;
}

/** Each spawn numbered on the map (blue team 1, red team 2). */
export function spawnsImage(whole:HTMLCanvasElement,surface:Int16Array,spawns:number[][]){
 const out=canvas(whole.width,MAP_HEIGHT),c=ctx(out);c.drawImage(whole,0,0);c.font='bold 26px sans-serif';c.textAlign='center';
 spawns.forEach((team,t)=>team.forEach((x,slot)=>{const y=surface[Math.floor(x)]??MAP_HEIGHT;
  c.fillStyle=t?'#ff5050':'#4aa8ff';c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.roundRect(x-14,y-56,28,56,10);c.fill();c.stroke();
  c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=5;c.strokeText(String(slot+1),x,y-66);c.fillText(String(slot+1),x,y-66);}));
 return out;
}
