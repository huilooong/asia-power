/**
 * AsiaPower — Half-cut enquiry lead capture
 */
(function () {
  'use strict';

  const ADS_CONVERSION_ID = 'AW-4801206293';
  const ADS_GENERATE_LEAD_LABEL = '';
  const ADS_GENERATE_LEAD_SEND_TO = ADS_GENERATE_LEAD_LABEL
    ? `${ADS_CONVERSION_ID}/${ADS_GENERATE_LEAD_LABEL}`
    : '';

  if (window.__HALF_CUT_LEADS_INIT__) return;
  window.__HALF_CUT_LEADS_INIT__ = true;

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function ensureStatusBar() {
    let el = document.getElementById('half-cut-lead-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'half-cut-lead-status';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'assertive');
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function showHalfCutStatus(options) {
    const opts = options || {};
    const type = opts.type || 'info';
    const text = [opts.title, opts.message, opts.details].filter(Boolean).join(' — ').trim();
    const el = ensureStatusBar();

    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'half-cut-lead-status';
      return;
    }

    el.hidden = false;
    el.className = `half-cut-lead-status half-cut-lead-status--${type}`;
    el.textContent = text;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (window.SiteFeedback?.toast) {
      window.SiteFeedback.toast(text, type);
    }
  }

  function presentHalfCutFeedback(options) {
    showHalfCutStatus(options);

    if (window.SiteFeedback?.modal) {
      window.SiteFeedback.modal(options);
    } else if (window.SiteFeedback?.notify) {
      window.SiteFeedback.notify(options);
    } else if (typeof window.showFeedbackModal === 'function') {
      window.showFeedbackModal(options);
    }

    if (options?.type === 'success' || options?.type === 'error') {
      const alertText = [options.title, options.message, options.details].filter(Boolean).join('\n');
      if (alertText) window.alert(alertText);
    }
  }

  function resolveLeadItem(slug) {
    if (!slug) return null;

    const fromCatalog = window.getHalfCutBySlug?.(slug);
    if (fromCatalog) return fromCatalog;

    const prerender = window.__HALF_CUT_PRERENDER_ITEM__;
    if (prerender && (prerender.slug === slug || (prerender.slugAliases || []).includes(slug))) {
      return prerender;
    }

    const fromStore = window.HalfCutInventoryStore?.getPublicItemBySlug?.(slug);
    if (fromStore) return fromStore;

    const stockMatch = String(slug).match(/(hc\d+)/i);
    if (stockMatch) {
      const stockId = stockMatch[0].toUpperCase();
      const list = window.HALF_CUT_LIST || [];
      const match = list.find((entry) => String(entry.stockId || '').toUpperCase() === stockId);
      if (match) return window.getHalfCutBySlug?.(match.slug) || match;
    }

    return null;
  }

  function partTypeLabel(partType) {
    if (!partType) return '';
    const key = `parts.partType.${partType}`;
    const fallbacks = {
      engine: 'Engine',
      transmission: 'Gearbox',
      chassis: 'Chassis part',
      front: 'Front cut',
    };
    return t(key, fallbacks[partType] || 'Part');
  }

  function messageForIntent(item, intent, partType) {
    const u = window.HalfCutUtils;
    if (!u || !item) return 'Hello AsiaPower, I would like to enquire about a half-cut listing.';
    if (partType) {
      const label = partTypeLabel(partType);
      const stock = item.stockId || item.slug || 'listing';
      const vehicle = [item.year, item.brand, item.model].filter(Boolean).join(' ');
      const priceLine = u.exwPriceLine?.(item, { prefix: 'EXW Price' })
        || (u.formatFobPrice?.(item) ? `EXW Price: ${u.formatFobPrice(item)} USD` : 'EXW Price: on enquiry');
      const listingLine = u.listingSharePageUrl?.(item) ? `Listing: ${u.listingSharePageUrl(item)}` : '';
      return [
        `Hello AsiaPower, I would like a ${label} enquiry for ${stock}${vehicle ? ` (${vehicle})` : ''}.`,
        priceLine,
        listingLine,
      ].filter(Boolean).join('\n');
    }
    if (intent === 'photos') return u.photosMessage(item);
    if (intent === 'similar') return u.similarUnitMessage(item);
    if (intent === 'availability') return u.whatsappMessage(item);
    return u.whatsappMessage(item);
  }

  function buildPayload(item, intent, contact, partType) {
    const partLabel = partTypeLabel(partType);
    const leadMeta = window.AsiaLeadContext?.captureLeadMeta?.({
      brand: item.brandSlug || item.brand,
      product: item.engineCode || item.model,
      enquiry_type: partType ? 'parts' : 'half-cut',
      source: partType ? `parts-${partType}` : 'half-cut',
    }) || {
      pageUrl: `${window.location.pathname}${window.location.search}`,
      page: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || '',
    };
    return {
      slug: item.slug,
      stockId: item.stockId,
      intent,
      partType: partType || '',
      partTypeLabel: partLabel,
      brand: item.brand,
      model: item.model,
      product: item.engineCode || item.model,
      productLabel: leadMeta.productLabel || '',
      inquirySubject: partType
        ? `${partLabel} enquiry — ${item.stockId || item.slug}`
        : (leadMeta.inquirySubject || ''),
      replySubject: leadMeta.replySubject || '',
      engineCode: item.engineCode,
      transmissionCode: item.transmissionCode,
      listingStatus: item.status,
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      country: contact?.country || '',
      pageUrl: leadMeta.pageUrl,
      page: leadMeta.page || leadMeta.pageUrl,
      referrer: leadMeta.referrer || '',
      utm_source: leadMeta.utm_source || '',
      utm_medium: leadMeta.utm_medium || '',
      utm_campaign: leadMeta.utm_campaign || '',
      utm_content: leadMeta.utm_content || '',
      utm_term: leadMeta.utm_term || '',
    };
  }

  function trackHalfCutLeadEvent(eventName, params = {}) {
    if (typeof window.gtag !== 'function') return;
    const utm = window.AsiaLeadContext?.captureUtm?.() || window.AsiaPowerUtm?.forLead?.() || {};
    const eventParams = {
      currency: 'USD',
      value: eventName === 'generate_lead' ? 1 : 0,
      event_category: 'lead',
      lead_source: params.method || params.lead_source || 'half_cut',
      page_location: window.location.href,
      page_path: window.location.pathname,
      ...utm,
      ...params,
    };

    if (!window.__ASIAPOWER_GOOGLE_ADS_CONFIGURED__) {
      window.gtag('config', ADS_CONVERSION_ID);
      window.__ASIAPOWER_GOOGLE_ADS_CONFIGURED__ = true;
    }

    window.gtag('event', eventName, eventParams);
    if (eventName === 'generate_lead' && ADS_GENERATE_LEAD_SEND_TO) {
      window.gtag('event', 'conversion', {
        ...eventParams,
        send_to: ADS_GENERATE_LEAD_SEND_TO,
      });
    }
  }

  async function saveHalfCutLead(item, intent, contact, partType) {
    const res = await fetch('/api/leads/half-cut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(item, intent, contact, partType)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save enquiry');
    return data;
  }

  async function promptContact() {
    if (window.SiteFeedback?.promptContact) {
      return window.SiteFeedback.promptContact();
    }
    const phone = window.prompt(t('leadContact.phoneRequired', 'Phone number is required. Include country code, e.g. +234 801 234 5678.'));
    if (!phone || !phone.trim()) return null;
    return { name: '', phone: phone.trim(), email: '', country: '' };
  }

  function openWhatsAppWithReference(href, leadId) {
    try {
      const url = new URL(href, window.location.origin);
      if (!leadId) {
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
        return;
      }
      const text = url.searchParams.get('text') || '';
      const refLine = text.includes(leadId) ? '' : `\n\nReference: ${leadId}`;
      if (refLine) url.searchParams.set('text', `${text}${refLine}`);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleWhatsAppLeadClick(event) {
    const link = event.target.closest('[data-half-cut-wa]');
    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      if (!window.SiteFeedback?.promptContact) {
        openWhatsAppWithReference(link.href, null);
        return;
      }

      const slug = link.dataset.slug;
      const intent = link.dataset.intent || 'whatsapp';
      const item = resolveLeadItem(slug);
      if (!item) {
        openWhatsAppWithReference(link.href, null);
        return;
      }

      const contact = await window.SiteFeedback.promptContact({
        message: t('leadContact.whatsappSaveHint', 'We will save your enquiry before opening WhatsApp.'),
      });
      if (!contact) {
        showHalfCutStatus({ type: 'info', title: '', message: '' });
        return;
      }

      showHalfCutStatus({
        type: 'info',
        title: t('feedback.saving', 'Saving enquiry…'),
        message: t('feedback.savingMsg', 'Please wait while we submit your enquiry.'),
      });

      let leadId = null;
      let saveError = null;
      try {
        const saved = await saveHalfCutLead(item, intent, contact);
        leadId = saved?.id || null;
      } catch (err) {
        saveError = err;
        console.warn('[half-cut-lead]', err);
      }

      if (leadId) {
        presentHalfCutFeedback({
          type: 'success',
          title: t('feedback.halfCutSaved', 'Enquiry recorded'),
          message: t('feedback.whatsappOpening', 'Opening WhatsApp…'),
          details: `Reference: ${leadId}\nStock: ${item.stockId || '—'}`,
        });
        trackHalfCutLeadEvent('generate_lead', {
          method: 'half_cut_whatsapp',
          lead_id: leadId,
          stock_id: item.stockId || '',
          intent,
        });
        openWhatsAppWithReference(link.href, leadId);
      } else {
        presentHalfCutFeedback({
          type: 'error',
          title: t('feedback.halfCutFailed', 'Could not save enquiry'),
          message: saveError?.message || t('feedback.halfCutFailedMsg', 'We could not save your enquiry on the server. Please try again or use the contact form.'),
        });
      }
    } catch (err) {
      console.error('[half-cut-wa-lead]', err);
      openWhatsAppWithReference(link.href, null);
    }
  }

  async function handleHalfCutLeadClick(event) {
    const btn = event.target.closest('[data-half-cut-lead]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      if (!window.SiteFeedback?.promptContact) {
        presentHalfCutFeedback({
          type: 'error',
          title: t('feedback.halfCutFailed', 'Could not save enquiry'),
          message: 'Contact form is not ready yet. Please refresh the page and try again.',
        });
        return;
      }

      const slug = btn.dataset.slug;
      const intent = btn.dataset.intent || 'price';
      const partType = btn.dataset.partType || '';

      const item = resolveLeadItem(slug);
      if (!item) {
        presentHalfCutFeedback({
          type: 'error',
          title: t('feedback.halfCutFailed', 'Could not save enquiry'),
          message: t('feedback.halfCutListingUnavailable', 'Listing unavailable. Please use the contact form to reach us.'),
        });
        return;
      }

      const contact = await promptContact();
      if (!contact) {
        showHalfCutStatus({ type: 'info', title: '', message: '' });
        return;
      }

      showHalfCutStatus({
        type: 'info',
        title: t('feedback.saving', 'Saving enquiry…'),
        message: t('feedback.savingMsg', 'Please wait while we submit your enquiry.'),
      });

      const original = btn.textContent;
      btn.setAttribute('aria-busy', 'true');
      if (btn.tagName === 'BUTTON') btn.disabled = true;

      let leadId = null;
      let savedEmail = '';
      let saveError = null;
      try {
        const saved = await saveHalfCutLead(item, intent, contact, partType);
        leadId = saved?.id || null;
        savedEmail = saved?.email || contact.email || '';
      } catch (err) {
        saveError = err;
        console.warn('[half-cut-lead]', err);
      } finally {
        btn.removeAttribute('aria-busy');
        if (btn.tagName === 'BUTTON') btn.disabled = false;
        if (original) btn.textContent = original;
      }

      if (leadId) {
        const partLabel = partTypeLabel(partType);
        presentHalfCutFeedback({
          type: 'success',
          title: partType
            ? t('feedback.partsEnquirySaved', 'Enquiry recorded')
            : t('feedback.halfCutSaved', 'Enquiry recorded'),
          message: partType
            ? t('feedback.partsEnquirySavedMsg', 'Your parts enquiry was submitted successfully. We will contact you within 24 hours.')
            : t('feedback.halfCutSavedMsg', 'Your half-cut enquiry was submitted successfully. We will contact you within 24 hours.'),
          details: [
            `Reference: ${leadId}`,
            partType ? `${partLabel}: ${item.stockId || '—'}` : `Stock: ${item.stockId || '—'}`,
            savedEmail ? `Email: ${savedEmail}` : '',
            contact.phone ? `Phone: ${contact.phone}` : '',
          ].filter(Boolean).join('\n'),
        });
        trackHalfCutLeadEvent('generate_lead', {
          method: partType ? 'parts_enquiry' : 'half_cut_form',
          lead_id: leadId,
          stock_id: item.stockId || '',
          intent,
          part_type: partType || '',
        });
      } else {
        presentHalfCutFeedback({
          type: 'error',
          title: t('feedback.halfCutFailed', 'Could not save enquiry'),
          message: saveError?.message || t('feedback.halfCutFailedMsg', 'We could not save your enquiry on the server. Please try again or use the contact form.'),
        });
      }
    } catch (err) {
      console.error('[half-cut-lead]', err);
      presentHalfCutFeedback({
        type: 'error',
        title: t('feedback.halfCutFailed', 'Could not save enquiry'),
        message: err?.message || t('feedback.halfCutFailedMsg', 'Something went wrong. Please try again or use the contact form.'),
      });
    }
  }

  document.addEventListener('click', handleHalfCutLeadClick, true);
  document.addEventListener('click', handleWhatsAppLeadClick, true);

  window.HalfCutLeads = {
    saveHalfCutLead,
    messageForIntent,
    buildPayload,
    resolveLeadItem,
    partTypeLabel,
    showHalfCutStatus,
    presentHalfCutFeedback,
  };
})();
