(() => {
  'use strict';

  const FALLBACK = {
    stockId: 'HC250642',
    title: '2026 DENZA D9 — Export Used Car',
    brand: 'DENZA', model: 'D9', year: 2026, mileage: '7,200 km', priceUsd: 47400,
    photos: [],
    video: { external: true, youtubeId: 'bBvr-rbi3Fs', fileName: 'youtube' },
  };

  const state = { item: null, photos: [], archive: [], video: null, changed: false, dragged: null };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const apiBase = '';

  function mediaUrl(photo) {
    if (!photo) return '';
    if (photo.localUrl) return photo.localUrl;
    return typeof photo === 'string' ? photo : (photo.thumbUrl || photo.url || '');
  }

  function fullMediaUrl(photo) {
    if (!photo) return '';
    if (photo.localUrl) return photo.localUrl;
    return typeof photo === 'string' ? photo : (photo.url || photo.thumbUrl || '');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function upperLatin(value) {
    return String(value || '').replace(/[A-Za-z][A-Za-z0-9+.-]*/g, (token) => token.toUpperCase());
  }

  function labelOf(photo, index) {
    if (photo.local) return photo.name || `本地待上传照片 ${index + 1}`;
    if (typeof photo === 'object' && photo.label) return photo.label;
    return `实拍证据 ${index + 1}`;
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `USD ${number.toLocaleString('en-US')}` : '询价';
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove('show'), 2600);
  }

  function markChanged(message = '有待提交变更') {
    state.changed = true;
    $('.save-card').classList.add('changed');
    $('#change-state').textContent = message;
  }

  function showPreviewDialog(copy) {
    if (copy) $('#dialog-copy').textContent = copy;
    $('#dialog').hidden = false;
  }

  function setPoster(element, url) {
    element.style.backgroundImage = url ? `url("${String(url).replace(/"/g, '%22')}")` : '';
  }

  function currentTitle() {
    return [upperLatin($('#brand').value.trim()), $('#model').value.trim(), $('#year').value.trim()].filter(Boolean).join(' ');
  }

  function syncPreview() {
    const title = currentTitle() || upperLatin(state.item?.title || '');
    const mileage = $('#mileage').value.trim();
    $('#preview-title').textContent = title;
    $('#preview-meta').textContent = [$('#year').value.trim(), mileage, '中国'].filter(Boolean).join(' · ');
    $('#preview-price').textContent = money($('#price').value);
    $('#preview-evidence').textContent = `${state.photos.length} 张照片${state.video ? ' · 1 个视频' : ''}`;
    const first = state.photos[0];
    setPoster($('#preview-media'), mediaUrl(first));
    $('.preview-play').hidden = !state.video;
    $('.preview-video-label').hidden = !state.video;
  }

  function renderGallery() {
    const gallery = $('#gallery');
    gallery.innerHTML = state.photos.map((photo, index) => `
      <article class="media-item" draggable="true" data-index="${index}">
        <div class="media-image">
          <img src="${escapeHtml(mediaUrl(photo))}" alt="${escapeHtml(labelOf(photo, index))}">
          <span class="media-order">${String(index + 1).padStart(2, '0')}</span>
          ${index === 0 ? '<span class="cover-chip">备用封面</span>' : ''}
          ${photo.local ? '<span class="local-chip">本地待上传</span>' : ''}
        </div>
        <div class="media-info"><strong>${escapeHtml(labelOf(photo, index))}</strong><span>${photo.local ? '尚未上传服务器' : '原始证据已保留'}</span></div>
        <div class="media-actions">
          <button class="media-handle" type="button" data-action="left" ${index === 0 ? 'disabled' : ''}>← 前移</button>
          <button class="media-handle" type="button" data-action="right" ${index === state.photos.length - 1 ? 'disabled' : ''}>后移 →</button>
          <button type="button" data-action="cover">设为封面</button>
          <button class="remove" type="button" data-action="remove">移除</button>
        </div>
      </article>
    `).join('');
    $('#photo-count').textContent = state.photos.length;
    bindGalleryEvents();
    renderArchive();
    syncPreview();
  }

  function movePhoto(from, to) {
    if (to < 0 || to >= state.photos.length || from === to) return;
    const [photo] = state.photos.splice(from, 1);
    state.photos.splice(to, 0, photo);
    markChanged('照片顺序已调整');
    renderGallery();
  }

  function removePhoto(index) {
    const [photo] = state.photos.splice(index, 1);
    if (!photo) return;
    state.archive.unshift({ ...photo, removedAt: new Date().toLocaleString('zh-CN'), removedBy: '盛元集团' });
    markChanged('照片变更待提交');
    renderGallery();
    toast('已从公开版本移入私有证据归档（预览）');
  }

  function setCover(index) {
    movePhoto(index, 0);
    toast('已设为静态备用封面');
  }

  function bindGalleryEvents() {
    $$('.media-item').forEach((card) => {
      const index = Number(card.dataset.index);
      card.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.action === 'left') movePhoto(index, index - 1);
          if (button.dataset.action === 'right') movePhoto(index, index + 1);
          if (button.dataset.action === 'cover') setCover(index);
          if (button.dataset.action === 'remove') removePhoto(index);
        });
      });
      card.addEventListener('dragstart', () => { state.dragged = index; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { state.dragged = null; card.classList.remove('dragging'); $$('.drag-over').forEach((el) => el.classList.remove('drag-over')); });
      card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (event) => { event.preventDefault(); card.classList.remove('drag-over'); movePhoto(state.dragged, index); });
    });
  }

  function renderArchive() {
    $('#archive-count').textContent = state.archive.length;
    $('#archive-list').innerHTML = state.archive.length ? state.archive.map((entry, index) => `
      <div class="archive-entry">
        <img src="${escapeHtml(mediaUrl(entry))}" alt="已归档证据">
        <div><strong>${escapeHtml(entry.name || entry.label || '原始实拍证据')}</strong><span>${escapeHtml(entry.removedBy)} · ${escapeHtml(entry.removedAt)}</span></div>
        <button type="button" data-restore="${index}">恢复公开</button>
      </div>
    `).join('') : '<div class="archive-empty">暂无已移除媒体。</div>';
    $$('[data-restore]').forEach((button) => button.addEventListener('click', () => {
      const [entry] = state.archive.splice(Number(button.dataset.restore), 1);
      delete entry.removedAt;
      delete entry.removedBy;
      state.photos.push(entry);
      markChanged('已恢复一张照片');
      renderGallery();
      toast('照片已恢复到公开媒体列表（预览）');
    }));
  }

  function renderVideo() {
    $('#video-row').hidden = !state.video;
    $('#video-name').textContent = state.video?.local ? state.video.name : '库存实拍视频 · 已发布';
    const first = state.photos[0];
    setPoster($('#video-poster'), mediaUrl(first));
    syncPreview();
  }

  function populate(item) {
    state.item = item;
    state.photos = Array.isArray(item.photos) ? item.photos.map((photo) => ({ ...(typeof photo === 'string' ? { url: photo } : photo) })) : [];
    state.video = item.video || null;
    const brand = upperLatin(item.brand || '');
    const model = item.model || '';
    const title = [brand, model].filter(Boolean).join(' ') || upperLatin(item.title || item.stockId);
    $('#record-title').textContent = title;
    $('#record-id').textContent = item.stockId || '—';
    $('#record-meta').textContent = [item.year, item.mileage].filter(Boolean).join(' · ');
    $('#record-price').textContent = money(item.priceUsd);
    const poster = state.photos[0] ? mediaUrl(state.photos[0]) : '';
    $('#record-thumb').src = poster;
    $('#record-thumb').alt = title;
    $('#brand').value = brand;
    $('#model').value = model;
    $('#year').value = item.year || '';
    $('#mileage').value = item.mileage || '';
    $('#price').value = item.priceUsd || '';
    renderGallery();
    renderVideo();
    $('#loading').hidden = true;
    $('#workspace').hidden = false;
  }

  async function loadInventory() {
    try {
      const response = await fetch(`${apiBase}/api/half-cuts/public`, { method: 'GET', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data.approved) ? data.approved : [];
      const selected = items.find((item) => item.stockId === 'HC250642')
        || items.find((item) => item.video && Array.isArray(item.photos) && item.photos.length >= 3)
        || items.find((item) => Array.isArray(item.photos) && item.photos.length >= 3);
      if (!selected) throw new Error('No inventory sample');
      populate(selected);
    } catch (error) {
      populate(FALLBACK);
      toast('真实库存读取失败，当前显示无图片安全后备数据');
    }
  }

  $('#photo-input').addEventListener('change', (event) => {
    const room = Math.max(0, 15 - state.photos.length);
    const files = [...event.target.files].slice(0, room);
    files.forEach((file) => state.photos.push({ local: true, localUrl: URL.createObjectURL(file), name: file.name, label: '本地待上传' }));
    if (event.target.files.length > room) toast(`最多保留 15 张，已忽略 ${event.target.files.length - room} 张`);
    if (files.length) { markChanged('新增照片待提交'); renderGallery(); toast(`已加入 ${files.length} 张本地照片（未上传）`); }
    event.target.value = '';
  });

  $('#video-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.video = { local: true, name: file.name, localUrl: URL.createObjectURL(file) };
    markChanged('视频变更待提交');
    renderVideo();
    toast('视频已加入本地预览，尚未上传');
    event.target.value = '';
  });

  $('#remove-video').addEventListener('click', () => {
    state.video = null;
    markChanged('视频移除待提交');
    renderVideo();
    toast('视频已从待发布版本移除（预览）');
  });

  $('#archive-toggle').addEventListener('click', (event) => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!expanded));
    $('#archive-body').hidden = expanded;
  });

  $$('.form-grid input, .form-grid select').forEach((input) => input.addEventListener('input', () => {
    if (input.id === 'brand') input.value = upperLatin(input.value);
    markChanged(input.id === 'price' || input.id === 'status' ? '含即时生效变更' : '关键参数变更待审核');
    syncPreview();
  }));

  $$('.preview-tabs button').forEach((button) => button.addEventListener('click', () => {
    $$('.preview-tabs button').forEach((el) => el.classList.toggle('active', el === button));
    $('#customer-preview').className = `customer-preview view-${button.dataset.view}`;
  }));

  $('#mobile-menu').addEventListener('click', (event) => {
    const open = $('.sidebar').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  $('#dialog-close').addEventListener('click', () => { $('#dialog').hidden = true; });
  $('#dialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.hidden = true; });
  $('#submit-review').addEventListener('click', () => showPreviewDialog('提交审核在本预览中被安全拦截。生产实现会拆分即时变更与待审版本，并记录变更人、时间、旧值和新值。'));
  $('#save-draft').addEventListener('click', () => showPreviewDialog('保存草稿在本预览中被安全拦截。当前所有操作只存在于这个浏览器标签页，刷新后自动恢复真实公开库存。'));
  $('#support-btn').addEventListener('click', () => showPreviewDialog('生产版本将接入站内支持入口，国内供应商不会被强制跳转到 WhatsApp。'));
  $$('[data-demo]').forEach((button) => button.addEventListener('click', () => showPreviewDialog('这是后台交互预览。公开页面链接将在生产实现中使用现有商品 URL，不改 URL 和 SEO。')));

  loadInventory();
})();
