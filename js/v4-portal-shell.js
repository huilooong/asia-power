/**
 * Shared v4 shell for portal pages (login / buyer / supplier dashboard).
 * Keeps portal UI on the v4 token system — not eBay layout.
 */
(function () {
  function mount(active) {
    const existing = document.querySelector('[data-v4-portal-nav]');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.className = 'ap-nav';
    nav.setAttribute('data-v4-portal-nav', '1');
    nav.innerHTML = `
      <div class="nav-w">
        <a class="ap-logo" href="/">Asia<span>Power</span></a>
        <div class="nav-links">
          <a href="/half-cuts/" ${active === 'browse' ? 'class="on"' : ''}>Browse</a>
          <a href="/buyer-portal/" ${active === 'buyer' ? 'class="on"' : ''}>Buyer</a>
          <a href="/supplier-portal/dashboard.html" ${active === 'supplier' ? 'class="on"' : ''}>Supplier</a>
          <span class="ap-auth-slot" data-ap-auth-slot data-variant="portal"><a href="/login/" ${active === 'login' ? 'class="on"' : ''} data-i18n="nav.signIn">Sign in</a></span>
        </div>
        <div class="nav-right">
          <a class="nav-wa" href="https://wa.me/8618603773077" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>`;
    document.body.insertBefore(nav, document.body.firstChild);

    // Prefer shared auth hydrator from components.js when available.
    if (window.AsiaPowerAuthNav?.hydrate) {
      window.AsiaPowerAuthNav.hydrate(nav);
      return;
    }

    // Fallback if portal page loads shell before / without components.js
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((me) => {
        const slot = nav.querySelector('[data-ap-auth-slot]');
        if (!slot || !me?.user) return;
        const name = me.user.displayName || me.user.name || me.user.contactPerson
          || me.user.supplierName || me.user.company
          || (window.AsiaPowerAuthNav?.maskPhone
            ? window.AsiaPowerAuthNav.maskPhone(me.user.phoneNormalized || me.user.phone)
            : (me.user.phone || me.user.email || 'Account'));
        const portal = me.user.role === 'supplier' || me.user.role === 'admin'
          ? (me.user.role === 'admin' ? '/admin/inventory.html' : '/supplier-portal/dashboard.html')
          : '/buyer-portal/';
        const safe = String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        slot.innerHTML = `
          <div class="ap-account ap-account--portal" data-ap-account>
            <button type="button" class="ap-account__toggle ap-account__toggle--portal" aria-expanded="false" aria-haspopup="true">
              <span class="ap-account__name">${safe}</span>
              <span class="ap-account__caret" aria-hidden="true">▾</span>
            </button>
            <div class="ap-account__menu" hidden role="menu">
              <a href="${portal}" role="menuitem">工作台</a>
              <button type="button" data-ap-logout role="menuitem">退出</button>
            </div>
          </div>`;
        const wrap = slot.querySelector('[data-ap-account]');
        const toggle = wrap?.querySelector('.ap-account__toggle');
        const menu = wrap?.querySelector('.ap-account__menu');
        toggle?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const open = menu.hasAttribute('hidden');
          if (open) {
            menu.removeAttribute('hidden');
            toggle.setAttribute('aria-expanded', 'true');
          } else {
            menu.setAttribute('hidden', '');
            toggle.setAttribute('aria-expanded', 'false');
          }
        });
        wrap?.querySelector('[data-ap-logout]')?.addEventListener('click', async () => {
          await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
          location.reload();
        });
      })
      .catch(() => {});
  }

  window.AsiaPowerV4PortalShell = { mount };
})();
