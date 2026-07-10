/**
 * AsiaPower — CIF calculator (detail sidebar)
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function formatUsd(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function cargoForItem(item) {
    if (item?.vehicleCategory === 'truck') return 'truck';
    if (item?.vehicleCategory === 'machinery') return 'machinery';
    return 'halfcut';
  }

  function renderDetailPanel(opts) {
    const exwUsd = opts?.exwUsd;
    const hasExw = Number.isFinite(Number(exwUsd)) && Number(exwUsd) > 0;
    const exwValue = hasExw ? Number(exwUsd) : '';

    return `<section class="hc-cif-calc" data-cif-calculator aria-labelledby="hc-cif-heading">
      <h3 class="hc-cif-calc__title" id="hc-cif-heading">${t('hc.cifCalculator', 'CIF Calculator')}</h3>
      <p class="hc-cif-calc__notice" role="note">
        <strong class="hc-cif-calc__notice-badge">${t('hc.cifDisclaimerBadge', 'Reference only')}</strong>
        <span>${t('hc.cifDisclaimer', 'For reference only. Actual price is based on the freight forwarder’s real quote at purchase. Destination duties & local port charges not included.')}</span>
      </p>
      <p class="hc-cif-calc__lead">${t('hc.cifCalculatorLead', 'Quick estimate of ocean freight & marine insurance to your port.')}</p>
      <form class="hc-cif-calc__form" data-cif-form novalidate>
        <label class="hc-cif-calc__field">
          <span>${t('hc.cifDestPort', 'Destination port')}</span>
          <select name="portId" data-cif-port required>
            <option value="">${t('hc.cifLoadingPorts', 'Loading ports…')}</option>
          </select>
        </label>
        <label class="hc-cif-calc__field">
          <span>${t('hc.cifExwUnit', 'EXW (this unit)')}</span>
          <div class="hc-cif-calc__exw-row">
            <span class="hc-cif-calc__currency">USD</span>
            <input type="number" name="exwUsd" data-cif-exw min="0" step="50"
              value="${hasExw ? exwValue : ''}"
              placeholder="${t('hc.cifExwPlaceholder', 'Enter EXW quote')}"
              ${hasExw ? 'readonly' : ''}>
          </div>
        </label>
        <div class="hc-cif-calc__results" data-cif-results hidden>
          <dl class="hc-cif-calc__breakdown">
            <div><dt>${t('hc.cifOceanFreight', 'Ocean freight')}</dt><dd data-cif-freight>—</dd></div>
            <div><dt>${t('hc.cifInsurance', 'Marine insurance')}</dt><dd data-cif-insurance>—</dd></div>
          </dl>
          <div class="hc-cif-calc__total">
            <span>${t('hc.cifTotal', 'Est. CIF total')}</span>
            <strong data-cif-total>—</strong>
          </div>
          <p class="hc-cif-calc__note" data-cif-note></p>
          <p class="hc-cif-calc__disclaimer hc-cif-calc__disclaimer--result">${t('hc.cifDisclaimer', 'For reference only. Actual price is based on the freight forwarder’s real quote at purchase. Destination duties & local port charges not included.')}</p>
        </div>
        <p class="hc-cif-calc__status" data-cif-status aria-live="polite"></p>
      </form>
    </section>`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }

  async function loadPorts(cargo) {
    const data = await fetchJson(`/api/shipping/ports?cargo=${encodeURIComponent(cargo)}`);
    return Array.isArray(data.ports) ? data.ports : [];
  }

  async function loadGeoHint() {
    try {
      return await fetchJson('/api/shipping/geo-hint');
    } catch {
      return null;
    }
  }

  async function loadEstimate(portId, cargo, exwUsd) {
    const params = new URLSearchParams({
      portId,
      cargo,
      exwUsd: String(Math.max(0, Number(exwUsd) || 0)),
    });
    return fetchJson(`/api/shipping/cif-estimate?${params.toString()}`);
  }

  function setStatus(root, message, tone) {
    const el = root.querySelector('[data-cif-status]');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.tone = tone || '';
  }

  function renderEstimate(root, estimate) {
    const results = root.querySelector('[data-cif-results]');
    if (!results) return;
    results.hidden = false;
    const freightEl = root.querySelector('[data-cif-freight]');
    const insuranceEl = root.querySelector('[data-cif-insurance]');
    const totalEl = root.querySelector('[data-cif-total]');
    const noteEl = root.querySelector('[data-cif-note]');
    if (freightEl) freightEl.textContent = formatUsd(estimate.freightUsd);
    if (insuranceEl) insuranceEl.textContent = formatUsd(estimate.insuranceUsd);
    if (totalEl) totalEl.textContent = formatUsd(estimate.cifUsd);
    if (noteEl) {
      const port = estimate.port;
      noteEl.textContent = port
        ? `${t('hc.cifToPort', 'To')} ${port.port}, ${port.country} · ${t('hc.cifFromChina', 'from China')}`
        : '';
    }
    setStatus(root, '', '');
  }

  function populatePortSelect(select, ports, selectedId) {
    if (!select) return;
    const placeholder = t('hc.cifSelectPort', 'Select destination port');
    select.innerHTML = `<option value="">${placeholder}</option>`;
    ports.forEach((port) => {
      const opt = document.createElement('option');
      opt.value = port.id;
      opt.textContent = `${port.port}, ${port.country}`;
      if (port.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  async function refreshEstimate(section) {
    const form = section.querySelector('[data-cif-form]');
    if (!form) return;
    const portId = form.portId?.value;
    const exwUsd = form.exwUsd?.value;
    const cargo = section.dataset.cifCargo || 'halfcut';

    if (!portId) {
      section.querySelector('[data-cif-results]')?.setAttribute('hidden', '');
      setStatus(section, '');
      return;
    }

    const exwNum = Number(exwUsd);
    if (!Number.isFinite(exwNum) || exwNum <= 0) {
      section.querySelector('[data-cif-results]')?.setAttribute('hidden', '');
      setStatus(section, t('hc.cifNeedExw', 'Enter EXW price to calculate CIF.'), 'warn');
      return;
    }

    setStatus(section, t('hc.cifFetching', 'Fetching freight & insurance…'), 'loading');
    try {
      const estimate = await loadEstimate(portId, cargo, exwNum);
      renderEstimate(section, estimate);
    } catch (err) {
      section.querySelector('[data-cif-results]')?.setAttribute('hidden', '');
      setStatus(section, err.message || t('hc.cifFetchFailed', 'Could not load rates. Try again or contact us.'), 'error');
    }
  }

  function bindDetailPanel(root, opts) {
    const section = root.querySelector('[data-cif-calculator]');
    if (!section || section.dataset.cifBound) return;
    section.dataset.cifBound = '1';

    const cargo = opts?.cargo || cargoForItem(opts?.item);
    section.dataset.cifCargo = cargo;

    const form = section.querySelector('[data-cif-form]');
    const portSelect = section.querySelector('[data-cif-port]');
    const exwInput = section.querySelector('[data-cif-exw]');

    (async () => {
      try {
        const [ports, geo] = await Promise.all([
          loadPorts(cargo),
          loadGeoHint(),
        ]);
        const suggested = geo?.suggestedPortId || ports[0]?.id || '';
        populatePortSelect(portSelect, ports, suggested);
        if (geo?.country && suggested) {
          setStatus(section, t('hc.cifDetected', 'Suggested port for {country}').replace('{country}', geo.country), 'hint');
        }
        await refreshEstimate(section);
      } catch (err) {
        populatePortSelect(portSelect, [], '');
        setStatus(section, t('hc.cifFetchFailed', 'Could not load rates. Try again or contact us.'), 'error');
      }
    })();

    portSelect?.addEventListener('change', () => { refreshEstimate(section); });
    exwInput?.addEventListener('input', () => { refreshEstimate(section); });
    exwInput?.addEventListener('change', () => { refreshEstimate(section); });
  }

  window.AsiaPowerCifCalculator = {
    renderDetailPanel,
    bindDetailPanel,
    cargoForItem,
  };
})();
