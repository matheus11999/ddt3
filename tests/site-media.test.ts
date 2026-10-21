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
