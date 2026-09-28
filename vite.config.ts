import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Serves the Vercel functions in /api during `npm run dev`, so the whole app
// runs locally without the Vercel CLI. In production Vercel serves /api itself.
function localApiRoutes(): Plugin {
  return {
    name: 'local-api-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const match = pathname.match(/^\/api\/([a-z0-9-]+)$/);
        if (!match) return next();
        const file = path.resolve(__dirname, 'api', `${match[1]}.ts`);
        if (!fs.existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only variables from .env available to the local /api handlers.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[key] ??= value;
  }

  return {
    plugins: [react(), localApiRoutes()],
    // NEXT_PUBLIC_ lets the Vercel ↔ Supabase integration's variables work as-is.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      port: 3000,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
