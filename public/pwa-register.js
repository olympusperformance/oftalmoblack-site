/* Instalação independente do login; o aplicativo continua usando dados online. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  function register() {
    navigator.serviceWorker.register('/pwa-sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(function (error) { console.warn('Não foi possível preparar o aplicativo.', error); });
  }
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
})();
