import {spawnSync} from 'node:child_process';import {readFileSync,existsSync} from 'node:fs';import {homedir} from 'node:os';
const codex='C:/Users/Alienware/AppData/Local/OpenAI/Codex/bin/896a0166b774037a/codex.exe';
const only=process.argv[2];
for(const job of JSON.parse(readFileSync(new URL('./prompts.json',import.meta.url)))){
 if(only&&job.id!==only)continue;
 const args=['exec','--skip-git-repo-check','-s','workspace-write','-C','D:/APPS/ddt-site/site/art-source','--add-dir',`${homedir()}/.codex/generated_images`,'-c','model_reasoning_effort="low"',...job.refs.flatMap(r=>['-i',r]),'-'];
 console.log('>>',job.id,new Date().toISOString());
 const r=spawnSync(codex,args,{input:job.prompt,encoding:'utf8',timeout:15*60e3});
 console.log((r.stdout||'').slice(-600),(r.stderr||'').slice(-400));
 console.log(job.id,existsSync(`D:/APPS/ddt-site/site/art-source/${job.id}.png`)?'OK':'MISSING');
}
