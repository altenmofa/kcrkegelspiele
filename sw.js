// KC Rebell Kegelspiele – Offline-Speicher für die App-Dateien
// Bei jeder neuen App-Version die Nummer erhöhen, dann holen sich alle Handys die neuen Dateien.
const CACHE = "kcr-v8";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./kaiser-logo.jpg"];
const EXTERN = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];
// Datenbank und Anmeldung laufen nie über den Speicher – das macht Firebase selbst
const NIE = ["firestore.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com", "www.googleapis.com", "firebaseinstallations.googleapis.com"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(EXTERN.map(async u => {
      try { const r = await fetch(u, { mode: "cors" }); if (r.ok) await c.put(u, r); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (NIE.includes(url.hostname)) return;

  // App-Seite und Startdaten: zuerst Netz (für Updates), ohne Netz aus dem Speicher
  const istSeite = req.mode === "navigate" || (url.origin === location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("index.html") || url.pathname.endsWith("seed.json")));
  if (istSeite) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(req, { signal: ctrl.signal }); clearTimeout(t);
        if (r.ok) c.put(req.mode === "navigate" ? "./index.html" : req, r.clone());
        return r;
      } catch (_) {
        return (await c.match(req, { ignoreSearch: true })) || (await c.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Alles andere (Bausteine, Schriften, Symbole): aus dem Speicher, sonst Netz und merken
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    } catch (_) { return hit || Response.error(); }
  })());
});
