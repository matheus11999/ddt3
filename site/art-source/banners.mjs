// Page headers (PageHeader.tsx): every banner the same 2560×900 crop from the middle band of the Codex painting.
import sharp from 'sharp';
for(const id of process.argv.slice(2)){
 const src=`site/art-source/banner-${id}.png`,m=await sharp(src).metadata();
 const h=Math.round(m.width*900/2560),top=Math.round((m.height-h)*0.42);
 await sharp(src).extract({left:0,top,width:m.width,height:h}).resize(2560,900,{kernel:'lanczos3'}).sharpen({sigma:0.7}).webp({quality:86}).toFile(`site/public/art/banner-${id}.webp`);
 console.log(id);
}
