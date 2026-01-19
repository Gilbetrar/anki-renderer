import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

// Plugin to copy WASM and dist files to output
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    closeBundle() {
      const distOut = resolve(__dirname, 'dist');
      const pkgOut = resolve(distOut, 'pkg');
      const libOut = resolve(distOut, 'lib');

      // Create directories
      if (!existsSync(pkgOut)) mkdirSync(pkgOut, { recursive: true });
      if (!existsSync(libOut)) mkdirSync(libOut, { recursive: true });

      // Copy pkg files (WASM)
      const pkgSrc = resolve(__dirname, '..', 'pkg');
      if (existsSync(pkgSrc)) {
        for (const file of readdirSync(pkgSrc)) {
          copyFileSync(resolve(pkgSrc, file), resolve(pkgOut, file));
        }
      }

      // Copy and fix dist files (JS library)
      const distSrc = resolve(__dirname, '..', 'dist');
      if (existsSync(distSrc)) {
        for (const file of readdirSync(distSrc)) {
          if (file.endsWith('.js')) {
            // Read file and fix import paths
            let content = readFileSync(resolve(distSrc, file), 'utf-8');
            // Fix WASM import paths for production deployment
            content = content.replace(
              /import\(['"]\.\.\/\.\.\/pkg\/anki_renderer\.js['"]\)/g,
              "import('/pkg/anki_renderer.js')"
            );
            content = content.replace(
              /import\(['"]\.\.\/\.\.\/pkg-node\/anki_renderer\.js['"]\)/g,
              "import('/pkg/anki_renderer.js')"
            );
            writeFileSync(resolve(libOut, file), content);
          } else if (file.endsWith('.d.ts')) {
            copyFileSync(resolve(distSrc, file), resolve(libOut, file));
          }
        }
      }
    },
  };
}

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Treat the library imports as external since we'll load them separately
      external: [/^\.\.\/dist\//],
    },
  },
  server: {
    port: 3001,
  },
  plugins: [copyAssetsPlugin()],
});
