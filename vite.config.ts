import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/server/index.ts',
      fileName: 'server',
      formats: ['es'],
    },
    target: 'node20',
    minify: false,
    rollupOptions: {
      external: [],
      output: {
        dir: 'dist',
      },
    },
  },
});
