import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MEDIA_FILE,sniff,stripJpegMetadata} from '../site/server/media';

test('uploads are typed by their bytes, never by name or browser', () => {
 assert.equal(sniff(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0])),'image/png');
 assert.equal(sniff(Buffer.from([0xff,0xd8,0xff,0xe0,0,0])),'image/jpeg');
 assert.equal(sniff(Buffer.from('GIF89a......')),'image/gif');
 assert.equal(sniff(Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBPVP8 ')])),'image/webp');
 assert.equal(sniff(Buffer.concat([Buffer.alloc(4),Buffer.from('ftypisom')])),'video/mp4');
 assert.equal(sniff(Buffer.from([0x1a,0x45,0xdf,0xa3,0,0])),'video/webm');
 for(const bad of ['<svg onload=alert(1)>','<!doctype html><script>alert(1)</script>','%PDF-1.7','MZ\u0090\u0000'])assert.equal(sniff(Buffer.from(bad)),null,bad);
});

test('JPEG loses its EXIF/GPS segment and keeps the image data', () => {
 const app1=Buffer.concat([Buffer.from([0xff,0xe1,0x00,0x0a]),Buffer.from('Exif\0\0GP')]);
 const app0=Buffer.from([0xff,0xe0,0x00,0x04,0x01,0x02]);
 const scan=Buffer.from([0xff,0xda,0x00,0x02,0x11,0x22,0xff,0xd9]);
 const out=stripJpegMetadata(Buffer.concat([Buffer.from([0xff,0xd8]),app0,app1,scan]));
 assert.deepEqual(out,Buffer.concat([Buffer.from([0xff,0xd8]),app0,scan]));
 assert.ok(!out.includes(Buffer.from('Exif')));
});

test('only server-made media names are served', () => {
 assert.ok(MEDIA_FILE.test('0123456789abcdef01234567.png'));
 for(const bad of ['../../etc/passwd','0123456789abcdef01234567.svg','0123456789abcdef01234567.html','0123456789abcdef01234567.png/..','x.png','0123456789ABCDEF01234567.png'])assert.ok(!MEDIA_FILE.test(bad),bad);
});

test('a valid JPEG with fill bytes still loses its EXIF and stays viewable; an unreadable one is refused (A06)', async () => {
 const {default:sharp}=await import('sharp');
 const clean=await sharp({create:{width:1,height:1,channels:3,background:{r:200,g:40,b:10}}}).jpeg().toBuffer();
 const exif=Buffer.concat([Buffer.from('Exif\0\0'),Buffer.from('SENTINELA-GPS-AUDITORIA')]);
 const app1=Buffer.concat([Buffer.from([0xff,0xe1]),Buffer.from([(exif.length+2)>>8,(exif.length+2)&255]),exif]);
 // SOI, a fill byte (0xFF before a marker is allowed), the EXIF block, then the rest of the file and junk after EOI.
 const tricky=Buffer.concat([clean.subarray(0,2),Buffer.from([0xff]),app1,clean.subarray(2),Buffer.from('depois-do-fim')]);
 assert.ok((await sharp(tricky).metadata()).width===1);
 const out=stripJpegMetadata(tricky);
 assert.ok(!out.includes(Buffer.from('SENTINELA')));assert.ok(!out.includes(Buffer.from('Exif')));assert.ok(!out.includes(Buffer.from('depois-do-fim')));
 const {data,info}=await sharp(out).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1);assert.ok(data[0]>150);
 for(const bad of [Buffer.from([0xff,0xd8,0x12,0x34]),tricky.subarray(0,tricky.length-40),Buffer.concat([clean.subarray(0,2),Buffer.from([0xff,0xe1,0x00,0x50,0x45])])])
  assert.throws(()=>stripJpegMetadata(bad),/Não foi possível ler/);
});
