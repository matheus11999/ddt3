import {chromium,expect} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
// Lobby preview and smoke: screenshots Praça Celeste, walks right with the
// keyboard so the camera follows, opens the arena gate and walks to the smith.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await browser.newPage({viewport:{width:1536,height:864}});
await enterGame(page,base);await page.waitForTimeout(2500);
await page.screenshot({path:`${dir}/lobby.png`});
const canvas=page.locator('.world-canvas'),box=await canvas.boundingBox(),at=(x,y)=>({x:x*box.width/1536,y:y*box.height/864});
await page.locator('.lobby-event.quests').click({force:true});await expect(page.locator('.quest-panel')).toBeVisible();
await page.locator('.lobby-event.quests').click({force:true});
// Spawned at the podiums, the arena gate sits at the right edge of the view.
await canvas.click({position:at(1444,450)});await expect(page.locator('.party-arena')).toBeVisible();
await page.keyboard.press('Escape');await expect(page.locator('.party-arena')).toHaveCount(0);
await page.keyboard.down('ArrowLeft');await page.waitForTimeout(4000);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(1200);
await page.screenshot({path:`${dir}/lobby-left.png`});
await page.locator('.bottom-dock').getByRole('button',{name:/^Ferreiro/}).click();
await expect(page.locator('.forge-window')).toBeVisible({timeout:40000});
await page.keyboard.press('Escape');await page.waitForTimeout(1200);
await page.screenshot({path:`${dir}/lobby-forge.png`});
await browser.close();console.log('lobby smoke ok');
