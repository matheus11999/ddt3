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
await page.getByPlaceholder('Seu nome no jogo').fill(user);
await page.getByPlaceholder('voce@email.com').fill(`${user.toLowerCase()}@teste.com`);
await page.getByPlaceholder('••••••••').fill('senha-de-teste');
await shot(page,'register-card',false);
await page.getByPlaceholder('••••••••').press('Enter');
await page.waitForURL('**/jogador');
await shot(page,'player-desktop');
// Fórum: criar tópico, responder e curtir.
await page.goto(`${base}/forum?novo`,{waitUntil:'networkidle'});
await page.getByPlaceholder('Sobre o que você quer falar?').fill('Sugestão: mais mapas de neve');
await page.getByPlaceholder(/Conte os detalhes/).fill('O Sonho Nevado ficou lindo. Queria um mapa de gelo com cavernas e obstáculos no céu!');
await page.getByRole('button',{name:'Publicar'}).click();
await page.waitForURL(/\/forum\/\d+$/);
await page.getByPlaceholder('Escreva sua resposta').fill('Apoio! E um evento de inverno com fantasia exclusiva.');
await page.getByRole('button',{name:'Responder'}).click();
await page.waitForTimeout(500);
await page.locator('.post-topic .like').click();
await shot(page,'topic-desktop');
await page.goto(`${base}/forum`,{waitUntil:'networkidle'});
await shot(page,'forum-desktop');
// Jogar abre o jogo já com a conta.
const play=await page.goto(`${base}/jogador`,{waitUntil:'networkidle'}).then(()=>page.locator('.play-btn').first().getAttribute('href'));
const game=await desktop.newPage();
const session=await game.goto(new URL('/api/session',play).toString()).then(r=>r.json()).catch(e=>({error:e.message}));
console.log('Jogar →',play,'sessão do jogo:',JSON.stringify(session).slice(0,120));

const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const m=await mobile.newPage();
await m.goto(base,{waitUntil:'networkidle'});
await shot(m,'home-mobile');
await m.goto(`${base}/jogador?cadastro`,{waitUntil:'networkidle'});
await shot(m,'register-mobile',false);
console.log(errors.length?`ERROS: ${errors.join(' | ')}`:'sem erros no console');
await browser.close();
