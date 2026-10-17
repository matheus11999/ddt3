import {chromium} from '@playwright/test';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Weapon kit validator (docs/weapon-kit.md). For every weapon × phase it checks the icon, the held art,
// the projectile, launch and impact cells of the effect atlas, the terrain mark, the four sounds and the
// POW × Tridente rule, then writes test-results/weapons/{report.md,report.json,sheet.png} and one
// ChatGPT/ElevenLabs prompt per missing piece in test-results/weapons/prompts/.
// Report mode by default; --strict exits 1 while anything is missing. --weapon=<id> limits the run.
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/weapons.
const strict=process.argv.includes('--strict');
const only=process.argv.find(arg=>arg.startsWith('--weapon='))?.slice(9);
const output=process.env.OUTPUT_DIR??'test-results/weapons';
await rm(`${output}/prompts`,{recursive:true,force:true});
await mkdir(`${output}/prompts`,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let report;
try{
 const page=await browser.newPage({viewport:{width:1500,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // A blank page on the Vite origin: modules and /assets resolve, the game itself does not boot.
 await page.route('**/__weapon-kit.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Validador de armas</title><body></body>'}));
 await page.goto(new URL('/__weapon-kit.html',server.resolvedUrls.local[0]).href,{waitUntil:'domcontentloaded'});
 report=await page.evaluate(async only=>{
  const K=await import('/shared/weaponKit.ts');
  const {WEAPONS}=await import('/shared/catalog.ts');
  // A missing public file falls back to index.html under Vite, so the content type decides.
  const fetchAsset=async(path,kind)=>{try{const response=await fetch(path,{cache:'no-store'});const type=response.headers.get('content-type')??'';return response.ok&&type.startsWith(kind)?response:null;}catch{return null;}};
  const images=new Map();
  const image=path=>{
   if(!images.has(path))images.set(path,(async()=>{
    const response=await fetchAsset(path,'image/');if(!response)return null;
    const bitmap=await createImageBitmap(await response.blob());return bitmap;
   })());
   return images.get(path);
  };
  // Coverage and a 16×16 signature of one region, to catch empty cells and phases that repeat the previous one.
  const measure=(bitmap,x,y,w,h)=>{
   const canvas=new OffscreenCanvas(64,64),c=canvas.getContext('2d');c.drawImage(bitmap,x,y,w,h,0,0,64,64);
   const data=c.getImageData(0,0,64,64).data;let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]>20)solid++;
   const small=new OffscreenCanvas(16,16),s=small.getContext('2d');s.drawImage(bitmap,x,y,w,h,0,0,16,16);
   // Style check at the source resolution: painted art has many colors and soft anti-aliased edges;
   // pixel art and flat vector have few colors, hard alpha and runs of identical pixels.
   // Calibrated on the former painted weapons (1300+ colors, 0.2-0.3% repeated, 0.6-2% soft edge) against
   // pixelated (75-92% repeated) and posterized vector versions of the same art (12 colors, hard alpha).
   const side=256,full=new OffscreenCanvas(side,side),f=full.getContext('2d');f.imageSmoothingEnabled=false;f.drawImage(bitmap,x,y,w,h,0,0,side,side);
   const px=f.getImageData(0,0,side,side).data,colors=new Set();let opaque=0,soft=0,same=0,pairs=0;
   for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a>20){opaque++;colors.add((px[i]>>3)<<10|(px[i+1]>>3)<<5|px[i+2]>>3);if(a<235)soft++;if(i%(side*4)&&px[i-1]>20){pairs++;if(px[i]===px[i-4]&&px[i+1]===px[i-3]&&px[i+2]===px[i-2])same++;}}}
   const style={colors:colors.size,softEdge:opaque?soft/opaque:0,flat:pairs?same/pairs:0};
   return {coverage:solid/4096,signature:Array.from(s.getImageData(0,0,16,16).data),style};
  };
  const same=(a,b)=>{if(!a||!b)return false;let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);return diff/a.length<4;};
  const thumb=(bitmap,x,y,w,h)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;canvas.getContext('2d').drawImage(bitmap,x,y,w,h,0,0,96,96);return canvas.toDataURL();};
  const weapons=[];
  for(const weapon of WEAPONS){
   if(only&&weapon.id!==only)continue;
   const kit=K.weaponKit(weapon.id),entry={id:weapon.id,name:weapon.name,items:[],prompts:[]};weapons.push(entry);
   const add=(item)=>{entry.items.push(item);return item;};
   if(!kit){add({group:'manifesto',slot:'kit',label:'Kit da arma',status:'falta',detail:'Arma sem entrada em WEAPON_KITS (shared/weaponKit.ts).'});continue;}
   const previous={};
   for(const phase of K.WEAPON_PHASES){
    for(const slot of Object.keys(K.PHASE_ART_SLOTS)){
     const spec=K.PHASE_ART_SLOTS[slot],path=K.phaseArtPath(kit,phase.stage,slot),bitmap=await image(path);
     const item=add({group:phase.label,stage:phase.stage,slot,label:spec.label,path,status:'ok',detail:''});
     if(!bitmap){item.status='falta';item.detail=`Arquivo não encontrado: public${path}`;}
     else{
      let region=[0,0,bitmap.width,bitmap.height];
      if(K.ATLAS_ROWS[slot]!==undefined){
       const [aw,ah]=K.ATLAS_SIZE;
       if(bitmap.width!==aw||bitmap.height!==ah){item.status='falta';item.detail=`Atlas com ${bitmap.width}×${bitmap.height}; o contrato é ${aw}×${ah} (4 colunas × 3 linhas).`;}
       const cw=bitmap.width/4,ch=bitmap.height/3;region=[phase.tier*cw,K.ATLAS_ROWS[slot]*ch,cw,ch];item.cell=`linha ${K.ATLAS_ROWS[slot]+1}, coluna ${phase.tier+1}`;
      }else if(spec.size&&(bitmap.width!==spec.size[0]||bitmap.height!==spec.size[1])){item.status='aviso';item.detail=`Tamanho ${bitmap.width}×${bitmap.height}; o esperado é ${spec.size[0]}×${spec.size[1]}.`;}
      const m=measure(bitmap,...region);item.coverage=Math.round(m.coverage*1000)/10;item.thumb=thumb(bitmap,...region);
      if(item.status==='ok'&&m.coverage<.01){item.status='falta';item.detail='Imagem ou célula vazia (transparente).';}
      else if(item.status==='ok'&&m.coverage>.97){item.status='aviso';item.detail='Sem transparência: o fundo precisa ser transparente.';}
      else if(item.status==='ok'&&same(previous[slot],m.signature)){item.status='falta';item.detail='Igual à fase anterior: cada fase precisa de arte própria.';}
      else if(item.status==='ok'&&K.ATLAS_ROWS[slot]===undefined&&(m.style.colors<350||m.style.flat>.3||m.style.softEdge<.003)){item.status='falta';item.detail=`Fora do estilo da casa: parece pixel art ou vetor chapado (${m.style.colors} cores, ${Math.round(m.style.flat*100)}% pixels repetidos, ${(m.style.softEdge*100).toFixed(1)}% borda suave). Refaça com o prompt.`;}
      item.style=m.style;
      previous[slot]=m.signature;
     }
     if(item.status!=='ok')entry.prompts.push(K.ATLAS_ROWS[slot]!==undefined
      ?{key:'atlas',order:K.promptOrder('atlas'),file:`atlas-efeitos.txt`,title:'Atlas de projétil, disparo e impacto (todas as fases)',kind:'imagem',text:K.artPrompt(weapon,kit,'atlas')}
      :{key:`${slot}-${phase.stage}`,order:K.promptOrder(slot,phase.stage),file:`${slot}-${phase.stage}.txt`,title:`${spec.label} ${phase.label}`,kind:'imagem',text:K.artPrompt(weapon,kit,slot,phase.stage)});
    }
   }
   {
    const path=K.weaponTerrainPath(kit.id),bitmap=await image(path),item=add({group:'arma',slot:'terrain',label:K.WEAPON_ART_SLOTS.terrain.label,path,status:'ok',detail:''});
    if(!bitmap){item.status='falta';item.detail=`Arquivo não encontrado: public${path}`;}
    else{const m=measure(bitmap,0,0,bitmap.width,bitmap.height);item.coverage=Math.round(m.coverage*1000)/10;item.thumb=thumb(bitmap,0,0,bitmap.width,bitmap.height);if(m.coverage<.01){item.status='falta';item.detail='Marca vazia.';}}
    if(item.status!=='ok')entry.prompts.push({key:'terrain',order:K.promptOrder('terrain'),file:'marca-cenario.txt',title:item.label,kind:'imagem',text:K.artPrompt(weapon,kit,'terrain')});
   }
   for(const slot of Object.keys(K.WEAPON_SOUND_SLOTS)){
    const spec=K.WEAPON_SOUND_SLOTS[slot],item=add({group:'som',slot:`sound-${slot}`,label:spec.label,status:'padrão',detail:''});
    const path=K.weaponSoundPath(weapon.id,slot),declared=kit.sounds?.includes(slot),response=await fetchAsset(path,'audio/');item.path=path;
    if(response){
     try{const context=new OfflineAudioContext(1,1,44100),buffer=await context.decodeAudioData(await response.arrayBuffer());item.seconds=Math.round(buffer.duration*100)/100;
      item.status=!declared||buffer.duration>4?'aviso':'ok';
      item.detail=!declared?`O arquivo existe mas o jogo ainda não usa: acrescente '${slot}' em sounds no kit (shared/weaponKit.ts).`:buffer.duration>4?`Dura ${item.seconds}s; efeitos de combate devem ter até 4s.`:'';}
     catch{item.status='falta';item.detail=`Não foi possível decodificar public${path}.`;}
    }else if(declared){item.status='falta';item.detail=`Declarado em sounds, mas falta public${path}.`;}
    else{
     item.detail=slot==='flight'?'Sem som de voo; o jogo segue em silêncio durante o voo.':slot==='terrain'?'Sem som próprio; o som de colisão cobre a quebra do cenário.':`Usando o som padrão sintetizado da família "${weapon.effect}" (src/game/audio.ts) até chegar o único.`;
     entry.prompts.push({key:`sound-${slot}`,order:20+Object.keys(K.WEAPON_SOUND_SLOTS).indexOf(slot),file:`som-${slot}.txt`,title:spec.label,kind:'som',seconds:spec.seconds,path:item.path,text:K.soundPrompt(kit,slot)});
    }
   }
   add(kit.powTrident
    ?{group:'regra',slot:'pow',label:'POW × Tridente',status:'ok',detail:K.POW_TRIDENT_LABELS[kit.powTrident]}
    :{group:'regra',slot:'pow',label:'POW × Tridente',status:'aviso',detail:'Regra não definida: o jogo usa "livre" (POW e Tridente combinam). Defina powTrident no kit.'});
   // All four looks in one image, cut by split-weapon-sheet: offered while any icon or held art is missing.
   if(entry.prompts.some(prompt=>/^(icon|held)-/.test(prompt.key)))entry.prompts.push({key:'sheet',order:0,file:'prancha-fases.txt',title:'Prancha com as 4 fases (ícone e arma na mão)',kind:'imagem',text:K.phasesSheetPrompt(weapon,kit)});
   const seen=new Set();entry.prompts=entry.prompts.filter(prompt=>!seen.has(prompt.key)&&seen.add(prompt.key)).sort((a,b)=>a.order-b.order);
  }
  // Visual sheet: one row per weapon, thumbnails per phase.
  const color={ok:'#2f9e44',falta:'#e03131','padrão':'#f08c00',aviso:'#f08c00'};
  const esc=value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const cell=item=>`<div class="c" style="border-color:${color[item.status]}" title="${esc(item.detail)}">${item.thumb?`<img src="${item.thumb}">`:'<b>?</b>'}<span style="background:${color[item.status]}">${esc(item.label)}</span></div>`;
  document.head.innerHTML='<style>body{margin:0;padding:16px;background:#2b1d12;font:13px Nunito,system-ui,sans-serif;color:#f6e7c8}h1{font-size:20px;margin:0 0 12px;color:#ffd36b}.w{background:#3d2a19;border-radius:10px;padding:10px;margin-bottom:12px}.w h2{margin:0 0 8px;font-size:16px;color:#ffd36b}.w h2 small{color:#f6e7c8;font-weight:400}.ph{display:flex;gap:10px;flex-wrap:wrap}.p{background:#4d3622;border-radius:8px;padding:6px}.p>div:first-child{font-weight:700;margin-bottom:4px}.row{display:flex;gap:4px}.c{width:96px;height:118px;border:2px solid;border-radius:6px;background:#1c130b;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden}.c img{width:96px;height:96px;object-fit:contain}.c b{font-size:40px;margin-top:20px;color:#e03131}.c span{width:100%;text-align:center;font-size:10px;color:#fff;padding:2px 0}.s{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.t{padding:3px 8px;border-radius:12px;color:#fff;font-size:12px}</style>';
  document.body.innerHTML=`<h1>Validador de armas · ${new Date().toLocaleDateString('pt-BR')}</h1>`+weapons.map(w=>{
   const missing=w.items.filter(i=>i.status==='falta').length,fallback=w.items.filter(i=>i.status==='padrão'||i.status==='aviso').length;
   const phases=K.WEAPON_PHASES.map(p=>`<div class="p"><div>${p.label}</div><div class="row">${w.items.filter(i=>i.stage===p.stage).map(cell).join('')}</div></div>`).join('');
   const extra=w.items.filter(i=>i.stage===undefined),art=extra.filter(i=>i.thumb||i.slot==='terrain').map(cell).join('');
   const tags=extra.filter(i=>!(i.thumb||i.slot==='terrain')).map(i=>`<span class="t" style="background:${color[i.status]}" title="${esc(i.detail)}">${esc(i.label)}: ${i.status==='ok'?'✓':i.status==='padrão'?'padrão':i.status==='aviso'&&i.group==='regra'?'indefinida':i.status}</span>`).join('');
   return `<div class="w"><h2>${esc(w.name)} <small>${w.id} · ${missing} faltando · ${fallback} provisórios</small></h2><div class="ph">${phases}<div class="p"><div>Arma</div><div class="row">${art}</div></div></div><div class="s">${tags}</div></div>`;
  }).join('');
  return weapons.map(w=>({...w,items:w.items.map(({thumb,...rest})=>rest)}));
 },only);
 await page.evaluate(()=>Promise.all([...document.images].map(img=>img.complete?null:new Promise(r=>img.onload=r))));
 await page.screenshot({path:`${output}/sheet.png`,fullPage:true});
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();await server.close();}

