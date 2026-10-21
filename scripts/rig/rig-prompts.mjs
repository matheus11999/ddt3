#!/usr/bin/env node
// Rig v2 (docs/rig-v2.md): Codex prompts that paint one piece of one context on the plates of scripts/rig/plates.py.
// Each run attaches IMAGE 1 = the plate to paint on (the mold, or the mold with the lower pieces already painted),
// IMAGE 2 = the same plate from the DDTank default character (POSE and placement reference only), then the
// approved pieces of the kit as style references. Output: test-results/rig/codex/<step>/<step>.png.
// Usage: node scripts/rig/rig-prompts.mjs --only=<step>[,<step>] [--run] [--plate=<n>]   CODEX_BIN overrides the binary.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';

const arg=(name,fallback)=>process.argv.find(item=>item.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const only=arg('only')?.split(','),run=process.argv.includes('--run');
const root=resolve('test-results/rig/codex'),plates='test-results/rig/plates';

const STYLE_LOCK=['STYLE LOCK: production 2D painted chibi art like DDTank (Korean casual MMO): rich painted volume, saturated colors, warm',
 'dark-brown outlines, soft top-left light, glossy highlights. Never vector, flat, pixel art, photo, 3D render, sketchy or childish.',
 'No text, logos or numbers anywhere.'].join(' ');
const KEEP=['Return the SAME canvas size. Keep the flat magenta (#FF00FF) background flat and pure. Paint only inside the shapes',
 'described below and keep every figure EXACTLY where it is in IMAGE 1 (same position, size and pose in every cell): the game stacks',
 'the pieces cell on cell, so anything moved will not fit.'].join(' ');
const POSE='IMAGE 2 is the same plate with the DDTank default character: use it ONLY for the pose, the placement and the proportions in each cell; never copy its face, hair, clothes or colors.';
const HANDS='Hands: in SHOW (bag preview) and VIRTUAL (plaza) relaxed chibi hands with fingers; in GAME (combat) the small round fists of DDTank.';

// The kit (pedido do matheus, 21/10): basic male look and the starter cap. Briefs of the pieces, one per kit item.
const KIT={
 face:'the plainest default boy face in the DDTank style: bald chibi head, gently almond-shaped dark-brown eyes (not stretched) with a thick dark upper lid and one white highlight, short thick eyebrows, tiny nose, small calm closed smile, rounded cheeks, light skin #FCD0AC',
 outfit:'the basic starter clothes: plain white short-sleeve t-shirt with a soft round collar, khaki-brown knee-length shorts with a thin dark-brown belt, white ankle socks, plain brown sneakers; bare arms and legs in light skin #FCD0AC',
 hairA:'a simple short neat boy haircut in natural chestnut brown, soft short fringe above the eyebrows, sides down to the top of the ears with short sideburns, covering the whole top and back of the skull',
 hat:'the starter cap: a soft baseball cap in muted denim blue with a short curved light-tan brim and a small button on top, no logo, worn on the head (the crown wraps the whole top and back of the skull, the band just above the eyebrows)',
 hairB:'the SAME chestnut haircut as worn UNDER the cap: only the parts that show below the cap (short fringe tips on the forehead, sides over the ears, nape), nothing above the cap band'
};
const step=(plate,refs,text)=>({plate,refs,text});
const STEPS={
 'show-face':step('show-m-1',[`${plates}/ref-show-m-1.png`,'public/assets/front/face-basic-male.png'],[
  'IMAGE 1 is the bag-preview cell of the game: a gray mannequin body with a flat GREEN head shape on magenta.',
  `Paint ONLY the head over the GREEN shape and REPLACE ALL of the green: the painted head is exactly as big as the green shape, its outline runs along the edge of the green (the skull to the top edge, the ear in the ear bump, the chin at the bottom edge), no green left and nothing painted outside it: ${KIT.face}. IMAGE 3 is the approved face style of the game. Leave the gray body exactly as it is.`]),
 'show-hairA':step('show-m-base-1',[`${plates}/ref-show-m-1.png`,'public/assets/hair-basic-male.png'],[
  'IMAGE 1 is the bag-preview cell of the game with the bald boy already painted. Use case: precise-object-edit.',
  `Paint ON his head: ${KIT.hairA}. Keep everything else pixel-identical (face, ears, body, background). IMAGE 3 is the same haircut approved in another view.`]),
 'show-hat':step('show-m-base-1',[`${plates}/ref-show-m-1.png`,'public/assets/front/hat-starter.png','public/assets/hat-starter.png'],[
  'IMAGE 1 is the bag-preview cell of the game with the bald boy already painted. Use case: precise-object-edit.',
  `Paint ON his bald head ${KIT.hat}. Keep everything else pixel-identical (face, ears, body, background). IMAGES 3-4 are the same cap approved in other views.`]),
 'show-hairB':step('show-m-basehat-1',[`${plates}/ref-show-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is the bag-preview cell of the game with the boy wearing the starter cap. Use case: precise-object-edit.',
  `Paint ${KIT.hairB}: the hair of IMAGE 3 seen under this cap. Keep the cap, face, ears and body pixel-identical.`]),
 'game-face-1':step('game-m-1',[`${plates}/ref-game-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-1':step('game-m-1',[`${plates}/ref-game-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'game-face-2':step('game-m-2',[`${plates}/ref-game-m-2.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-2':step('game-m-2',[`${plates}/ref-game-m-2.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'game-face-3':step('game-m-3',[`${plates}/ref-game-m-3.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-3':step('game-m-3',[`${plates}/ref-game-m-3.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'game-face-4':step('game-m-4',[`${plates}/ref-game-m-4.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-4':step('game-m-4',[`${plates}/ref-game-m-4.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'game-face-5':step('game-m-5',[`${plates}/ref-game-m-5.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-5':step('game-m-5',[`${plates}/ref-game-m-5.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'game-face-6':step('game-m-6',[`${plates}/ref-game-m-6.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the face, skin and head).',
  `In EVERY cell paint ONLY the head over the GREEN shape and replace all of the green (same outline and size as the green, including any tear shapes as painted tears): the SAME bald head and face as IMAGE 3, with the expression of the same cell of IMAGE 2 (eyes closed, squinting, crying, hurt...). Leave the gray bodies exactly as they are.`]),
 'game-outfit-6':step('game-m-6',[`${plates}/ref-game-m-6.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head shape, on magenta. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and as the same cell of IMAGE 2: lying, crawling, kneeling, throwing): ${'the basic starter clothes'} of IMAGE 3 (${'plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers'}), bare arms and legs in light skin, small round fists like DDTank. Leave the green heads exactly as they are.`]),
 'show-face-closed':step('show-face-plate',['test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is the bald boy head of the game. Use case: precise-object-edit.',
  'Change ONLY the eyes to CLOSED (a calm blink: curved closed lids with the lashes), keep everything else pixel-identical.']),
 'show-face-half':step('show-face-plate',['test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is the bald boy head of the game. Use case: precise-object-edit.',
  'Change ONLY the eyes to HALF-CLOSED (the middle of a blink), keep everything else pixel-identical.']),
 'virtual-face':step('virtualhead-m-1',[`${plates}/ref-virtualhead-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is the plaza head sheet of the game: 3 flat GREEN head shapes on magenta: 1) facing the viewer, 2) the same with the eyes closed, 3) seen from the BACK.',
  `Paint each head over its GREEN shape and replace all of the green (same outline and size): the SAME bald boy head as IMAGE 3 (face, skin, eyes), 1) eyes open, 2) eyes closed, 3) the back of the bald head (no face). Bald: no hair.`]),
 'virtual-outfit-1':step('virtual-m-1',[`${plates}/ref-virtual-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a plaza sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head, on magenta. The top row of cells walks facing the viewer (front), the bottom row is seen from the BACK. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and the same cell of IMAGE 2): the basic starter clothes of IMAGE 3 (plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers), bare arms and legs in light skin, relaxed chibi hands; back cells show the back of the clothes. Ignore IMAGE 2's suit: only its pose. Leave the green heads exactly as they are.`]),
 'virtual-outfit-2':step('virtual-m-2',[`${plates}/ref-virtual-m-2.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a plaza sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head, on magenta. The top row of cells walks facing the viewer (front), the bottom row is seen from the BACK. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and the same cell of IMAGE 2): the basic starter clothes of IMAGE 3 (plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers), bare arms and legs in light skin, relaxed chibi hands; back cells show the back of the clothes. Ignore IMAGE 2's suit: only its pose. Leave the green heads exactly as they are.`]),
 'virtual-outfit-3':step('virtual-m-3',[`${plates}/ref-virtual-m-3.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a plaza sheet of the game: 6 cells, each a gray mannequin body with a flat GREEN head, on magenta. The top row of cells walks facing the viewer (front), the bottom row is seen from the BACK. IMAGE 3 is the approved boy of this kit (source of truth for the clothes).',
  `In EVERY cell paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette and pose as the gray shape and the same cell of IMAGE 2): the basic starter clothes of IMAGE 3 (plain white short-sleeve t-shirt, khaki-brown shorts with a thin dark belt, white socks, plain brown sneakers), bare arms and legs in light skin, relaxed chibi hands; back cells show the back of the clothes. Ignore IMAGE 2's suit: only its pose. Leave the green heads exactly as they are.`]),

 'game-hairA-1':step('game-m-base-1',[`${plates}/ref-game-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-1':step('game-m-base-1',[`${plates}/ref-game-m-1.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'game-hairA-2':step('game-m-base-2',[`${plates}/ref-game-m-2.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-2':step('game-m-base-2',[`${plates}/ref-game-m-2.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'game-hairA-3':step('game-m-base-3',[`${plates}/ref-game-m-3.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-3':step('game-m-base-3',[`${plates}/ref-game-m-3.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'game-hairA-4':step('game-m-base-4',[`${plates}/ref-game-m-4.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-4':step('game-m-base-4',[`${plates}/ref-game-m-4.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'game-hairA-5':step('game-m-base-5',[`${plates}/ref-game-m-5.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-5':step('game-m-base-5',[`${plates}/ref-game-m-5.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'game-hairA-6':step('game-m-base-6',[`${plates}/ref-game-m-6.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his head the SAME haircut as IMAGE 3 (${KIT.hairA}), following each head's angle and position. Keep everything else pixel-identical (faces, bodies, background).`]),
 'game-hat-6':step('game-m-base-6',[`${plates}/ref-game-m-6.png`,'test-results/rig/sheets/show-kit-m.png','test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the bald boy already painted in each pose. Use case: precise-object-edit.',
  `In EVERY cell paint ON his bald head the starter cap of IMAGE 4 (right figure): ${KIT.hat}, following each head's angle and position. Keep everything else pixel-identical.`]),
 'virtual-hairA':step('virtualhead-m-base-1',[`${plates}/ref-virtualhead-m-1.png`,'test-results/rig/sheets/show-kit-m.png'],[
  'IMAGE 1 is the plaza head sheet of the game: the bald boy head 1) facing the viewer, 2) with the eyes closed, 3) seen from the BACK. Use case: precise-object-edit.',
  `Paint ON each head the SAME haircut as IMAGE 3 (${KIT.hairA}); on head 3 the back of that haircut covering the whole back of the skull. Keep everything else pixel-identical.`]),
 'virtual-hat':step('virtualhead-m-base-1',[`${plates}/ref-virtualhead-m-1.png`,'test-results/rig/show-kit-m.png'],[
  'IMAGE 1 is the plaza head sheet of the game: the bald boy head 1) facing the viewer, 2) with the eyes closed, 3) seen from the BACK. Use case: precise-object-edit.',
  `Paint ON each bald head the starter cap of IMAGE 3 (right figure): ${KIT.hat}; on head 3 the back of the cap (brim pointing away). Keep everything else pixel-identical.`]),

 'game-hairB-1':step('game-m-basehat-1',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'game-hairB-2':step('game-m-basehat-2',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'game-hairB-3':step('game-m-basehat-3',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'game-hairB-4':step('game-m-basehat-4',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'game-hairB-5':step('game-m-basehat-5',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'game-hairB-6':step('game-m-basehat-6',['test-results/rig/game-kit-m.png'],[
  'IMAGE 1 is a combat sheet of the game: 6 cells with the boy wearing the starter cap in each pose. Use case: precise-object-edit. IMAGE 2 shows the approved haircut (top rows) and cap (bottom rows) of this kit.',
  `In EVERY cell paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap, following each head. Keep the cap, faces and bodies pixel-identical.`]),
 'virtual-hairB':step('virtualhead-m-basehat-1',['test-results/rig/sheets/virtualhead-hairA-m.png'],[
  'IMAGE 1 is the plaza head sheet: the boy with the starter cap 1) facing the viewer, 2) eyes closed, 3) from the back. Use case: precise-object-edit. IMAGE 2 is the approved haircut of these heads.',
  `Paint ${KIT.hairB} (the haircut of IMAGE 2) under the cap on each head (on head 3 the nape below the cap). Keep the cap and faces pixel-identical.`]),
 'show-outfit':step('show-m-1',[`${plates}/ref-show-m-1.png`,'public/assets/front/outfit-basic-male.png'],[
  'IMAGE 1 is the bag-preview cell of the game: a gray mannequin body with a flat GREEN head shape on magenta.',
  `Paint ONLY the body over the GRAY mannequin, filling it exactly (same silhouette, same arms and legs, same feet): ${KIT.outfit}. IMAGE 3 is the same outfit approved in another view (copy its clothes and colors). Leave the green head exactly as it is.`,HANDS]),
};

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
