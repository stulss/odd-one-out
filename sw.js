// 서비스 워커 — 앱 셸을 캐시해 오프라인에서도 실행되게 한다.
// 전략: 같은 출처 GET은 stale-while-revalidate (캐시를 즉시 쓰고 뒤에서 갱신).
// 파일을 바꿔 배포하면 VERSION을 올린다 → 옛 캐시는 activate에서 삭제된다.
const VERSION = 'ooo-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/game.js', './src/rng.js', './src/stage.js', './src/render.js',
  './src/input.js', './src/timer.js', './src/save.js', './src/daily.js', './src/card.js',
  './src/share.js', './src/audio.js', './src/logger.js', './src/achieve.js',
  './src/story.js', './src/hero.js', './src/dialog.js', './src/fx.js', './src/theme.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // ?c=코드 / ?d=날짜 같은 쿼리가 붙어도 같은 index.html을 쓴다
  const opts = req.mode === 'navigate' ? { ignoreSearch: true } : {};
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : req, opts);
      const net = fetch(req).then(res => {
        if (res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response('오프라인입니다', { status: 503 });
    })
  );
});
