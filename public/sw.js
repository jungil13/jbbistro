// Empty service worker placeholder to prevent 404s from previously registered service workers on localhost
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
