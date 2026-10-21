// Avatares do site (docs/site.md): recortes quadrados de artes aprovadas, sobre fundo pintado em degradê.
import sharp from 'sharp';
const S=256,bg=(a,b)=>Buffer.from(`<svg width="${S}" height="${S}"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`);
const jobs=[
 ['explorer','art-source/av-boy.webp',null,['#ffcf6a','#b0471a']],
 ['goggles','art-source/av-girl.webp',null,['#f4a6ff','#5b2391']],
 ['knight','art-source/hall-of-fame.png',{left:975,top:300,width:320,height:320},null],
 ['champion','art-source/hall-of-fame.png',{left:560,top:100,width:330,height:330},null],
 ['dragon','../public/assets/world-boss/portrait.png',null,null],
 ['verdalia','../public/assets/pets/verdalia/stage-2.png',null,['#bff59a','#2f7a3a']],
];
for(const [id,src,box,colors] of jobs){
 let img=sharp(src);if(box)img=img.extract(box);
 const pic=await img.resize(S,S,{fit:colors?'contain':'cover',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 let out=colors?sharp(bg(...colors)).composite([{input:pic}]):sharp(pic);
 await out.resize(S,S).webp({quality:90}).toFile(`public/avatars/${id}.webp`);console.log(id);
}
