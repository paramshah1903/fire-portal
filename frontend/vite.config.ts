import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    // Split heavy vendor libs into their own cacheable chunks so the
    // main app bundle stays lean and browsers can parallelise the
    // downloads. Update this list when new heavy deps are added.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    // Silence the >500 KB warning; the vendor-charts chunk is
    // intentionally large.
    chunkSizeWarningLimit: 700,
  },
});
