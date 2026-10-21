import type pg from 'pg';
import {randomBytes} from 'node:crypto';
import {mkdir,rename,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {AccountError} from '../../server/accounts';
import {FORUM_MEDIA,type ForumMedia} from '../src/forumRules';

/**
 * Imagens e vídeos do fórum (pedido do matheus, 21/10). The type comes from the file's own bytes (never from its name or
 * the browser), files live in UPLOAD_DIR under a random name, JPEG metadata (EXIF, GPS) is dropped before saving, and an
 * upload only shows up once its author attaches it to a topic or reply.
 */
const TYPES={
 'image/png':{kind:'image',ext:'png'},'image/jpeg':{kind:'image',ext:'jpg'},'image/gif':{kind:'image',ext:'gif'},'image/webp':{kind:'image',ext:'webp'},
 'video/mp4':{kind:'video',ext:'mp4'},'video/webm':{kind:'video',ext:'webm'},
} as const;
type Mime=keyof typeof TYPES;
export const UPLOAD_TYPES=Object.keys(TYPES) as Mime[];
export const MEDIA_FILE=/^([a-f0-9]{24})\.(png|jpg|gif|webp|mp4|webm)$/;
export const MEDIA_MIME:Record<string,string>=Object.fromEntries(Object.entries(TYPES).map(([mime,t])=>[t.ext,mime]));

/** The real type of a file from its first bytes. */
export function sniff(b:Buffer):Mime|null{
 const at=(i:number,...bytes:number[])=>bytes.every((v,k)=>b[i+k]===v);
 if(at(0,0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))return 'image/png';
 if(at(0,0xff,0xd8,0xff))return 'image/jpeg';
 if(b.subarray(0,6).toString('latin1')==='GIF87a'||b.subarray(0,6).toString('latin1')==='GIF89a')return 'image/gif';
 if(b.subarray(0,4).toString('latin1')==='RIFF'&&b.subarray(8,12).toString('latin1')==='WEBP')return 'image/webp';
 if(b.subarray(4,8).toString('latin1')==='ftyp')return 'video/mp4';
 if(at(0,0x1a,0x45,0xdf,0xa3))return 'video/webm';
 return null;
}

/** Segments that may carry private data: APP1 (EXIF, XMP, GPS), APP3–APP13 and APP15 (IPTC and vendor blocks) and COM.
 * APP0 (JFIF), APP2 (ICC color profile) and APP14 (Adobe color transform) stay: the picture needs them to look right. */
const DROPPED=(marker:number)=>marker===0xfe||marker>=0xe1&&marker<=0xef&&marker!==0xe2&&marker!==0xee;
const STANDALONE=(marker:number)=>marker===0x01||marker>=0xd0&&marker<=0xd7;

/**
 * The JPEG walked marker by marker to its end, without metadata (A06, auditoria 21/10): fill bytes between markers are
 * skipped, every scan (progressive files have many) is copied as is, and anything after the end marker is dropped.
 * A file this cannot read is refused, never saved as it came.
 */
export function stripJpegMetadata(b:Buffer):Buffer{
 const bad=()=>new AccountError('Não foi possível ler esta imagem JPG. Salve-a de novo e envie outra vez.',415);
 if(b.length<4||b[0]!==0xff||b[1]!==0xd8)throw bad();
 const parts:Buffer[]=[b.subarray(0,2)];let i=2;
 for(;;){
  if(i>=b.length||b[i]!==0xff)throw bad();
  while(b[i+1]===0xff)i++; // fill bytes before a marker
  if(i+1>=b.length)throw bad();
  const marker=b[i+1];
  if(marker===0xd9){parts.push(b.subarray(i,i+2));break;}
  if(marker===0x00||marker===0xd8)throw bad();
  if(STANDALONE(marker)){parts.push(b.subarray(i,i+2));i+=2;continue;}
  if(i+4>b.length)throw bad();
  const len=b.readUInt16BE(i+2);if(len<2||i+2+len>b.length)throw bad();
  if(!DROPPED(marker))parts.push(b.subarray(i,i+2+len));
  i+=2+len;
  if(marker===0xda){
   // Entropy-coded data runs to the next marker: 0xFF is followed by 0x00 (a stuffed byte) or a restart marker inside it.
   const start=i;
   while(i<b.length&&!(b[i]===0xff&&i+1<b.length&&b[i+1]!==0x00&&!(b[i+1]>=0xd0&&b[i+1]<=0xd7)))i++;
   if(i>=b.length)throw bad();
   parts.push(b.subarray(start,i));
  }
 }
 return Buffer.concat(parts);
}

export class MediaStore {
 constructor(readonly pool:pg.Pool,readonly dir:string){}
 async init(){
  await mkdir(this.dir,{recursive:true});
  await this.pool.query(`
  CREATE TABLE IF NOT EXISTS forum_media(id char(24) PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind varchar(8) NOT NULL,ext varchar(8) NOT NULL,size int NOT NULL,used boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS forum_media_account ON forum_media(account_id,created_at);
  ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]';
  ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]';
  `);
 }
 async save(accountId:string,body:Buffer):Promise<ForumMedia>{
  const mime=sniff(body);
  if(!mime)throw new AccountError('Envie uma imagem (PNG, JPG, GIF, WEBP) ou um vídeo (MP4, WEBM).',415);
  const {kind,ext}=TYPES[mime];
  if(body.length>FORUM_MEDIA.maxBytes[kind])throw new AccountError(kind==='image'?`A imagem pode ter até ${FORUM_MEDIA.maxBytes.image/1048576} MB.`:`O vídeo pode ter até ${FORUM_MEDIA.maxBytes.video/1048576} MB.`,413);
  const data=mime==='image/jpeg'?stripJpegMetadata(body):body;
  const id=randomBytes(12).toString('hex'),file=join(this.dir,`${id}.${ext}`);
  // The day's quota is reserved under a lock per account (A05): two uploads racing for the last slot get one success.
  // The row and the file are written inside that transaction; a failure removes the file, so nothing is left behind.
  const c=await this.pool.connect();let wrote=false;
  try{
   await c.query('BEGIN');
   await c.query("SELECT pg_advisory_xact_lock(hashtext('forum_media:'||$1))",[accountId]);
   const today=await c.query("SELECT count(*)::int AS n,coalesce(sum(size),0)::bigint AS bytes FROM forum_media WHERE account_id=$1 AND created_at>now()-interval '1 day'",[accountId]);
   if(today.rows[0].n>=FORUM_MEDIA.perDay||Number(today.rows[0].bytes)+data.length>FORUM_MEDIA.perDayBytes)throw new AccountError('Você chegou ao limite de envios de hoje. Tente amanhã.',429);
   await c.query('INSERT INTO forum_media(id,account_id,kind,ext,size) VALUES($1,$2,$3,$4,$5)',[id,accountId,kind,ext,data.length]);
   await writeFile(`${file}.part`,data,{flag:'wx'});wrote=true;await rename(`${file}.part`,file);
   await c.query('COMMIT');
  }catch(e){
   await c.query('ROLLBACK').catch(()=>{});
   if(wrote)await Promise.all([unlink(`${file}.part`).catch(()=>{}),unlink(file).catch(()=>{})]);
   throw e;
  }finally{c.release();}
  return {id,kind,url:`/media/${id}.${ext}`};
 }
 /** The author's own, not yet used uploads, in the order given; marks them used. */
 async claim(c:pg.PoolClient,accountId:string,ids:string[]):Promise<ForumMedia[]>{
  const unique=[...new Set(ids)];
  if(unique.length>FORUM_MEDIA.perPost)throw new AccountError(`Até ${FORUM_MEDIA.perPost} imagens ou vídeos por mensagem.`);
  if(!unique.length)return [];
  const r=await c.query('UPDATE forum_media SET used=true WHERE id=ANY($1) AND account_id=$2 AND used=false RETURNING id,kind,ext',[unique,accountId]);
  if(r.rowCount!==unique.length)throw new AccountError('Algum arquivo não pôde ser anexado. Envie de novo.');
  const byId=new Map(r.rows.map(m=>[m.id as string,{id:m.id as string,kind:m.kind as ForumMedia['kind'],url:`/media/${m.id}.${m.ext}`}]));
  return unique.map(id=>byId.get(id)!);
 }
}
