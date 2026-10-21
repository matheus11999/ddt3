// Prévia do site Bomb Masters (docs/site.md): cadastro, página do jogador, fórum e Jogar.
// Precisa do site rodando (`npm run start:site`, padrão http://localhost:4120) e, para o Jogar, do jogo em GAME_URL.
// Uso: node scripts/preview-site.mjs [url] → test-results/site/*.png
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base=process.argv[2]??'http://localhost:4120';
const out='test-results/site';await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
const shot=async(page,name,full=true)=>{if(full){await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);});}await page.waitForTimeout(700);await page.screenshot({path:`${out}/${name}.png`,fullPage:full});console.log(`${out}/${name}.png`);};
const user=`Beta${Date.now()%100000}`;

const desktop=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await desktop.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(base,{waitUntil:'networkidle'});
await shot(page,'home-hero',false);
await shot(page,'home-desktop');
// Cadastro pelo cartão do topo: "Ainda não tem conta? Cadastrar agora".
await page.getByRole('button',{name:'Cadastrar agora'}).click();
await page.getByLabel('Usuário',{exact:true}).fill(user);
await page.getByPlaceholder('voce@email.com').fill(`${user.toLowerCase()}@teste.com`);
await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');await page.getByLabel('Repita a senha').fill('senha-de-teste');
await shot(page,'register-card',false);
await page.getByLabel('Repita a senha').press('Enter');
await page.waitForURL('**/jogador');
await shot(page,'player-desktop');
await page.goto(`${base}/personagens`,{waitUntil:'networkidle'});await shot(page,'characters');
await page.goto(`${base}/configuracoes`,{waitUntil:'networkidle'});await shot(page,'settings-page');
// Fórum: criar tópico, responder e curtir.
await page.goto(`${base}/forum?novo`,{waitUntil:'networkidle'});
await page.getByPlaceholder('Sobre o que você quer falar?').fill('Sugestão: mais mapas de neve');
await page.getByPlaceholder(/Conte os detalhes/).fill('O Sonho Nevado ficou lindo. Queria um mapa de gelo com cavernas e obstáculos no céu!');
await page.locator('.topic-modal input[type=file]').setInputFiles(['site/public/shots/battle.webp','site/public/shots/gvg.webp']);
await page.locator('.media-chip-busy').first().waitFor({state:'detached',timeout:15000}).catch(()=>{});
await shot(page,'new-topic-modal',false);
await page.getByRole('button',{name:'Publicar'}).click();
await page.waitForURL(/\/forum\/\d+$/);
await page.getByPlaceholder('Escreva sua resposta').fill('Apoio! E um evento de inverno com fantasia exclusiva.');
await page.getByRole('button',{name:'Responder'}).click();
await page.waitForTimeout(500);
await page.locator('.post-topic .like').click();
await shot(page,'topic-desktop');
await page.goto(`${base}/forum`,{waitUntil:'networkidle'});
await shot(page,'forum-desktop');
// Jogar abre a escolha de servidor; cada servidor leva ao jogo com a conta.
await page.goto(`${base}/jogador`,{waitUntil:'networkidle'});await page.locator('.page-header-actions .play-btn').click();await page.waitForTimeout(400);
await shot(page,'servers',false);
console.log('servidores:',(await page.locator('.server-modal .server-row').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')).join(' | '));

const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const m=await mobile.newPage();
await m.goto(base,{waitUntil:'networkidle'});
await shot(m,'home-mobile');
await m.goto(`${base}/jogador?cadastro`,{waitUntil:'networkidle'});
await shot(m,'register-mobile',false);
console.log(errors.length?`ERROS: ${errors.join(' | ')}`:'sem erros no console');
await browser.close();
