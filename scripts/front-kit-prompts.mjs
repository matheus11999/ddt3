#!/usr/bin/env node
// Front view (pedido do matheus, 21/10): outside battle (bag, rooms, shop, lobby, fishing) the character faces the
// viewer like in DDTank; battle keeps the side view. This writes and runs (--run) the Codex prompts of the front
// starter kit, one piece at a time, each one attaching the pieces already painted so the kit stays coherent.
// Usage: node scripts/front-kit-prompts.mjs --only=head-male[,face-female,...] [--run]
// Output: test-results/codex-front/<piece>/{prompt.txt,<piece>.png,log.txt}. CODEX_BIN overrides the binary.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';

const arg=(name,fallback)=>process.argv.find(item=>item.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const only=arg('only')?.split(','),run=process.argv.includes('--run');
const root=resolve('test-results/codex-front');
const out=key=>join(root,key,`${key}.png`);

const STYLE_LOCK=[
 'STYLE LOCK. Paint in EXACTLY the art style of the attached approved art of this game: production 2D painted chibi art like DDTank',
 '(Korean casual MMO), rich painted volume, saturated colors, warm dark-brown outlines, soft top-left lighting, glossy highlights.',
 'Never vector, flat, pixel art, photographic, 3D render, sketchy or childish. No text, logos, letters or numbers anywhere.'
].join(' ');
// matheus (21/10): not 100% straight; 3/4 front like the DDTank bag portrait (test-results/references/ddtank-bag-angle-*.png).
const FRONT=[
 'VIEW: THREE-QUARTER FRONT VIEW exactly like the character in the DDTank bag window references: the character faces the viewer',
 'but is turned about 30 degrees toward the RIGHT side of the image: the near (left) ear is fully visible, the far (right) ear is',
 'mostly hidden behind the cheek, the far eye is a little narrower than the near eye, nose and mouth slightly right of centre.'
].join(' ');
const ANGLE_REFS=['test-results/references/ddtank-bag-angle-1.png','test-results/references/ddtank-bag-angle-2.png'];
const ANGLE_NOTE='The DDTank screenshots attached last are references for the VIEWING ANGLE and the pose only: never copy their characters, clothes, hair or UI.';
const alpha='Fully transparent background (real PNG alpha; if your tool returns an opaque background remove it cleanly). No shadow, no frame, no guides. Square 1254x1254 image.';
const save=file=>`Use your image generation tool to create exactly ONE image, then copy the resulting PNG to this exact path: ${file} . Do not edit any other files. When done, print the final file path.`;
const HEAD_RULE='The head is the SAME universal head in every piece of the kit: same canvas position, size and shape as the front head attached, the top of the skull at y=182 and the chin near y=600 of the 1254 canvas, skull about 417 px wide centred on x=634.';

const PIECES={
 'head-male':{refs:['public/assets/faces/face-brave.png','public/assets/character-base.png','public/assets/faces/face-basic-male.png',...ANGLE_REFS],text:[
  `IMAGE 1 and IMAGE 3 are the game's universal chibi head in its SIDE 3/4 view (bald, with the face painted). IMAGE 2 is the old full body for style.`,
  `Paint the SAME universal bald chibi head (same skin tones, same big round skull, same painting finish, same eye style) in FRONT VIEW. ${FRONT}`,
  'Face: the plainest default face, simple big round dark-brown eyes with one white highlight each, small calm eyebrows, a small relaxed closed-mouth smile, tiny nose, no blush. Bald (no hair at all), smooth round skull, both ears at the sides, a short neck stub at the bottom centre.',
  HEAD_RULE.replace('as the front head attached','described here'),ANGLE_NOTE,STYLE_LOCK,alpha]},
 // matheus (21/10): the face must look like DDTank's (test-results/references/ddtank-face-*.png), not big round anime eyes.
 'face-ddtank-male':{refs:['test-results/codex-front/head-male/v1.png','test-results/references/ddtank-face-1.png','test-results/references/ddtank-face-2.png'],text:[
  'IMAGE 1 is the game universal bald chibi head in the 3/4 front view, the edit target. Use case: precise-object-edit.',
  'Repaint ONLY the facial features so the face looks like a DDTank character (IMAGES 2-3 are DDTank characters, references for the FACE STYLE only): smaller eyes instead of big round anime eyes, gently almond-shaped but NOT stretched or elongated (each eye about two thirds as tall as it is wide, the far eye narrower only because of the turn), a thick dark upper eyelid line, a coloured iris (dark brown) with one small white highlight, eyes set a little LOWER on the face and a bit wider apart, short thick eyebrows, a tiny nose, a small calm closed mouth with a slight smile, full rounded cheeks; a confident, friendly boy.',
  'Keep the identical outer head silhouette, skull, ears, neck, skin tones, canvas size and position of IMAGE 1. Bald. Never copy the hair, ears, armour or anything else of IMAGES 2-3.',STYLE_LOCK,alpha]},
 'face-ddtank-female':{refs:[()=>out('face-ddtank-male'),'test-results/references/ddtank-face-2.png','public/assets/faces/face-smile.png'],text:[
  'IMAGE 1 is the game universal bald chibi head in the 3/4 front view with the approved DDTank-style male face, the edit target. Use case: precise-object-edit.',
  'Change ONLY the facial features into the FEMININE version of the same DDTank style: same almond eye shape and placement but with soft longer upper lashes, a slightly bigger brighter iris, thin soft eyebrows, a small cute smile, a faint pink blush.',
  'Keep the identical outer head silhouette, skull, ears, neck, skin tones, canvas size and position of IMAGE 1. Bald.',STYLE_LOCK,alpha]},
 'on-hair-male':{refs:['public/assets/front/face-basic-male.png','public/assets/hair-basic-male.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal chibi head in the 3/4 front view, the edit target. Use case: precise-object-edit.',
  "Paint ON this head a simple short neat boy haircut in natural chestnut brown (like IMAGE 2, the approved side-view basic hair): soft short fringe ending just above the eyebrows, the side over the near (left) ear coming down to touch the top of that ear with a short sideburn, the hair covering the far side of the skull down behind the far eye, few strands, tidy.",
  'Keep EVERYTHING else of IMAGE 1 pixel-identical: same canvas size and position, same head silhouette, face, ears, neck and skin. The new piece must cover the whole top and back of the skull (no bald skin showing anywhere above the ears or behind the piece), hug the head, and leave the eyes, eyebrows and mouth fully visible.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'on-hair-female':{refs:['public/assets/front/face-basic-female.png','public/assets/front/hair-basic-female.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal chibi head in the 3/4 front view, the edit target. Use case: precise-object-edit.',
  "Paint ON this head a simple feminine hairstyle: SMOOTH STRAIGHT chestnut-brown hair, sleek with little volume, a soft side-swept fringe just above the eyebrows, ending just below the jaw at shoulder height (a long bob); the near side comes down over the top of the near (left) ear and falls beside the jaw, the far side falls behind the far cheek.",
  'Keep EVERYTHING else of IMAGE 1 pixel-identical: same canvas size and position, same head silhouette, face, ears, neck and skin. The new piece must cover the whole top and back of the skull (no bald skin showing anywhere above the ears or behind the piece), hug the head, and leave the eyes, eyebrows and mouth fully visible.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'on-cap-male':{refs:['public/assets/front/face-basic-male.png','public/assets/front/hat-starter.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal chibi head in the 3/4 front view, the edit target. Use case: precise-object-edit.',
  "Paint ON this bald head the starter cap of the game WORN on it (IMAGE 2 shows the cap): a soft baseball cap in muted denim blue with a short curved light-tan brim and a small button on top, no logo. The cap crown wraps the WHOLE top and back of the skull (it is as wide as the skull, no skin visible behind or above it), its band sits on the forehead just above the eyebrows and above the near ear, the brim turned with the head toward the face direction, short so the eyes stay fully visible.",
  'Keep EVERYTHING else of IMAGE 1 pixel-identical: same canvas size and position, same head silhouette, face, ears, neck and skin. The new piece must cover the whole top and back of the skull (no bald skin showing anywhere above the ears or behind the piece), hug the head, and leave the eyes, eyebrows and mouth fully visible.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'face-female':{refs:['public/assets/front/face-basic-male.png','public/assets/faces/face-basic-female.png','public/assets/faces/face-smile.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal bald chibi head in FRONT VIEW, the edit target. Use case: precise-object-edit.',
  'Change ONLY its internal facial expression into the plainest default FEMININE face: simple big round dark-brown eyes with one white highlight each and short soft upper lashes, thin soft eyebrows, a small relaxed closed-mouth smile, a faint pink blush. IMAGE 2 and IMAGE 3 are the same feminine faces in the side view: copy their feminine eyes.',
  'Keep the identical outer head silhouette, skull, ears, neck, skin tones, canvas size and position of IMAGE 1. Bald.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'hair-male':{refs:['docs/templates/front-head.png','public/assets/hair-basic-male.png','public/assets/front/hair-basic-female.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal bald chibi head in FRONT VIEW with guides: RED areas (eyes and mouth) must stay completely uncovered, the BLUE dashed line is the top of the eyebrows (the fringe ends ABOVE it, the eyebrows stay visible), the BLUE dots are the tops of the ears (the hair at each side comes down to touch them). IMAGE 2 is the approved basic male hair in the side view. IMAGE 3 is the approved front female hair (match its painting and its size on the head).',
  `Paint the SAME hairstyle as IMAGE 2 (simple short neat boy haircut, natural chestnut brown, soft short fringe above the eyebrows, few strands) seen in the 3/4 FRONT VIEW of IMAGE 1, as a separate layer that fits IMAGE 1's skull exactly: same canvas position and size as the head in IMAGE 1, hugging the skull, fringe ending ABOVE the eyebrows, never covering the eyes, eyebrows or mouth (no lock hanging over the forehead below the blue line), the side over the near (left) ear comes down to touch the top of that ear with a short sideburn in front of it; the far side follows the skull behind the far eye. Total width at most 1.3x the skull.`,
  'Paint ONLY the hair: no face, skin, ears or head. The face area is a big transparent opening.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'hair-female':{refs:['docs/templates/front-head.png','public/assets/hair-basic-female.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal bald chibi head in the 3/4 FRONT VIEW with guides: RED areas (eyes and mouth) must stay completely uncovered (no lock of hair over any part of the far eye either), the BLUE dashed line is the top of the near eyebrow, the BLUE dots are the tops of the ears. IMAGE 2 is the approved basic female hair in the side view.',
  `Paint a simple feminine hairstyle in the colors of IMAGE 2: SMOOTH STRAIGHT chestnut-brown hair, flat and sleek with little volume, a soft side-swept fringe above the eyebrows, ending just below the jaw at shoulder height (a long bob) seen in the 3/4 FRONT VIEW of IMAGE 1, as a separate layer that fits IMAGE 1's skull exactly: same canvas position and size as the head in IMAGE 1, hugging the skull, fringe ending ABOVE the eyebrows, never covering the eyes, cheeks or mouth; the near side comes down over the top of the near (left) ear and falls beside the jaw to the shoulder line, the far side falls behind the far cheek, slim: the hair hugs the head, total width at most 1.35x the skull, nothing puffing out sideways.`,
  'Paint ONLY the hair: no face, skin, ears or head. The face area is a big transparent opening.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'hat-starter':{refs:['docs/templates/front-head.png','public/assets/hat-hiphop.png','public/assets/headwear-worn-atlas.png',...ANGLE_REFS],text:[
  'IMAGE 1 is the game universal bald chibi head in FRONT VIEW. IMAGES 2-3 are approved hats of the game (style only).',
  `Paint the starter hat of the game, simple and plain: a soft baseball cap in muted denim blue with a short curved light-tan brim and a small button on top, no logo, seen in the 3/4 FRONT VIEW of IMAGE 1 and WORN on its head: same canvas position and size as the head in IMAGE 1, the band sitting on the forehead just above the eyebrows, wrapping the skull, seen slightly from above, turned with the head (about 30 degrees to the right), the brim pointing toward the face direction and short so the eyes stay fully visible.`,
  'Paint ONLY the hat: no head, face or hair.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'walk-male':{refs:['docs/templates/front-walk.png','public/assets/front/outfit-basic-male.png','public/assets/outfits/walk/outfit-basic-male.png',...ANGLE_REFS],text:[
  'Production 2D painted game sprite sheet for a DDTank-style browser game: the lobby WALK cycle of one outfit in the FRONT view.',
  'IMAGE 1 is the template: 1536x1024, 3 columns x 2 rows of 512x512 cells, flat magenta (#FF00FF) background, a flat lime-green (#00FF00) head placeholder in every cell. Return the same 1536x1024 canvas: keep the magenta flat and pure and keep every green head EXACTLY where it is, same shape and size, flat and untouched.',
  'IMAGE 2 is this outfit in the front view (source of truth for every detail and color). IMAGE 3 is the same outfit walking in the side view (timing of the 6 frames only).',
  'In every cell paint the headless body of IMAGE 2 under the green head, the collar touching the bottom of the green neck, the soles near y=490 of the cell: the body in the 3/4 FRONT VIEW turned about 30 degrees toward the RIGHT, the direction it walks, like the references, and walks: 6 frames of a walk cycle (contact, down, passing, then the same with the other leg), arms swinging opposite to the legs. Same body size in every frame, chibi proportions (the body as tall as the green head).',
  'HANDS: realistic chibi hands with FINGERS (thumb and fingers drawn, relaxed), in the light skin tone #FCD0AC with soft shading and a thin dark outline, NOT round fists or mittens (round fists are only for the battle sheets).',
  'SAME OUTFIT IN EVERY FRAME, exactly as IMAGE 2: plain white short-sleeve t-shirt with a soft round collar, khaki-brown knee-length shorts with a thin dark-brown belt, white ankle socks, plain brown sneakers. No floor, no shadow, no text, nothing crossing a cell border or touching the image edge.',ANGLE_NOTE,STYLE_LOCK]},
 'walk-female':{refs:['docs/templates/front-walk.png','public/assets/front/outfit-basic-female.png','public/assets/outfits/walk/outfit-basic-female.png',...ANGLE_REFS],text:[
  'Production 2D painted game sprite sheet for a DDTank-style browser game: the lobby WALK cycle of one outfit in the FRONT view.',
  'IMAGE 1 is the template: 1536x1024, 3 columns x 2 rows of 512x512 cells, flat magenta (#FF00FF) background, a flat lime-green (#00FF00) head placeholder in every cell. Return the same 1536x1024 canvas: keep the magenta flat and pure and keep every green head EXACTLY where it is, same shape and size, flat and untouched.',
  'IMAGE 2 is this outfit in the front view (source of truth for every detail and color). IMAGE 3 is the same outfit walking in the side view (timing of the 6 frames only).',
  'In every cell paint the headless body of IMAGE 2 under the green head, the collar touching the bottom of the green neck, the soles near y=490 of the cell: the body in the 3/4 FRONT VIEW turned about 30 degrees toward the RIGHT, the direction it walks, like the references, and walks: 6 frames of a walk cycle (contact, down, passing, then the same with the other leg), arms swinging opposite to the legs. Same body size in every frame, chibi proportions (the body as tall as the green head).',
  'HANDS: realistic chibi hands with FINGERS (thumb and fingers drawn, relaxed), in the light skin tone #FCD0AC with soft shading and a thin dark outline, NOT round fists or mittens (round fists are only for the battle sheets).',
  'SAME OUTFIT IN EVERY FRAME, exactly as IMAGE 2: plain white short-sleeve blouse with a small flat rounded collar, pastel-pink A-line skirt above the knee that sways with the step, white ankle socks, plain pink-brown flat shoes, feminine silhouette. No floor, no shadow, no text, nothing crossing a cell border or touching the image edge.',ANGLE_NOTE,STYLE_LOCK]},
 'idle-male':{refs:[()=>out('walk-male'),'public/assets/front/outfit-basic-male.png',...ANGLE_REFS],text:[
  'Production 2D painted game sprite sheet for a DDTank-style browser game: the lobby IDLE (standing still) pose of one outfit in the FRONT view.',
  'IMAGE 1 is this outfit approved WALK sheet in the front view: 1536x1024, 3 columns x 2 rows of 512x512 cells, flat magenta background, a flat lime-green head placeholder in every cell. IMAGE 2 is the same outfit standing (reference for the relaxed pose).',
  'Return the same 1536x1024 canvas. Keep the magenta flat and pure. Keep every green head EXACTLY where it is in IMAGE 1, same shape and size, flat and untouched.',
  'In EVERY cell paint the SAME character of IMAGE 1 STANDING STILL in the same 3/4 front view as IMAGE 1, in a relaxed idle pose with personality copied from IMAGE 2 (the standing painting: same hand positions, e.g. hand in the pocket or on the waist), feet on the ground, collar touching the green neck. All six cells may be the same painting with a very slight breathing difference. Same scale, body size and ground line as IMAGE 1.',
  'HANDS: realistic chibi hands with FINGERS (thumb and fingers drawn, relaxed), in the light skin tone #FCD0AC with soft shading and a thin dark outline, NOT round fists.',
  'The outfit must be IDENTICAL to IMAGE 1: same colors, details and painting. No floor, no shadow, no text, nothing crossing a cell border.',ANGLE_NOTE,STYLE_LOCK]},
 'idle-female':{refs:[()=>out('walk-female'),'public/assets/front/outfit-basic-female.png',...ANGLE_REFS],text:[
  'Production 2D painted game sprite sheet for a DDTank-style browser game: the lobby IDLE (standing still) pose of one outfit in the FRONT view.',
  'IMAGE 1 is this outfit approved WALK sheet in the front view: 1536x1024, 3 columns x 2 rows of 512x512 cells, flat magenta background, a flat lime-green head placeholder in every cell. IMAGE 2 is the same outfit standing (reference for the relaxed pose).',
  'Return the same 1536x1024 canvas. Keep the magenta flat and pure. Keep every green head EXACTLY where it is in IMAGE 1, same shape and size, flat and untouched.',
  'In EVERY cell paint the SAME character of IMAGE 1 STANDING STILL in the same 3/4 front view as IMAGE 1, in a relaxed idle pose with personality copied from IMAGE 2 (the standing painting: same hand positions, e.g. hand in the pocket or on the waist), feet on the ground, collar touching the green neck. All six cells may be the same painting with a very slight breathing difference. Same scale, body size and ground line as IMAGE 1.',
  'HANDS: realistic chibi hands with FINGERS (thumb and fingers drawn, relaxed), in the light skin tone #FCD0AC with soft shading and a thin dark outline, NOT round fists.',
  'The outfit must be IDENTICAL to IMAGE 1: same colors, details and painting. No floor, no shadow, no text, nothing crossing a cell border.',ANGLE_NOTE,STYLE_LOCK]},
 'stand-male':{refs:['public/assets/front/face-basic-male.png','public/assets/outfits/basic-male-atlas.png','public/assets/outfits/basic-female-atlas.png',...ANGLE_REFS],text:[
  'IMAGE 2 is the approved basic male outfit of the game in the side 3/4 view (headless). IMAGE 1 is the game universal chibi head in FRONT VIEW.',
  `Paint the SAME outfit as IMAGE 2 (plain white short-sleeve t-shirt with a soft round collar, khaki-brown knee-length shorts with a thin dark-brown belt, white ankle socks, plain brown sneakers) on a headless chibi body in the 3/4 FRONT VIEW (body turned about 30 degrees to the right like the references), in a casual confident pose with personality: one hand in the shorts pocket and the other hand giving a relaxed thumbs-up or wave, weight on one leg, realistic chibi hands with FINGERS in the light skin tone #FCD0AC with soft shading and a thin dark outline (never round fists). ${'The collar opening is at the top (around x=600, y=430) where the game puts the head; the soles touch y=1200. Chibi proportions like IMAGE 2: the body is short, its height (collar to soles) about 1.3x the height of the head of IMAGE 1.'}`,
  'No head, no neck skin above the collar, no weapon, no props.',ANGLE_NOTE,STYLE_LOCK,alpha]},
 'stand-female':{refs:['public/assets/front/face-basic-male.png','public/assets/outfits/basic-female-atlas.png','public/assets/outfits/explorer-atlas.png',...ANGLE_REFS],text:[
  'IMAGE 2 is the approved basic female outfit of the game in the side 3/4 view (headless). IMAGE 1 is the game universal chibi head in FRONT VIEW.',
  `Paint the SAME outfit as IMAGE 2 (plain white short-sleeve blouse with a small FLAT rounded collar, pastel-pink A-line skirt above the knee, white ankle socks, plain pink-brown flat shoes) on a headless FEMININE chibi body in the 3/4 FRONT VIEW (body turned about 30 degrees to the right like the references): narrow shoulders, small waist, SLIM delicate feminine legs (thin thighs and calves, never chunky or muscular), short chibi legs, in a cute pose with personality: one hand on the waist and the other making a peace sign near the shoulder, one foot slightly crossed, realistic chibi hands with FINGERS in the light skin tone #FCD0AC with soft shading and a thin dark outline (never round fists). The collar opening is at the top (around x=600, y=430) where the game puts the head; the soles touch y=1200. Chibi proportions like IMAGE 2: body height (collar to soles) about 1.3x the height of the head of IMAGE 1.`,
  'No head, no neck skin above the collar, no weapon, no props.',ANGLE_NOTE,STYLE_LOCK,alpha]},
};

function codexBin(){
 if(process.env.CODEX_BIN)return process.env.CODEX_BIN;
 const base=join(process.env.LOCALAPPDATA??'','OpenAI','Codex','bin');
 const found=existsSync(base)?readdirSync(base).map(dir=>join(base,dir,'codex.exe')).filter(existsSync).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs):[];
 return found[0]??'codex';
}
function generate(key){
 const dir=join(root,key),piece=PIECES[key],log=join(dir,'log.txt');
 const args=['exec','--skip-git-repo-check','-s','workspace-write','-C',dir,'--add-dir',join(homedir(),'.codex','generated_images'),'-c','model_reasoning_effort="low"'];
 for(const ref of piece.refs.map(r=>typeof r==='function'?r():r))if(existsSync(ref))args.push('-i',resolve(ref));
 args.push('-');
 return new Promise(done=>{const child=spawn(codexBin(),args,{stdio:['pipe','pipe','pipe']});let text='';
  child.stdout.on('data',d=>text+=d);child.stderr.on('data',d=>text+=d);child.stdin.end(readFileSync(join(dir,'prompt.txt')));
  child.on('close',code=>{writeFileSync(log,text);console.log(`${key}: ${existsSync(out(key))?out(key):`falhou (${code}), veja ${log}`}`);done();});});
}

const keys=Object.keys(PIECES).filter(key=>!only||only.includes(key));
for(const key of keys){
 const dir=join(root,key);mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'prompt.txt'),[save(out(key)),'','ART BRIEF',...PIECES[key].text].join('\n\n'));
}
console.log(`Prompts em ${root}: ${keys.join(', ')}`);
if(run)await Promise.all(keys.map(generate));
