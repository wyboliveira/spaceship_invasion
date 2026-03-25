import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    exclude: ['.claude/**', 'node_modules/**'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Desativar threads ajuda na estabilidade do process.env e window no Windows
    threads: false,
  }
});

