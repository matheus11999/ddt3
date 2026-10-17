import {chromium} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const [,,script,out]=process.argv;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage();
page.on('pageerror',e=>{console.error(e);process.exitCode=1;});
await page.setContent('<html><body></body></html>');await page.addScriptTag({content:fs.readFileSync(script,'utf8')});
const files=await page.evaluate(()=>window.paintAll());
for(const [name,url] of Object.entries(files)){const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));console.log(file);}
await browser.close();
