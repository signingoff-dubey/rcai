import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  plugins: [
    {
      name: 'diagnose',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.includes('main.jsx')) {
            console.log('=== REQUEST ===', req.url, 'Accept:', req.headers.accept);
            const origEnd = res.end.bind(res);
            res.end = function(...args) {
              const body = args[0]?.toString() || '';
              if (body.includes('<React.StrictMode>')) {
                console.log('RAW JSX DETECTED in response');
              } else if (body.includes('_jsx') || body.includes('createElement')) {
                console.log('TRANSFORMED JSX in response');
              } else {
                console.log('Response length:', body.length, 'Preview:', body.substring(0, 100));
              }
              return origEnd(...args);
            };
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
