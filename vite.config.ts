import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5177, proxy: { '/api': 'http://127.0.0.1:4107', '/ws': {target:'ws://127.0.0.1:4107',ws:true} } }, build:{sourcemap:false} });
