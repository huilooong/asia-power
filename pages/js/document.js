/**
 * AsiaPower — Print document helpers (quotation & contract templates)
 */
(function () {
  'use strict';

  const SELLER_DEFAULTS = {
    legalName: 'BSB Motors',
    brandLine: 'AsiaPower · asia-power.com',
    address: 'South Third Ring Road & Shangdu Road, Zhengzhou, Henan, China',
    email: '',
    phone: '',
    website: 'https://asia-power.com',
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function docNumber(prefix) {
    const d = new Date();
    return `${prefix}${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function money(n) {
    const v = Number.parseFloat(String(n).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseMoney(el) {
    if (!el) return 0;
    return Number.parseFloat(String(el.textContent).replace(/[^0-9.-]/g, '')) || 0;
  }

  function applySellerFromConfig() {
    const c = window.ASIAPOWER;
    if (!c) return;

    SELLER_DEFAULTS.email = c.email || SELLER_DEFAULTS.email;
    SELLER_DEFAULTS.website = c.siteUrl || SELLER_DEFAULTS.website;
    SELLER_DEFAULTS.legalName = c.legalName || SELLER_DEFAULTS.legalName;
    if (c.company && c.siteUrl) {
      SELLER_DEFAULTS.brandLine = `${c.company} · ${c.siteUrl.replace(/^https?:\/\//, '')}`;
    }

    document.querySelectorAll('[data-seller-name]').forEach(el => {
      if (!el.textContent.trim()) el.textContent = SELLER_DEFAULTS.legalName;
    });
    document.querySelectorAll('[data-brand-line]').forEach(el => {
      if (!el.textContent.trim()) el.textContent = SELLER_DEFAULTS.brandLine;
    });
    document.querySelectorAll('[data-seller-email]').forEach(el => {
      if (!el.textContent.trim()) el.textContent = SELLER_DEFAULTS.email;
    });
    document.querySelectorAll('[data-seller-phone]').forEach(el => {
      if (!el.textContent.trim()) el.textContent = SELLER_DEFAULTS.phone;
    });
  }

  function fillIfEmpty(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(el => {
      if (!el.textContent.trim()) el.textContent = value;
    });
  }

  function applyBankFromConfig() {
    const b = window.ASIAPOWER?.bankDetails;
    if (!b) return;

    const accountName = b.accountNameLocal
      ? `${b.accountName} (${b.accountNameLocal})`
      : b.accountName;

    fillIfEmpty('[data-bank-name]', b.bankName);
    fillIfEmpty('[data-bank-address]', b.bankAddress);
    fillIfEmpty('[data-account-name]', accountName);
    fillIfEmpty('[data-account-no]', b.accountNumber);
    fillIfEmpty('[data-routing]', b.routingNumber);
    fillIfEmpty('[data-swift]', b.swift);
    fillIfEmpty('[data-bank-currency]', b.currency);
  }

  function initMeta(options) {
    const { prefix, validDays = 15 } = options;

    const dateEl = document.querySelector('[data-doc-date]');
    const validEl = document.querySelector('[data-doc-valid]');
    const noEl = document.querySelector('[data-doc-no]');

    if (dateEl && !dateEl.textContent.trim()) dateEl.textContent = todayISO();
    if (validEl && !validEl.textContent.trim()) validEl.textContent = addDaysISO(validDays);
    if (noEl && !noEl.textContent.trim()) noEl.textContent = docNumber(prefix);
  }

  function bindLineItems(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const tfoot = table.querySelector('tfoot');

    function recalc() {
      let subtotal = 0;
      tbody.querySelectorAll('tr').forEach(row => {
        const qty = parseMoney(row.querySelector('[data-qty]'));
        const unit = parseMoney(row.querySelector('[data-unit]'));
        const amountEl = row.querySelector('[data-amount]');
        const amount = qty * unit;
        if (amountEl) amountEl.textContent = amount ? money(amount) : '';
        subtotal += amount;
      });

      const freightEl = tfoot?.querySelector('[data-freight]');
      const freight = parseMoney(freightEl);
      const subEl = tfoot?.querySelector('[data-subtotal]');
      const totalEl = tfoot?.querySelector('[data-total]');

      if (subEl) subEl.textContent = money(subtotal);
      if (totalEl) totalEl.textContent = money(subtotal + freight);
    }

    function wireRow(row) {
      row.querySelectorAll('[data-qty], [data-unit]').forEach(el => {
        el.addEventListener('input', recalc);
        el.addEventListener('blur', recalc);
      });
      const removeBtn = row.querySelector('.doc-row-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          if (tbody.querySelectorAll('tr').length > 1) {
            row.remove();
            renumber(tbody);
            recalc();
          }
        });
      }
    }

    function renumber(tbodyEl) {
      tbodyEl.querySelectorAll('tr').forEach((row, i) => {
        const num = row.querySelector('[data-line-no]');
        if (num) num.textContent = String(i + 1);
      });
    }

    tbody.querySelectorAll('tr').forEach(wireRow);

    tfoot?.querySelector('[data-freight]')?.addEventListener('input', recalc);
    tfoot?.querySelector('[data-freight]')?.addEventListener('blur', recalc);

    recalc();

    return {
      addRow() {
        const last = tbody.querySelector('tr:last-child');
        if (!last) return;
        const clone = last.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(el => { el.textContent = ''; });
        const amount = clone.querySelector('[data-amount]');
        if (amount) amount.textContent = '';
        tbody.appendChild(clone);
        renumber(tbody);
        wireRow(clone);
        recalc();
      },
      recalc,
    };
  }

  function bindToolbar(handlers) {
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-add-row')?.addEventListener('click', handlers.addRow);
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (window.confirm('Clear all editable fields and reset document numbers?')) {
        location.reload();
      }
    });
  }

  window.AsiaPowerDoc = {
    initQuote() {
      applySellerFromConfig();
      applyBankFromConfig();
      initMeta({ prefix: 'QT-', validDays: 15 });
      const items = bindLineItems('quote-items');
      bindToolbar({ addRow: () => items?.addRow() });
    },
    initContract() {
      applySellerFromConfig();
      applyBankFromConfig();
      initMeta({ prefix: 'SC-', validDays: 0 });
      const items = bindLineItems('contract-items');
      bindToolbar({ addRow: () => items?.addRow() });
    },
    money,
    todayISO,
    docNumber,
  };
})();
