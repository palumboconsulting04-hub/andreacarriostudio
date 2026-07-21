// Service worker mínimo: habilita que la PWA se pueda instalar (Android/Chrome
// dispara "beforeinstallprompt" solo si hay un SW con handler de fetch).
// Passthrough puro, sin caché, para no servir nunca versiones antiguas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* red normal, sin interceptar */ });
