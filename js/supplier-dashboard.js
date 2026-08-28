(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STATUS_LABELS = {
    Available: '现货', Reserved: '已预订', 'In Transit': '运输中', Sold: '已售',
  };
  const REVISION_LABELS = {
    draft: '草稿', pending: '待平台审核', rejected: '审核未通过', approved: '已审核', withdrawn: '已撤回',
  };
  const FIELD_LABELS = {
    brand: '品牌', model: '型号', year: '年份', vin: 'VIN', mileage: '里程',
    engineCode: '发动机型号', transmissionCode: '变速箱型号', drivetrain: '驱动形式',
    priceUsd: 'EXW 价格', status: '库存状态', listingVisibility: '上下架状态', photos: '照片',
    video: '视频', videoUrl: '视频', shortDescription: '短描述', notes: '内部备注',
  };
  const REVIEW_INPUTS = {
    'edit-brand': 'brand', 'edit-model': 'model', 'edit-year': 'year', 'edit-vin': 'vin',
    'edit-mileage': 'mileage', 'edit-engine': 'engineCode', 'edit-trans': 'transmissionCode',
    'edit-drive': 'drivetrain', 'edit-desc': 'shortDescription', 'edit-notes': 'notes',
  };

  const state = {
    user: null,
    items: [],
    filter: 'all',
    search: '',
    detail: null,
    item: null,
    published: null,
    photos: [],
    video: null,
    evidence: [],
    audit: [],
    dirty: new Set(),
    dragged: null,
    uploadToken: '',
    uploadTokenExpiresAt: 0,
    busy: false,
    referral: null,
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function upperBrand(value) {
    return String(value || '').replace(/[A-Za-z][A-Za-z0-9+.-]*/g, (token) => token.toUpperCase());
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? `USD ${number.toLocaleString('en-US')}` : '询价';
  }

  function mediaUrl(photo, preferThumb = false) {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return preferThumb ? (photo.thumbUrl || photo.url || '') : (photo.url || photo.thumbUrl || '');
  }

  function setPoster(element, url) {
    if (!element) return;
    element.style.backgroundImage = url ? `url("${String(url).replace(/"/g, '%22')}")` : '';
  }

  function toast(message, duration = 3400) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('on'), duration);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function hideAllViews() {
    ['#login-prompt', '#profile-panel', '#referral-panel', '#inventory-view', '#editor-view'].forEach((selector) => {
      const element = $(selector);
      if (element) element.hidden = true;
    });
  }

  function setActiveNav(target) {
    $$('.supplier-nav-item').forEach((item) => item.classList.remove('active'));
    const active = target === 'inventory'
      ? $('.supplier-nav-item[data-go-list]')
      : (target === 'referral' ? $('#show-referral-btn') : $('#edit-company-btn'));
    if (active) active.classList.add('active');
    $('.supplier-sidebar')?.classList.remove('open');
    $('#mobile-menu')?.setAttribute('aria-expanded', 'false');
  }

  function showLoginPrompt() {
    hideAllViews();
    $('#login-prompt').hidden = false;
  }

  function fillProfileForm(user) {
    const values = {
      'prof-company': user.supplierName, 'prof-business': user.businessType,
      'prof-contact': user.contactPerson, 'prof-country': user.country,
      'prof-email': user.email, 'prof-address': user.address, 'prof-spec': user.specialization,
      'prof-brands': user.brands, 'prof-wechat': user.wechat, 'prof-city': user.city,
    };
    Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value || ''; });
  }

  function showProfile(user, completing = false) {
    hideAllViews();
    setActiveNav('profile');
    fillProfileForm(user || {});
    $('#profile-sub').textContent = completing
      ? `还需补全：${(user?.missingFields || []).map((field) => field.label).join('、') || '公司资料'}`
      : '修改后的公司资料将用于平台审核与业务联系。';
    $('#profile-panel').hidden = false;
    $('#security-panel').hidden = user?.role === 'admin';
  }

  function statusBadge(item) {
    if (item.listingVisibility === 'delisted') return '<span class="supplier-badge supplier-badge--gray">已下架</span>';
    const revision = item.activeRevision?.reviewStatus;
    if (revision === 'pending') return '<span class="supplier-badge supplier-badge--gold">变更待审</span>';
    if (revision === 'draft') return '<span class="supplier-badge supplier-badge--gray">修订草稿</span>';
    if (revision === 'rejected') return '<span class="supplier-badge supplier-badge--red">需处理</span>';
    if (item.reviewStatus === 'pending') return '<span class="supplier-badge supplier-badge--gold">新库存待审</span>';
    if (item.reviewStatus === 'rejected') return '<span class="supplier-badge supplier-badge--red">审核未通过</span>';
    return '<span class="supplier-badge supplier-badge--green">已上线</span>';
  }

  function filterMatches(item) {
    if (state.filter === 'delisted') return item.listingVisibility === 'delisted';
    if (state.filter === 'pending') return item.reviewStatus === 'pending' || ['pending', 'draft'].includes(item.activeRevision?.reviewStatus);
    if (state.filter === 'rejected') return item.reviewStatus === 'rejected' || item.activeRevision?.reviewStatus === 'rejected';
    if (state.filter === 'approved') return item.source === 'approved' && item.listingVisibility !== 'delisted';
    return true;
  }

  function renderInventoryList() {
    const query = state.search.toLowerCase();
    const items = state.items.filter((item) => {
      if (!filterMatches(item)) return false;
      if (!query) return true;
      return [item.stockId, item.submissionId, item.brand, item.model, item.title]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
    const container = $('#upload-rows');
    if (!items.length) {
      container.innerHTML = '<div class="supplier-empty"><strong>没有符合条件的库存</strong><p>可调整筛选条件，或发布一条新库存。</p></div>';
      return;
    }
    container.innerHTML = items.map((item) => {
      const id = item.stockId || item.submissionId || item.id;
      const title = [upperBrand(item.brand), item.model, item.year].filter(Boolean).join(' ') || item.title || id;
      const image = mediaUrl(item.photos?.[0], true) || item.photo || '';
      const mediaCount = `${item.photos?.length || 0} 图${item.video ? ' · 1 视频' : ''}`;
      return `<article class="supplier-inventory-row">
        <div class="supplier-list-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">` : '<span>NO IMAGE</span>'}${item.video ? '<b>▶ 视频</b>' : ''}</div>
        <div class="supplier-list-identity"><div>${statusBadge(item)}<span>${escapeHtml(id)}</span></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml([item.engineCode, item.transmissionCode, item.mileage].filter(Boolean).join(' · ') || '参数待补充')}</p></div>
        <div class="supplier-list-state"><small>公开库存状态</small><strong>${escapeHtml(STATUS_LABELS[item.inventoryStatus] || item.inventoryStatus || '—')}</strong><span>${escapeHtml(mediaCount)}</span></div>
        <div class="supplier-list-price"><small>EXW</small><strong>${escapeHtml(money(item.priceUsd))}</strong><span>${item.evidenceCount ? `${item.evidenceCount} 条私有证据` : '变更留痕'}</span></div>
        <button class="supplier-button supplier-button--quiet" type="button" data-edit-id="${escapeHtml(id)}">编辑库存</button>
      </article>`;
    }).join('');
    $$('[data-edit-id]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.editId)));
  }

  function renderInventory(payload) {
    state.items = payload.items || [];
    const counts = payload.counts || {};
    $('#c-total').textContent = counts.total || 0;
    $('#c-live').textContent = counts.approved || 0;
    $('#c-pending').textContent = counts.pending || 0;
    $('#c-rejected').textContent = counts.rejected || 0;
    $('#c-delisted').textContent = counts.delisted || 0;
    $('#sidebar-total').textContent = counts.total || 0;
    const supplier = payload.supplier || {};
    $('#supplier-identity').textContent = [supplier.supplierName, supplier.phoneNormalized || supplier.phone].filter(Boolean).join(' · ') || '供应商账户';
    renderInventoryList();
  }

  async function loadInventory() {
    $('#upload-rows').innerHTML = '<div class="supplier-loading">正在读取账户绑定的库存…</div>';
    const payload = await request('/api/half-cuts/my-uploads');
    renderInventory(payload);
  }

  async function showInventory() {
    hideAllViews();
    setActiveNav('inventory');
    $('#inventory-view').hidden = false;
    history.replaceState({}, '', '/supplier-portal/dashboard.html');
    await loadInventory();
  }

  function formatReferralTime(value) {
    if (!value) return '尚未使用';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '尚未使用';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function renderReferral(referral) {
    state.referral = referral;
    $('#referral-code').textContent = referral.code || '—';
    $('#referral-use-count').textContent = Number(referral.useCount || 0).toLocaleString('zh-CN');
    $('#referral-last-used').textContent = formatReferralTime(referral.lastUsedAt);
    $('#referral-loading').hidden = true;
    $('#referral-error').hidden = true;
    $('#referral-content').hidden = false;
  }

  async function showReferral() {
    hideAllViews();
    setActiveNav('referral');
    $('#referral-panel').hidden = false;
    $('#referral-loading').hidden = false;
    $('#referral-content').hidden = true;
    $('#referral-error').hidden = true;
    $('#referral-copy-status').textContent = '可重复使用，不与被推荐人的手机号绑定。';
    try {
      const payload = await request('/api/supplier/referral-code');
      if (!payload.referralCode?.code) throw new Error('账户暂未分配推荐码');
      renderReferral(payload.referralCode);
    } catch (error) {
      $('#referral-loading').hidden = true;
      $('#referral-error').hidden = false;
      $('#referral-error-copy').textContent = error.message || '请稍后重试，或联系平台运营。';
    }
  }

  async function copyReferralCode() {
    const code = state.referral?.code || '';
    if (!code) return;
    const button = $('#copy-referral-code');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const field = document.createElement('textarea');
        field.value = code;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('copy failed');
      }
      $('#referral-copy-status').textContent = '已复制，可以直接发给要加入网站的供应商。';
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = '复制推荐码'; }, 1800);
    } catch {
      $('#referral-copy-status').textContent = `无法自动复制，请手动复制：${code}`;
    }
  }

  function markDirty(field, message) {
    state.dirty.add(field);
    $('#save-card').classList.add('changed');
    $('#change-state').textContent = message || '有待提交变更';
    syncPreview();
  }

  function resetDirty() {
    state.dirty.clear();
    $('#save-card').classList.remove('changed');
    $('#change-state').textContent = '尚无待提交变更';
  }

  function currentTitle() {
    return [upperBrand($('#edit-brand').value.trim()), $('#edit-model').value.trim(), $('#edit-year').value]
      .filter(Boolean).join(' ');
  }

  function syncPreview() {
    if (!state.item) return;
    $('#preview-title').textContent = currentTitle() || state.item.title || state.item.id;
    $('#preview-meta').textContent = [$('#edit-engine').value.trim(), $('#edit-trans').value.trim(), $('#edit-mileage').value.trim()].filter(Boolean).join(' · ') || '参数待补充';
    $('#preview-price').textContent = money($('#edit-price').value);
    const status = $('#edit-status').value;
    $('#preview-status').innerHTML = `<span></span> ${escapeHtml(STATUS_LABELS[status] || status)}`;
    $('#preview-evidence').textContent = `${state.photos.length} 张照片${state.video ? ' · 1 个视频' : ''}`;
    setPoster($('#preview-media'), mediaUrl(state.photos[0], true));
    $('#preview-play').hidden = !state.video;
    $('#preview-video-label').hidden = !state.video;
  }

  function movePhoto(from, to) {
    if (!Number.isInteger(from) || to < 0 || to >= state.photos.length || from === to) return;
    const [photo] = state.photos.splice(from, 1);
    state.photos.splice(to, 0, photo);
    markDirty('photos', '照片顺序变更待审核');
    renderGallery();
  }

  function removePhoto(index) {
    if (state.photos.length <= 1) return toast('公开库存至少保留 1 张照片');
    state.photos.splice(index, 1);
    markDirty('photos', '照片移除待审核');
    renderGallery();
  }

  function renderGallery() {
    $('#photo-count').textContent = state.photos.length;
    $('#gallery').innerHTML = state.photos.map((photo, index) => {
      const url = mediaUrl(photo, true);
      return `<article class="supplier-media-item" draggable="true" data-photo-index="${index}"><div class="supplier-media-image"><img src="${escapeHtml(url)}" alt="实拍照片 ${index + 1}"><span>${String(index + 1).padStart(2, '0')}</span>${index === 0 ? '<b>备用封面</b>' : ''}</div><div class="supplier-media-actions"><button type="button" data-photo-action="left" ${index === 0 ? 'disabled' : ''}>← 前移</button><button type="button" data-photo-action="right" ${index === state.photos.length - 1 ? 'disabled' : ''}>后移 →</button><button type="button" data-photo-action="cover">设为封面</button><button class="danger" type="button" data-photo-action="remove">移除</button></div></article>`;
    }).join('');
    $$('.supplier-media-item').forEach((card) => {
      const index = Number(card.dataset.photoIndex);
      card.querySelectorAll('[data-photo-action]').forEach((button) => button.addEventListener('click', () => {
        if (button.dataset.photoAction === 'left') movePhoto(index, index - 1);
        if (button.dataset.photoAction === 'right') movePhoto(index, index + 1);
        if (button.dataset.photoAction === 'cover') movePhoto(index, 0);
        if (button.dataset.photoAction === 'remove') removePhoto(index);
      }));
      card.addEventListener('dragstart', () => { state.dragged = index; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { state.dragged = null; card.classList.remove('dragging'); });
      card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (event) => { event.preventDefault(); card.classList.remove('drag-over'); movePhoto(state.dragged, index); });
    });
    syncPreview();
  }

  function renderVideo() {
    $('#video-row').hidden = !state.video;
    if (state.video) $('#video-name').textContent = state.video.fileName || '库存实拍视频';
    setPoster($('#video-poster'), mediaUrl(state.photos[0], true));
    syncPreview();
  }

  function renderEvidence() {
    $('#archive-count').textContent = state.evidence.length;
    $('#archive-list').innerHTML = state.evidence.length ? state.evidence.map((entry) => `<article class="supplier-evidence-item"><div class="supplier-evidence-preview">${entry.available ? (entry.kind === 'video' ? `<video src="${escapeHtml(entry.previewUrl)}" controls preload="metadata"></video>` : `<img src="${escapeHtml(entry.previewUrl)}" alt="私有归档证据" loading="lazy">`) : '<span>仅保留历史引用</span>'}</div><div><strong>${entry.kind === 'video' ? '原始视频证据' : '原始照片证据'}</strong><span>${escapeHtml((entry.archivedAt || '').replace('T', ' ').slice(0, 19))}</span></div><b>私有</b></article>`).join('') : '<div class="supplier-empty supplier-empty--compact">暂无已归档媒体。移除操作只有在修订审核通过后才会进入这里。</div>';
  }

  function auditDescription(event) {
    if (event.type === 'supplier_immediate_field_changed') return `${FIELD_LABELS[event.field] || event.field} 已即时更新`;
    if (event.type === 'listing_visibility_changed') return event.after === 'delisted' ? '供应商下架库存' : '供应商恢复上架';
    if (event.type === 'supplier_revision_submitted') return `提交修订审核：${(event.fields || []).map((field) => FIELD_LABELS[field] || field).join('、')}`;
    if (event.type === 'supplier_revision_saved') return '保存修订草稿';
    if (event.type === 'inventory_revision_approved') return '修订已审核通过并发布';
    if (event.type === 'inventory_revision_rejected') return `修订未通过${event.reason ? `：${event.reason}` : ''}`;
    if (event.type === 'supplier_revision_withdrawn') return '撤回修订';
    return event.type || '库存操作';
  }

  function renderAudit() {
    $('#audit-list').innerHTML = state.audit.length ? state.audit.map((event) => `<div><span></span><p><strong>${escapeHtml(auditDescription(event))}</strong><small>${escapeHtml((event.at || '').replace('T', ' ').slice(0, 19))} · ${escapeHtml(event.actorName || event.actorRole || '系统')}</small></p></div>`).join('') : '<div class="supplier-empty supplier-empty--compact">暂无变更记录。</div>';
  }

  function publicDetailUrl(item) {
    const slug = encodeURIComponent(item?.slug || item?.stockId || '');
    if (item?.vehicleListingType === 'used') return `/used-cars/detail.html?slug=${slug}`;
    if (item?.vehicleCategory === 'truck') return `/trucks/detail.html?slug=${slug}`;
    if (item?.vehicleCategory === 'machinery') return `/machinery/detail.html?slug=${slug}`;
    return `/half-cuts/detail.html?slug=${slug}`;
  }

  function fillEditor(detail) {
    state.detail = detail;
    state.item = detail.item;
    state.published = detail.publishedItem || detail.item;
    state.photos = (detail.item.photos || []).map((photo) => typeof photo === 'string' ? { url: photo } : { ...photo });
    state.video = detail.item.video ? { ...detail.item.video } : null;
    state.evidence = detail.evidence || [];
    state.audit = detail.audit || [];
    resetDirty();

    const item = state.item;
    const published = state.published;
    const fields = {
      'edit-brand': upperBrand(item.brand), 'edit-model': item.model, 'edit-year': item.year,
      'edit-vin': item.vin, 'edit-mileage': item.mileage, 'edit-engine': item.engineCode,
      'edit-trans': item.transmissionCode, 'edit-drive': item.drivetrain,
      'edit-price': published.priceUsd, 'edit-status': published.inventoryStatus || 'Available',
      'edit-desc': item.shortDescription, 'edit-notes': item.notes,
    };
    Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; });

    const title = [upperBrand(item.brand), item.model, item.year].filter(Boolean).join(' ') || item.title || item.id;
    $('#record-title').textContent = title;
    $('#record-id').textContent = published.stockId || item.stockId || item.submissionId;
    $('#record-meta').textContent = [item.engineCode, item.transmissionCode, item.mileage].filter(Boolean).join(' · ') || '参数待补充';
    $('#record-price').textContent = money(published.priceUsd);
    $('#record-thumb').src = mediaUrl(state.photos[0], true) || '/assets/favicon.png';
    $('#record-thumb').alt = title;
    const revision = item.activeRevision;
    $('#record-revision').textContent = revision ? (REVISION_LABELS[revision.reviewStatus] || revision.reviewStatus) : '无待审变更';
    $('#record-state').innerHTML = published.listingVisibility === 'delisted' ? '<span></span> 已下架' : '<span></span> 已上线';
    $('#record-state').classList.toggle('delisted', published.listingVisibility === 'delisted');
    $('#revision-banner').classList.toggle('rejected', revision?.reviewStatus === 'rejected');
    $('#revision-banner').querySelector('strong').textContent = revision?.reviewStatus === 'rejected' ? '修订未通过，请修改后重新提交' : '关键修改将创建待审版本';
    $('#visibility-button').textContent = published.listingVisibility === 'delisted' ? '恢复上架' : '下架该库存';
    $('#public-link').href = publicDetailUrl(published);
    $('#public-link').hidden = published.listingVisibility === 'delisted' || !published.slug;

    renderGallery();
    renderVideo();
    renderEvidence();
    renderAudit();
    $('#editor-loading').hidden = true;
    $('#editor-workspace').hidden = false;
  }

  async function openEditor(id) {
    hideAllViews();
    $('#editor-view').hidden = false;
    $('#editor-loading').hidden = false;
    $('#editor-workspace').hidden = true;
    history.replaceState({}, '', `/supplier-portal/dashboard.html?stock=${encodeURIComponent(id)}`);
    try {
      fillEditor(await request(`/api/half-cuts/my-uploads/${encodeURIComponent(id)}`));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast(error.message, 5200);
      await showInventory();
    }
  }

  async function getUploadToken() {
    if (state.uploadToken && Date.now() < state.uploadTokenExpiresAt - 60000) return state.uploadToken;
    const data = await request('/api/half-cuts/upload-token', { method: 'POST' });
    state.uploadToken = data.token || '';
    state.uploadTokenExpiresAt = Date.parse(data.expiresAt || '') || Date.now() + 25 * 60 * 1000;
    return state.uploadToken;
  }

  async function uploadFile(file, kind, label) {
    const token = await getUploadToken();
    const form = new FormData();
    form.append('file', file);
    if (label) form.append('label', label);
    return request(`/api/half-cuts/upload/${kind}`, {
      method: 'POST', headers: token ? { 'X-Upload-Token': token } : {}, body: form,
    });
  }

  async function handlePhotoUpload(files) {
    const room = Math.max(0, 15 - state.photos.length);
    const selected = [...files].slice(0, room);
    if (!selected.length) return toast(room ? '请选择照片' : '最多允许 15 张照片');
    const invalid = selected.find((file) => file.size > 8 * 1024 * 1024);
    if (invalid) return toast(`${invalid.name} 超过 8MB`);
    const progress = $('#upload-progress');
    progress.hidden = false;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        progress.textContent = `正在上传第 ${index + 1} / ${selected.length} 张照片…`;
        const photo = await uploadFile(selected[index], 'photo', selected[index].name);
        state.photos.push(photo);
        renderGallery();
      }
      markDirty('photos', '新增照片待审核');
      toast(`已安全上传 ${selected.length} 张照片，尚未提交审核`);
    } catch (error) {
      state.uploadToken = '';
      toast(error.message, 5200);
    } finally {
      progress.hidden = true;
      $('#photo-input').value = '';
    }
  }

  async function handleVideoUpload(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast(`${file.name} 超过 50MB`);
    const progress = $('#upload-progress');
    progress.hidden = false;
    progress.textContent = '正在上传视频，请保持页面打开…';
    try {
      state.video = await uploadFile(file, 'video');
      markDirty('video', '视频变更待审核');
      renderVideo();
      toast('视频已安全上传，尚未提交审核');
    } catch (error) {
      state.uploadToken = '';
      toast(error.message, 5200);
    } finally {
      progress.hidden = true;
      $('#video-input').value = '';
    }
  }

  function buildSaveBody(action) {
    const immediate = {};
    const proposed = {};
    if (state.dirty.has('priceUsd')) immediate.priceUsd = $('#edit-price').value;
    if (state.dirty.has('inventoryStatus')) immediate.inventoryStatus = $('#edit-status').value;
    Object.entries(REVIEW_INPUTS).forEach(([id, field]) => {
      if (!state.dirty.has(field)) return;
      const value = document.getElementById(id).value.trim();
      proposed[field] = field === 'year' && value ? Number(value) : value;
    });
    if (state.dirty.has('photos')) proposed.photos = state.photos.map((photo) => ({ ...photo }));
    if (state.dirty.has('video')) {
      proposed.video = state.video ? { ...state.video } : null;
      proposed.videoUrl = state.video?.url || '';
    }
    return { action, immediate, proposed };
  }

  async function saveChanges(action) {
    if (state.busy || !state.item) return;
    const activeRevision = state.item.activeRevision;
    if (!state.dirty.size && !(activeRevision && ['draft', 'pending', 'rejected'].includes(activeRevision.reviewStatus))) {
      return toast('尚无需要保存的变更');
    }
    if (state.photos.length < 1) return toast('公开库存至少需要 1 张照片');
    state.busy = true;
    const buttons = [$('#save-draft'), $('#submit-review')];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const id = state.published?.stockId || state.item.stockId || state.item.submissionId || state.item.id;
      const result = await request(`/api/half-cuts/my-uploads/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildSaveBody(action)),
      });
      const immediateCount = result.immediateChanges?.length || 0;
      const copy = action === 'save-draft'
        ? `草稿已保存${immediateCount ? '；价格或状态已即时生效并留痕' : ''}`
        : `变更已提交审核${immediateCount ? '；价格或状态已即时生效并留痕' : ''}`;
      toast(copy, 4800);
      await openEditor(id);
    } catch (error) {
      toast(error.message, 5600);
    } finally {
      state.busy = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  function confirmDialog({ title, copy, confirmLabel = '确认', danger = false }) {
    return new Promise((resolve) => {
      $('#dialog-title').textContent = title;
      $('#dialog-copy').textContent = copy;
      const confirm = $('#dialog-confirm');
      confirm.textContent = confirmLabel;
      confirm.classList.toggle('supplier-button--danger', danger);
      $('#dialog').hidden = false;
      const close = (answer) => {
        $('#dialog').hidden = true;
        confirm.onclick = null;
        $('#dialog-cancel').onclick = null;
        resolve(answer);
      };
      confirm.onclick = () => close(true);
      $('#dialog-cancel').onclick = () => close(false);
    });
  }

  async function toggleVisibility() {
    if (!state.published?.stockId) return toast('待审新库存暂不支持上下架操作');
    const delisted = state.published.listingVisibility === 'delisted';
    const confirmed = await confirmDialog({
      title: delisted ? '恢复公开展示？' : '下架该库存？',
      copy: delisted
        ? '恢复后该库存会重新出现在目录、搜索和公开详情页，原 URL 保持不变。'
        : '下架会立即从公开目录、搜索、详情页和站点地图隐藏，但不会物理删除库存、媒体或审核记录。',
      confirmLabel: delisted ? '恢复上架' : '确认下架', danger: !delisted,
    });
    if (!confirmed) return;
    try {
      await request(`/api/half-cuts/my-uploads/${encodeURIComponent(state.published.stockId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-review', immediate: { listingVisibility: delisted ? 'public' : 'delisted' }, proposed: {} }),
      });
      toast(delisted ? '库存已恢复上架' : '库存已安全下架');
      await openEditor(state.published.stockId);
    } catch (error) {
      toast(error.message, 5200);
    }
  }

  async function saveProfile() {
    const body = {
      supplierName: $('#prof-company').value.trim(), businessType: $('#prof-business').value,
      contactPerson: $('#prof-contact').value.trim(), country: $('#prof-country').value,
      email: $('#prof-email').value.trim(), address: $('#prof-address').value.trim(),
      specialization: $('#prof-spec').value, brands: $('#prof-brands').value.trim(),
      wechat: $('#prof-wechat').value.trim(), city: $('#prof-city').value.trim(),
    };
    try {
      const result = await request('/api/supplier/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      state.user = result.profile;
      toast('公司资料已保存');
      await showInventory();
    } catch (error) {
      toast(error.message, 5200);
    }
  }

  async function changePassword() {
    const currentPassword = $('#security-current').value;
    const password = $('#security-new').value;
    const passwordConfirm = $('#security-confirm').value;
    if (!currentPassword || !password || !passwordConfirm) return toast('请填写当前密码和两次新密码');
    if (password.length < 8) return toast('新密码至少 8 位');
    if (password !== passwordConfirm) return toast('两次新密码不一致');
    try {
      await request('/api/auth/phone/password/set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'supplier',
          phone: state.user.phone,
          countryCode: state.user.countryCode || '+86',
          currentPassword,
          password,
          passwordConfirm,
        }),
      });
      $('#security-current').value = '';
      $('#security-new').value = '';
      $('#security-confirm').value = '';
      $('#security-panel').open = false;
      toast('密码已安全修改');
    } catch (error) {
      toast(error.message, 5200);
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    location.href = '/login/?role=supplier';
  }

  async function initialize() {
    try {
      const me = await request('/api/me');
      const user = me.user;
      state.user = user;
      if (!user || !['supplier', 'admin'].includes(user.role)) return showLoginPrompt();
      if (user.role === 'supplier' && (me.needsProfile || user.profileComplete === false)) return showProfile(user, true);
      const stock = new URLSearchParams(location.search).get('stock');
      if (stock) return openEditor(stock);
      await showInventory();
    } catch (error) {
      if (error.status === 401) return showLoginPrompt();
      toast(error.message, 5200);
      showLoginPrompt();
    }
  }

  $$('.supplier-metrics [data-filter]').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    $$('.supplier-metrics [data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderInventoryList();
  }));
  $('#inventory-search').addEventListener('input', (event) => { state.search = event.target.value.trim(); renderInventoryList(); });
  $$('[data-go-list]').forEach((button) => button.addEventListener('click', () => showInventory().catch((error) => toast(error.message))));
  $('#show-referral-btn').addEventListener('click', () => showReferral());
  $('#retry-referral').addEventListener('click', () => showReferral());
  $('#copy-referral-code').addEventListener('click', copyReferralCode);
  $('#edit-company-btn').addEventListener('click', () => showProfile(state.user, false));
  $('#save-profile').addEventListener('click', saveProfile);
  $('#security-save').addEventListener('click', changePassword);
  $('#logout-btn').addEventListener('click', logout);
  $('#support-btn').addEventListener('click', async () => {
    await confirmDialog({ title: '联系 AsiaPower 平台运营', copy: '国内供应商账户恢复采用人工身份核验，不会强制使用 Google 或 WhatsApp。请通过现有业务联系人、官网 Contact 表单或公司邮箱联系运营人员。', confirmLabel: '知道了' });
  });
  $('#mobile-menu').addEventListener('click', (event) => {
    const open = $('.supplier-sidebar').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  $('#archive-toggle').addEventListener('click', (event) => {
    const open = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!open));
    $('#archive-body').hidden = open;
  });
  $('#photo-input').addEventListener('change', (event) => handlePhotoUpload(event.target.files));
  $('#video-input').addEventListener('change', (event) => handleVideoUpload(event.target.files[0]));
  $('#remove-video').addEventListener('click', () => {
    state.video = null;
    markDirty('video', '视频移除待审核');
    renderVideo();
  });
  Object.entries(REVIEW_INPUTS).forEach(([id, field]) => document.getElementById(id).addEventListener('input', (event) => {
    if (field === 'brand') event.target.value = upperBrand(event.target.value);
    if (field === 'vin') event.target.value = event.target.value.toUpperCase();
    markDirty(field, '关键参数变更待审核');
  }));
  $('#edit-price').addEventListener('input', () => markDirty('priceUsd', 'EXW 价格将在保存后即时生效'));
  $('#edit-status').addEventListener('change', () => markDirty('inventoryStatus', '库存状态将在保存后即时生效'));
  $('#save-draft').addEventListener('click', () => saveChanges('save-draft'));
  $('#submit-review').addEventListener('click', () => saveChanges('submit-review'));
  $('#visibility-button').addEventListener('click', toggleVisibility);
  $('#dialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) $('#dialog-cancel').click(); });

  initialize();
}());
