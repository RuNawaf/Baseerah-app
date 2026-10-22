import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const port = Number(process.env.CLIENT_PORT ?? 5173);

// Turns Vite's bare "Port 5173 is already in use" into an instruction.
function explainBusyPort() {
  return {
    name: 'baseerah-explain-busy-port',
    configureServer(server) {
      server.httpServer?.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `\nPort ${port} is already in use. Another Baseerah dev server is probably still running in a different terminal: stop it with Ctrl+C and run "npm run dev" again.\n`,
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), explainBusyPort()],
  server: {
    port,
    strictPort: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,jsx}'],
    setupFiles: ['./test/setup.js'],
    css: false,
  },
});