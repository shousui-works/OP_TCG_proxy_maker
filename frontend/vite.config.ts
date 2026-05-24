import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '..',  // ルートディレクトリの.envを読み込む
  server: {
    proxy: {
      // 公式サイトの画像をプロキシ（開発環境のCORS問題を回避）
      '/card-images': {
        target: 'https://www.onepiece-cardgame.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/card-images/, '/images/cardlist/card'),
      },
      // バックエンドAPIへのプロキシ（サムネイル等）
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
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
