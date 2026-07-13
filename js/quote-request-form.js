/**
 * AsiaPower — structured quote request form (contact page)
 */
(function () {
  'use strict';

  const PORT_MAP = {
    Ghana: 'Tema',
    Nigeria: 'Apapa / Lagos',
    Kenya: 'Mombasa',
    Tanzania: 'Dar es Salaam',
    Uganda: 'Mombasa transit',
    Ethiopia: 'Djibouti transit',
    'South Africa': 'Durban',
    Zambia: 'Dar es Salaam transit',
    Zimbabwe: 'Beira transit',
    Mozambique: 'Maputo',
    UAE: 'Jebel Ali',
    'Saudi Arabia': 'Jeddah',
    Jordan: 'Aqaba',
    Iraq: 'Umm Qasr',
    Philippines: 'Manila',
    Malaysia: 'Port Klang',
    Indonesia: 'Jakarta',
    Thailand: 'Laem Chabang',
  };

  const CATEGORY_MAP = {
    'truck-heads': { enquiryType: 'truck-head', label: 'Truck Heads / Cabs', panel: 'truck-heads' },
    engines: { enquiryType: 'engine', label: 'Engines', panel: 'engines' },
    gearboxes: { enquiryType: 'gearbox', label: 'Gearboxes', panel: 'gearboxes' },
    'truck-parts': { enquiryType: 'truck-parts', label: 'Truck Parts', panel: 'truck-parts' },
    'half-cuts': { enquiryType: 'half-cut', label: 'Half-cuts', panel: 'half-cuts' },
    chassis: { enquiryType: 'chassis', label: 'Chassis Parts', panel: 'chassis' },
  };

  /** Labels included in every WhatsApp / copy / preview message (acceptance checklist). */
  const WA_MESSAGE_FIELDS = [
    'Category',
    'Requirement',
    'Brand',
    'Model',
    'Year',
    'Engine code',
    'Chassis / VIN',
    'Cab or drive spec',
    'Quantity',
    'Destination country',
    'Destination port',
    'Shipping type',
    'FOB/CIF',
    'Buyer name',
    'Company',
    'WhatsApp',
    'Email',
    'Buyer type',
    'Proof requested',
    'Notes',
  ];

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function waNumber() {
    return String(window.ASIAPOWER?.whatsapp || '8616638801930').replace(/\D/g, '');
  }

  function field(form, id) {
    const el = form.querySelector(`#${id}`) || form.querySelector(`[name="${id}"]`);
    return el?.value?.trim?.() || '';
  }

  function optionText(form, name) {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return '';
    const selected = el.options?.[el.selectedIndex];
    return selected?.text?.trim() || el.value?.trim() || '';
  }

  function phoneE164(form) {
    const raw = form.querySelector('[name="phone"]')?.value || '';
    if (window.AsiaPhone?.toE164) return window.AsiaPhone.toE164(raw);
    const digits = String(raw).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  function countryName(form) {
    return optionText(form, 'country') || field(form, 'country');
  }

  function brandName(form) {
    return field(form, 'brand') || field(form, 'quote-brand');
  }

  function valOrTbc(value) {
    const v = String(value || '').trim();
    return v || 'TBC';
  }

  function notesText(form) {
    const notes = field(form, 'message') || field(form, 'notes');
    return notes || 'None';
  }

  function radio(form, name) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
  }

  function checkedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((i) => i.value);
  }

  function selectedCategory(form) {
    const card = form.querySelector('.quote-cat.selected');
    return card?.dataset?.cat || 'truck-heads';
  }

  function categoryLabel(form) {
    const meta = CATEGORY_MAP[selectedCategory(form)];
    return meta?.label || '';
  }

  function requirementDetail(form) {
    const cat = selectedCategory(form);
    if (cat === 'truck-heads') return radio(form, 'truck_req');
    if (cat === 'engines') return radio(form, 'engine_pref');
    if (cat === 'gearboxes') return radio(form, 'gearbox_type');
    if (cat === 'truck-parts') return radio(form, 'truck_part_req');
    if (cat === 'half-cuts') return radio(form, 'halfcut_req');
    if (cat === 'chassis') return radio(form, 'chassis_req');
    return '';
  }

  function buildBrandOptions(form) {
    const select = form.querySelector('#quote-brand');
    if (!select) return;
    const cat = selectedCategory(form);
    const truckish = cat === 'truck-heads' || cat === 'truck-parts';
    const groups = [];
    if (truckish && window.TruckBrandCatalog?.getBrandOptionGroups) {
      const g = window.TruckBrandCatalog.getBrandOptionGroups();
      if (g.china?.length) groups.push({ label: 'China · 中国', brands: g.china });
      if (g.japan?.length) groups.push({ label: 'Japan · 日本', brands: g.japan });
      if (g.korea?.length) groups.push({ label: 'Korea · 韩国', brands: g.korea });
      if (g.europe?.length) groups.push({ label: 'Europe · 欧洲', brands: g.europe });
      if (g.asia?.length) groups.push({ label: 'Asia · 亚洲', brands: g.asia });
      if (g.other?.length) groups.push({ label: 'Other', brands: g.other });
    } else if (window.VehicleCatalog?.getBrands) {
      groups.push({ label: 'Passenger & SUV', brands: window.VehicleCatalog.getBrands().map((b) => b.name) });
      if (window.TruckBrandCatalog?.getBrands) {
        groups.push({ label: 'Commercial', brands: window.TruckBrandCatalog.getBrands().map((b) => b.name) });
      }
    }
    const current = select.value;
    select.innerHTML = `<option value="">${t('quote.selectBrand', 'Select brand')}</option>`;
    groups.forEach(({ label, brands }) => {
      const og = document.createElement('optgroup');
      og.label = label;
      [...new Set(brands)].forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        og.appendChild(opt);
      });
      if (og.children.length) select.appendChild(og);
    });
    const other = document.createElement('option');
    other.value = 'Other';
    other.textContent = t('quote.otherBrand', 'Other');
    select.appendChild(other);
    if (current) select.value = current;
  }

  function syncEnquiryType(form) {
    const hidden = form.querySelector('[name="enquiry_type"]');
    if (!hidden) return;
    hidden.value = CATEGORY_MAP[selectedCategory(form)]?.enquiryType || 'truck-head';
  }

  function buildVehicleDetails(form) {
    const lines = [
      `Category: ${categoryLabel(form)}`,
      `Requirement: ${valOrTbc(requirementDetail(form))}`,
      `Brand: ${valOrTbc(brandName(form))}`,
      `Model: ${valOrTbc(field(form, 'model'))}`,
      `Year: ${valOrTbc(field(form, 'year'))}`,
      `Engine code: ${valOrTbc(field(form, 'engine_code'))}`,
      `Chassis / VIN: ${valOrTbc(field(form, 'chassis'))}`,
      `Cab or drive spec: ${valOrTbc(field(form, 'spec'))}`,
      `Quantity: ${valOrTbc(field(form, 'qty'))}`,
    ];
    return lines.join('\n');
  }

  function syncHiddenFields(form) {
    syncEnquiryType(form);
    const vd = form.querySelector('[name="vehicle_details"]');
    if (vd) vd.value = buildVehicleDetails(form);
  }

  function buildMessage(form, leadId) {
    const lines = [
      'Hello AsiaPower, I would like a quotation.',
      '',
      `Category: ${valOrTbc(categoryLabel(form))}`,
      `Requirement: ${valOrTbc(requirementDetail(form))}`,
      `Brand: ${valOrTbc(brandName(form))}`,
      `Model: ${valOrTbc(field(form, 'model'))}`,
      `Year: ${valOrTbc(field(form, 'year'))}`,
      `Engine code: ${valOrTbc(field(form, 'engine_code'))}`,
      `Chassis / VIN: ${valOrTbc(field(form, 'chassis'))}`,
      `Cab or drive spec: ${valOrTbc(field(form, 'spec'))}`,
      '',
      `Quantity: ${valOrTbc(field(form, 'qty'))}`,
      `Destination country: ${valOrTbc(countryName(form))}`,
      `Destination port: ${valOrTbc(field(form, 'port'))}`,
      `Shipping type: ${valOrTbc(radio(form, 'shipping'))}`,
      `FOB/CIF: ${valOrTbc(radio(form, 'terms'))}`,
      '',
      `Buyer name: ${valOrTbc(field(form, 'name'))}`,
      `Company: ${valOrTbc(field(form, 'company'))}`,
      `WhatsApp: ${valOrTbc(phoneE164(form))}`,
      `Email: ${valOrTbc(field(form, 'email'))}`,
      `Buyer type: ${valOrTbc(radio(form, 'buyer_type'))}`,
      '',
      `Proof requested: ${checkedValues(form, 'proof').join(', ') || 'TBC'}`,
      `Notes: ${notesText(form)}`,
      '',
      ...(window.AsiaPowerTrustCopy?.lines?.() || [
        window.ASIAPOWER?.trustCopy?.startupVideo || 'Whole-vehicle startup video available before dismantling.',
        window.ASIAPOWER?.trustCopy?.buyerDismantle || 'Parts can be dismantled according to buyer requirements after confirmation.',
      ]),
    ];
    if (leadId) lines.push('', `Reference: ${leadId}`);
    return lines.join('\n');
  }

  function buildLeadExtras(form) {
    const proofs = checkedValues(form, 'proof');
    const logistics = [
      radio(form, 'shipping') ? `Shipping type: ${radio(form, 'shipping')}` : '',
      radio(form, 'terms') ? `FOB/CIF: ${radio(form, 'terms')}` : '',
      field(form, 'port') ? `Destination port: ${field(form, 'port')}` : '',
      radio(form, 'buyer_type') ? `Buyer type: ${radio(form, 'buyer_type')}` : '',
      proofs.length ? `Proof requested: ${proofs.join(', ')}` : '',
    ].filter(Boolean);
    const buyerNotes = field(form, 'message');
    const structured = [buyerNotes, logistics.join(' · ')].filter(Boolean).join('\n\n');
    return {
      brand: brandName(form),
      model: field(form, 'model'),
      engine_code: field(form, 'engine_code'),
      vehicle_details: buildVehicleDetails(form),
      message: structured,
      whatsapp_message: buildMessage(form),
    };
  }

  function updateTermsHint(form) {
    const terms = radio(form, 'terms');
    const hint = form.querySelector('#quote-terms-hint');
    if (!hint) return;
    if (terms === 'CIF') {
      hint.textContent = t(
        'quote.cifHint',
        'CIF quotation includes ocean freight and insurance to your destination port. Destination customs, taxes and local port charges are quoted separately unless stated.',
      );
      hint.hidden = false;
    } else if (terms === 'Both FOB and CIF') {
      hint.textContent = t(
        'quote.cifBothHint',
        'We can quote FOB (China port of loading) and CIF (freight + insurance to your destination port). Destination customs and local charges are quoted separately.',
      );
      hint.hidden = false;
    } else if (terms === 'FOB') {
      hint.textContent = t(
        'quote.fobHint',
        'FOB covers goods to port of loading in China. Ocean freight and insurance can be quoted separately if needed.',
      );
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function updateShipHint(form) {
    const qty = parseInt(field(form, 'qty'), 10) || 0;
    const country = countryName(form);
    const port = form.querySelector('#quote-port, [name="port"]');
    const hint = form.querySelector('#quote-ship-hint');
    if (port && PORT_MAP[country] && !port.value) port.placeholder = PORT_MAP[country];
    if (!hint) return;
    if (qty >= 60) hint.textContent = t('quote.shipContainer', 'Likely container shipment. We can quote FOB and CIF.');
    else if (qty >= 10) hint.textContent = t('quote.shipMixed', 'LCL or small container plan depends on product mix.');
    else hint.textContent = t('quote.shipLcl', 'LCL available from 1 unit.');
  }

  function selectCategory(form, card) {
    form.querySelectorAll('.quote-cat').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    const cat = card.dataset.cat;
    form.querySelectorAll('.quote-panel').forEach((p) => p.classList.remove('active'));
    const panel = form.querySelector(`#quote-panel-${cat}`);
    if (panel) panel.classList.add('active');
    syncEnquiryType(form);
    buildBrandOptions(form);
    updateShipHint(form);
    updateTermsHint(form);
  }

  function prefillFromUrl(form) {
    const params = new URLSearchParams(window.location.search);
    const brand = params.get('brand');
    const product = params.get('product');
    if (product) {
      const p = product.toLowerCase();
      let cat = 'engines';
      if (p.includes('gearbox') || p.includes('transmission')) cat = 'gearboxes';
      else if (p.includes('truck-part')) cat = 'truck-parts';
      else if (p.includes('half-cut') || p.includes('halfcut')) cat = 'half-cuts';
      else if (p.includes('chassis')) cat = 'chassis';
      else if (p.includes('truck') || p.includes('cab') || p.includes('howo') || p.includes('hino')) cat = 'truck-heads';
      const card = form.querySelector(`.quote-cat[data-cat="${cat}"]`);
      if (card) selectCategory(form, card);
    }
    const brandSelect = form.querySelector('#quote-brand');
    if (brand && brandSelect) {
      const slug = brand.toLowerCase();
      [...brandSelect.options].forEach((opt) => {
        if (opt.value && opt.value.toLowerCase().replace(/\s+/g, '-') === slug) brandSelect.value = opt.value;
      });
      if (!brandSelect.value && brand) brandSelect.value = brand.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const modelField = form.querySelector('[name="model"]');
    if (product && modelField && !modelField.value) modelField.value = product;
  }

  function bind(form) {
    if (!form || form.dataset.quoteBound) return;
    form.dataset.quoteBound = '1';

    form.querySelectorAll('.quote-cat').forEach((card) => {
      card.addEventListener('click', () => selectCategory(form, card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCategory(form, card);
        }
      });
    });

    form.querySelector('#quote-preview-btn')?.addEventListener('click', () => {
      syncHiddenFields(form);
      const preview = form.querySelector('#quote-preview');
      if (!preview) return;
      preview.textContent = buildMessage(form);
      preview.hidden = false;
    });

    form.querySelector('#quote-copy-btn')?.addEventListener('click', async () => {
      syncHiddenFields(form);
      const msg = buildMessage(form);
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(msg);
      } catch (_) { /* ignore */ }
      const preview = form.querySelector('#quote-preview');
      if (preview) {
        preview.textContent = msg;
        preview.hidden = false;
      }
      window.SiteFeedback?.toast?.(t('quote.copied', 'Details copied to clipboard.'), 'success');
    });

    ['qty', 'country'].forEach((name) => {
      form.querySelector(`[name="${name}"]`)?.addEventListener('input', () => updateShipHint(form));
      form.querySelector(`[name="${name}"]`)?.addEventListener('change', () => updateShipHint(form));
    });

    form.querySelectorAll('input[name="terms"]').forEach((input) => {
      input.addEventListener('change', () => updateTermsHint(form));
    });

    const brandSelect = form.querySelector('#quote-brand');
    if (brandSelect) {
      brandSelect.id = 'quote-brand';
      brandSelect.name = 'brand';
    }

    buildBrandOptions(form);
    syncEnquiryType(form);
    prefillFromUrl(form);
    updateShipHint(form);
    updateTermsHint(form);
  }

  function init() {
    document.querySelectorAll('form[data-form="contact-enquiry"]').forEach(bind);
  }

  window.QuoteRequestForm = {
    bind,
    buildMessage,
    buildVehicleDetails,
    buildLeadExtras,
    categoryLabel,
    selectedCategory,
    prefillFromUrl,
    syncHiddenFields,
    WA_MESSAGE_FIELDS,
    init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
