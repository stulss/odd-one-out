/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // 서비스 워커·매니페스트를 빌드 때 자동 생성한다. 해시 붙은 파일을 전부 미리 캐시하므로
    // 예전처럼 VERSION을 손으로 올릴 필요가 없다. 새 버전은 다음 실행 때 자동 교체된다.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: '딱 하나 이상함',
        short_name: '딱하나',
        description: '여러 개 중 딱 하나만 다릅니다. 제한 시간 안에 찾으세요.',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E1116',
        theme_color: '#0E1116',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [], globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
    }),
  ],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
