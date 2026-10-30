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
        name: '오리지널 감별국',
        short_name: '감별국',
        description: '복제품 속에서 진짜를 찾아라! 똑같은 물건들 사이에서 딱 하나 다른 것을 찾아내는 감별사 게임.',
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
