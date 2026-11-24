/* 雅思复习 · 离线缓存
   页面导航走「网络优先」：在线时永远拿最新 HTML，离线才用缓存；
   题库 json 也走网络优先；其余静态资源缓存优先。 */
const CACHE = 'ielts-v25';
const SHELL = ['./', './index.html', './writing.js', './patterns.js', './ideas.js', './essay.js', './backup.js', './manifest.webmanifest',
               './icon-192.png', './icon-512.png'];
const NETFIRST = ['deck.json', 'writing.json', 'patterns.json', 'ideas.json', 'essay.json', 'cloze.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 1. 页面本身：先要新的，拿不到才退回缓存（离线仍能打开） */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  /* 2. 题库 json：网络优先，拿不到用缓存 */
  if (NETFIRST.some(f => url.pathname.endsWith(f))) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  /* 3. 其余静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
