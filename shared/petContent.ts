// The game's pets (docs/pets.md "Como registrar a primeira espécie"). Imported once by the server
// (server/index.ts) and the client (src/main.tsx); tests use their own fixtures instead.
import {registerPetFood,registerPetSpecies} from './pets';
import {registerPetSkill} from './petSkills';

const ART='/assets/pets/verdalia';
const TOOLS=['boost','ability','power','flight'] as const;

// ── Verdália, the plant: Broto → Botão → Flor. Every skill grows with the stage (stageScaling). ──
// Numbers are provisional (matheus will tune them).
registerPetSkill({id:'verdalia-roots',name:'Raízes da Terra',kind:'passive',stageScaling:true,
 description:'Quando você termina o seu tiro, a Verdália levanta um redemoinho de folhas onde ele caiu: dano em quem estiver na área, sem projétil.',
 triggers:['shot-end'],limits:{perTurn:1},
 levels:[
  {effects:[{kind:'area-damage',target:'enemies',radius:90,amount:60,attackPercent:20}]},
  {effects:[{kind:'area-damage',target:'enemies',radius:110,amount:110,attackPercent:25}]},
  {effects:[{kind:'area-damage',target:'enemies',radius:135,amount:170,attackPercent:30}]}],
 // A round whirlwind of leaves on the target, fuller at each stage (buds, then petals and sparks).
 visual:{icon:`${ART}/skill-roots.png`,style:'whirl',effect:`${ART}/whirl-{stage}.png`,particles:`${ART}/leaves-{stage}.png`,duration:900,size:180}});
registerPetSkill({id:'verdalia-orb',name:'Orbe da Natureza',kind:'active',stageScaling:true,
 description:'O próximo tiro vira uma bola verde da natureza: um projétil só, sem outros poderes no turno, e o dano é sempre crítico.',
 levels:[
  {cost:40,cooldown:2,delay:100,effects:[{kind:'special-shot',target:'self',projectile:'verdalia-orb',multiplier:1.2,critical:true},{kind:'block',target:'self',actions:[...TOOLS],turns:1}]},
  {cost:40,cooldown:2,delay:100,effects:[{kind:'special-shot',target:'self',projectile:'verdalia-orb',multiplier:1.35,critical:true},{kind:'block',target:'self',actions:[...TOOLS],turns:1}]},
  {cost:40,cooldown:2,delay:100,effects:[{kind:'special-shot',target:'self',projectile:'verdalia-orb',multiplier:1.5,critical:true},{kind:'block',target:'self',actions:[...TOOLS],turns:1}]}],
 visual:{icon:`${ART}/skill-orb.png`,projectile:`${ART}/orb.png`,impact:`${ART}/orb-impact.png`}});
registerPetSkill({id:'verdalia-dew',name:'Orvalho Curativo',kind:'active',stageScaling:true,
 description:'Cura você no começo de cada um dos seus próximos 3 turnos.',
 levels:[
  {cost:30,cooldown:4,delay:60,effects:[{kind:'hot',target:'self',maxHpPercent:5,at:'turn-start',turns:3}]},
  {cost:30,cooldown:4,delay:60,effects:[{kind:'hot',target:'self',maxHpPercent:7,at:'turn-start',turns:3}]},
  {cost:30,cooldown:4,delay:60,effects:[{kind:'hot',target:'self',maxHpPercent:9,at:'turn-start',turns:3}]}],
 visual:{icon:`${ART}/skill-dew.png`,effect:`${ART}/heal.png`,frames:4,duration:900,size:150}});

registerPetSpecies({id:'verdalia',name:'Verdália',enabled:true,
 description:'Uma plantinha corajosa que cresce com você: de broto a flor, a terra luta ao seu lado.',
 qualities:['common','uncommon','rare'],maxStars:5,starBonus:.05,
 base:{hp:300,attack:40,defense:30,agility:20,luck:20},
 growth:{hp:20,attack:6,defense:4,agility:2,luck:2},
 traitRange:{attack:10,defense:10},
 stages:[
  {name:'Broto',requires:{level:1},visual:{sprite:`${ART}/stage-0.png`,portrait:`${ART}/stage-0.png`,scale:.25}},
  {name:'Botão',multiplier:1.25,requires:{level:20},visual:{sprite:`${ART}/stage-1.png`,portrait:`${ART}/stage-1.png`,scale:.25}},
  {name:'Flor',multiplier:1.5,requires:{level:40},visual:{sprite:`${ART}/stage-2.png`,portrait:`${ART}/stage-2.png`,scale:.25}}],
 skills:[{skill:'verdalia-roots',innate:true},{skill:'verdalia-orb'},{skill:'verdalia-dew',level:10}],
 visual:{offset:{x:-78,y:-6}}});

registerPetFood({id:'pet-food-dew',name:'Adubo de Orvalho',vitality:25,xp:50,maxPerUse:10,dailyLimit:40,icon:'/assets/pets/food-dew.png'});

/** One-time gifts: every player receives the first pet once, with some food, ready to fight. */
export const PET_GIFTS=[{key:'starter-verdalia',species:'verdalia',food:{'pet-food-dew':10},equip:true}] as const;
