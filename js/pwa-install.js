(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (error) {
        console.warn('[AsiaPower PWA] service worker registration failed', error);
      });
    });
  }

  var deferredPrompt = null;
  var button = null;

  function createButton() {
    if (button || window.matchMedia('(display-mode: standalone)').matches) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'ap-install-prompt';
    button.textContent = 'Install AsiaPower';
    button.setAttribute('aria-label', 'Install AsiaPower app');
    button.style.cssText = [
      'position:fixed',
      'left:16px',
      'bottom:16px',
      'z-index:999',
      'border:0',
      'border-radius:6px',
      'padding:12px 16px',
      'background:#0a1628',
      'color:#fff',
      'font:700 14px/1.2 Inter,Arial,sans-serif',
      'box-shadow:0 10px 28px rgba(0,0,0,.22)',
      'cursor:pointer'
    ].join(';');
    button.hidden = true;
    document.body.appendChild(button);
    button.addEventListener('click', promptInstall);
  }

  function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      if (button) button.hidden = true;
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    createButton();
    if (button) button.hidden = false;
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (button) button.hidden = true;
  });
})();
