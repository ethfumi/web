// オンラインでは常に最新版を取得し、通信できない時だけ保存済みデータを使う。
const CACHE = "train-go-v53";
const ASSETS = [
  ".",
  "index.html",
  "style.css?v=53",
  "app.js?v=53",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-512.png",
];

async function precacheFreshAssets() {
  const cache = await caches.open(CACHE);
  await Promise.all(ASSETS.map(async (asset) => {
    const request = new Request(asset, { cache: "reload" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`Failed to precache ${asset}: ${response.status}`);
    await cache.put(asset, response);
  }));
}

self.addEventListener("install", (e) => {
  e.waitUntil(Promise.all([precacheFreshAssets(), self.skipWaiting()]));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function fetchFreshOrCached(request) {
  try {
    // Safari の HTTP cache を使わず、配信元から最新版を取得する。
    const response = await fetch(new Request(request, { cache: "reload" }));
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // URL に query が付いていても、オフライン時はアプリ本体を開けるようにする。
    if (request.mode === "navigate") {
      const appShell = await caches.match("index.html");
      if (appShell) return appShell;
    }
    throw error;
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(fetchFreshOrCached(e.request));
});
