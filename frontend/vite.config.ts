import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '..',  // ルートディレクトリの.envを読み込む
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase - loaded lazily when auth is used
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // PDF/Image export - loaded lazily when export is triggered
          'pdf-export': ['jspdf'],
          'image-export': ['html2canvas'],
        },
      },
    },
  },
})
