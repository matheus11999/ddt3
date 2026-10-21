/**
 * Character names chosen at creation (pedido do matheus, 21/10): 3 to 16 letters, digits or _, one name per server.
 * The client checks while typing; the server checks again and owns the uniqueness test.
 */
export const NAME_MIN=3,NAME_MAX=16;
const NAME_RULE=/^[\p{L}\p{N}_]+$/u;
/** Staff-looking or offensive pieces never allowed anywhere in a name (compared without accents, case or digits-as-letters). */
const BLOCKED=['admin','adm','moderador','suporte','staff','gamemaster','oficial','bombmasters','bombmaster','sistema','system',
 'porra','caralho','buceta','puta','puto','viado','merda','foder','fodase','cuzao','arrombado','corno','vagabund','piroca','xoxota','nazi','hitler','racista','macaco'];
const LEET:Record<string,string>={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s'};

export function plainName(name:string){return name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[013457@$]/g,c=>LEET[c]).replace(/_/g,'');}

/** Null when the name can be used (still subject to the server's uniqueness check), else the reason in Portuguese. */
export function characterNameError(raw:string):string|null{
 const name=raw.trim();
 if(name.length<NAME_MIN||name.length>NAME_MAX)return `O nome precisa ter de ${NAME_MIN} a ${NAME_MAX} caracteres.`;
 if(!NAME_RULE.test(name))return 'Use só letras, números e _ (sem espaços).';
 if(/^_|_$|__/.test(name))return 'O _ não pode ficar no começo, no fim ou repetido.';
 if(/^\d+$/.test(name))return 'O nome precisa ter pelo menos uma letra.';
 const plain=plainName(name);
 if(/^gm/.test(plain)||BLOCKED.some(word=>plain.includes(word)))return 'Esse nome não é permitido. Escolha outro.';
 return null;
}
