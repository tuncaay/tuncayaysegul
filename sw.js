// Tuncay & Ayşegül — Service Worker
// Mantık: İnternet varken HER ZAMAN sunucudaki güncel dosya gelir (önbellek kullanılmaz).
// Önbellek yalnızca internet yokken yedek olarak kullanılır, böylece uygulama ve logo kaybolmaz.
// Yeni bir şey yüklediğinde sürüm numarasını değiştirmene gerek yok.

const CACHE = "ta-offline";
const INDEX = new URL("index.html", self.registration.scope).href;
const ASSETS = [
  "index.html",
  "manifest.json",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

// Kurulum: hemen devreye gir, dosyaları yedek olarak sakla (biri başarısız olsa bile kurulum bozulmaz)
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        ASSETS.map((a) =>
          fetch(new Request(a, { cache: "reload" }))
            .then((r) => r.ok && c.put(new URL(a, self.registration.scope).href, r))
            .catch(() => {})
        )
      )
    )
  );
});

// Aktifleşme: eski sürümlerin bütün önbelleklerini sil, açık sayfaları devral
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k !== CACHE) await caches.delete(k);
      }
      await self.clients.claim();
    })()
  );
});

// Önce internet (her seferinde sunucuya sorar), olmazsa yedek
async function internetOnce(key, url) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (r.ok) {
      c.put(key, r.clone());
      return r;
    }
    return (await c.match(key)) || r;
  } catch (err) {
    return (await c.match(key)) || Response.error();
  }
}

// Google Fonts: değişmez dosyalar, hızlı açılsın diye önbellekten ver, arkada yenile
async function fontlar(req) {
  const c = await caches.open(CACHE);
  const eski = await c.match(req);
  const yeni = fetch(req)
    .then((r) => {
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    })
    .catch(() => eski || Response.error());
  return eski || yeni;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Sayfa açılışı (her adres şifreli ana sayfaya gider)
  if (req.mode === "navigate" && url.origin === location.origin) {
    e.respondWith(internetOnce(INDEX, INDEX));
    return;
  }

  // Aynı siteden gelen diğer dosyalar (logo, manifest vb.)
  if (url.origin === location.origin) {
    e.respondWith(internetOnce(req.url, req.url));
    return;
  }

  // Google Fonts
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(fontlar(req));
  }
});
