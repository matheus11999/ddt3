import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {hashPassword} from '../server/adminAuth';

// Prints the ADMIN_PASSWORD_HASH line for .env (docker compose) or the server's environment.
// Usage: npm run admin:password   (asks for the password; it is never written to disk)
const rl=createInterface({input:stdin,output:stdout});
const password=process.env.ADMIN_PASSWORD??await rl.question('Senha do painel (mínimo 10 caracteres): ');
rl.close();
console.log(`\nColoque no .env (que não vai para o git):\nADMIN_USERNAME=matheus\nADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
