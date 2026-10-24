/* Somente navegação: não armazena sessões, páginas autenticadas nem respostas de APIs. */
'use strict';
var APP_NAME = 'Cérebro Black';
var APP_PATHS = /^\/(?:$|index\.html$|(?:entrar|admin|membros|recuperar-senha)(?:\/|$))/;

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== self.location.origin || !APP_PATHS.test(url.pathname)) return;

  event.respondWith(fetch(request).catch(function () {
    return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="theme-color" content="#0A0A0C"><title>' + APP_NAME + '</title>' +
      '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0C;' +
      'color:#fff;font:17px/1.6 system-ui}main{max-width:28rem;padding:2rem}h1{font-size:1.6rem}' +
      'button{font:inherit;padding:.7rem 1.2rem;border:0;border-radius:.6rem;background:#E8C07A;' +
      'color:#0A0A0C;cursor:pointer}p{color:#ccc}</style><main><p>' + APP_NAME + '</p>' +
      '<h1>Não foi possível conectar</h1><p>Confira sua conexão com a internet e tente novamente.</p>' +
      '<button onclick="location.reload()">Tentar novamente</button></main></html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
  }));
});
