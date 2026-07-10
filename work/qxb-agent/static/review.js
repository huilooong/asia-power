(function () {
  'use strict';

  const SLOTS = ['front', 'rear', 'engine', 'interior', 'vin'];
  const SLOT_LABELS = { front: '车头', rear: '车尾', engine: '机舱', interior: '内饰', vin: 'VIN' };
  const FIELD_KEYS = ['vin', 'brand', 'model', 'year', 'engineCode', 'transmissionCode', 'drivetrain'];
  const FIELD_LABELS = {
    vin: 'VIN 识别', brand: '品牌', model: '车型', year: '年份',
    engineCode: '发动机型号', transmissionCode: '变速箱型号', drivetrain: '驱动',
  };

  const nav = document.getElementById('nav');
  const meta = document.getElementById('meta');
  const photos = document.getElementById('photos');
  const slotsEl = document.getElementById('slots');
  const note = document.getElementById('note');
  const preview = document.getElementById('preview');
  const metrics = document.getElementById('metrics');
  const log = document.getElementById('log');
  const queueBox = document.getElementById('queueBox');
  const topStatus = document.getElementById('topStatus');
  const photoCount = document.getElementById('photoCount');

  const batchSize = 10;
  const urlParams = new URLSearchParams(window.location.search);
  let rowFilter = urlParams.get('filter') || 'needs_vin';
  let data = { records: [] };
  let serverStatus = { status: {} };
  let memoryData = { metrics: {}, events: [] };
  let active = 0;
  let selected = null;
  let page = 0;
  let visiblePhotoList = [];
  let busy = false;
  let loading = false;
  let pageReady = false;

  const draftKey = 'qxbReviewDraftV1';
  const draft = JSON.parse(sessionStorage.getItem(draftKey) || '{}');

  function saveDraft() {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }

  function recDraft(stockId) {
    if (!draft[stockId]) draft[stockId] = { slots: {}, edits: {}, note: '', decision: '' };
    return draft[stockId];
  }

  function syncUiState() {
    const locked = loading || busy || !pageReady;
    document.querySelectorAll('.actions button').forEach((b) => { b.disabled = locked; });
    const nextBtn = document.getElementById('nextBatch');
    if (nextBtn) nextBtn.disabled = loading || busy;
    document.querySelectorAll('.filter-tab').forEach((b) => { b.disabled = loading; });
    nav.querySelectorAll('button').forEach((b) => { b.disabled = loading; });
  }

  function autoSelectPhoto(c) {
    const list = c?.photos || [];
    if (!list.length) {
      selected = null;
      return;
    }
    const suggestions = c.suggestions || {};
    const suggested = list.find((p) => {
      const ref = p.path || p.local;
      return ref && Object.values(suggestions).some((s) => {
        const sref = s.path || s.local;
        return sref && (sref === ref || String(s.path || '').includes(ref));
      });
    });
    selected = suggested ? list.indexOf(suggested) : 0;
    if (selected < 0) selected = 0;
  }

  function autofillDraftSlots(d, c) {
    if (c.suggestions) {
      for (const [k, v] of Object.entries(c.suggestions)) {
        if (!d.slots[k] && v) d.slots[k] = v;
      }
    }
    const list = c.photos || [];
    if (!list.length) return;
    const used = new Set();
    SLOTS.forEach((slot) => {
      const p = d.slots[slot];
      if (!p) return;
      const ref = p.path || p.local;
      if (ref) used.add(ref);
    });
    SLOTS.forEach((slot, i) => {
      if (d.slots[slot]) return;
      const unused = list.find((p) => {
        const ref = p.path || p.local;
        return ref && !used.has(ref);
      });
      const pick = unused || list[i % list.length];
      if (!pick) return;
      d.slots[slot] = pick;
      const ref = pick.path || pick.local;
      if (ref) used.add(ref);
    });
  }

  function escapeHtml(v) {
    return String(v || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function escapeAttr(v) { return escapeHtml(v).replace(/`/g, '&#96;'); }

  function current() { return data.records[active] || null; }
  function candidate() { return current()?.candidates?.[0] || {}; }

  async function loadMemory() {
    const res = await fetch('/api/memory');
    memoryData = await res.json();
  }

  async function loadServerStatus() {
    try {
      const res = await fetch('/api/qxb-status');
      serverStatus = await res.json();
    } catch {
      serverStatus = { status: {} };
    }
  }

  function successfulStockIds() {
    const ids = new Set();
    for (const [stock, info] of Object.entries(serverStatus.status || {})) {
      if (info.reviewStatus === 'approved' || info.reviewStatus === 'knowledge') {
        ids.add(stock);
      }
    }
    return [...ids];
  }

  function filterLabel() {
    if (rowFilter === 'needs_vin') return '真缺 VIN';
    return '全部图库';
  }

  function syncFilterTabs() {
    document.getElementById('filterAll')?.classList.toggle('active', rowFilter === 'all');
    document.getElementById('filterNeedsVin')?.classList.toggle('active', rowFilter === 'needs_vin');
  }

  function setRowFilter(next) {
    rowFilter = next;
    page = 0;
    active = 0;
    selected = null;
    const nextUrl = new URL(window.location.href);
    if (rowFilter === 'all') nextUrl.searchParams.delete('filter');
    else nextUrl.searchParams.set('filter', rowFilter);
    window.history.replaceState({}, '', nextUrl);
    syncFilterTabs();
  }

  async function load() {
    loading = true;
    pageReady = false;
    syncUiState();
    try {
      const exclude = successfulStockIds().join(',');
      const res = await fetch(
        `/api/unuploaded?page=${page}&size=${batchSize}&exclude=${encodeURIComponent(exclude)}&filter=${encodeURIComponent(rowFilter)}`
      );
      data = await res.json();
      if (active >= data.records.length) active = Math.max(0, data.records.length - 1);
      const start = data.records.length ? page * batchSize + 1 : 0;
      const end = Math.min((page + 1) * batchSize, data.totalCount || data.records.length);
      const firstRow = data.records[0]?.row;
      topStatus.textContent = firstRow
        ? `${filterLabel()} ${data.totalCount || 0} 夹 · 第 ${start}-${end}（从 row ${firstRow} 起）`
        : `${filterLabel()} ${data.totalCount || 0} 夹`;
      for (const r of data.records) {
        const c = r.candidates?.[0] || {};
        const d = recDraft(r.stockId);
        if (!Object.keys(d.edits).length) {
          d.edits = {
            vin: c.vin || '', brand: c.brand || '', model: c.model || '', year: c.year || '',
            engineCode: c.engineCode || '', transmissionCode: c.transmissionCode || '', drivetrain: c.drivetrain || '2WD',
          };
        }
        autofillDraftSlots(d, c);
      }
      saveDraft();
      await loadMemory();
      autoSelectPhoto(candidate());
      pageReady = true;
    } catch (err) {
      topStatus.textContent = err.message || '加载失败';
      throw err;
    } finally {
      loading = false;
      syncUiState();
      if (pageReady) render();
    }
  }

  function renderNav() {
    if (!data.records.length) {
      nav.innerHTML = '<p class="empty-note">当前批次无待上传行。点「下一批/刷新」继续。</p>';
      return;
    }
    nav.innerHTML = data.records.map((r, i) => {
      const d = draft[r.stockId] || {};
      const c = r.candidates?.[0] || {};
      const real = serverStatus.status?.[r.stockId];
      const tag = real ? `${real.where}:${real.reviewStatus}` : (d.decision || '未处理');
      const noVin = !(c.vin || d.edits?.vin);
      const cls = [i === active ? 'active' : '', noVin ? 'no-vin' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-i="${i}">${r.stockId}<small>${escapeHtml(r.localTitle || r.localFolder || '')} · ${escapeHtml(tag)}${noVin ? ' · 缺VIN' : ''}</small></button>`;
    }).join('');
    nav.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        if (loading) return;
        active = Number(btn.dataset.i);
        autoSelectPhoto(candidate());
        render();
      };
    });
  }

  function renderMeta() {
    const r = current();
    if (!r) { meta.innerHTML = ''; return; }
    const c = candidate();
    const d = recDraft(r.stockId);
    const dupMsg = c.duplicateVinMessage || '';
    const dupBanner = dupMsg
      ? `<div class="dup-vin-banner" role="alert">${escapeHtml(dupMsg)}</div>`
      : '';
    meta.innerHTML = dupBanner + FIELD_KEYS.map((k) => `
      <div><label>${FIELD_LABELS[k]}</label><input data-edit="${k}" value="${escapeAttr(d.edits[k] || '')}"></div>
    `).join('') + serverStatusBox(r);
    meta.querySelectorAll('[data-edit]').forEach((input) => {
      input.oninput = () => { d.edits[input.dataset.edit] = input.value; saveDraft(); renderPreview(); updateConfirmButton(); };
    });
    updateConfirmButton();
  }

  function updateConfirmButton() {
    const r = current();
    const btn = document.getElementById('confirmUpload');
    if (!btn || !r) return;
    const c = candidate();
    const dupMsg = c.duplicateVinMessage || '';
    btn.disabled = !!dupMsg;
    btn.title = dupMsg || '';
  }

  function serverStatusBox(r) {
    const real = serverStatus.status?.[r.stockId];
    if (!real) return '<div><label>服务器状态</label><input value="未进入服务器" readonly></div>';
    return `<div><label>服务器状态</label><input value="${escapeAttr(real.where)} / ${escapeAttr(real.reviewStatus)}" readonly></div>`;
  }

  function photoSrc(p) {
    if (p.url) return p.url;
    if (p.local) {
      return '/media/' + p.local.split('/').map(encodeURIComponent).join('/');
    }
    return '';
  }

  function renderPhotos() {
    const r = current();
    const c = candidate();
    const list = c.photos || [];
    visiblePhotoList = list;
    const suggestions = c.suggestions || {};
    const suggestedPaths = new Set(Object.values(suggestions).map((p) => p.path));

    if (!r) {
      photos.innerHTML = '<p class="empty-note">没有可显示的照片。</p>';
      return;
    }
    photoCount.textContent = `${r.localFolder || r.stockId} · ${list.length} 张`;
    if (!list.length) {
      photos.innerHTML = `<p class="empty-note">没有找到 ${escapeHtml(r.stockId)} 照片。</p>`;
      return;
    }
    photos.innerHTML = list.map((p, i) => {
      const src = photoSrc(p);
      const isSuggested = suggestedPaths.has(p.path);
      return `<div class="photo ${selected === i ? 'selected' : ''} ${isSuggested ? 'suggested' : ''}" data-i="${i}">
        <img src="${src}" alt="" loading="lazy" onerror="this.alt='图片未找到';this.style.objectFit='contain';">
        <b>#${p.index || i + 1}</b>
        <small>${escapeHtml(p.fileName || '')}</small>
      </div>`;
    }).join('');
    photos.querySelectorAll('.photo').forEach((card) => {
      card.onclick = () => { selected = Number(card.dataset.i); renderPhotos(); };
    });
  }

  function renderSlots() {
    const r = current();
    if (!r) { slotsEl.innerHTML = ''; note.value = ''; return; }
    const d = recDraft(r.stockId);
    slotsEl.innerHTML = SLOTS.map((slot) => {
      const p = d.slots[slot];
      const text = p ? (p.fileName || `#${p.index}` || p.path) : '未选择';
      return `<div class="slot ${p ? '' : 'empty'}"><b>${SLOT_LABELS[slot]}</b><span>${escapeHtml(text)}</span><button data-slot="${slot}">放入</button></div>`;
    }).join('');
    slotsEl.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        const slot = btn.dataset.slot;
        let picked = selected !== null ? visiblePhotoList[selected] : null;
        if (!picked) picked = (candidate().suggestions || {})[slot] || d.slots[slot] || null;
        if (!picked) return alert('先点左边一张候选图，或等自动识图填槽。');
        d.slots[slot] = picked;
        saveDraft();
        render();
      };
    });
    note.value = d.note || '';
  }

  function payload(decision) {
    const r = current();
    if (!r) return null;
    const d = recDraft(r.stockId);
    const c = candidate();
    if (decision === 'confirm_and_upload' || decision === 'save_training_only') autofillDraftSlots(d, c);
    return {
      row: r.row,
      stockId: r.stockId,
      decision,
      note: note.value || d.note || '',
      edits: d.edits,
      slots: d.slots,
    };
  }

  function renderPreview() {
    preview.textContent = JSON.stringify(payload(draft[current()?.stockId]?.decision || '') || {}, null, 2);
  }

  function renderMemory() {
    const m = memoryData.metrics || {};
    metrics.innerHTML = SLOTS.map((slot) => {
      const item = m[slot] || { label: SLOT_LABELS[slot], score: 5, examples: 0 };
      return `<div class="metric"><div class="metric-head"><strong>${escapeHtml(item.label)}</strong><span class="score">${Number(item.score).toFixed(1)}</span></div><div class="bar"><i style="width:${Math.min(100, item.score * 10)}%"></i></div><small>${item.examples || 0} 条样本 · 确认上传 ${item.confirmedUploads || 0}</small></div>`;
    }).join('');
    const events = memoryData.events || [];
    log.innerHTML = events.slice().reverse().map((e) =>
      `<li>${escapeHtml(e.stockId)} · ${escapeHtml(e.decision || e.lesson || '')}</li>`
    ).join('') || '<li>还没有子龙学习记录。</li>';
    const lines = (data.records || []).map((r) => {
      const s = serverStatus.status?.[r.stockId];
      return s ? `${r.stockId} · ${s.where}/${s.reviewStatus}` : `${r.stockId} · 本地待传`;
    });
    queueBox.value = lines.join('\n') || '队列为空';
  }

  function render() {
    renderNav();
    renderMeta();
    renderPhotos();
    renderSlots();
    renderMemory();
    renderPreview();
    syncUiState();
  }

  async function decide(decision) {
    if (busy || loading || !pageReady) {
      if (!pageReady || loading) alert('数据还在加载，请稍等片刻再审核。');
      return;
    }
    const body = payload(decision);
    if (!body) return alert('当前没有可处理车辆。');
    busy = true;
    syncUiState();
    const prevStatus = topStatus.textContent;
    if (decision === 'confirm_and_upload') {
      topStatus.textContent = '记录学习中…';
    }
    try {
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.ok) {
        if (result.error === 'blocked_missing_slots') {
          alert(`不能上传：缺少 ${(result.missing || []).join('、')}`);
        } else if (result.error === 'duplicate_vin') {
          alert(result.message || '此底盘号已上传过，禁止重复上传');
        } else if (/423|429|Locked|Too many/i.test(String(result.error || ''))) {
          alert(`上传被限流，请约 30 秒后再点「确认可上传」。\n\n${result.error || ''}`);
        } else {
          alert(`失败：${result.error || res.statusText}`);
        }
        return;
      }
      const r = current();
      const d = recDraft(r.stockId);
      d.decision = decision;
      d.note = body.note;
      if (result.memory) memoryData = result.memory;
      saveDraft();
      let msg = `${r.stockId} · ${decision}`;
      if (result.queued) {
        msg = `${r.stockId} 学习已保存，后台正在上传（无需等待）`;
      }
      if (result.submit?.submissionId) msg += `\n已提交：${result.submit.submissionId}`;
      if (result.submit?.adminReviewUrl) msg += `\n${result.submit.adminReviewUrl}`;
      if (result.queued) {
        delete draft[r.stockId];
        saveDraft();
        active = Math.min(active + 1, Math.max(0, data.records.length - 1));
        await loadServerStatus();
        await load();
        alert(msg);
        return;
      }
      alert(msg);
      if (decision === 'confirm_and_upload' && result.ok) {
        delete draft[r.stockId];
        saveDraft();
        await loadServerStatus();
        await load();
        return;
      }
      render();
    } catch (err) {
      alert(err.message);
    } finally {
      busy = false;
      topStatus.textContent = prevStatus;
      syncUiState();
    }
  }

  note.oninput = () => {
    const r = current();
    if (!r) return;
    recDraft(r.stockId).note = note.value;
    saveDraft();
    renderPreview();
  };

  document.getElementById('confirmUpload').onclick = () => decide('confirm_and_upload');
  document.getElementById('saveLearning').onclick = () => decide('save_training_only');
  document.getElementById('skipMissing').onclick = () => decide('skip_missing_photos');
  document.getElementById('notSame').onclick = () => decide('not_same_vehicle');
  document.getElementById('nextBatch').onclick = async () => {
    const total = data.totalCount || 0;
    if ((page + 1) * batchSize >= total) page = 0;
    else page += 1;
    active = 0;
    selected = null;
    await loadServerStatus();
    await load();
  };

  document.getElementById('filterAll').onclick = async () => {
    setRowFilter('all');
    await loadServerStatus();
    await load();
  };
  document.getElementById('filterNeedsVin').onclick = async () => {
    setRowFilter('needs_vin');
    await loadServerStatus();
    await load();
  };

  syncFilterTabs();
  loadServerStatus().then(() => load()).catch((err) => { topStatus.textContent = err.message; });
})();
