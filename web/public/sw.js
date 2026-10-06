/*
 * Service worker do DARK FISIC.
 * Guarda SO a casca do app (HTML/JS/CSS/icones) para abrir rapido e mostrar
 * um aviso claro quando o servidor esta fora do ar.
 * NUNCA guarda respostas de /api: sao dados de saude e dinheiro, e ficariam
 * gravados no cache do celular. API sempre vai direto a rede.
 */
const CACHE = 'darkfisic-casca-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icone-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname === '/status') return;

  // casca: rede primeiro (pega versao nova), cache como reserva
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && url.origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  );
});
