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
  var installPromptSeen = false;

  var LABEL_INSTALL = '📱 安装 APP';
  var LABEL_INSTALLED = '✅ 已安装';
  var LABEL_ADD_TO_DESKTOP = '📱 添加到桌面';

  function createButton() {
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'ap-install-prompt';
    button.textContent = LABEL_INSTALL;
    button.setAttribute('aria-label', LABEL_INSTALL);
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
    return button;
  }

  function setButtonLabel(label) {
    createButton();
    button.textContent = label;
    button.setAttribute('aria-label', label);
  }

  function showFallbackInstallHint() {
    if (installPromptSeen || deferredPrompt || window.matchMedia('(display-mode: standalone)').matches) return;
    setButtonLabel(LABEL_ADD_TO_DESKTOP);
    button.hidden = false;
    button.disabled = true;
    button.style.cursor = 'default';
    button.title = '请使用浏览器菜单添加到主屏幕';
  }

  function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      deferredPrompt = null;
      if (choice && choice.outcome === 'accepted') {
        setButtonLabel(LABEL_INSTALLED);
        if (button) {
          button.disabled = true;
          button.style.cursor = 'default';
        }
        return;
      }
      setButtonLabel(LABEL_INSTALL);
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPromptSeen = true;
    deferredPrompt = event;
    setButtonLabel(LABEL_INSTALL);
    if (button) {
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.hidden = false;
    }
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    setButtonLabel(LABEL_INSTALLED);
    if (button) {
      button.disabled = true;
      button.style.cursor = 'default';
      button.hidden = false;
    }
  });

  window.addEventListener('load', function () {
    window.setTimeout(showFallbackInstallHint, 2500);
  });
})();
