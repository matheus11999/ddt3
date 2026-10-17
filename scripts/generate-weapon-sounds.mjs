import {existsSync,readFileSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

// Generates the missing weapon sounds listed by `npm run verify:weapons` with ElevenLabs Sound Effects.
// The key stays in the local .env (ELEVENLABS_API_KEY), never in git. Spends credits, so it asks for a target:
//   node scripts/generate-weapon-sounds.mjs --weapon=ember            (all missing sounds of one weapon)
//   node scripts/generate-weapon-sounds.mjs --weapon=ember --slot=fire
//   node scripts/generate-weapon-sounds.mjs --all                     (every missing sound)
// Then add the slot to `sounds` in shared/weaponKit.ts and run the validator again.
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.split('=')[1];
const weapon=arg('weapon'),slot=arg('slot'),all=process.argv.includes('--all'),overwrite=process.argv.includes('--overwrite');
if(!weapon&&!all){console.error('Escolha --weapon=<id> (com --slot=<fire|flight|impact|terrain> opcional) ou --all.');process.exit(2);}
if(existsSync('.env'))for(const line of readFileSync('.env','utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^["']|["']$/g,'');}
const key=process.env.ELEVENLABS_API_KEY;
const report=JSON.parse(await readFile(`${process.env.OUTPUT_DIR??'test-results/weapons'}/report.json`,'utf8').catch(()=>{console.error('Rode antes: npm run verify:weapons');process.exit(2);}));
const jobs=report.filter(entry=>all||entry.id===weapon).flatMap(entry=>entry.prompts.filter(prompt=>prompt.kind==='som'&&(!slot||prompt.key===`sound-${slot}`)).map(prompt=>({...prompt,weapon:entry.id})));
if(!jobs.length){console.log('Nenhum som faltando para esse filtro.');process.exit(0);}
for(const job of jobs){
 const target=`public${job.path}`;
 if(existsSync(target)&&!overwrite){console.log(`pulado (já existe): ${target}`);continue;}
 // Without a key the request still goes out: a proxy that injects the credential (cloud sessions) also works.
 const response=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',headers:{'content-type':'application/json',...(key?{'xi-api-key':key}:{})},body:JSON.stringify({text:job.text,duration_seconds:job.seconds,prompt_influence:.6})});
 if(!response.ok){console.error(`${job.weapon} ${job.key}: ElevenLabs respondeu ${response.status} ${await response.text()}`);process.exitCode=1;continue;}
 await mkdir(dirname(target),{recursive:true});await writeFile(target,Buffer.from(await response.arrayBuffer()));
 console.log(`gerado: ${target} (${job.seconds}s) → acrescente '${job.key.slice(6)}' em sounds de ${job.weapon} (shared/weaponKit.ts)`);
}
