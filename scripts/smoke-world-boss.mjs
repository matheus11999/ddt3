import {chromium,expect} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
// Chefão Mundial smoke and preview: the admin panel starts the event, the plaza shows the dragon's face,
// the window lists the ranking, Entrar opens the attempt, the dragon acts, and stopping the event in the panel
// sends the player back to the window. Needs the game running and ADMIN_USERNAME/ADMIN_PASSWORD for the panel.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/world-boss';
const user=process.env.ADMIN_USERNAME,password=process.env.ADMIN_PASSWORD;
if(!user||!password)throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD for the admin panel.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const admin=await browser.newPage({viewport:{width:1440,height:1000}});
await admin.goto(`${base}/admin`);
await admin.getByLabel(/Usuário/i).fill(user);await admin.getByLabel(/Senha/i).fill(password);await admin.getByRole('button',{name:'Entrar'}).click();
await admin.getByRole('link',{name:'Eventos'}).click();
const stop=admin.getByRole('button',{name:'Parar agora',exact:true});
if(await stop.isEnabled()){await stop.click();await admin.getByRole('dialog').getByRole('button',{name:'Parar agora',exact:true}).click();}
await admin.getByRole('button',{name:'Iniciar agora',exact:true}).click();
await admin.getByRole('dialog').getByRole('textbox').fill('250000');
await admin.getByRole('dialog').getByRole('button',{name:'Iniciar agora',exact:true}).click();
await expect(admin.locator('.adm-event-status .adm-status.live')).toBeVisible();
await admin.screenshot({path:`${dir}/admin-events.png`,fullPage:true});

const page=await browser.newPage({viewport:{width:1536,height:864}});
await enterGame(page,base);
const button=page.locator('.world-boss-button');await expect(button).toBeVisible({timeout:10000});await page.waitForTimeout(1500);
await page.screenshot({path:`${dir}/lobby-icon.png`});
await button.click();const window=page.locator('.world-boss-window');await expect(window).toBeVisible();await page.waitForTimeout(800);
await page.screenshot({path:`${dir}/window.png`});
await window.getByRole('button',{name:'Entrar'}).click();
await expect(page.locator('.world-boss-bar')).toBeVisible({timeout:10000});
const entered=Date.now();for(const at of [400,1200,2400,3400]){await page.waitForTimeout(Math.max(0,at-(Date.now()-entered)));await page.screenshot({path:`${dir}/entrance-${at}.png`});}
await expect(page.getByText('SUA VEZ!')).toBeVisible({timeout:8000});await page.waitForTimeout(600);
await page.screenshot({path:`${dir}/my-turn.png`});
// Pass: the dragon acts. Frames through its move.
await page.keyboard.press('p');
const started=Date.now();for(const at of [300,900,1250,1500,1900,2300,2700,3100]){await page.waitForTimeout(Math.max(0,at-(Date.now()-started)));await page.screenshot({path:`${dir}/dragon-${at}.png`});}
await page.waitForTimeout(2500);
// The panel stops the event: the dragon retreats and the player is back in the plaza with the window open.
await admin.getByRole('button',{name:'Parar agora',exact:true}).click();await admin.getByRole('dialog').getByRole('button',{name:'Parar agora',exact:true}).click();
await page.waitForTimeout(1200);await page.screenshot({path:`${dir}/retreat.png`});
await expect(page.locator('.world-boss-window')).toBeVisible({timeout:12000});await page.waitForTimeout(600);
await page.screenshot({path:`${dir}/results.png`});
await browser.close();console.log('world boss smoke ok');
