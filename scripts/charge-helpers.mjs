import {expect} from '@playwright/test';

export async function animationFrames(page,count=3){
 await page.evaluate(count=>new Promise(resolve=>{const next=()=>--count<=0?resolve():requestAnimationFrame(next);requestAnimationFrame(next);}),count);
}

/** Observe the committed, visible value before the app handles release. */
export async function observeChargeReleases(page){
 await page.evaluate(()=>{
  if(window.__brasaChargeQA)return;
  window.__brasaChargeQA={releases:[]};
  const record=input=>{
   const meter=document.querySelector('[role="meter"][aria-label="Força do disparo"]');
   const output=document.querySelector('[data-testid="shot-power"]');
   if(meter&&output)window.__brasaChargeQA.releases.push({input,power:Number(output.textContent),meter:Number(meter.getAttribute('aria-valuenow'))});
  };
  window.addEventListener('keyup',event=>{if(event.code==='Space')record('keyboard');},true);
  window.addEventListener('pointerup',event=>{if(event.target instanceof Element&&event.target.closest('[aria-label="Força do disparo"]'))record(event.pointerType||'mouse');},true);
 });
}

export async function waitForCharge(page,minimum){
 await expect(page.getByRole('meter',{name:'Força do disparo',exact:true})).toHaveAttribute('data-charging','true');
 await page.waitForFunction(minimum=>Number(document.querySelector('[role="meter"][aria-label="Força do disparo"]')?.getAttribute('aria-valuenow'))>=minimum,minimum,{polling:'raf'});
}

export async function chargeWithPointer(page,minimum){
 const button=page.getByRole('meter',{name:'Força do disparo',exact:true});await expect(button).toHaveAttribute('aria-disabled','false');
 const box=await button.boundingBox();if(!box)throw Error('Charge button is outside the viewport');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await waitForCharge(page,minimum);await page.mouse.up();
}

export async function openEnvironmentOptions(page){
 const more=page.getByRole('button',{name:'Mais opções do cenário',exact:true});
 if(await more.count()&&await more.getAttribute('aria-expanded')==='false')await more.click();
}
