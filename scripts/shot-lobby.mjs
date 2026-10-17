import {chromium} from '@playwright/test';
import {expect} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
// Lobby preview and hotspot smoke: screenshots the plaza, then checks that the
// arena portal opens the arena and that the smith walks the player to the forge.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await browser.newPage({viewport:{width:1536,height:864}});
await enterGame(page,base);await page.waitForTimeout(2500);
await page.screenshot({path:`${dir}/lobby.png`});
const canvas=page.locator('.world-canvas'),box=await canvas.boundingBox(),at=(x,y)=>({x:x*box.width/1536,y:y*box.height/864});
await page.locator('.lobby-event.quests').click({force:true});await expect(page.locator('.quest-panel')).toBeVisible();
await page.screenshot({path:`${dir}/lobby-quests.png`});await page.locator('.lobby-event.quests').click({force:true});
await canvas.click({position:at(690,420)});await expect(page.locator('.party-arena')).toBeVisible();
await page.keyboard.press('Escape');await expect(page.locator('.party-arena')).toHaveCount(0);
await canvas.click({position:at(1330,520)});await expect(page.locator('.forge-window')).toBeVisible({timeout:15000});
await page.screenshot({path:`${dir}/lobby-forge.png`});
await browser.close();console.log('lobby hotspots ok');
