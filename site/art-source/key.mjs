// Corta o fundo magenta de uma arte do Codex: só a região magenta ligada à borda (cabelo roxo fica).
// node site/art-source/key.mjs <in.png> <out.webp> [left,top,width,height|-] [largura]
import sharp from 'sharp';
const [,,input,output,box,width]=process.argv;
const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,dist=p=>Math.hypot(255-data[p],data[p+1],255-data[p+2]);
const gone=new Uint8Array(W*H),stack=[];
for(let x=0;x<W;x++)stack.push(x,(H-1)*W+x);for(let y=0;y<H;y++)stack.push(y*W,y*W+W-1);
while(stack.length){const i=stack.pop();if(gone[i]||dist(i*4)>95)continue;gone[i]=1;const x=i%W;if(x>0)stack.push(i-1);if(x<W-1)stack.push(i+1);if(i>=W)stack.push(i-W);if(i<W*(H-1))stack.push(i+W);}
for(let i=0;i<W*H;i++)if(dist(i*4)<55)gone[i]=1; // enclosed pockets of pure background
for(let i=0;i<W*H;i++){
 const p=i*4;if(gone[i]){data[p+3]=0;continue;}
 const x=i%W;const edge=(x>0&&gone[i-1])||(x<W-1&&gone[i+1])||(i>=W&&gone[i-W])||(i<W*(H-1)&&gone[i+W]);
 if(edge){const d=dist(p);data[p+3]=Math.round(255*Math.min(1,Math.max(0,(d-95)/90)));const g=data[p+1];data[p]=Math.min(data[p],g+90);data[p+2]=Math.min(data[p+2],g+90);}
}
let img=sharp(data,{raw:info});
if(box&&box!=='-'){const [left,top,w,h]=box.split(',').map(Number);img=sharp(await img.png().toBuffer()).extract({left,top,width:w,height:h});}
img=sharp(await img.png().toBuffer()).trim({threshold:1});
if(width)img=img.resize({width:Number(width)});
await img.webp({quality:88,alphaQuality:100}).toFile(output);console.log(output);
