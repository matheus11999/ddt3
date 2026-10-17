import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame,createArenaRoom} from './character-helpers.mjs';
const base=process.env.BASE_URL??'http://127.0.0.1:8097',out='test-results/room-invites';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),errors=[];
try{
 async function player(viewport,touch=false){
  const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));await enterGame(page,base);
  const {profile}=await (await page.request.get(`${base}/api/session`)).json();return {context,page,profile};
 }
 const h=await player({width:1536,height:864}),g=await player({width:1280,height:720}),m=await player({width:844,height:390},true),host=h.page,guest=g.page,mobile=m.page;
 await createArenaRoom(host);await host.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();await host.getByRole('button',{name:'Convidar',exact:true}).click();
 const dialog=host.getByRole('dialog',{name:'Convidar para a sala'});
 await expect(dialog.getByRole('textbox',{name:'Link da sala'})).toHaveCount(0);
 await expect(dialog.locator(`[data-invite-player="${g.profile.id}"]`)).toBeVisible();await dialog.locator(`[data-invite-player="${g.profile.id}"] button`).click();
 const incoming=guest.getByRole('dialog',{name:'Convite para jogar'});await expect(incoming).toContainText(h.profile.name);await expect(incoming).toContainText('Sala');
 await host.screenshot({path:`${out}/online-list.png`});await guest.screenshot({path:`${out}/incoming.png`});
 await incoming.getByRole('button',{name:'Recusar convite'}).click();await expect(incoming).toHaveCount(0);await expect(dialog.locator(`[data-invite-player="${g.profile.id}"]`)).toContainText('Recusado');
 const sendMobile=dialog.locator(`[data-invite-player="${m.profile.id}"] button`);await expect(sendMobile).toBeEnabled();await sendMobile.click();
 const mobileInvite=mobile.getByRole('dialog',{name:'Convite para jogar'});await expect(mobileInvite).toBeVisible();await mobile.screenshot({path:`${out}/incoming-mobile.png`});
 await mobileInvite.getByRole('button',{name:'Aceitar convite'}).click();await expect(mobile.locator('.party-room')).toBeVisible();await expect(mobileInvite).toHaveCount(0);
 await expect(host.locator('.party-player-card.occupied')).toHaveCount(2);await expect(mobile.getByRole('button',{name:/^Expulsar /})).toHaveCount(0);
 await mobile.getByRole('button',{name:'Estou pronto',exact:true}).click();await expect(host.locator('.party-player-state.ready')).toHaveCount(2);await host.screenshot({path:`${out}/joined.png`});
 await host.getByRole('button',{name:`Expulsar ${m.profile.name}`,exact:true}).click();await expect(mobile.locator('.bottom-dock')).toBeVisible();
 await host.getByRole('button',{name:'Fechar vaga 2',exact:true}).click();await expect(host.getByRole('button',{name:'Convidar',exact:true})).toBeDisabled();await host.getByRole('button',{name:'Sair da sala',exact:true}).click();
 assert.deepEqual(errors,[]);const report={checks:['online player list replaces link','private incoming invitation','decline informs sender','mobile acceptance enters original room','guest permissions','ready badge','kick','full room disables invitations'],errors};
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
