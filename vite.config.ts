import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const backend=process.env.DEV_PROXY_TARGET??'http://127.0.0.1:4107';
export default defineConfig({
 plugins:[react()],
 server:{port:5177,strictPort:true,watch:process.env.DEV_POLLING==='true'?{usePolling:true,interval:250}:undefined,
  proxy:{'/api':backend,'/ws':{target:backend.replace(/^http/,'ws'),ws:true}}},
 build:{sourcemap:false}
});
