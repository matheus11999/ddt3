import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
/** Bomb Masters site (docs/site.md): `npm run dev:site` with `npm run start:site` on 4120. */
const backend=process.env.SITE_PROXY_TARGET??'http://127.0.0.1:4120';
export default defineConfig({
 root:fileURLToPath(new URL('.',import.meta.url)),
 plugins:[react()],
 server:{port:5178,strictPort:true,proxy:{'/api':backend}},
 build:{outDir:'dist',emptyOutDir:true,sourcemap:false,assetsDir:'s'},
});
