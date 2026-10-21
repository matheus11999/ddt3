#!/usr/bin/env node
// Prompts (and, with --run, the art) for a cosmetic set of docs/cosmetic-sets.json, through the local Codex CLI.
// Every prompt carries the STYLE LOCK: the approved cosmetics of the game are attached and Codex must match their
// painting style; a theme changes clothes and accessories, never the art style (pedido do matheus, 19/10/2026).
// Usage: node scripts/cosmetic-prompts.mjs --set=hiphop [--run] [--only=stand,hair,hat,glasses,face,walk,ground,throw]
// Output: test-results/codex-cosmetics/<set>/<piece>/{prompt.txt,refs.txt,<piece>.png}. CODEX_BIN overrides the binary.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';

const arg=(name,fallback)=>process.argv.find(item=>item.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const config=JSON.parse(readFileSync('docs/cosmetic-sets.json','utf8'));
const set=config.sets.find(item=>item.id===arg('set'));
if(!set)throw new Error(`--set=<id> obrigatório: ${config.sets.map(item=>item.id).join(', ')}`);
const only=arg('only')?.split(','),run=process.argv.includes('--run');
const root=resolve('test-results/codex-cosmetics',set.id);

// Approved art of the game, attached to every prompt of its kind as the style reference.
const APPROVED={
 stand:['public/assets/outfits/cartographer-atlas.png','public/assets/outfits/captain-atlas.png','public/assets/outfits/hiphop-atlas.png','public/assets/outfits/swordsman-atlas.png'],
 hair:['public/assets/hair-horizon.png','public/assets/hair-surf.png','public/assets/hair-wavy.png'],
 hat:['public/assets/headwear-worn-atlas.png','public/assets/hat-captain.png','public/assets/hat-hiphop.png','public/assets/hat-swordsman.png'],
 glasses:['public/assets/glasses-navigator.png','public/assets/glasses-captain.png','public/assets/glasses-hiphop.png'],
 face:['public/assets/faces/face-captain.png'],
 walk:['public/assets/outfits/walk/outfit-captain.png'],
 combat:['public/assets/outfits/combat/outfit-captain.png']
};
const STYLE_LOCK=[
 'STYLE LOCK. The attached reference images are cosmetics ALREADY APPROVED in this game. Before painting, study all of them and',
 'paint in EXACTLY their art style: production 2D painted chibi art like DDTank (Korean casual MMO), rich painted volume, saturated',
 'colors, warm dark-brown outlines, soft top-left lighting, glossy highlights, the same detail level and finish. The THEME of the new',
 'piece is new; the ART STYLE is not: never vector, flat, pixel art, photographic, 3D render, sketchy or childish, and never another',
 'style unless the brief explicitly asks for it. No text, logos, letters or numbers anywhere in the image.'
].join(' ');
const save=file=>`Use your image generation tool to create exactly ONE image, then copy the resulting PNG to this exact path: ${file} . Do not edit any other files. When done, print the final file path.`;
const alpha='Fully transparent background (real PNG alpha; if your tool returns an opaque background remove it cleanly). No text, no guides, no shadow, no frame.';
const refsNote=(n,what)=>`IMAGES ${n} and after are approved ${what} of this game (style references only: do not copy their design).`;

function pieces(){
 const o=set.outfit,list=[];
 if(o)list.push({key:'stand',refs:['public/assets/outfits/cartographer-atlas.png',...APPROVED.stand.slice(1)],text:[
  'ART BRIEF',`IMAGE 1 is an approved outfit of the game (the TOP standing headless figure is the layout reference). Paint a NEW ${set.gender} outfit "${o.name}" at EXACTLY the same scale, proportions, camera (3/4 view facing right), canvas placement and painting quality as that top standing figure: a headless body from the collar down to the shoes, the collar opening at the top centre where the game puts the head, feet at the bottom. Only ONE figure: no lying figure, nothing else.`,
  refsNote(2,'outfits'),...(set.gender==='female'?['The body proportions follow IMAGE 1 (head size, height, where the collar and the feet are) but the silhouette is FEMININE: narrower shoulders, small waist, softer hips, slimmer limbs, feet closer together.']:[]),`The new outfit: ${o.brief}. No weapon, no props in the hands. No head, no neck skin above the collar.`,
  'POSE (previews: bag, PvP and expedition rooms, shop): a lively pose with personality that fits the theme (hand on the hip, peace sign, hand in a pocket, arms crossed, a confident or cute gesture); NEVER both arms hanging straight down. HANDS like the approved outfits: bare chibi hands in the light skin tone #FCD0AC with soft shading and a thin dark outline, painted with the sleeve cuff, so the game can recolor the skin.',STYLE_LOCK,alpha+' Square image.']});
 if(set.hair)list.push({key:'hair',refs:[`docs/templates/${set.hair.fit}.png`,'docs/templates/ref-hair-ear.png',...APPROVED.hair],text:[
  'ART BRIEF',`ONE ${set.gender} hairstyle "${set.hair.name}" as a separate wig-like layer, placed by the game over its universal bald chibi head.`,
  `IMAGE 1 is the game's universal bald head (3/4 view facing right) with guides: the hair must fit THAT skull exactly - same perspective, hugging the skull, fringe ending ABOVE the eyebrows (blue dashed line), never covering the eyes or mouth (red areas), SIDES AND NAPE COME DOWN TO THE EAR: like IMAGE 2 the hair at the temple and behind the ear reaches down to the middle of the ear (paint it right over the ear area: the game cuts the ear out of the hair and outlines it), so no bald skin shows between the hair and the ear, and a SIDEBURN comes down IN FRONT of the ear (between the ear and the eye) to the middle of the ear, exactly like IMAGE 2, and the back of the hair HUGS THE SKULL behind and below the ear (the nape ends on the head outline, never hanging out past the back of the head) (the game's validator measures all three: hair touching the top of the ear, the sideburn and nothing hanging past the skull behind the ear); total width at most 1.4x the head and rising at most 0.3x the head above the top of the skull (inside the green box).`,
  `IMAGE 2 is the approved Corte Tempestade: copy how its sides and nape meet the ear.`,refsNote(3,'hairstyles'),`The new hairstyle: ${set.hair.brief}. Big transparent opening where the face is.`,STYLE_LOCK,
  `Paint ONLY the hair, in the size and position it would have on IMAGE 1's head. ${alpha} Square image. No face, skin, ear, head or hat.`]});
 if(set.hat)list.push({key:'hat',refs:[`docs/templates/${set.hat.fit}.png`,...APPROVED.hat],text:[
  'ART BRIEF',`ONE ${set.gender} hat "${set.hat.name}" as a separate layer, placed by the game on its universal chibi head.`,
  `IMAGE 1 is the game's universal bald head (3/4 view facing right) with guides: the hat sits on that skull, its inner band resting on the orange seat line, inside the green box, never covering the eyes (red); any brim or visor stays short and high so glasses under it stay visible. The hat is WORN on the head and seen from slightly ABOVE, like the approved hats: its opening wraps around the skull at forehead height and the INSIDE of the hat is never visible; a wide brim is an ellipse around the head, tilted the same way as the head.`,
  refsNote(2,'hats'),`The new hat: ${set.hat.brief}. Seen in the same 3/4 view facing right, as WORN (the opening is shaped by the head).`,STYLE_LOCK,
  `Paint ONLY the hat, alone, centred, about half the image wide. ${alpha} Square image. No head, hair or face.`]});
 if(set.glasses)list.push({key:'glasses',refs:['docs/templates/glasses.png',...APPROVED.glasses],text:[
  'ART BRIEF',`ONE pair of ${set.gender} glasses "${set.glasses.name}" as a separate layer, placed by the game on its universal chibi head.`,
  `IMAGE 1 is the game's universal bald head (3/4 view facing right): each lens centre sits on an eye (red); the far lens (right) is smaller and its centre a little LOWER than the near lens centre; total width 0.8-0.95x the head. Show only the NEAR temple arm going back to the LEFT; the far arm is hidden behind the head (nothing above the far lens).`,
  refsNote(2,'glasses'),`The new glasses: ${set.glasses.brief}. Lenses evenly semi-transparent so the eyes stay visible, one soft gloss highlight each.`,STYLE_LOCK,
  `Paint ONLY the glasses, centred, filling most of the width. ${alpha} No face or head.`]});
 if(set.face)list.push({key:'face',refs:[`public/assets/faces/${set.gender==='female'?'face-smile':'face-brave'}.png`,...APPROVED.face],text:[
  'ART BRIEF',`Use case: precise-object-edit. IMAGE 1 is the universal bald chibi HEAD of the game and the edit target. Change ONLY its INTERNAL facial expression to: ${set.face.brief}. Keep the identical outer head silhouette and registration: same scalp, cheek, chin, ear, nose, skin tones, canvas size and position, head width and height and right-facing three-quarter perspective; keep eyes, eyebrows and mouth in the same places.`,
  refsNote(2,'faces'),STYLE_LOCK,'No hair, no hat, no glasses, no body. Real PNG alpha: fully transparent outside the head, exactly like IMAGE 1.']});
 if(o){
  const stand=join(root,'stand','stand.png');
  const sheet=(key,template,prompt,extra)=>({key,after:'stand',refs:[template,stand,...extra],text:['ART BRIEF',
   readFileSync(`docs/combat-art-prompts/${prompt}.txt`,'utf8').replace(/\r/g,'').replace(/^IMAGE 4.*\n/m,'')
    .replace('(coat with its tails, shirt, belt, map scroll, trousers, boots)',`(${o.walkParts})`).replace(/the coat tails swinging naturally with the step/g,'loose cloth swinging naturally with the step'),
   `SAME OUTFIT IN EVERY FRAME: IMAGE 2 is the source of truth. Copy every one of its details exactly, at the same place on the body, so nothing changes when the character starts walking: ${o.details??o.walkParts}. Do not add, drop, move or redesign any print, trim, pocket, strap or accessory; only the pose changes.`,
   // The Exploradora's lying frames came out wearing the Capitão's red coat copied from this reference (19/10).
   `The LAST attached image is the same kind of sheet already approved for ANOTHER outfit: match only its painting style and finish. NEVER copy its clothes, colors, coat, trousers or boots: every piece of clothing in every frame comes from IMAGE 2.`,STYLE_LOCK]});
  list.push(sheet('walk','docs/templates/walk.png','walk',APPROVED.walk));
  list.push(sheet('ground','docs/templates/combat-ground.png','ground',['output/pdf/ddtank-rig-imagens/04-caminhada.png',...APPROVED.combat]));
  list.push(sheet('throw','docs/templates/combat-throw.png','throw',['output/pdf/ddtank-rig-imagens/06-arremesso.png',...APPROVED.combat]));
 }
 return list.filter(item=>!only||only.includes(item.key));
}

function codexBin(){
 if(process.env.CODEX_BIN)return process.env.CODEX_BIN;
 const base=join(process.env.LOCALAPPDATA??'','OpenAI','Codex','bin');
 const found=existsSync(base)?readdirSync(base).map(dir=>join(base,dir,'codex.exe')).filter(existsSync).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs):[];
 return found[0]??'codex';
}
function generate(piece){
 const dir=join(root,piece.key),file=join(dir,`${piece.key}.png`),log=join(dir,'log.txt');
 const args=['exec','--skip-git-repo-check','-s','workspace-write','-C',dir,'--add-dir',join(homedir(),'.codex','generated_images'),'-c','model_reasoning_effort="low"'];
 for(const ref of piece.refs)if(existsSync(ref))args.push('-i',resolve(ref));
 args.push('-');
 return new Promise(done=>{const child=spawn(codexBin(),args,{stdio:['pipe','pipe','pipe']});let out='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);child.stdin.end(readFileSync(join(dir,'prompt.txt')));
  child.on('close',code=>{writeFileSync(log,out);console.log(`${piece.key}: ${existsSync(file)?file:`falhou (${code}), veja ${log}`}`);done();});});
}

const list=pieces();
for(const piece of list){
 const dir=join(root,piece.key);mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'prompt.txt'),[save(join(dir,`${piece.key}.png`)),'',...piece.text].join('\n\n'));
 writeFileSync(join(dir,'refs.txt'),piece.refs.join('\n')+'\n');
}
console.log(`Prompts em ${root}: ${list.map(piece=>piece.key).join(', ')}`);
if(run){
 // Pieces that do not need the standing painting go first, in parallel; the sheets then use the standing painting.
 await Promise.all(list.filter(piece=>!piece.after).map(generate));
 await Promise.all(list.filter(piece=>piece.after&&existsSync(join(root,'stand','stand.png'))).map(generate));
}
