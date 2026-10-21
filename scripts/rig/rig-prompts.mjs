#!/usr/bin/env node
// Rig v2 (docs/rig-v2.md): Codex prompts that paint one piece of one context on the plates of scripts/rig/plates.py.
// Each run attaches IMAGE 1 = the plate to paint on (the mold, or the mold with the lower pieces already painted),
// IMAGE 2 = the same plate from the DDTank default character (POSE and placement reference only), then the
// approved pieces of the kit as style references. Output: test-results/rig/codex/<step>/<step>.png.
// Steps of the male kit have plain names (show-face, game-outfit-3...); the female ones end in -f.
// Usage: node scripts/rig/rig-prompts.mjs --only=<step>[,<step>] [--run]   CODEX_BIN overrides the binary.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';

const arg=(name,fallback)=>process.argv.find(item=>item.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const only=arg('only')?.split(','),run=process.argv.includes('--run');
const root=resolve('test-results/rig/codex'),plates='test-results/rig/plates',sheets='test-results/rig/sheets';

const STYLE_LOCK=['STYLE LOCK: production 2D painted chibi art like DDTank (Korean casual MMO): rich painted volume, saturated colors, warm',
 'dark-brown outlines, soft top-left light, glossy highlights. Never vector, flat, pixel art, photo, 3D render, sketchy or childish.',
 'No text, logos or numbers anywhere.'].join(' ');
const KEEP=['Return the SAME canvas size. Keep the flat magenta (#FF00FF) background flat and pure. Paint only inside the shapes',
 'described below and keep every figure EXACTLY where it is in IMAGE 1 (same position, size and pose in every cell): the game stacks',
 'the pieces cell on cell, so anything moved will not fit.'].join(' ');
const POSE='IMAGE 2 is the same plate with the DDTank default character: use it ONLY for the pose, the placement and the proportions in each cell; never copy its face, hair, clothes or colors.';
const HANDS='Hands: relaxed chibi hands with fingers.';

// The starter kit of each sex (pedido do matheus, 21/10): basic look and the starter cap.
const CAP='the starter cap: a soft baseball cap in muted denim blue with a short curved light-tan brim and a small button on top, no logo, worn on the head (the crown wraps the whole top and back of the skull, the band just above the eyebrows)';
const KITS={
 m:{who:'boy',his:'his',
  face:'the plainest default boy face in the DDTank style: bald chibi head, gently almond-shaped dark-brown eyes (not stretched) with a thick dark upper lid and one white highlight, short thick eyebrows, tiny nose, small calm closed smile, rounded cheeks, light skin #FCD0AC',
  clothes:'plain white short-sleeve t-shirt with a soft round collar, khaki-brown knee-length shorts with a thin dark-brown belt, white ankle socks, plain brown sneakers',
  hairA:'a simple short neat boy haircut in natural chestnut brown, soft short fringe above the eyebrows, sides down to the top of the ears with short sideburns, covering the whole top and back of the skull',
  hairB:'the SAME chestnut haircut as worn UNDER the cap: only the parts that show below the cap (short fringe tips on the forehead, sides over the ears, nape), nothing above the cap band',
  faceRef:'public/assets/front/face-basic-male.png',hairRef:'public/assets/hair-basic-male.png',outfitRef:'public/assets/front/outfit-basic-male.png'},
 f:{who:'girl',his:'her',
  face:'the plainest default girl face in the DDTank style: bald chibi head, gently almond-shaped dark-brown eyes (not stretched) with a thick dark upper lid, soft upper lashes and one white highlight, thin soft eyebrows, tiny nose, small cute closed smile, a faint pink blush, rounded cheeks, light skin #FCD0AC',
  clothes:'plain white short-sleeve blouse with a small flat rounded collar, pastel-pink A-line skirt above the knee, white ankle socks, plain pink-brown flat shoes; slim feminine legs',
  hairA:'a simple feminine straight hairstyle in natural chestnut brown: sleek shoulder-length hair (a long bob) with a soft side-swept fringe above the eyebrows, covering the whole top and back of the skull, the sides falling beside the jaw',
  hairB:'the SAME chestnut long bob as worn UNDER the cap: only the parts that show below the cap (fringe tips on the forehead, the sides falling beside the jaw, the hair on the back below the cap), nothing above the cap band',
  faceRef:'public/assets/front/face-basic-female.png',hairRef:'public/assets/front/hair-basic-female.png',outfitRef:'public/assets/front/outfit-basic-female.png'}
};
const step=(plate,refs,text)=>({plate,refs,text});

function kitSteps(sex){
 const K=KITS[sex],x=sex==='m'?'':'-f',kit=`${sheets}/show-kit-${sex}.png`,gameKit=`test-results/rig/game-kit-${sex}.png`,showKit=`test-results/rig/show-kit-${sex}.png`;
 const out={};
 out[`show-face${x}`]=step(`show-${sex}-1`,[`${plates}/ref-show-${sex}-1.png`,K.faceRef],[
  'IMAGE 1 is the bag-preview cell of the game: a gray mannequin body with a flat GREEN head shape on magenta.',
  `Paint ONLY the head over the GREEN shape and REPLACE ALL of the green: the painted head is exactly as big as the green shape, its outline runs along the edge of the green (the skull to the top edge, the ear in the ear bump, the chin at the bottom edge), no green left and nothing painted outside it: ${K.face}. IMAGE 3 is the approved face style of the game. Leave the gray body exactly as it is.`]);
 out[`show-outfit${x}`]=step(`show-${sex}-1`,[`${plates}/ref-show-${sex}-1.png`,K.outfitRef],[
  'IMAGE 1 is the bag-preview cell of the game: a gray mannequin body with a flat GREEN head shape on magenta.',
  `Paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette, same arms and legs, same feet): the basic starter clothes: ${K.clothes}; bare arms and legs in light skin #FCD0AC. IMAGE 3 is the same outfit approved in another view (copy its clothes and colors). Leave the green head exactly as it is.`,HANDS]);
 out[`show-hairA${x}`]=step(`show-${sex}-base-1`,[`${plates}/ref-show-${sex}-1.png`,K.hairRef],[
  `IMAGE 1 is the bag-preview cell of the game with the bald ${K.who} already painted. Use case: precise-object-edit.`,
  `Paint ON ${K.his} head: ${K.hairA}. Keep everything else pixel-identical (face, ears, body, background). IMAGE 3 is the same hairstyle approved in another view.`]);
 out[`show-hat${x}`]=step(`show-${sex}-base-1`,[`${plates}/ref-show-${sex}-1.png`,'test-results/rig/show-kit-m.png'],[
  `IMAGE 1 is the bag-preview cell of the game with the bald ${K.who} already painted. Use case: precise-object-edit.`,
  `Paint ON ${K.his} bald head ${CAP}. Keep everything else pixel-identical (face, ears, body, background). IMAGE 3 (right figure) is the same cap approved on the boy.`]);
 out[`show-hairB${x}`]=step(`show-${sex}-basehat-1`,[`${plates}/ref-show-${sex}-1.png`,kit],[
  `IMAGE 1 is the bag-preview cell of the game with the ${K.who} wearing the starter cap. Use case: precise-object-edit.`,
  `Paint ${K.hairB}: the hair of IMAGE 3 seen under this cap. Keep the cap, face, ears and body pixel-identical.`]);
 out[`show-face-closed${x}`]=step(`show-face-plate-${sex}`,[kit],[
  `IMAGE 1 is the bald ${K.who} head of the game. Use case: precise-object-edit.`,
  'Change ONLY the eyes to CLOSED (a calm blink: curved closed lids with the lashes), keep everything else pixel-identical.']);
 out[`show-face-half${x}`]=step(`show-face-plate-${sex}`,[kit],[
  `IMAGE 1 is the bald ${K.who} head of the game. Use case: precise-object-edit.`,
  'Change ONLY the eyes to HALF-CLOSED (the middle of a blink), keep everything else pixel-identical.']);
 for(let n=1;n<=6;n++){
  out[`game-face-${n}${x}`]=step(`game-${sex}-${n}`,[`${plates}/ref-game-${sex}-${n}.png`,kit],[
   `IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved ${K.who} of this kit (source of truth for the face, skin and head).`,
   `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]);
  out[`game-outfit-${n}${x}`]=step(`game-${sex}-${n}`,[`${plates}/ref-game-${sex}-${n}.png`,kit],[
   `IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved ${K.who} of this kit (source of truth for the clothes).`,
   `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): the basic starter clothes of IMAGE 3 (${K.clothes}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]);
  out[`game-hairA-${n}${x}`]=step(`game-${sex}-base-${n}`,[`${plates}/ref-game-${sex}-${n}.png`,kit],[
   `IMAGE 1 is a combat sheet of the game: 6 cells with the bald ${K.who} already painted in each pose. Use case: precise-object-edit.`,
   `In EVERY cell paint ON ${K.his} head the SAME hairstyle as IMAGE 3 (${K.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]);
  out[`game-hat-${n}${x}`]=step(`game-${sex}-base-${n}`,[`${plates}/ref-game-${sex}-${n}.png`,'test-results/rig/game-kit-m.png'],[
   `IMAGE 1 is a combat sheet of the game: 6 cells with the bald ${K.who} already painted in each pose. Use case: precise-object-edit. IMAGE 3 (bottom rows) shows the same cap approved on the boy in the same poses.`,
   `In EVERY cell paint ON ${K.his} bald head ${CAP}, following each head's angle and position. Keep everything else pixel-identical.`]);
  out[`game-hairB-${n}${x}`]=step(`game-${sex}-basehat-${n}`,[gameKit],[
   `IMAGE 1 is a combat sheet of the game: 6 cells with the ${K.who} wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved hairstyle (top rows) and cap (bottom rows) of this kit.`,
   `In EVERY cell paint ${K.hairB} (the hairstyle of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]);
 }
 out[`virtual-face${x}`]=step(`virtualhead-${sex}-1`,[`${plates}/ref-virtualhead-${sex}-1.png`,kit],[
  'IMAGE 1 is the plaza head sheet of the game: 3 flat GREEN head shapes on magenta: 1) facing the viewer, 2) the same with the eyes closed, 3) seen from the BACK.',
  `Paint each head over its GREEN shape and replace all of the green (same outline and size): the SAME bald ${K.who} head as IMAGE 3 (face, skin, eyes), 1) eyes open, 2) eyes closed, 3) the back of the bald head (no face). Bald: no hair.`]);
 for(let n=1;n<=3;n++)out[`virtual-outfit-${n}${x}`]=step(`virtual-${sex}-${n}`,[`${plates}/ref-virtual-${sex}-${n}.png`,kit],[
  `IMAGE 1 is a plaza sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head, on magenta. The top row of cells walks facing the viewer (front), the bottom row is seen from the BACK. IMAGE 3 is the approved ${K.who} of this kit (source of truth for the clothes).`,
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and the same cell of IMAGE 2): the basic starter clothes of IMAGE 3 (${K.clothes}), bare arms and legs in light skin, relaxed chibi hands; back cells show the back of the clothes. Ignore IMAGE 2's clothes (coat tails, long skirts): only its pose; nothing outside the gray shape. Every cell is STANDING or WALKING upright (never sitting or kneeling). Leave the green heads exactly as they are.`]);
 out[`virtual-hairA${x}`]=step(`virtualhead-${sex}-base-1`,[`${plates}/ref-virtualhead-${sex}-1.png`,kit],[
  `IMAGE 1 is the plaza head sheet of the game: the bald ${K.who} head 1) facing the viewer, 2) with the eyes closed, 3) seen from the BACK. Use case: precise-object-edit.`,
  `Paint ON each head the SAME hairstyle as IMAGE 3 (${K.hairA}); on head 3 the back of that hairstyle covering the whole back of the skull. Keep everything else pixel-identical.`]);
 out[`virtual-hat${x}`]=step(`virtualhead-${sex}-base-1`,[`${plates}/ref-virtualhead-${sex}-1.png`,'test-results/rig/show-kit-m.png'],[
  `IMAGE 1 is the plaza head sheet of the game: the bald ${K.who} head 1) facing the viewer, 2) with the eyes closed, 3) seen from the BACK. Use case: precise-object-edit.`,
  `Paint ON each bald head ${CAP} (IMAGE 3, right figure, is the same cap on the boy); on head 3 the back of the cap (brim pointing away). Keep everything else pixel-identical.`]);
 out[`virtual-hairB${x}`]=step(`virtualhead-${sex}-basehat-1`,[`${sheets}/virtualhead-hairA-${sex}.png`],[
  `IMAGE 1 is the plaza head sheet: the ${K.who} with the starter cap 1) facing the viewer, 2) eyes closed, 3) from the back. Use case: precise-object-edit. IMAGE 2 is the approved hairstyle of these heads.`,
  `Paint ${K.hairB} (the hairstyle of IMAGE 2) under the cap on each head (on head 3 the hair below the cap). Keep the cap and faces pixel-identical.`]);
 void showKit;
 return out;
}
const STEPS={...kitSteps('m'),...kitSteps('f')};

function codexBin(){
 if(process.env.CODEX_BIN)return process.env.CODEX_BIN;
 const base=join(process.env.LOCALAPPDATA??'','OpenAI','Codex','bin');
 const found=existsSync(base)?readdirSync(base).map(dir=>join(base,dir,'codex.exe')).filter(existsSync).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs):[];
 return found[0]??'codex';
}
function generate(key){
 const dir=join(root,key),file=join(dir,`${key}.png`),s=STEPS[key];
 const args=['exec','--skip-git-repo-check','-s','workspace-write','-C',dir,'--add-dir',join(homedir(),'.codex','generated_images'),'-c','model_reasoning_effort="low"','-i',resolve(`${plates}/${s.plate}.png`)];
 for(const ref of s.refs)if(existsSync(ref))args.push('-i',resolve(ref));
 args.push('-');
 return new Promise(done=>{const child=spawn(codexBin(),args,{stdio:['pipe','pipe','pipe']});let out='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);child.stdin.end(readFileSync(join(dir,'prompt.txt')));
  child.on('close',code=>{writeFileSync(join(dir,'log.txt'),out);console.log(`${key}: ${existsSync(file)?file:`falhou (${code})`}`);done();});});
}
const keys=Object.keys(STEPS).filter(key=>!only||only.includes(key));
for(const key of keys){
 const dir=join(root,key),file=join(dir,`${key}.png`);mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'prompt.txt'),[`Use your image generation tool to create exactly ONE image (an edit of IMAGE 1), then copy the resulting PNG to this exact path: ${file} . Do not edit any other files. When done, print the final file path.`,'',KEEP,POSE,...STEPS[key].text,STYLE_LOCK].join('\n\n'));
}
console.log(`Prompts em ${root}: ${keys.join(', ')}`);
if(run)await Promise.all(keys.map(generate));
