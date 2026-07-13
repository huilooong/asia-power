/**
 * AsiaPower — Main Application JS
 */
(function () {
  'use strict';

  const ADS_CONVERSION_ID = 'AW-4801206293';
  const ADS_GENERATE_LEAD_LABEL = '';
  const ADS_GENERATE_LEAD_SEND_TO = ADS_GENERATE_LEAD_LABEL
    ? `${ADS_CONVERSION_ID}/${ADS_GENERATE_LEAD_LABEL}`
    : '';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function initMobileNav() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const header = document.querySelector('.header');
    if (!toggle || !nav) return;

    function updateSiteHeaderHeight() {
      const topBar = document.querySelector('.top-bar:not(.site-topbar--hidden)');
      const topBarEl = document.getElementById('site-topbar');
      const hasTopBar = topBar && topBar.offsetHeight > 0 && !topBarEl?.classList.contains('site-topbar--hidden');
      const height = (hasTopBar ? topBar.offsetHeight : 0) + (header?.offsetHeight || 0);
      document.documentElement.style.setProperty('--site-header-height', `${height}px`);
      document.documentElement.style.setProperty('--header-offset', `${height}px`);
    }

    function setNavOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      document.body.classList.toggle('nav-open', open);
    }

    updateSiteHeaderHeight();
    window.addEventListener('resize', updateSiteHeaderHeight, { passive: true });
    window.addEventListener('orientationchange', updateSiteHeaderHeight);
    window.addEventListener('load', updateSiteHeaderHeight);
    requestAnimationFrame(updateSiteHeaderHeight);

    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      setNavOpen(open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    nav.querySelectorAll('.nav__link, .lang-switcher__btn').forEach(el => {
      el.addEventListener('click', () => setNavOpen(false));
    });

    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setNavOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) setNavOpen(false);
    });
  }

  function initFAQ() {
    document.querySelectorAll('.faq-q').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
      const panel = btn.nextElementSibling;
      if (panel) panel.setAttribute('aria-hidden', 'true');

      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => {
          i.classList.remove('open');
          const q = i.querySelector('.faq-q');
          const p = q?.nextElementSibling;
          if (q) q.setAttribute('aria-expanded', 'false');
          if (p) p.setAttribute('aria-hidden', 'true');
        });
        if (!wasOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          if (panel) panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  }

  function initFilters() {
    const bar = document.querySelector('.filter-group');
    if (!bar) return;

    const buttons = bar.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('[data-filter-tags]');
    const countEl = document.querySelector('[data-catalog-count]');

    function updateCount(visible) {
      if (countEl) countEl.textContent = visible;
    }

    function applyFilter(filter) {
      let visible = 0;
      items.forEach(item => {
        const tags = (item.dataset.filterTags || '').split(/\s+/);
        const show = filter === 'all' || tags.includes(filter);
        item.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      updateCount(visible);
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.dataset.filter);
      });
    });

    applyFilter('all');
  }

  function initURLFilters() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (!type) return;
    const btn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
    if (btn) btn.click();
  }

  function contactPhoneE164(form) {
    const field = form.querySelector('[name="phone"]');
    if (field?.dataset?.e164) return field.dataset.e164;
    const raw = field?.value || '';
    if (window.AsiaPhone?.toE164) return window.AsiaPhone.toE164(raw);
    const digits = String(raw).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  function isValidPhone(value, country) {
    if (window.AsiaPhone?.validatePhone) {
      return window.AsiaPhone.validatePhone(value, country).ok;
    }
    if (window.SiteFeedback?.isValidPhoneWithCountryCode) {
      return window.SiteFeedback.isValidPhoneWithCountryCode(value, country);
    }
    const raw = String(value || '').trim();
    if (!raw.startsWith('+')) return false;
    const digits = raw.replace(/[^\d]/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }

  function contactPhoneCheck(form, phoneRaw) {
    if (window.AsiaPhone?.validatePhoneLoose) {
      return window.AsiaPhone.validatePhoneLoose(phoneRaw);
    }
    const phone = contactPhoneE164(form);
    return isValidPhone(phone, '') ? { ok: true, phone } : {
      ok: false,
      message: t('leadContact.phoneInvalid', 'Enter a valid international phone number.'),
    };
  }

  function phoneFieldHost(field) {
    return field.closest('.form-group') || field.closest('.site-modal__field') || field.parentElement;
  }

  function presentContactFeedback(form, options) {
    if (window.SiteFeedback?.presentFormFeedback) {
      return window.SiteFeedback.presentFormFeedback(form, {
        modal: false,
        toast: options?.toast ?? false,
        scroll: options?.scroll ?? false,
        ...options,
      });
    }
    return presentFeedback(form, options);
  }

  function showFieldError(form, fieldName, message) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    field.style.borderColor = 'var(--danger)';
    field.setAttribute('aria-invalid', 'true');
    const host = phoneFieldHost(field);
    host?.querySelectorAll('.field-err').forEach((el) => el.remove());
    const span = document.createElement('span');
    span.className = 'field-err';
    span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
    span.textContent = message;
    host?.appendChild(span);
    field.focus();
    scrollFormCardIntoView(field);
  }

  function validateContactReachable(form) {
    const email = fieldValue(form, 'email').trim();
    const phoneRaw = form.querySelector('[name="phone"]')?.value || '';

    if (!email) {
      showFieldError(form, 'email', t('leadContact.emailRequired', 'Please enter your email address so we can reply.'));
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(form, 'email', t('leadContact.emailInvalid', 'Please enter a valid email address.'));
      return false;
    }

    if (window.SiteFeedback?.isPlaceholderOrTestEmail?.(email)) {
      showFieldError(form, 'email', t('leadContact.emailPlaceholder', 'Please use a real email address you can receive mail at.'));
      return false;
    }

    if (!phoneRaw.trim()) return true;

    const phoneCheck = contactPhoneCheck(form, phoneRaw);
    if (!phoneCheck.ok) {
      showFieldError(form, 'phone', phoneCheck.message);
      return false;
    }

    const phoneField = form.querySelector('[name="phone"]');
    if (phoneField && phoneCheck.phone) phoneField.dataset.e164 = phoneCheck.phone;
    return true;
  }

  function validateForm(form) {
    let ok = true;
    const country = form.querySelector('[name="country"]')?.value || '';
    const isContactForm = form.dataset.form === 'contact-enquiry';
    form.querySelectorAll('[required]').forEach(field => {
      field.style.borderColor = '';
      const host = phoneFieldHost(field);
      host?.querySelectorAll('.field-err').forEach((el) => el.remove());

      if (!field.value.trim()) {
        ok = false;
        field.style.borderColor = 'var(--danger)';
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = 'Required';
        host?.appendChild(span);
      } else if (field.type === 'email' && field.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
        ok = false;
        field.style.borderColor = 'var(--danger)';
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = t('leadContact.emailInvalid', 'Please enter a valid email address.');
        host?.appendChild(span);
      }
    });

    if (isContactForm) {
      const emailField = form.querySelector('[name="email"]');
      const phoneField = form.querySelector('[name="phone"]');
      if (phoneField?.value.trim()) {
        phoneField.style.borderColor = '';
        phoneField.removeAttribute('aria-invalid');
        const host = phoneFieldHost(phoneField);
        host?.querySelectorAll('.field-err').forEach((el) => el.remove());
        const phoneCheck = contactPhoneCheck(form, phoneField.value);
        if (!phoneCheck.ok) {
          ok = false;
          phoneField.style.borderColor = 'var(--danger)';
          phoneField.setAttribute('aria-invalid', 'true');
          const span = document.createElement('span');
          span.className = 'field-err';
          span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
          span.textContent = phoneCheck.message;
          host?.appendChild(span);
        }
      }
      return ok && !!emailField?.value.trim();
    }

    const phoneField = form.querySelector('[name="phone"]');
    if (phoneField && !isContactForm && phoneField.value.trim()) {
      phoneField.style.borderColor = '';
      phoneField.removeAttribute('aria-invalid');
      const host = phoneFieldHost(phoneField);
      host?.querySelectorAll('.field-err').forEach((el) => el.remove());

      const phoneCheck = window.AsiaPhone?.validatePhone
        ? window.AsiaPhone.validatePhone(phoneField.value, country)
        : null;
      if (!phoneField.value.trim()) {
        ok = false;
        phoneField.style.borderColor = 'var(--danger)';
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = t('leadContact.phoneRequired', 'Please enter your phone number.');
        host?.appendChild(span);
      } else if (phoneCheck && !phoneCheck.ok) {
        ok = false;
        phoneField.style.borderColor = 'var(--danger)';
        phoneField.setAttribute('aria-invalid', 'true');
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = phoneCheck.message;
        host?.appendChild(span);
      } else if (!phoneCheck && !isValidPhone(contactPhoneE164(form), country)) {
        ok = false;
        phoneField.style.borderColor = 'var(--danger)';
        phoneField.setAttribute('aria-invalid', 'true');
        const span = document.createElement('span');
        span.className = 'field-err';
        span.style.cssText = 'color:var(--danger);font-size:.75rem;margin-top:4px;display:block;';
        span.textContent = t('leadContact.phoneInvalid', 'Enter a valid international phone number.');
        host?.appendChild(span);
      }
    }

    const terms = form.querySelector('[data-terms]');
    if (terms && !terms.checked) ok = false;

    return ok;
  }

  function fieldValue(form, name) {
    if (name === 'email' && form.dataset.form === 'contact-enquiry') {
      return form.querySelector('#contact-email, [name="email"]')?.value?.trim() || '';
    }
    const field = form.elements[name];
    if (field && typeof field.value === 'string') return field.value.trim();
    return field?.value?.trim?.() || '';
  }

  function optionText(form, name) {
    const field = form.elements[name];
    if (!field) return '';
    const selected = field.options?.[field.selectedIndex];
    return selected?.text?.trim() || field.value?.trim() || '';
  }

  function buildContactWhatsAppMessage(form, leadId) {
    if (window.QuoteRequestForm?.buildMessage) {
      return window.QuoteRequestForm.buildMessage(form, leadId);
    }
    const lines = [
      'Hello AsiaPower, I would like to request a quote.',
      '',
      `Name: ${fieldValue(form, 'name')}`,
      `Company: ${fieldValue(form, 'company') || '-'}`,
      `Email: ${fieldValue(form, 'email')}`,
      `Phone / WhatsApp: ${contactPhoneE164(form)}`,
      `Country: ${optionText(form, 'country')}`,
      `Enquiry Type: ${optionText(form, 'enquiry_type')}`,
      '',
      `Vehicle / Part Details: ${fieldValue(form, 'vehicle_details')}`,
      `Additional Message: ${fieldValue(form, 'message') || '-'}`,
      '',
      'Please quote availability, price, shipping option, and lead time.',
    ];
    if (leadId) lines.push('', `Reference: ${leadId}`);
    return lines.join('\n');
  }

  function syncQuoteFormFields(form) {
    if (!window.QuoteRequestForm) return;
    if (window.QuoteRequestForm.syncHiddenFields) {
      window.QuoteRequestForm.syncHiddenFields(form);
      return;
    }
    const vd = form.querySelector('[name="vehicle_details"]');
    if (vd) vd.value = window.QuoteRequestForm.buildVehicleDetails(form);
  }

  function buildContactLeadPayload(form, options = {}) {
    syncQuoteFormFields(form);
    const extras = window.QuoteRequestForm?.buildLeadExtras?.(form) || {};
    const channel = options.channel || 'email';
    const waMessage = extras.whatsapp_message || buildContactWhatsAppMessage(form);
    const leadMeta = window.AsiaLeadContext?.captureLeadMeta?.({
      brand: extras.brand || fieldValue(form, 'brand'),
      product: extras.product || extras.model || fieldValue(form, 'model'),
      enquiry_type: fieldValue(form, 'enquiry_type'),
      source: options.source || 'quote-form',
    }) || {
      pageUrl: `${window.location.pathname}${window.location.search}`,
      page: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || '',
      ...(window.AsiaPowerUtm?.forLead?.() || {}),
    };
    return {
      name: fieldValue(form, 'name'),
      company: fieldValue(form, 'company'),
      email: fieldValue(form, 'email'),
      phone: contactPhoneE164(form),
      country: fieldValue(form, 'country'),
      enquiry_type: fieldValue(form, 'enquiry_type'),
      vehicle_details: extras.vehicle_details || fieldValue(form, 'vehicle_details'),
      message: waMessage || extras.message || fieldValue(form, 'message'),
      brand: leadMeta.brand || extras.brand || fieldValue(form, 'brand'),
      model: extras.model || fieldValue(form, 'model'),
      product: leadMeta.product || extras.product || extras.model || fieldValue(form, 'model'),
      productLabel: leadMeta.productLabel || '',
      inquirySubject: leadMeta.inquirySubject || '',
      replySubject: leadMeta.replySubject || '',
      engine_code: extras.engine_code || fieldValue(form, 'engine_code'),
      prefer_email_reply: channel === 'email',
      source: options.source || 'quote-form',
      intent: channel === 'whatsapp' ? 'whatsapp-quote' : (options.intent || 'quote'),
      company_website: fieldValue(form, 'company_website'),
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

  function initContactInfo() {
    const c = window.ASIAPOWER;
    if (!c?.email) return;
    const subject = encodeURIComponent('AsiaPower enquiry');
    const btn = document.getElementById('contact-email-btn');
    const addr = document.getElementById('contact-email-address');
    if (btn) btn.href = `mailto:${c.email}?subject=${subject}`;
    if (addr) {
      addr.href = `mailto:${c.email}`;
      addr.textContent = c.email;
    }
  }

  function initContactCountrySelect() {
    const select = document.getElementById('contact-country');
    if (!select || !window.AsiaCountryOptions?.populateSelect) return;
    const current = select.value;
    window.AsiaCountryOptions.populateSelect(select, t('contact.selectCountry', 'Select country'));
    if (current) select.value = current;
  }

  function initPhoneInputs() {
    document.querySelectorAll('form[data-form="contact-enquiry"]').forEach((form) => {
      const phoneInput = form.querySelector('[name="phone"]');
      const countrySelect = form.querySelector('[name="country"]');
      window.AsiaPhone?.bindInput?.(phoneInput, countrySelect, {
        suggestPrefixOnly: true,
        keepRequired: true,
        onChange: () => {
          phoneInput?.style.removeProperty('border-color');
          phoneInput?.removeAttribute('aria-invalid');
          window.SiteFeedback?.clearFormStatus?.(form);
        },
      });
    });
  }

  function initContactFormFeedbackReset() {
    document.querySelectorAll('form[data-form="contact-enquiry"]').forEach((form) => {
      form.addEventListener('input', () => {
        window.SiteFeedback?.clearFormStatus?.(form);
      });
      form.addEventListener('change', () => {
        window.SiteFeedback?.clearFormStatus?.(form);
      });
    });
  }

  async function saveContactLead(form, options = {}) {
    const payload = buildContactLeadPayload(form, options);
    const res = await fetch('/api/leads/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Could not save enquiry');
    }
    return data;
  }

  function showContactSuccess(form, { channel, leadId, email }) {
    const card = form.closest('.form-card');
    const success = card?.querySelector('.form-success');
    const successWhatsapp = card?.querySelector('.form-success--whatsapp');
    const successEmail = card?.querySelector('.form-success--email');
    if (success) success.classList.remove('show');
    if (successWhatsapp) successWhatsapp.classList.remove('show');
    if (successEmail) successEmail.classList.remove('show');
    form.classList.add('hidden');
    if (channel === 'whatsapp' && successWhatsapp) {
      successWhatsapp.classList.add('show');
    } else if (successEmail) {
      successEmail.classList.add('show');
    } else if (success) {
      success.classList.add('show');
    }
    scrollFormCardIntoView(form);
    if (leadId && window.SiteFeedback?.toast) {
      window.SiteFeedback.toast(
        t('feedback.enquirySavedRef', `Enquiry saved — reference ${leadId}`),
        'success',
      );
    }
    trackAdsLeadEvent('generate_lead', {
      method: channel === 'whatsapp' ? 'whatsapp_quote' : 'contact_form',
      lead_id: leadId || '',
      page_path: window.location.pathname,
    });
    void email;
  }

  function trackAdsLeadEvent(eventName, params = {}) {
    if (typeof window.gtag !== 'function') return;
    const utm = window.AsiaLeadContext?.captureUtm?.() || window.AsiaPowerUtm?.forLead?.() || {};
    const eventParams = {
      currency: 'USD',
      value: eventName === 'generate_lead' ? 1 : 0,
      lead_source: params.method || params.lead_source || '',
      event_category: 'lead',
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

  function initQuoteWhatsAppButton() {
    document.querySelectorAll('form[data-form="contact-enquiry"]').forEach((form) => {
      const btn = form.querySelector('#quote-wa-btn');
      if (!btn || btn.dataset.waCrmBound) return;
      btn.dataset.waCrmBound = '1';

      btn.addEventListener('click', async () => {
        syncQuoteFormFields(form);

        if (!validateForm(form)) {
          const firstErr = form.querySelector('.field-err, [required][style*="border-color"]');
          const focusTarget = form.querySelector('[required]:invalid, [required][value=""], [name="email"], [name="phone"]');
          (focusTarget)?.focus();
          scrollFormCardIntoView(firstErr || focusTarget || form);
          return;
        }

        if (!validateContactReachable(form)) return;

        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = t('feedback.saving', 'Saving enquiry…');

        try {
          const result = await saveContactLead(form, { channel: 'whatsapp', source: 'quote-form' });
          const leadId = result?.id || null;
          const msg = buildContactWhatsAppMessage(form, leadId);

          if (window.SiteFeedback?.rememberLeadContact) {
            window.SiteFeedback.rememberLeadContact({
              name: fieldValue(form, 'name'),
              phone: contactPhoneE164(form),
              email: fieldValue(form, 'email'),
              country: fieldValue(form, 'country'),
            });
          }

          if (window.WhatsAppCrm?.openWhatsApp) {
            window.WhatsAppCrm.openWhatsApp(msg, leadId);
          } else {
            window.open(`https://wa.me/${String(window.ASIAPOWER?.whatsapp || '8616638801930').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
          }

          showContactSuccess(form, { channel: 'whatsapp', leadId, email: result?.email });
          window.SiteFeedback?.clearFormStatus?.(form);
        } catch (err) {
          console.warn('[quote-wa]', err);
          presentContactFeedback(form, {
            type: 'error',
            title: t('feedback.enquiryFailed', 'Could not save enquiry'),
            message: err?.message || t('feedback.enquiryFailedMsg', 'We could not save your enquiry on the server. Please try again later or contact us directly.'),
          });
          scrollFormCardIntoView(form);
        } finally {
          btn.disabled = false;
          btn.textContent = originalLabel || t('quote.sendWhatsapp', 'Send via WhatsApp');
        }
      });
    });
  }

  function initWhatsAppCtaLinks() {
    const truckMsg = window.ASIAPOWER?.whatsappTruckMessage || window.WhatsAppCrm?.truckPrefill?.() || '';
    document.querySelectorAll('[data-wa-truck]').forEach((link) => {
      if (!truckMsg || !window.WhatsAppCrm?.buildUrl) return;
      link.href = window.WhatsAppCrm.buildUrl(truckMsg);
    });
  }

  window.AsiaPowerContact = {
    buildPayload: buildContactLeadPayload,
    saveLead: saveContactLead,
    buildWhatsAppMessage: buildContactWhatsAppMessage,
    validateForm,
    validateReachable: validateContactReachable,
    showSuccess: showContactSuccess,
    syncFields: syncQuoteFormFields,
  };

  function initForms() {
    document.querySelectorAll('form[data-form]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          if (form.dataset.form !== 'contact-enquiry') {
            if (!validateForm(form)) return;
            const card = form.closest('.form-card');
            const success = card?.querySelector('.form-success');
            if (form.dataset.form === 'supplier-registration') {
              // Legacy fake form removed — always send users to real OTP registration.
              window.location.href = '/login/?role=supplier&mode=register';
              return;
            }
            if (success) {
              form.classList.add('hidden');
              success.classList.add('show');
            } else {
              form.reset();
              showToast('Message sent. We will respond within 24 hours.', 'success');
            }
            return;
          }

          syncQuoteFormFields(form);

          if (!validateForm(form)) {
            const firstErr = form.querySelector('.field-err');
            const focusTarget = form.querySelector('[required]:invalid, [required][value=""], [name="email"], [name="phone"]');
            (focusTarget)?.focus();
            scrollFormCardIntoView(firstErr || focusTarget || form);
            return;
          }

          if (!validateContactReachable(form)) return;

          const card = form.closest('.form-card');
          const success = card?.querySelector('.form-success');
          const submitBtn = form.querySelector('[type="submit"]');
          const originalLabel = submitBtn?.textContent;

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t('feedback.saving', 'Saving enquiry…');
          }

          let saved = false;
          let leadId = null;
          let savedEmail = '';
          let saveError = null;
          try {
            const result = await saveContactLead(form);
            saved = true;
            leadId = result?.id || null;
            savedEmail = result?.email || fieldValue(form, 'email');
            if (window.SiteFeedback?.rememberLeadContact) {
              window.SiteFeedback.rememberLeadContact({
                name: fieldValue(form, 'name'),
                phone: contactPhoneE164(form),
                email: savedEmail,
                country: fieldValue(form, 'country'),
              });
            }
          } catch (err) {
            saveError = err;
            console.warn('[contact-lead]', err);
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalLabel || t('contact.submitEnquiry', 'Submit Enquiry');
            }
          }

          window.SiteFeedback?.clearFormStatus?.(form);

          if (saved) {
            showContactSuccess(form, { channel: 'email', leadId, email: savedEmail });
            if (leadId && window.SiteFeedback?.toast) {
              window.SiteFeedback.toast(
                t('feedback.enquirySavedRef', `Enquiry saved — reference ${leadId}`),
                'success',
              );
            }
            scrollFormCardIntoView(form);
          } else {
            presentContactFeedback(form, {
              type: 'error',
              toast: true,
              title: t('feedback.enquiryFailed', 'Could not save enquiry'),
              message: saveError?.message || t('feedback.enquiryFailedMsg', 'We could not save your enquiry. Please try WhatsApp or email us directly.'),
            });
            scrollFormCardIntoView(submitBtn || form);
          }
        } catch (err) {
          console.error('[form-submit]', err);
          presentContactFeedback(form, {
            type: 'error',
            toast: true,
            title: t('feedback.enquiryFailed', 'Could not save enquiry'),
            message: err?.message || t('feedback.enquiryFailedMsg', 'Something went wrong. Please try again or contact us directly.'),
          });
        }
      });
    });
  }

  function showToast(msg, type) {
    if (window.SiteFeedback?.toast) {
      window.SiteFeedback.toast(msg, type);
      return;
    }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:96px;right:24px;z-index:10001;background:var(--navy-800);color:#fff;padding:14px 20px;border-radius:6px;font-size:.88rem;box-shadow:0 8px 24px rgba(0,0,0,.2);border-left:4px solid var(--accent);max-width:320px;';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4000);
  }

  function showModal(options) {
    if (window.SiteFeedback?.modal) {
      return window.SiteFeedback.modal(options);
    }
    window.alert(`${options?.title || ''}\n\n${options?.message || ''}`);
    if (typeof options?.onClose === 'function') options.onClose();
    return { close: () => {} };
  }

  function notifyFeedback(options) {
    if (window.SiteFeedback?.notify) {
      return window.SiteFeedback.notify(options);
    }
    const toastText = [options?.title, options?.message].filter(Boolean).join(' — ');
    if (toastText) showToast(toastText, options?.type || 'info');
    const result = showModal(options);
    if ((options?.type === 'error' || options?.type === 'success') && !window.SiteFeedback?.modal) {
      return result;
    }
    return result;
  }

  function presentFeedback(form, options) {
    if (window.SiteFeedback?.setFormStatus) {
      window.SiteFeedback.setFormStatus(form, options);
    }
    return notifyFeedback(options);
  }

  function scrollFormCardIntoView(form) {
    form?.closest('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function initContactPrefill() {
    document.querySelectorAll('form[data-form="contact-enquiry"]').forEach((form) => {
      if (window.QuoteRequestForm) {
        window.QuoteRequestForm.prefillFromUrl(form);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const brand = params.get('brand');
      const product = params.get('product');
      if (!brand && !product) return;

      const detailsField = form.querySelector('[name="vehicle_details"]');
      if (detailsField && !detailsField.value.trim()) {
        const lines = [];
        if (brand) lines.push(`Brand: ${brand}`);
        if (product) lines.push(`Product / Engine code: ${product}`);
        detailsField.value = lines.join('\n');
      }

      const typeField = form.querySelector('[name="enquiry_type"]');
      if (typeField && !typeField.value && product) {
        const p = product.toLowerCase();
        if (p.includes('gearbox') || p.includes('transmission')) typeField.value = 'gearbox';
        else if (p.includes('half-cut') || p.includes('halfcut')) typeField.value = 'other';
        else if (p.includes('chassis')) typeField.value = 'other';
        else typeField.value = 'engine';
      }
    });
  }

  function initHeaderShadow() {
    const header = document.querySelector('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 20 ? 'var(--shadow-sm)' : 'var(--shadow-xs)';
    }, { passive: true });
  }

  function initCategoryGrid() {
    const grid = document.getElementById('category-grid');
    const config = window.ASIAPOWER;
    if (!grid || !config) return;

    const iconMap = {
      engine: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="10" rx="1"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M8 8V5h8v3"/></svg>',
      gearbox: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="20"/></svg>',
      diesel: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>',
      '4wd': '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="8" rx="1"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
      network: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>',
      shipping: '<svg viewBox="0 0 24 24"><rect x="1" y="6" width="15" height="10"/><polygon points="16 10 20 10 23 13 23 16 16 16 16 10"/></svg>',
    };

    grid.innerHTML = config.categories.map(cat => `
      <a href="${cat.href}" class="category-card${cat.image ? ' category-card--photo' : ''}">
        ${cat.image ? `<div class="category-card__media"><picture><source srcset="${cat.image.replace('.jpg', '.webp')}" type="image/webp"><img src="${cat.image}" alt="${cat.imageAlt || cat.title}" loading="lazy" decoding="async"></picture></div>` : ''}
        <div class="category-card__body">
        <div class="category-card__icon">${iconMap[cat.icon] || iconMap.engine}</div>
        <div>
          <div class="category-card__count">${cat.count}</div>
          <div class="category-card__title">${cat.title}</div>
          <div class="category-card__desc">${cat.desc}</div>
        </div>
        <span class="category-card__arrow">→</span>
        </div>
      </a>
    `).join('');
  }

  function initStatsStrip() {
    const strip = document.getElementById('stats-strip');
    const config = window.ASIAPOWER;
    if (!strip || !config) return;
    strip.innerHTML = config.stats.map(s => `
      <div class="stats-strip__item">
        <div class="stats-strip__num"><span>${s.value.replace('+', '')}</span>${s.value.includes('+') ? '+' : ''}</div>
        <div class="stats-strip__label">${s.label}</div>
      </div>
    `).join('');
  }

  function initBrandsMarquee() {
    const track = document.getElementById('brands-track');
    const config = window.ASIAPOWER;
    if (!track || !config) return;
    const tags = config.brands.map(b => `<a href="brands.html" class="brand-tag">${b}</a>`).join('');
    track.innerHTML = tags + tags;
  }


  const ENGINE_TYPE_FILTERS = [
    { filter: 'all', i18n: 'gearboxes.all', label: 'All' },
    { filter: 'petrol', i18n: 'engines.petrol', label: 'Petrol' },
    { filter: 'diesel', i18n: 'engines.diesel', label: 'Diesel' },
    { filter: 'hybrid', i18n: 'engines.hybrid', label: 'Hybrid' },
  ];

  const GEARBOX_TYPE_FILTERS = [
    { filter: 'all', i18n: 'gearboxes.all', label: 'All' },
    { filter: 'automatic', i18n: 'gearboxes.automatic', label: 'Automatic' },
    { filter: 'manual', i18n: 'gearboxes.manual', label: 'Manual' },
    { filter: 'cvt', i18n: 'gearboxes.cvt', label: 'CVT' },
    { filter: '4wd', i18n: 'gearboxes.4wd', label: '4WD' },
  ];

  const CHASSIS_TYPE_FILTERS = [
    { filter: 'all', i18n: 'gearboxes.all', label: 'All' },
    { filter: 'suspension', i18n: 'chassis.suspension', label: 'Suspension' },
    { filter: 'steering', i18n: 'chassis.steering', label: 'Steering' },
    { filter: 'brakes', i18n: 'chassis.brakes', label: 'Brakes' },
    { filter: 'drivetrain', i18n: 'chassis.drivetrain', label: 'Drivetrain' },
  ];

  function bindPowertrainToolbar(catalogType, root, options) {
    if (window.AsiaPowerEbayCatalogHub?.initParts) {
      const pageMap = { engines: 'engines', gearboxes: 'gearboxes', chassis: 'chassis' };
      window.AsiaPowerEbayCatalogHub.initParts(pageMap[catalogType] || 'engines', root, options);
      return;
    }
    window.PowertrainCatalogToolbar?.bind({
      catalogType,
      root,
      toolbarId: 'powertrain-catalog-toolbar',
      getBrands: options.getBrands,
      getTotalCount: options.getTotalCount,
      countId: options.countId,
      typeFilters: options.typeFilters,
      emptyHref: options.emptyHref,
    });
  }

  function initEngineCatalogPage() {
    const root = document.getElementById('engine-catalog-root');
    if (!root || !window.AsiaPowerEbayCatalogHub?.initInventoryParts) return;
    window.AsiaPowerEbayCatalogHub.initInventoryParts('engines', root);
  }

  function initGearboxCatalogPage() {
    const root = document.getElementById('gearbox-catalog-root');
    if (!root || !window.AsiaPowerEbayCatalogHub?.initInventoryParts) return;
    window.AsiaPowerEbayCatalogHub.initInventoryParts('gearboxes', root);
  }

  function initChassisCatalogPage() {
    const root = document.getElementById('chassis-catalog-root');
    if (!root || !window.AsiaPowerEbayCatalogHub?.initInventoryParts) return;
    window.AsiaPowerEbayCatalogHub.initInventoryParts('chassis', root);
  }

  function initFrontCutCatalogPage() {
    const root = document.getElementById('frontcut-catalog-root');
    if (!root || !window.AsiaPowerEbayCatalogHub?.initInventoryParts) return;
    window.AsiaPowerEbayCatalogHub.initInventoryParts('frontcuts', root);
  }

  function initPlatformOffices() {
    const el = document.getElementById('platform-offices');
    const config = window.ASIAPOWER;
    if (!el || !config) return;
    el.innerHTML = Object.values(config.offices).map(o => `
      <div class="platform-office">
        <strong>${o.flag} ${o.label}</strong>
        <p>${o.address}</p>
      </div>
    `).join('');
  }

  function initHomepageBrands() {
    const grid = document.getElementById('homepage-brands');
    const config = window.ASIAPOWER;
    if (!grid || !config) return;

    const brands = getBrandsWithPublicStock(config).slice(0, 12);

    grid.innerHTML = brands.map(brand => {
      const url = brandProductUrl(brand);
      const initial = brand.name.charAt(0);
      const active = brand.landingPage ? ' platform-brand--active' : '';
      return `
        <a href="${url}" class="platform-brand${active}">
          <span class="platform-brand__initial">${initial}</span>
          <span class="platform-brand__name">${brand.name}</span>
        </a>`;
    }).join('');
  }

  const BRAND_PRODUCT_SEARCH = [
    {
      label: 'Gearboxes',
      terms: ['gearbox', 'gearboxes', 'transmission', 'transmissions', 'cvt', 'automatic', 'manual', 'dsg', '4wd', 'awd', 'steptronic', 'zf'],
    },
    {
      label: 'Half-Cuts',
      terms: ['half-cut', 'half cut', 'halfcut', 'half-cuts', 'half cuts', 'nose cut', 'front cut', 'rear cut'],
    },
    {
      label: 'Chassis Parts',
      terms: ['chassis', 'suspension', 'steering', 'brake', 'brakes', 'axle', 'control arm', 'chassis parts', 'chassis part'],
    },
    {
      label: 'Engines',
      terms: ['engine', 'engines', 'motor', 'motors'],
    },
  ];

  function normalizeBrandSearch(value) {
    return String(value || '').toLowerCase().replace(/[\s-]/g, '');
  }

  function findEngineModelMatch(models, query) {
    const q = query.toLowerCase().trim();
    const qNorm = normalizeBrandSearch(q);
    if (!qNorm) return null;

    let best = null;
    let bestScore = -1;

    models.forEach(model => {
      const modelLower = model.toLowerCase();
      const modelNorm = normalizeBrandSearch(model);
      const matches = modelLower.includes(q) || modelNorm.includes(qNorm);
      if (!matches) return;

      let score = 0;
      if (modelNorm === qNorm) score += 100;
      if (modelNorm.startsWith(qNorm) || modelLower.startsWith(q)) score += 50;
      score += Math.max(0, 40 - modelNorm.length);
      if (score > bestScore) {
        bestScore = score;
        best = model;
      }
    });

    return best;
  }

  function findProductCategoryMatch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    for (const category of BRAND_PRODUCT_SEARCH) {
      const matched = category.terms.some(term => q.includes(term) || term.includes(q));
      if (matched) return category.label;
    }
    return null;
  }

  function getBrandSearchMatch(brand, query) {
    if (!query) return { show: true, label: null };

    const q = query.toLowerCase().trim();
    const name = brand.name.toLowerCase();
    const slug = brand.slug.toLowerCase();

    if (name.includes(q) || slug.includes(q)) {
      return { show: true, label: null };
    }

    const engineMatch = findEngineModelMatch(brand.engineModels || [], q);
    if (engineMatch) {
      return { show: true, label: engineMatch };
    }

    const productMatch = findProductCategoryMatch(q);
    if (productMatch) {
      return { show: true, label: productMatch };
    }

    return { show: false, label: null };
  }

  function updateBrandMatchLabel(el, label) {
    const matchEl = el.querySelector('.brand-search-match');
    if (!matchEl) return;
    if (label) {
      matchEl.textContent = label ? `${t('brands.matched', 'Matched:')}${label}` : '';
      matchEl.classList.remove('hidden');
    } else {
      matchEl.textContent = '';
      matchEl.classList.add('hidden');
    }
  }

  function brandProductUrl(brand) {
    if (brand.landingPage) return brand.landingPage;
    return `contact.html?brand=${encodeURIComponent(brand.slug)}`;
  }

  function normalizeBrandSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isCountableStockItem(item) {
    const status = String(item?.status || '').trim().toLowerCase();
    return !['sold', 'unavailable', 'removed', 'private', 'draft'].includes(status);
  }

  function getPublicStockItems() {
    if (Array.isArray(window.HALF_CUT_LIST)) return window.HALF_CUT_LIST;
    return [];
  }

  function getBrandsWithPublicStock(config) {
    const configured = new Map((config.brandsDirectory || []).map((brand) => [brand.slug, brand]));
    const counts = new Map();
    const names = new Map();

    getPublicStockItems().forEach((item) => {
      if (!isCountableStockItem(item)) return;
      const slug = item.brandSlug || normalizeBrandSlug(item.brand);
      if (!slug) return;
      counts.set(slug, (counts.get(slug) || 0) + 1);
      if (!names.has(slug)) names.set(slug, item.brand || slug);
    });

    const priority = [
      ...(config.featuredBrandSlugs || []),
      'toyota',
      'nissan',
      'honda',
      'hyundai',
      'kia',
      'mitsubishi',
    ];
    const priorityRank = new Map(priority.map((slug, index) => [slug, index]));

    return Array.from(counts, ([slug, count]) => {
      const baseBrand = configured.get(slug) || {};
      return {
        ...baseBrand,
        slug,
        name: baseBrand.name || names.get(slug) || slug,
        inventoryCount: count,
      };
    }).sort((a, b) => {
      const ar = priorityRank.has(a.slug) ? priorityRank.get(a.slug) : 999;
      const br = priorityRank.has(b.slug) ? priorityRank.get(b.slug) : 999;
      if (ar !== br) return ar - br;
      if ((b.inventoryCount || 0) !== (a.inventoryCount || 0)) return (b.inventoryCount || 0) - (a.inventoryCount || 0);
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  function renderFeaturedBrandCard(brand) {
    const initial = brand.name.charAt(0);
    const url = brandProductUrl(brand);
    const cta = brand.landingPage ? t('brands.viewDirectory', 'View Brand Directory') : t('brand.requestQuote', 'Request Quote');

    return `
      <article class="brand-card brand-card--featured-lg" data-brand-slug="${brand.slug}" id="brand-featured-${brand.slug}">
        <div class="brand-card__inner">
          <span class="brand-card__badge">${t('brands.featured', 'Featured')}</span>
          <div class="brand-card__header">
            <h2 class="brand-card__name">${brand.name}</h2>
            <span class="brand-card__initial" aria-hidden="true">${initial}</span>
          </div>
          <p class="brand-search-match hidden" aria-live="polite"></p>
          <p class="brand-card__summary">${t('brands.productSummary', 'Engines · Gearboxes · Chassis Parts · Half-Cuts')}</p>
          <a href="${url}" class="brand-card__action brand-card__action--featured">${cta} →</a>
        </div>
      </article>`;
  }

  function renderBrandTile(brand) {
    const initial = brand.name.charAt(0);
    const url = brandProductUrl(brand);
    const active = brand.landingPage ? ' brand-tile--active' : '';

    return `
      <a href="${url}" class="brand-tile${active}" data-brand-slug="${brand.slug}" id="brand-${brand.slug}">
        <span class="brand-tile__initial" aria-hidden="true">${initial}</span>
        <span class="brand-tile__content">
          <span class="brand-tile__name">${brand.name}</span>
          <span class="brand-search-match hidden" aria-live="polite"></span>
        </span>
      </a>`;
  }

  function translateBrandProduct(label) {
    const map = {
      Engines: t('home.catEngines', 'Engines'),
      Gearboxes: t('home.catGearboxes', 'Gearboxes'),
      'Chassis Parts': t('home.catChassis', 'Chassis Parts'),
      'Half-Cuts': t('home.catHalfCuts', 'Half-Cuts'),
    };
    return map[label] || label;
  }

  function renderBrandCard(brand, config) {
    const products = config.brandProducts.map(p =>
      `<li><span class="brand-card__check" aria-hidden="true">✓</span> ${translateBrandProduct(p)}</li>`
    ).join('');
    const initial = brand.name.charAt(0);
    const featuredClass = brand.featured ? ' brand-card--featured' : '';
    const badge = brand.featured ? `<span class="brand-card__badge">${t('brands.priority', 'Priority')}</span>` : '';
    const url = brandProductUrl(brand);
    const searchName = brand.name.toLowerCase();

    return `
      <article class="brand-card${featuredClass}" data-brand-name="${searchName}" data-brand-slug="${brand.slug}" id="brand-${brand.slug}">
        ${badge}
        <div class="brand-card__inner">
          <div class="brand-card__header">
            <h2 class="brand-card__name">${brand.name}</h2>
            <span class="brand-card__initial" aria-hidden="true">${initial}</span>
          </div>
          <div class="brand-card__products-label">${t('brands.availableProducts', 'Available Products')}</div>
          <ul class="brand-card__products">${products}</ul>
          <a href="${url}" class="brand-card__action">${brand.landingPage ? t('brands.viewBrand', 'View Brand') : t('brands.viewProducts', 'View Products')}</a>
        </div>
      </article>`;
  }

  let brandsDirectorySearchBound = false;

  function initBrandDirectory() {
    const matrix = document.getElementById('brand-matrix');
    const featuredMatrix = document.getElementById('brand-featured-matrix');
    const config = window.ASIAPOWER;
    if (!matrix && !featuredMatrix) return;
    if (!config || !Array.isArray(config.brandsDirectory) || !Array.isArray(config.brandProducts)) {
      console.error('AsiaPower: brandsDirectory data missing — check js/config.js');
      return;
    }

    const brands = getBrandsWithPublicStock(config);
    const featuredSlugs = config.featuredBrandSlugs || [];
    const featuredBrands = featuredSlugs
      .map(slug => brands.find(b => b.slug === slug))
      .filter(Boolean);

    try {
      if (featuredMatrix) {
        featuredMatrix.innerHTML = featuredBrands.map(brand => renderFeaturedBrandCard(brand)).join('');
      }
      if (matrix) {
        matrix.innerHTML = brands.map(brand => renderBrandTile(brand)).join('');
      }
    } catch (err) {
      console.error('AsiaPower: failed to render brand directory', err);
      return;
    }

    const totalEl = document.getElementById('brand-total-count');
    const visibleEl = document.getElementById('brand-visible-count');
    const countMetric = document.getElementById('brand-count-metric');
    const emptyEl = document.getElementById('brands-empty');
    const searchInput = document.getElementById('brand-search');
    const featuredSection = document.querySelector('.brands-section--featured');

    const brandBySlug = Object.fromEntries(brands.map(brand => [brand.slug, brand]));
    const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(config.whatsappMessage)}`;

    if (totalEl) totalEl.textContent = brands.length;
    if (visibleEl) visibleEl.textContent = brands.length;
    if (countMetric) countMetric.textContent = brands.length;
    if (emptyEl) {
      emptyEl.classList.add('hidden');
      emptyEl.innerHTML = `<p>${t('brands.noResults', 'No matching brand or engine model found.')} ${t('brands.noResultsHint', 'Try another keyword or contact us on WhatsApp.')} <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a>.</p>`;
    }

    function filterBrands() {
      const query = (searchInput?.value || '').trim();
      let visible = 0;
      let featuredVisible = 0;

      matrix?.querySelectorAll('.brand-tile').forEach(tile => {
        const brand = brandBySlug[tile.dataset.brandSlug || ''];
        const result = brand ? getBrandSearchMatch(brand, query) : { show: !query, label: null };
        tile.classList.toggle('hidden', !result.show);
        tile.style.display = result.show ? '' : 'none';
        updateBrandMatchLabel(tile, query ? result.label : null);
        if (result.show) visible++;
      });

      featuredMatrix?.querySelectorAll('.brand-card').forEach(card => {
        const brand = brandBySlug[card.dataset.brandSlug || ''];
        const result = brand ? getBrandSearchMatch(brand, query) : { show: !query, label: null };
        card.classList.toggle('hidden', !result.show);
        card.style.display = result.show ? '' : 'none';
        updateBrandMatchLabel(card, query ? result.label : null);
        if (result.show) featuredVisible++;
      });

      if (featuredSection) {
        featuredSection.classList.toggle('hidden', featuredBrands.length === 0 || (query.length > 0 && featuredVisible === 0));
      }
      if (visibleEl) visibleEl.textContent = visible;
      if (emptyEl) emptyEl.classList.toggle('hidden', visible > 0);
    }

    if (searchInput && !brandsDirectorySearchBound) {
      brandsDirectorySearchBound = true;
      searchInput.addEventListener('input', filterBrands);
      searchInput.addEventListener('search', filterBrands);
    }
    filterBrands();
  }

  function initBrandDetailNav() {
    const nav = document.querySelector('.brand-detail-nav');
    if (!nav) return;

    const links = nav.querySelectorAll('.brand-detail-nav__link');
    const sections = Array.from(links).map(link => {
      const id = link.getAttribute('href')?.slice(1);
      return id ? document.getElementById(id) : null;
    }).filter(Boolean);

    function setActive() {
      const scrollY = window.scrollY + 120;
      let current = sections[0];
      sections.forEach(section => {
        if (section.offsetTop <= scrollY) current = section;
      });
      links.forEach(link => {
        const id = link.getAttribute('href')?.slice(1);
        link.classList.toggle('active', id === current?.id);
      });
    }

    window.addEventListener('scroll', setActive, { passive: true });
    setActive();
  }

  function initWhatsAppAnalytics() {
    if (window.__ASIAPOWER_WA_ANALYTICS_INIT__) return;
    window.__ASIAPOWER_WA_ANALYTICS_INIT__ = true;

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="wa.me"]');
      if (!link) return;
      const payload = {
        eventType: 'whatsapp_click',
        page: window.location.pathname + window.location.search,
        href: link.href,
        label: (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        timestamp: new Date().toISOString(),
        ...(window.AsiaLeadContext?.captureUtm?.() || window.AsiaPowerUtm?.forLead?.() || {}),
      };
      const body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
        } else {
          fetch('/api/analytics/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // analytics must not block navigation
      }
      trackAdsLeadEvent('whatsapp_click', {
        method: 'whatsapp_link',
        link_url: link.href,
        link_text: payload.label,
      });
    }, true);
  }

  const WA_PROMPT_SKIP_SELECTOR = '[data-half-cut-wa], [data-half-cut-lead], [data-product-lead], #quote-wa-btn, [data-wa-no-prompt]';

  function initGenericWhatsAppLeadCapture() {
    if (window.__ASIAPOWER_WA_LEAD_CAPTURE_INIT__) return;
    window.__ASIAPOWER_WA_LEAD_CAPTURE_INIT__ = true;

    document.addEventListener('click', async (e) => {
      const link = e.target.closest('a[href*="wa.me"]');
      if (!link || link.closest(WA_PROMPT_SKIP_SELECTOR)) return;
      if (!window.SiteFeedback?.promptContact) return;

      e.preventDefault();

      const contact = await window.SiteFeedback.promptContact({
        message: t('leadContact.whatsappSaveHint', 'We will save your enquiry before opening WhatsApp.'),
      });
      if (!contact) return;

      presentFeedback(null, {
        type: 'info',
        title: t('feedback.saving', 'Saving enquiry…'),
        message: t('feedback.savingMsg', 'Please wait while we submit your enquiry.'),
      });

      try {
        const params = new URLSearchParams(window.location.search);
        const brand = params.get('brand') || '';
        const product = params.get('product') || '';
        let enquiryType = '';
        let vehicleDetails = '';
        if (brand || product) {
          const lines = [];
          if (brand) lines.push(`Brand: ${brand}`);
          if (product) lines.push(`Product / Engine code: ${product}`);
          vehicleDetails = lines.join('\n');
          const p = product.toLowerCase();
          if (p.includes('gearbox') || p.includes('transmission')) enquiryType = 'gearbox';
          else if (p.includes('chassis')) enquiryType = 'chassis';
          else if (p.includes('engine')) enquiryType = 'engine';
          else if (product) enquiryType = 'engine';
        }
        const leadMeta = window.AsiaLeadContext?.captureLeadMeta?.({
          brand,
          product,
          enquiry_type: enquiryType,
          source: 'whatsapp-intent',
        }) || {
          pageUrl: `${window.location.pathname}${window.location.search}`,
          page: `${window.location.pathname}${window.location.search}`,
          referrer: document.referrer || '',
        };
        const res = await fetch('/api/leads/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...contact,
            intent: 'whatsapp',
            source: 'whatsapp-intent',
            brand,
            product,
            model: product,
            productLabel: leadMeta.productLabel || '',
            inquirySubject: leadMeta.inquirySubject || '',
            replySubject: leadMeta.replySubject || '',
            enquiry_type: enquiryType,
            vehicle_details: vehicleDetails,
            pageUrl: leadMeta.pageUrl,
            page: leadMeta.page || leadMeta.pageUrl,
            referrer: leadMeta.referrer || '',
            utm_source: leadMeta.utm_source || '',
            utm_medium: leadMeta.utm_medium || '',
            utm_campaign: leadMeta.utm_campaign || '',
            utm_content: leadMeta.utm_content || '',
            utm_term: leadMeta.utm_term || '',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save enquiry');
        window.SiteFeedback?.toast?.(t('feedback.enquirySaved', 'Enquiry saved'), 'success');
        trackAdsLeadEvent('generate_lead', {
          method: 'whatsapp_intent',
          lead_id: data?.id || '',
          page_path: window.location.pathname,
        });
        window.open(link.href, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('[whatsapp-lead]', err);
        notifyFeedback({
          type: 'error',
          title: t('feedback.enquiryFailed', 'Could not save enquiry'),
          message: err?.message || t('feedback.enquiryFailedMsg', 'Something went wrong. Please try again or contact us directly.'),
        });
      }
    }, true);
  }

  function initCaseStudyVideos() {
    document.querySelectorAll('[data-case-video]').forEach((card) => {
      const btn = card.querySelector('.case-card__play');
      const video = card.querySelector('.case-card__video');
      if (!btn || !video) return;

      const startPlayback = () => {
        card.classList.add('case-card--is-playing');
        video.hidden = false;
        video.load();
        video.play().catch(() => {});
      };

      btn.addEventListener('click', startPlayback);
      card.querySelector('.case-card__poster')?.addEventListener('click', startPlayback);
    });
  }

  function initCaseStudyCarousel() {
    const track = document.getElementById('case-studies-track');
    if (!track) return;
    const prevBtn = document.querySelector('[data-case-prev]');
    const nextBtn = document.querySelector('[data-case-next]');
    const scrollByCard = (direction) => {
      const card = track.querySelector('.case-card');
      const step = (card?.getBoundingClientRect().width || 220) + 20;
      track.scrollBy({ left: step * direction, behavior: 'smooth' });
    };
    prevBtn?.addEventListener('click', () => scrollByCard(-1));
    nextBtn?.addEventListener('click', () => scrollByCard(1));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initFAQ();
    initFilters();
    initURLFilters();
    initForms();
    initQuoteWhatsAppButton();
    initWhatsAppCtaLinks();
    initContactPrefill();
    initContactInfo();
    initContactCountrySelect();
    initPhoneInputs();
    initContactFormFeedbackReset();
    initHeaderShadow();
    initCategoryGrid();
    initStatsStrip();
    initBrandsMarquee();
    initBrandDirectory();
    initBrandDetailNav();
    initPlatformOffices();
    initHomepageBrands();
    initEngineCatalogPage();
    initGearboxCatalogPage();
    initChassisCatalogPage();
    initFrontCutCatalogPage();
    initWhatsAppAnalytics();
    initGenericWhatsAppLeadCapture();
    initCaseStudyVideos();
    initCaseStudyCarousel();
    window.InquiryCta?.initPage?.();
  });

  window.addEventListener('load', () => {
    const matrix = document.getElementById('brand-matrix');
    if (matrix && matrix.children.length === 0) {
      initBrandDirectory();
    }
  });

  window.addEventListener('asiapower:layoutrefresh', initMobileNav);

  window.addEventListener('asiapower:langchange', () => {
    initEngineCatalogPage();
    initGearboxCatalogPage();
    initChassisCatalogPage();
    initFrontCutCatalogPage();
    if (document.getElementById('brand-matrix') || document.getElementById('brand-featured-matrix')) {
      initBrandDirectory();
    }
    initContactCountrySelect();
    initPhoneInputs();
    initContactFormFeedbackReset();
  });
})();
