import {expect} from '@playwright/test';

/** Enter through the real creation UI when this browser has no saved character. */
export async function enterGame(page,base,gender='male'){
 if(!['male','female'].includes(gender))throw new Error('Choose male or female for the test character');
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.character-creation,.bottom-dock').first()).toBeVisible({timeout:15000});
 const creation=page.locator('.character-creation');
 if(await creation.isVisible()){
  await creation.getByRole('button',{name:gender==='female'?'Personagem feminino':'Personagem masculino',exact:true}).click();
  // Every new character needs a free name (docs/site.md); tests use a random one.
  await creation.getByLabel('Nome do personagem').fill(`Teste${Math.random().toString(36).slice(2,9)}`);
  await expect(creation.getByRole('button',{name:'Criar personagem',exact:true})).toBeEnabled({timeout:10000});
  await creation.getByRole('button',{name:'Criar personagem',exact:true}).click();
 }
 await expect(page.locator('.bottom-dock')).toBeVisible({timeout:15000});
}

/** Current arena flow: the server assigns the room name on the first click. */
export async function createArenaRoom(page){
 if(!await page.locator('.party-arena').isVisible())await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
 await expect(page.locator('.party-hall-banner,.party-create-form,.arena-map-choices,.arena-mode-choices')).toHaveCount(0);
 await page.getByRole('button',{name:'Criar sala',exact:true}).click();
 await expect(page.locator('.party-room')).toBeVisible();
 await expect(page.locator('.party-player-card[data-slot-state="closed"]')).toHaveCount(3);
 return page.locator('.party-room');
}

/** Practice always starts through the room's explicit confirmation dialog. */
export async function startPractice(page){
 if(!await page.locator('.party-room').isVisible())await createArenaRoom(page);
 await page.getByRole('button',{name:'Treinar com bots',exact:true}).click();
 const confirmation=page.getByRole('dialog',{name:'Treinar com bots?',exact:true});
 await expect(confirmation).toBeVisible();
 await confirmation.getByRole('button',{name:'Começar treino',exact:true}).click();
 await expect(page.locator('.battle-console')).toBeVisible({timeout:15000});
}
