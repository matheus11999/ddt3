// Production build step (infra/Dockerfile.client, docs/performance.md "Imagens"): beside every painted PNG in dist/assets
// writes a lossless WebP copy (`x.png.webp`, the same pixels) when it is at least 10% smaller; nginx serves it in place
// of the PNG (same URL, so no code or pipeline changes). The /source/ pranchas are never loaded by the game and are skipped.
// node scripts/webp-assets.mjs [dist]
import sharp from 'sharp';
import {readdir,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=join(process.argv[2]??'dist','assets');
async function* pngs(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);
 if(e.isDirectory()){if(e.name!=='source')yield* pngs(p);}else if(e.name.endsWith('.png'))yield p;}}
const files=[];for await(const p of pngs(root))files.push(p);
let before=0,after=0,kept=0,next=0;const start=Date.now();
async function worker(){while(next<files.length){const p=files[next++];const size=(await stat(p)).size;before+=size;
 const webp=await sharp(p,{limitInputPixels:false}).webp({lossless:true,effort:4}).toBuffer();
 if(webp.length<=size*.9){await writeFile(p+'.webp',webp);after+=webp.length;kept++;}else after+=size;}}
await Promise.all(Array.from({length:4},worker));
console.log(`[webp] ${kept}/${files.length} PNGs com cópia WebP sem perda: ${(before/1e6).toFixed(1)} MB -> ${(after/1e6).toFixed(1)} MB em ${((Date.now()-start)/1000).toFixed(0)} s`);
