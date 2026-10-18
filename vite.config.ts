import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
const backend=process.env.DEV_PROXY_TARGET??'http://127.0.0.1:4107';
/** /admin and its sub-routes open the admin panel (admin.html), as nginx does in production. */
const adminPage:Plugin={name:'admin-page',configureServer(server){server.middlewares.use((req,_res,next)=>{if(req.url&&/^\/admin(\/[^.]*)?(\?.*)?$/.test(req.url))req.url='/admin.html';next();});}};
export default defineConfig({
 plugins:[react(),adminPage],
 server:{port:5177,strictPort:true,watch:process.env.DEV_POLLING==='true'?{usePolling:true,interval:1000,binaryInterval:5000}:undefined,
  proxy:{'/api':backend,'/ws':{target:backend.replace(/^http/,'ws'),ws:true}}},
 build:{sourcemap:false,rollupOptions:{input:{main:'index.html',admin:'admin.html'}}}
});
