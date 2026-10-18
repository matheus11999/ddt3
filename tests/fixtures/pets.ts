// TEST-ONLY pet content. Imported only by the pet tests (each test file runs in its own process), so the real
// registries stay empty in the game. Never import this from server/ or src/.
import {registerPetFood,registerPetSpecies} from '../../shared/pets';
import type {PlayerPet} from '../../shared/pets';
import {registerPetSkill} from '../../shared/petSkills';
import {PetService} from '../../server/pets';
import type {PetTx} from '../../server/pets';
import {petDay} from '../../server/pets';
import type {Profile} from '../../shared/protocol';

registerPetSkill({id:'test-strike',name:'Golpe de teste',description:'',kind:'active',levels:[{cost:20,cooldown:1,delay:50,effects:[{kind:'damage',target:'enemy',amount:100}]},{cost:15,cooldown:1,delay:50,effects:[{kind:'damage',target:'enemy',amount:150}]}]});
registerPetSkill({id:'test-focus',name:'Foco de teste',description:'',kind:'active',levels:[{cost:10,effects:[{kind:'next-shot',target:'self',multiplier:1.5,shots:1}]}]});
registerPetSkill({id:'test-guard',name:'Escudo de teste',description:'',kind:'active',levels:[{cost:10,effects:[{kind:'shield',target:'self',amount:200,turns:2}]}]});
registerPetSkill({id:'test-thorns',name:'Espinhos de teste',description:'',kind:'passive',triggers:['damaged'],levels:[{chance:.5,effects:[{kind:'damage',target:'event-source',amount:30}]}]});
registerPetSkill({id:'test-per-shot',name:'Uma vez por tiro',description:'',kind:'passive',triggers:['hit'],limits:{perShot:1},levels:[{effects:[{kind:'mana',target:'self',amount:5}]}]});
// Two skills that would answer each other forever without the chain limits.
registerPetSkill({id:'test-echo-a',name:'Eco A',description:'',kind:'passive',triggers:['damage-dealt'],allowFromSkills:true,levels:[{effects:[{kind:'damage',target:'enemy',amount:1}]}]});
registerPetSkill({id:'test-echo-b',name:'Eco B',description:'',kind:'passive',triggers:['damaged'],allowFromSkills:true,levels:[{effects:[{kind:'damage',target:'event-source',amount:1}]}]});
registerPetSkill({id:'test-sturdy',name:'Robustez de teste',description:'',kind:'permanent',levels:[{stats:{defense:50}}]});
registerPetSkill({id:'test-late',name:'Habilidade do nível 10',description:'',kind:'active',requirements:{petLevel:10,stage:0,stars:0},levels:[{cost:0,effects:[{kind:'heal',target:'self',amount:10}]}]});
registerPetSpecies({id:'test-pet',name:'Pet de teste',enabled:true,qualities:['common','rare'],maxStars:3,starBonus:.1,
 base:{attack:100,defense:40,hp:200},growth:{attack:10},
 skills:[{skill:'test-strike'},{skill:'test-focus'},{skill:'test-guard'},{skill:'test-thorns'},{skill:'test-per-shot'},{skill:'test-sturdy'},{skill:'test-echo-a'},{skill:'test-echo-b'},{skill:'test-late',level:10}]});
registerPetSpecies({id:'test-hidden',name:'Pet desligado',enabled:false});
registerPetFood({id:'pet-food-test',name:'Ração de teste',vitality:30,maxPerUse:5,dailyLimit:8});
registerPetFood({id:'pet-food-xp',name:'Petisco de EXP',vitality:0,xp:500,maxPerUse:5});

/** The pet service on plain maps, with the same per-owner serialization and all-or-nothing commits as PetStore. */
export class MemoryPetStore extends PetService {
 pets=new Map<string,PlayerPet>();feedings:{petId:string;food:string;quantity:number;day:string}[]=[];ledger=new Set<string>();events:unknown[]=[];
 private queues=new Map<string,Promise<unknown>>();
 constructor(public profiles:Map<string,Profile>,rng?:()=>number){super(undefined,rng);}
 protected transact<T>(ownerId:string,run:(tx:PetTx)=>Promise<T>|T){
  const previous=this.queues.get(ownerId)??Promise.resolve();
  const next=previous.catch(()=>undefined).then(async()=>{
   await new Promise(resolve=>setImmediate(resolve));
   const stored=this.profiles.get(ownerId);if(!stored)throw Error('Jogador não encontrado.');
   const profile=structuredClone(stored),pets=[...this.pets.values()].filter(p=>p.ownerId===ownerId).map(p=>structuredClone(p));
   const feedings=[...this.feedings],ledger=new Set(this.ledger);
   const tx:PetTx={profile,pets,events:[],
    fedToday:async(petId,food)=>feedings.filter(f=>f.petId===petId&&f.food===food&&f.day===petDay()).reduce((n,f)=>n+f.quantity,0),
    recordFeeding:async e=>{feedings.push({petId:e.petId,food:e.food,quantity:e.quantity,day:petDay()});},
    claimBattle:async(battleId,entry)=>{const key=`${battleId}:${entry.petId}`;if(ledger.has(key))return false;ledger.add(key);return true;}};
   const value=await run(tx);
   PetService.wear(profile,tx.pets);
   for(const [id,p] of this.pets)if(p.ownerId===ownerId)this.pets.delete(id);
   for(const p of tx.pets)this.pets.set(p.id,structuredClone(p));
   this.profiles.set(ownerId,structuredClone(profile));this.feedings=feedings;this.ledger=ledger;this.events.push(...tx.events);
   return {value,profile,pets:tx.pets};
  });
  this.queues.set(ownerId,next);return next;
 }
}
