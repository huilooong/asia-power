(function () {
  'use strict';

  const state = {
    data: null,
    selectedId: '',
    query: '',
    source: 'all',
    hunter: 'all',
  };

  const els = {
    apbdModule: document.querySelector('#apbdModule'),
    apsalesModule: document.querySelector('#apsalesModule'),
    empty: document.querySelector('#emptyState'),
    feedback: document.querySelector('#pageFeedback'),
    hunterProvider: document.querySelector('#hunterProviderText'),
    hunterFilter: document.querySelector('#hunterFilter'),
    leadDetail: document.querySelector('#leadDetail'),
    leadList: document.querySelector('#leadList'),
    leadSearch: document.querySelector('#leadSearch'),
    metrics: document.querySelector('#metrics'),
    metricTemplate: document.querySelector('#metricTemplate'),
    planSummary: document.querySelector('#planSummary'),
    queueSummary: document.querySelector('#queueSummary'),
    sourceFilter: document.querySelector('#sourceFilter'),
    tabLeadCount: document.querySelector('#tabLeadCount'),
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function showFeedback(message, type = 'info') {
    els.feedback.hidden = !message;
    els.feedback.className = `feedback${type === 'warning' ? ' is-warning' : ''}`;
    els.feedback.textContent = message;
  }

  function metricRows(data) {
    return [
      ['APBD 客户', data.summary.totalLeads, '23 / 23 已关联原客户库'],
      ['Places 新增', data.summary.placesAdded, '30 原始 · 去重 14'],
      ['C / D 级', `${data.summary.gradeC} / ${data.summary.gradeD}`, '没有 A/B 级'],
      ['Hunter 增量', `+${data.hunter.newContacts}`, `${data.hunter.domainsWithResults} 个域名有结果`],
      ['有效邮箱', data.hunter.valid, `${data.hunter.invalid} 无效 · ${data.hunter.unknown} 未知`],
      ['可外发', data.summary.outreachReady, '外发仍需独立审批'],
    ];
  }

  function renderMetrics() {
    const rows = metricRows(state.data);
    els.metrics.replaceChildren(...rows.map(([label, value, note], index) => {
      const card = els.metricTemplate.content.firstElementChild.cloneNode(true);
      card.querySelector('span').textContent = label;
      card.querySelector('strong').textContent = value;
      card.querySelector('small').textContent = note;
      if (index === rows.length - 1 && Number(value) === 0) card.classList.add('is-caution');
      return card;
    }));
  }

  function hunterState(lead) {
    if (!lead.hunter.searched) return 'untested';
    return lead.hunter.found > 0 ? 'hit' : 'miss';
  }

  function filteredLeads() {
    const q = state.query.trim().toLocaleLowerCase('zh-CN');
    return state.data.leads.filter((lead) => {
      const textMatch = !q || [lead.company, lead.city, lead.type].join(' ').toLocaleLowerCase('zh-CN').includes(q);
      const sourceMatch = state.source === 'all' || lead.source === state.source;
      const hunterMatch = state.hunter === 'all' || hunterState(lead) === state.hunter;
      return textMatch && sourceMatch && hunterMatch;
    });
  }

  function sourceLabel(source) {
    return source === 'google_maps' ? 'Google Places' : '公开网页';
  }

  function renderLeadList() {
    const leads = filteredLeads();
    if (!leads.some((lead) => lead.id === state.selectedId)) state.selectedId = leads[0]?.id || '';
    els.queueSummary.textContent = `显示 ${leads.length} / ${state.data.leads.length} 家 · 按证据评分排序`;
    els.empty.hidden = leads.length > 0;
    els.leadList.replaceChildren(...leads.map((lead) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lead-row';
      button.setAttribute('aria-current', String(lead.id === state.selectedId));
      const hunter = lead.hunter.searched
        ? (lead.hunter.found > 0 ? `Hunter +${lead.hunter.new}` : 'Hunter 无结果')
        : 'Hunter 未测试';
      const hunterClass = lead.hunter.found > 0 ? 'is-hunter' : 'is-miss';
      button.innerHTML = `
        <span class="lead-row__main">
          <strong>${escapeHtml(lead.company)}</strong>
          <small>${escapeHtml(lead.city)}<br>${escapeHtml(lead.type)}</small>
          <span class="lead-tags">
            <span class="tag${lead.source === 'google_maps' ? ' is-places' : ''}">${escapeHtml(sourceLabel(lead.source))}</span>
            <span class="tag ${hunterClass}">${escapeHtml(hunter)}</span>
          </span>
        </span>
        <span class="lead-score"><strong>${Number(lead.score).toFixed(1)}</strong><small>${escapeHtml(lead.grade)} · ${escapeHtml(lead.confidence)}%</small></span>`;
      button.addEventListener('click', () => {
        state.selectedId = lead.id;
        renderLeadList();
        renderLeadDetail();
      });
      return button;
    }));
  }

  function renderHunterResult(lead) {
    if (!lead.hunter.searched) {
      return '<p class="hunter-note">尚未调用 Hunter。社交媒体和短链接不会作为企业域名提交。</p>';
    }
    return `
      <div class="hunter-result">
        <div><span>找到</span><strong>${lead.hunter.found}</strong></div>
        <div><span>新增</span><strong>${lead.hunter.new}</strong></div>
        <div><span>有效</span><strong>${lead.hunter.valid}</strong></div>
        <div><span>无效</span><strong>${lead.hunter.invalid}</strong></div>
        <div><span>未知</span><strong>${lead.hunter.unknown}</strong></div>
      </div>
      <p class="hunter-note">Hunter 结果只提升联系方式完整度，不证明对方正在采购，也没有在本次样本中提供具名采购角色。</p>`;
  }

  function renderSources(lead) {
    const rows = (lead.sources || [])
      .map((value) => safeUrl(value))
      .filter(Boolean)
      .map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">来源 ${index + 1} · ${escapeHtml(url)}</a>`)
      .join('');
    return rows || '<span class="hunter-note">没有可点击来源。</span>';
  }

  function renderLeadDetail() {
    const lead = state.data.leads.find((row) => row.id === state.selectedId);
    if (!lead) {
      els.leadDetail.innerHTML = '<div class="empty-state"><strong>选择一个客户查看证据</strong></div>';
      return;
    }
    const website = safeUrl(lead.website);
    els.leadDetail.innerHTML = `
      <header class="detail-head">
        <div>
          <p class="kicker">${escapeHtml(lead.apbdId)} · ${escapeHtml(sourceLabel(lead.source))}</p>
          <h2>${escapeHtml(lead.company)}</h2>
          <p>${escapeHtml(lead.type)} · ${escapeHtml(lead.city)}</p>
        </div>
        <span class="grade" title="证据评分等级">${escapeHtml(lead.grade)}</span>
      </header>

      <div class="score-band">
        <div><span>排序分</span><strong>${Number(lead.score).toFixed(1)}</strong><small>不是成交概率</small></div>
        <div><span>证据完整度</span><strong>${escapeHtml(lead.confidence)}%</strong><small>缺口仍保留</small></div>
        <div><span>工作流状态</span><strong>${escapeHtml(lead.status)}</strong><small>尚未授权外发</small></div>
      </div>

      <section class="detail-section">
        <div class="detail-section__title"><h3>证据与缺口</h3><span>Evidence first</span></div>
        <ul class="evidence-list">${(lead.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
        <div class="source-list">${renderSources(lead)}</div>
      </section>

      <section class="detail-section">
        <div class="detail-section__title"><h3>Hunter 联系人补全</h3><span>${lead.hunter.searched ? '已调用' : '按需调用'}</span></div>
        ${renderHunterResult(lead)}
      </section>

      <section class="detail-section">
        <div class="detail-section__title"><h3>四轮草稿节奏</h3><span>Draft only</span></div>
        <div class="sequence">
          <div><span>DAY 0</span><strong>只争取回复 “Sure”</strong><small>无链接 / 无附件 / 无会议</small></div>
          <div><span>DAY 3</span><strong>简短相关性提醒</strong><small>仍为草稿</small></div>
          <div><span>DAY 7</span><strong>邀请提供具体规格</strong><small>承诺先核验</small></div>
          <div><span>DAY 14</span><strong>礼貌结束</strong><small>不制造紧迫感</small></div>
        </div>
      </section>

      <div class="detail-actions">
        ${website ? `<a class="button button-secondary" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">打开企业官网</a>` : '<button class="button button-secondary" type="button" disabled>未发布企业官网</button>'}
        <button class="button button-secondary" type="button" data-preview-action="draft">预览草稿动作</button>
        <button class="button button-primary" type="button" disabled>未达到外发条件</button>
      </div>
      <p class="governance-note">页面中的评分用于研究排序。C/D 级、Hunter 找到邮箱、自动质量检查通过，都不能替代外发审批。</p>`;

    els.leadDetail.querySelector('[data-preview-action="draft"]')?.addEventListener('click', () => {
      showFeedback(`已预演 ${lead.company} 的草稿动作：仅生成四轮草稿，不创建 Gmail 草稿，也不发送。`);
    });
  }

  function render() {
    const data = state.data;
    els.tabLeadCount.textContent = `${data.summary.totalLeads} 家`;
    els.hunterProvider.textContent = `Free · 剩余 ${data.hunter.creditsRemaining}/${data.hunter.creditsAvailable}`;
    renderMetrics();
    renderLeadList();
    renderLeadDetail();
  }

  function switchModule(module) {
    const showApbd = module === 'apbd';
    els.apbdModule.hidden = !showApbd;
    els.apsalesModule.hidden = showApbd;
    document.querySelectorAll('.promotion-tab').forEach((tab) => {
      const active = tab.dataset.module === module;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    if (showApbd) renderLeadDetail();
  }

  function bindEvents() {
    document.querySelectorAll('[data-module]').forEach((control) => {
      control.addEventListener('click', () => switchModule(control.dataset.module));
    });
    els.leadSearch.addEventListener('input', (event) => {
      state.query = event.target.value;
      renderLeadList();
      renderLeadDetail();
    });
    els.sourceFilter.addEventListener('change', (event) => {
      state.source = event.target.value;
      renderLeadList();
      renderLeadDetail();
    });
    els.hunterFilter.addEventListener('change', (event) => {
      state.hunter = event.target.value;
      renderLeadList();
      renderLeadDetail();
    });
    document.querySelector('#campaignForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const depth = Number(document.querySelector('#depthInput').value);
      const max = Math.max(1, Math.min(200, Number(document.querySelector('#maxInput').value) || 20));
      const limits = { 1: [4, 4], 2: [10, 6], 3: [20, 10] }[depth];
      els.planSummary.innerHTML = `<span>更新后的计划</span><strong>${limits[0]} 个查询 · 每条最多 ${limits[1]} 个结果</strong><p>单次新增上限 ${max} 家；活动累计数可高于此值。Hunter 仍只对有效企业域名按需调用。</p>`;
      showFeedback('搜索计划已在预览中更新。当前页面不会调用外部 API。');
    });
    document.querySelector('#runPreviewButton').addEventListener('click', () => {
      showFeedback('预演完成：将先运行 Places，再做官网证据检查；只有有企业域名且缺少邮箱的候选才进入 Hunter。', 'warning');
    });
  }

  async function loadData() {
    try {
      const response = await fetch('sample-campaign.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.leads)) throw new Error('客户数据格式无效');
      data.leads.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      state.data = data;
      state.selectedId = data.leads[0]?.id || '';
      render();
    } catch (error) {
      els.metrics.innerHTML = '<div class="empty-state"><strong>无法加载预览数据</strong><p>请通过本地预览服务打开此页面。</p></div>';
      els.queueSummary.textContent = '数据加载失败';
      els.leadDetail.innerHTML = `<div class="empty-state"><strong>加载失败</strong><p>${escapeHtml(error.message)}</p></div>`;
      showFeedback('预览数据加载失败，请确认 sample-campaign.json 与页面位于同一目录。', 'warning');
    }
  }

  bindEvents();
  loadData();
}());
