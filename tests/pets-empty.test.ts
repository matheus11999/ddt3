// The released game has the pet system with no content: zero species, skills and foods (docs/pets.md).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PET_FOODS,PET_SPECIES,petContribution} from '../shared/pets';
import {PET_SKILLS} from '../shared/petSkills';
import {PET_CONFIG,validatePetConfig} from '../shared/petConfig';
import {attributes,DEFAULT_EQUIPMENT} from '../shared/catalog';

test('the game ships with zero pets, pet skills and pet foods',()=>{
 assert.equal(PET_SPECIES.size,0);assert.equal(PET_SKILLS.size,0);assert.equal(PET_FOODS.size,0);
});
test('an unknown pet in the equipment grants nothing, so attributes and FC stay as before',()=>{
 const pet={id:'00000000-0000-4000-8000-000000000000',species:'ghost',level:60,quality:'common',stars:5,stage:0,vitality:100,traits:{attack:999},skills:[]};
 assert.deepEqual(petContribution(pet),{});
 assert.deepEqual(attributes({...DEFAULT_EQUIPMENT,pet},10),attributes(DEFAULT_EQUIPMENT,10));
});
test('the pet configuration is validated and refuses unsafe values',()=>{
 assert.equal(PET_CONFIG.maxOwned,20);assert.equal(PET_CONFIG.skillSlots.length,4);assert.equal(PET_CONFIG.equipment.slots.length,3);assert.equal(PET_CONFIG.equipment.enabled,false);assert.equal(PET_CONFIG.progression.maxLevel,60);
 assert.throws(()=>validatePetConfig({...PET_CONFIG,vitality:{...PET_CONFIG.vitality,initial:500}}),/Vitalidade inicial/);
 assert.throws(()=>validatePetConfig({...PET_CONFIG,skillSlots:[{unlockLevel:20},{unlockLevel:5}]}),/crescentes/);
 assert.throws(()=>validatePetConfig({...PET_CONFIG,maxOwned:0}),/inválida/);
 // Raising the level cap needs no code change.
 assert.equal(validatePetConfig({...PET_CONFIG,progression:{...PET_CONFIG.progression,maxLevel:100}}).progression.maxLevel,100);
});
