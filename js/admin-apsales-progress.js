/** AsiaPower Admin — APBD customer development + APSales audit. */
(function () {
  'use strict';

  const apbdRoot = document.getElementById('apbd-promotion-root');
  const apsalesRoot = document.getElementById('apsales-progress-root');
  const feedback = document.getElementById('promotion-feedback');
  const tabCount = document.getElementById('apbd-tab-count');
  const state = { data: null, selectedId: '', query: '', source: 'all', native: 'all', confirmRun: false, job: null };
  let jobTimer = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function showFeedback(message, type = 'info') {
    feedback.hidden = !message;
    feedback.className = `promotion-feedback${type === 'warning' ? ' is-warning' : ''}${type === 'error' ? ' is-error' : ''}`;
    feedback.textContent = message;
  }

  async function getJson(url, options) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store', ...options });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw new Error('请先登录 Admin 账号后刷新本页。');
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function metric(label, value, note, caution = false) {
    return `<article class="promo-metric${caution ? ' is-caution' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
  }

  function provider(label, detail, status = '') {
    return `<div class="provider-item"><span class="provider-light ${status}"></span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div>`;
  }

  function nativeStatusText() {
    const native = state.data?.native || {};
    const job = state.job || {};
    if (job.status === 'running') return `运行中 · ${job.options?.limit || 0} 家上限`;
    if (job.status === 'complete') return `最近完成 · 已检查 ${native.companiesChecked || 0} 家`;
    return native.companiesChecked ? `已检查 ${native.companiesChecked} 家` : '可运行 · 不消耗第三方额度';
  }

  function filteredLeads() {
    const query = state.query.trim().toLowerCase();
    return (state.data?.leads || []).filter((lead) => {
      const text = [lead.company, lead.city, lead.type].join(' ').toLowerCase();
      const sourceMatch = state.source === 'all' || lead.source === state.source;
      const nativeMatch = state.native === 'all' || (state.native === 'checked' ? lead.native?.checked : !lead.native?.checked);
      return (!query || text.includes(query)) && sourceMatch && nativeMatch;
    });
  }

  function sourceLabel(source) { return source === 'google_maps' ? 'Google Places' : '公开网页'; }

  function renderLeadList() {
    const list = document.getElementById('apbd-lead-list');
    const summary = document.getElementById('apbd-queue-summary');
    if (!list || !summary) return;
    const leads = filteredLeads();
    if (!leads.some((lead) => lead.id === state.selectedId)) state.selectedId = leads[0]?.id || '';
    summary.textContent = `显示 ${leads.length} / ${state.data.leads.length} 家 · 按证据评分排序`;
    list.innerHTML = leads.length ? leads.map((lead) => {
      const native = lead.native?.checked ? `原生已查 ${lead.native.publicEmailsChecked || 0}` : '原生未查';
      return `<button class="lead-row" type="button" data-lead-id="${escapeHtml(lead.id)}" aria-current="${lead.id === state.selectedId}">
        <span class="lead-row__main"><strong>${escapeHtml(lead.company)}</strong><small>${escapeHtml(lead.city)}<br>${escapeHtml(lead.type || '业务类型待核验')}</small>
        <span class="lead-tags"><span class="lead-tag">${escapeHtml(sourceLabel(lead.source))}</span><span class="lead-tag${lead.native?.checked ? ' is-native' : ''}">${escapeHtml(native)}</span></span></span>
        <span class="lead-score"><strong>${Number(lead.score || 0).toFixed(1)}</strong><small>${escapeHtml(lead.grade || 'D')} · ${escapeHtml(lead.confidence || 0)}%</small></span>
      </button>`;
    }).join('') : '<div class="promotion-empty">没有符合筛选条件的客户。</div>';
    list.querySelectorAll('[data-lead-id]').forEach((button) => button.addEventListener('click', () => {
      state.selectedId = button.dataset.leadId;
      renderLeadList();
      renderLeadDetail();
    }));
  }

  function renderLeadDetail() {
    const root = document.getElementById('apbd-lead-detail');
    if (!root) return;
    const lead = state.data.leads.find((row) => row.id === state.selectedId);
    if (!lead) { root.innerHTML = '<div class="promotion-empty">选择一个客户查看证据。</div>'; return; }
    const sources = (lead.sources || []).map(safeUrl).filter(Boolean);
    const notes = (lead.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join('') || '<li>暂无进一步证据，保持未知。</li>';
    root.innerHTML = `<header class="detail-head"><div><p class="promotion-kicker">${escapeHtml(lead.apbdId || lead.id)} · ${escapeHtml(sourceLabel(lead.source))}</p><h2>${escapeHtml(lead.company)}</h2><p>${escapeHtml(lead.type || '业务类型待核验')} · ${escapeHtml(lead.city)}</p></div><span class="grade">${escapeHtml(lead.grade || 'D')}</span></header>
      <div class="score-band"><div><span>排序分</span><strong>${Number(lead.score || 0).toFixed(1)}</strong><small>不是成交概率</small></div><div><span>证据完整度</span><strong>${escapeHtml(lead.confidence || 0)}%</strong><small>未知项保留</small></div><div><span>工作流</span><strong>${escapeHtml(lead.status)}</strong><small>尚未授权外发</small></div></div>
      <section class="detail-card"><h3>证据与缺口</h3><ul>${notes}</ul>${sources.map((url, i) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">来源 ${i + 1} · ${escapeHtml(url)}</a>`).join('')}</section>
      <section class="detail-card"><h3>联系人补全（只显示数量，不显示邮箱）</h3><div class="detail-stats"><div><span>Hunter 找到</span><strong>${lead.hunter?.found || 0}</strong></div><div><span>Hunter 新增</span><strong>${lead.hunter?.new || 0}</strong></div><div><span>原生公开邮箱</span><strong>${lead.native?.publicEmailsChecked || 0}</strong></div><div><span>公开决策人</span><strong>${lead.native?.namedPeopleWithEvidence || 0}</strong></div></div><p>原生层只验证官网公开证据，不猜测个人邮箱；域名可解析也不等于邮箱可投递。</p></section>
      <section class="detail-card"><h3>首次触达策略</h3><p>如后续满足独立审批，只争取一个最小回复 “Sure”；不先索要会议、目录、价格表或表单。</p></section>
      <p class="governance-note">C/D 级、Hunter 找到邮箱、域名可解析或自动质量检查通过，都不能替代独立外发审批。</p>`;
  }

  function bindApbdControls() {
    document.getElementById('apbd-search')?.addEventListener('input', (event) => { state.query = event.target.value; renderLeadList(); renderLeadDetail(); });
    document.getElementById('apbd-source-filter')?.addEventListener('change', (event) => { state.source = event.target.value; renderLeadList(); renderLeadDetail(); });
    document.getElementById('apbd-native-filter')?.addEventListener('change', (event) => { state.native = event.target.value; renderLeadList(); renderLeadDetail(); });
    document.getElementById('run-native-enrichment')?.addEventListener('click', runNativeEnrichment);
  }

  function renderApbd() {
    const data = state.data;
    const summary = data.summary || {};
    const hunter = data.hunter || {};
    const native = data.native || {};
    tabCount.textContent = `${summary.totalLeads || 0} 家`;
    const runLabel = state.job?.status === 'running' ? '原生补全运行中…' : (state.confirmRun ? '再次点击确认运行 10 家' : '运行自有补全');
    apbdRoot.innerHTML = `<div class="provider-bar">
      ${provider('Google Places', `${summary.placesAdded ?? 16} 家新增 · 企业公开数据`, 'is-ready')}
      ${provider('APBD Native', nativeStatusText(), 'is-ready')}
      ${provider('Hunter', `${hunter.plan || '按需'} · ${hunter.domainsTested || 0} 域名`, hunter.domainsTested ? 'is-ready' : '')}
      ${provider('Apollo', data.apollo?.used ? '已使用' : '未配置 · 本轮未使用', '')}
      ${provider('外部发送', '关闭 · 仍需独立审批', 'is-locked')}
    </div>
    <div class="promo-metrics">
      ${metric('APBD 客户', summary.totalLeads || 0, `${summary.apbdLinked || 0} 家已关联原客户库`)}
      ${metric('C / D 级', `${summary.gradeC || 0} / ${summary.gradeD || 0}`, `A/B 共 ${(summary.gradeA || 0) + (summary.gradeB || 0)} 家`)}
      ${metric('Hunter 增量', `+${hunter.newContacts || 0}`, `${hunter.domainsTested || 0} 个域名已测试`)}
      ${metric('原生已查', native.companiesChecked || 0, `${native.publicEmailsChecked || 0} 个公开邮箱`)}
      ${metric('公开决策人', native.namedPeopleWithEvidence || 0, '必须有官网角色证据')}
      ${metric('可外发', summary.outreachReady || 0, '外发仍需独立审批', Number(summary.outreachReady || 0) === 0)}
    </div>
    <section class="promo-truth"><div><p class="promotion-kicker">Pilot verdict</p><h2>这次测试说明了什么</h2><p>Places 扩大候选名单；Hunter 对少数域名有增量，但没有把名单自动变成高质量商机。</p></div>
      <dl class="truth-grid"><div><dt>域名测试</dt><dd><strong>${hunter.domainsTested || 0}</strong><small>按需付费能力</small></dd></div><div><dt>联系人增量</dt><dd><strong>+${hunter.newContacts || 0}</strong><small>不等于采购人</small></dd></div><div><dt>原生角色邮箱</dt><dd><strong>${native.roleMailboxes || 0}</strong><small>只计公开证据</small></dd></div><div><dt>已发送</dt><dd><strong>${summary.sent || 0}</strong><small>本模块保持关闭</small></dd></div></dl>
      <div class="native-action"><strong>自建层不消耗 Hunter/Apollo 额度</strong><p>检查现有官网公开邮箱、域名解析与公开决策人证据；不进行 SMTP 收件人探测。</p><button id="run-native-enrichment" class="promo-button" type="button" ${state.job?.status === 'running' ? 'disabled' : ''}>${escapeHtml(runLabel)}</button></div>
    </section>
    <section class="promo-workflow"><ol><li class="is-complete"><span>01</span><strong>活动简报</strong><small>产品 / 市场 / 客群</small></li><li class="is-complete"><span>02</span><strong>Places 发现</strong><small>企业公开数据</small></li><li class="is-complete"><span>03</span><strong>官网证据</strong><small>事实与缺口</small></li><li class="is-complete"><span>04</span><strong>原生补全</strong><small>无第三方额度</small></li><li class="is-complete"><span>05</span><strong>证据评分</strong><small>排序而非概率</small></li><li><span>06</span><strong>草稿与审批</strong><small>当前未进入</small></li><li><span>07</span><strong>APSales 交接</strong><small>真实询价后接管</small></li></ol></section>
    <div class="promo-workbench"><section class="lead-queue"><div class="lead-toolbar"><div><p class="promotion-kicker">Canonical APBD queue</p><h2>客户队列</h2></div><div class="lead-filters"><label>搜索<input id="apbd-search" type="search" placeholder="公司、城市或类型"></label><label>来源<select id="apbd-source-filter"><option value="all">全部</option><option value="google_maps">Google Places</option><option value="public_web">公开网页</option></select></label><label>原生补全<select id="apbd-native-filter"><option value="all">全部</option><option value="checked">已检查</option><option value="unchecked">未检查</option></select></label></div></div><div id="apbd-queue-summary" class="queue-summary"></div><div id="apbd-lead-list" class="lead-list"></div></section><article id="apbd-lead-detail" class="lead-detail"></article></div>`;
    bindApbdControls();
    renderLeadList();
    renderLeadDetail();
  }

  async function runNativeEnrichment() {
    if (!state.confirmRun) {
      state.confirmRun = true;
      showFeedback('将验证最多 10 家委内瑞拉企业的现有公开联系人；不调用 Hunter/Apollo，也不发送邮件。请再次点击按钮确认。', 'warning');
      renderApbd();
      return;
    }
    state.confirmRun = false;
    try {
      state.job = await getJson('/api/admin/apbd/native-enrichment/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: 'VE', limit: 10, workers: 3 }) });
      showFeedback('原生补全已启动。完成后页面会自动刷新汇总。');
      renderApbd();
      startJobPolling();
    } catch (error) { showFeedback(error.message, 'error'); }
  }

  function startJobPolling() {
    clearInterval(jobTimer);
    jobTimer = setInterval(async () => {
      try {
        state.job = await getJson('/api/admin/apbd/native-enrichment/status');
        if (state.job.status !== 'running') {
          clearInterval(jobTimer);
          await loadApbd();
          showFeedback(state.job.status === 'complete' ? '原生补全已完成，汇总已更新。' : `原生补全状态：${state.job.status}`, state.job.status === 'complete' ? 'info' : 'error');
        } else renderApbd();
      } catch (error) { clearInterval(jobTimer); showFeedback(error.message, 'error'); }
    }, 3000);
  }

  async function loadApbd() {
    try {
      const [data, job] = await Promise.all([getJson('/api/admin/apbd/solo-trade'), getJson('/api/admin/apbd/native-enrichment/status')]);
      if (!Array.isArray(data.leads)) throw new Error('APBD 客户数据格式无效');
      data.leads.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      state.data = data; state.job = job; state.selectedId = state.selectedId || data.leads[0]?.id || '';
      renderApbd();
      if (job.status === 'running') startJobPolling();
    } catch (error) { apbdRoot.innerHTML = `<div class="promotion-error">${escapeHtml(error.message)}</div>`; }
  }

  function renderActionLinks(links) {
    return (links || []).map((link) => ({ label: link.label || '链接', url: safeUrl(link.url) })).filter((link) => link.url).map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join(' · ') || '—';
  }

  function actionSection(title, items) {
    const rows = items || [];
    if (!rows.length) return `<section class="apsales-progress__section"><h3>${escapeHtml(title)}</h3><div class="promotion-empty">暂无可验证记录</div></section>`;
    return `<section class="apsales-progress__section"><h3>${escapeHtml(title)} · ${rows.length}</h3><div class="apsales-progress__table-wrap"><table class="apsales-progress__table"><thead><tr><th>时间</th><th>类型</th><th>平台</th><th>市场</th><th>内容摘要</th><th>链接</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.at || '—')}</td><td>${escapeHtml(item.type_label || item.type || '—')}</td><td>${escapeHtml(item.platform_label || item.platform || '—')}</td><td>${escapeHtml(item.language_market || item.market || '—')}</td><td>${escapeHtml(item.content_preview || item.group_name || item.summary || '—')}</td><td>${renderActionLinks(item.links)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  async function loadApsales() {
    try {
      const data = await getJson('/api/apsales/distribution-progress');
      const metrics = data.metrics || {};
      apsalesRoot.innerHTML = `<section class="apsales-progress__section"><p class="promotion-kicker">APSales action log</p><h2>推广动作审计记录</h2><div class="apsales-progress__meta"><span>最后动作：${escapeHtml(data.last_verified_action_at || '尚无')}</span><span>邮件已发：${metrics.emails_sent || 0}</span><span>回复扫描：${metrics.replies_scanned || 0}</span><span>完成度：${data.overall_completion_pct || 0}%</span></div></section>${actionSection('今日互动动作', data.engagement)}${actionSection('已登记帖文（含受阻）', data.posts)}${actionSection('已加入小组', data.groups)}${actionSection('客户回复跟进', data.followups)}`;
    } catch (error) { apsalesRoot.innerHTML = `<div class="promotion-error">${escapeHtml(error.message)}</div>`; }
  }

  function switchTab(name) {
    const apbd = name === 'apbd';
    apbdRoot.hidden = !apbd; apsalesRoot.hidden = apbd;
    document.querySelectorAll('[data-promotion-tab]').forEach((tab) => { const active = tab.dataset.promotionTab === name; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); });
    if (!apbd) loadApsales();
  }

  document.querySelectorAll('[data-promotion-tab]').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.promotionTab)));
  loadApbd();
  setInterval(() => { if (!apbdRoot.hidden && state.job?.status !== 'running') loadApbd(); }, 60000);
}());
