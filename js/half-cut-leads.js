/**
 * AsiaPower — Half-cut enquiry lead capture
 */
(function () {
  'use strict';

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

  function messageForIntent(item, intent) {
    const u = window.HalfCutUtils;
    if (!u || !item) return 'Hello AsiaPower, I would like to enquire about a half-cut listing.';
    if (intent === 'photos') return u.photosMessage(item);
    if (intent === 'similar') return u.similarUnitMessage(item);
    if (intent === 'availability') return u.whatsappMessage(item);
    return u.whatsappMessage(item);
  }

  function buildPayload(item, intent, contact) {
    return {
      slug: item.slug,
      stockId: item.stockId,
      intent,
      brand: item.brand,
      model: item.model,
      engineCode: item.engineCode,
      transmissionCode: item.transmissionCode,
      listingStatus: item.status,
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      country: contact?.country || '',
      page: `${window.location.pathname}${window.location.search}`,
    };
  }

  async function saveHalfCutLead(item, intent, contact) {
    const res = await fetch('/api/leads/half-cut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(item, intent, contact)),
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

      showHalfCutStatus({
        type: 'info',
        title: t('leadContact.title', 'Your contact details'),
        message: t('leadContact.whatsappSaveHint', 'We will save your enquiry before opening WhatsApp.'),
      });

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

      const item = resolveLeadItem(slug);
      if (!item) {
        presentHalfCutFeedback({
          type: 'error',
          title: t('feedback.halfCutFailed', 'Could not save enquiry'),
          message: t('feedback.halfCutListingUnavailable', 'Listing unavailable. Please use the contact form to reach us.'),
        });
        return;
      }

      showHalfCutStatus({
        type: 'info',
        title: t('leadContact.title', 'Your contact details'),
        message: t('leadContact.message', 'Select your country, then enter your phone number or email address.'),
      });

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
        const saved = await saveHalfCutLead(item, intent, contact);
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
        presentHalfCutFeedback({
          type: 'success',
          title: t('feedback.halfCutSaved', 'Enquiry recorded'),
          message: t('feedback.halfCutSavedMsg', 'Your half-cut enquiry was submitted successfully. We will contact you within 24 hours.'),
          details: [
            `Reference: ${leadId}`,
            `Stock: ${item.stockId || '—'}`,
            savedEmail ? `Email: ${savedEmail}` : '',
            contact.phone ? `Phone: ${contact.phone}` : '',
          ].filter(Boolean).join('\n'),
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
    showHalfCutStatus,
    presentHalfCutFeedback,
  };
})();
