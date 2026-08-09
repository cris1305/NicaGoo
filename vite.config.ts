import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'print-secure-url',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            setTimeout(() => {
              console.log('\n\x1b[1m\x1b[35m[Nita - NicaGo Assistant]:\x1b[0m');
              console.log('\x1b[1m\x1b[36m  ➜  NicaGo Secure Mobile URLs (Allows GPS Connection):\x1b[0m');
              console.log('  ➜  Development HTTPS:   \x1b[1m\x1b[32mhttps://ais-dev-wt2byy7wkt7i74gcexrng5-393234148693.us-east1.run.app\x1b[0m');
              console.log('  ➜  Shared Mobile HTTPS: \x1b[1m\x1b[32mhttps://ais-pre-wt2byy7wkt7i74gcexrng5-393234148693.us-east1.run.app\x1b[0m');
              console.log('  ➜  \x1b[33m"Nita, do it."\x1b[0m\n');
            }, 1500);
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: true,
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
