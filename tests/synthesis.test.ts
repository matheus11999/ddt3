import test from 'node:test';
import assert from 'node:assert/strict';
import {commandSchema} from '../shared/protocol';
import {CATALOG} from '../shared/catalog';
import {canCompose} from '../shared/composition';
import {SYNTHESIS_SOURCES,synthesisTarget,synthesize} from '../shared/synthesis';

test('síntese junta 4 pedras de um nível em 1 do nível seguinte, para fortalecimento e composição', ()=>{
 const profile={stones:{'1':9,'2':0,'5':3},compositionStones:{'luck-2':8,'luck-3':1}};
 assert.deepEqual(synthesize(profile,'fortify-1',2),{stone:'fortify-1',target:'fortify-2',count:2,consumed:8});
 assert.deepEqual(profile.stones,{'1':1,'2':2,'5':3});
 synthesize(profile,'luck-2',2);
 assert.deepEqual(profile.compositionStones,{'luck-2':0,'luck-3':3});
 assert.throws(()=>synthesize(profile,'fortify-1',1),/4 pedras/);
 assert.throws(()=>synthesize(profile,'fortify-5',1),/não pode/);
 assert.throws(()=>synthesize(profile,'luck-3',1),/não pode/);
 assert.throws(()=>synthesize(profile,'fortify-1',0),/quantas/);
 assert.equal(synthesisTarget('attack-1')?.id,'attack-2');
 assert.equal(SYNTHESIS_SOURCES.length,4+5*2);
});

test('o comando de síntese só aceita pedras que sobem de nível', ()=>{
 assert.equal(commandSchema.safeParse({type:'synthesize',stone:'fortify-4',count:3}).success,true);
 assert.equal(commandSchema.safeParse({type:'synthesize',stone:'armor-2',count:1}).success,true);
 for(const command of [{type:'synthesize',stone:'fortify-5',count:1},{type:'synthesize',stone:'attack-3',count:1},{type:'synthesize',stone:'fortify-1',count:0},{type:'synthesize',stone:'fortify-1',count:1,target:'fortify-5'}])assert.equal(commandSchema.safeParse(command).success,false);
 assert.equal(commandSchema.safeParse({type:'compose',item:'ember',stone:'luck-1'}).success,true);
});

test('colar não tem aprimoramento no ferreiro', ()=>{
 for(const id of ['necklace-star','necklace-guild-1'])assert.equal(canCompose(CATALOG[id]),false);
});
