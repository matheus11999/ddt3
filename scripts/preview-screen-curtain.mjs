// The full-screen loading cover: first load, back to a hidden tab, reconnecting; and a window whose pictures arrive late.
// Uso: node scripts/preview-screen-curtain.mjs  (BASE_URL, OUT, CHROME_PATH, VIEWPORT opcionais; precisa do jogo rodando)
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/screen-curtain',suffix=process.env.VIEWPORT?`-${process.env.VIEWPORT}`:'';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const [width,height]=(process.env.VIEWPORT??'1536x864').split('x').map(Number),mobile=width<1000;
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
const shot=name=>page.screenshot({path:`${output}/${name}${suffix}.png`});
const curtain=page.locator('.screen-curtain');
await enterGame(page,base);
// Reload with a slow network: the cover holds until the plaza and its HUD are complete.
await page.route('**/assets/**',async route=>{await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
await page.reload({waitUntil:'domcontentloaded'});
await expect(curtain).toBeVisible();await page.waitForTimeout(600);await shot('1-boot');
await expect(curtain).toHaveCount(0,{timeout:20000});
const broken=await page.evaluate(()=>[...document.querySelectorAll('#root img')].filter(img=>!img.complete).length);
console.log('imagens incompletas depois do carregamento:',broken);
await page.unroute('**/assets/**');await page.waitForTimeout(500);await shot('2-plaza');
// The tab goes hidden for a while and comes back.
const visibility=hidden=>page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));},hidden);
await visibility(true);await page.waitForTimeout(1800);await visibility(false);
await expect(curtain).toBeVisible();await shot('3-resume');
const resumeStart=Date.now();await expect(curtain).toHaveCount(0,{timeout:10000});console.log('volta da aba coberta por',Date.now()-resumeStart,'ms');
// A short glance away (under 1.5 s) keeps the game on screen.
await visibility(true);await page.waitForTimeout(300);await visibility(false);await page.waitForTimeout(100);
console.log('olhada rápida mostra a cobertura?',await curtain.count()>0);
// The connection drops: the cover says so until the new welcome is on screen.
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.ws.close();});
await expect(curtain).toBeVisible();await page.waitForTimeout(300);await shot('4-reconnect');
await expect(curtain).toHaveCount(0,{timeout:15000});
// A window opened for the first time stays invisible until its pictures are in.
await page.route('**/assets/**',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();
await page.waitForTimeout(150);
console.log('janela escondida enquanto as imagens chegam:',await page.locator('[data-pictures-pending]').count());
await shot('5-window-pending');
await expect(page.locator('[data-pictures-pending]')).toHaveCount(0,{timeout:5000});await page.waitForTimeout(300);await shot('6-window-ready');
await browser.close();