const icon={ok:'✅',falta:'❌','padrão':'🟠',aviso:'⚠️'};
const lines=[`# Validador de armas`,'',`Gerado por \`npm run verify:weapons\`. ✅ pronto · ❌ falta · 🟠 usando o padrão · ⚠️ aviso. Prompts em \`${output}/prompts/\`.`,''];
let missing=0,pending=0;
for(const weapon of report){
 const counts={falta:0,'padrão':0,aviso:0,ok:0};for(const item of weapon.items)counts[item.status]++;missing+=counts.falta;pending+=counts['padrão']+counts.aviso;
 lines.push(`## ${weapon.name} (\`${weapon.id}\`): ${counts.falta} faltando, ${counts['padrão']+counts.aviso} provisórios, ${counts.ok} prontos`,'','| Grupo | Peça | Estado | Detalhe |','| --- | --- | --- | --- |');
 for(const item of weapon.items)lines.push(`| ${item.group} | ${item.label}${item.cell?` (${item.cell})`:''} | ${icon[item.status]} | ${(item.detail||item.path||'').replace(/\|/g,'/')} |`);
 lines.push('');
 if(weapon.prompts.length){
  await mkdir(`${output}/prompts/${weapon.id}`,{recursive:true});
  for(const prompt of weapon.prompts)await writeFile(`${output}/prompts/${weapon.id}/${String(prompt.order).padStart(2,'0')}-${prompt.file}`,prompt.text+'\n');
 }
}
const prompts=['# Prompts das peças que faltam','','Gere **na ordem dos números**: cada peça usa as anteriores, já aprovadas, como imagem de referência (anexe no ChatGPT os arquivos listados em "Reference images"). Assim as quatro fases saem com o mesmo traço, luz e ângulo. Salve cada imagem no caminho indicado no fim do prompt e rode `npm run verify:weapons` de novo.','','Sons: `npm run sounds:weapons -- --weapon=<id>` usa a chave do ElevenLabs do `.env`, ou cole o texto no site do ElevenLabs (Sound Effects).',''];
for(const weapon of report)for(const prompt of weapon.prompts)prompts.push(`## ${prompt.order}. ${weapon.name} · ${prompt.title} (${prompt.kind})`,'',...(prompt.path?[`Salvar em \`public${prompt.path}\`, ${prompt.seconds}s.`,'']:[]),'```text',prompt.text,'```','');
await writeFile(`${output}/report.md`,lines.join('\n'));
await writeFile(`${output}/prompts.md`,prompts.join('\n'));
await writeFile(`${output}/report.json`,JSON.stringify(report,null,1));
console.log(lines.filter(line=>line.startsWith('## ')).map(line=>line.slice(3)).join('\n'));
console.log(`\n${missing} peças faltando, ${pending} provisórias. Relatório: ${output}/report.md, prancha: ${output}/sheet.png, prompts: ${output}/prompts.md`);
if(strict&&missing)process.exit(1);
