/**
 * AsiaPower — Admin APSales distribution action log dashboard
 */
(function () {
  'use strict';

  const root = document.getElementById('apsales-progress-root');

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLinks(links) {
    const items = (links || []).filter((l) => l && l.url);
    if (!items.length) return '—';
    return `<span class="apsales-progress__links">${items.map((l) =>
      `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || '链接')}</a>`
    ).join('')}</span>`;
  }

  function isSocialBlocked(item) {
    const status = String(item.status || '').toLowerCase();
    return status === 'blocked_no_account'
      || status === 'pending_ceo_manual'
      || item.type === 'post_blocked';
  }

  function isPendingPublish(item) {
    return String(item.status || '').toLowerCase() === 'approved_pending_publish';
  }

  function renderChannels(channels) {
    const entries = Object.entries(channels || {});
    if (!entries.length) return '';
    const cards = entries.map(([key, ch]) => {
      const ready = ch.can_send_today === true;
      const blocked = String(ch.status || '').includes('blocked');
      const badgeClass = ready
        ? 'apsales-progress__badge--ready'
        : (blocked ? 'apsales-progress__badge--blocked' : '');
      const sessionLabel = ch.status_label || '';
      const badge = ch.can_send_today
        ? (sessionLabel || '今天可发')
        : (sessionLabel || (blocked ? '受阻' : (ch.status || '—')));
      return `
        <div class="apsales-progress__channel-card">
          <h4>${escapeHtml(ch.label || key)} <span class="apsales-progress__badge ${badgeClass}">${escapeHtml(badge)}</span></h4>
          <p>${escapeHtml(ch.detail || '')}</p>
          <p><strong>下一步：</strong>${escapeHtml(ch.next_step || '—')}</p>
        </div>`;
    }).join('');
    return `
      <section class="apsales-progress__section">
        <h3>可执行渠道 · 登录状态</h3>
        <div class="apsales-progress__channels">${cards}</div>
      </section>`;
  }

  function rowId(section, index) {
    return `apsales-row-${section}-${index}`;
  }

  function renderTableRow(item, section, index) {
    const fullText = item.post_content || item.content || '';
    const expandable = Boolean(fullText.trim());
    const exampleBadge = item.example
      ? ' <span class="apsales-progress__badge apsales-progress__badge--example">示例</span>'
      : '';
    const blocked = isSocialBlocked(item);
    const pending = isPendingPublish(item);
    const statusBadge = blocked
      ? ' <span class="apsales-progress__badge apsales-progress__badge--blocked">无账号</span>'
      : (pending
        ? ' <span class="apsales-progress__badge apsales-progress__badge--ready">待自动发</span>'
        : '');
    const scheme = item.scheme_id ? ` · 方案${escapeHtml(item.scheme_id)}` : '';
    const id = rowId(section, index);
    const blockNote = blocked && item.block_reason
      ? ` · ${escapeHtml(item.block_reason)}`
      : '';

    const mainRow = `
      <tr data-expandable="${expandable ? 'true' : 'false'}" data-target="${id}" ${expandable ? 'title="点击展开全文"' : ''}>
        <td>${escapeHtml(item.at || '—')}</td>
        <td>${escapeHtml(item.type_label || item.type || '—')}${exampleBadge}${statusBadge}</td>
        <td>${escapeHtml(item.platform_label || item.platform || '—')}${scheme}${blockNote}</td>
        <td>${escapeHtml(item.language_market || item.market || '—')}</td>
        <td class="apsales-progress__preview">${escapeHtml(item.content_preview || item.group_name || item.summary || '—')}</td>
        <td>${renderLinks(item.links)}</td>
      </tr>`;

    const detailRow = expandable
      ? `<tr class="apsales-progress__detail-row" id="${id}" hidden>
          <td colspan="6"><pre>${escapeHtml(fullText)}</pre></td>
        </tr>`
      : '';

    return mainRow + detailRow;
  }

  function renderSection(title, items, sectionKey) {
    const list = items || [];
    if (!list.length) {
      return `
        <section class="apsales-progress__section">
          <h3>${escapeHtml(title)}</h3>
          <div class="apsales-progress__empty">暂无记录</div>
        </section>`;
    }
    return `
      <section class="apsales-progress__section">
        <h3>${escapeHtml(title)} <span class="apsales-progress__badge">${list.length}</span></h3>
        <div class="apsales-progress__table-wrap">
          <table class="apsales-progress__table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>平台</th>
                <th>市场</th>
                <th>内容摘要</th>
                <th>链接</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((item, i) => renderTableRow(item, sectionKey, i)).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function bindExpandHandlers() {
    root.querySelectorAll('tr[data-expandable="true"]').forEach((row) => {
      row.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;
        const targetId = row.getAttribute('data-target');
        const detail = document.getElementById(targetId);
        if (detail) detail.hidden = !detail.hidden;
      });
    });
  }

  function renderEngagementSummary(summary) {
    if (!summary || !Object.keys(summary).length) return '';
    const m = summary.metrics || {};
    const bp = summary.by_platform || {};
    const fb = bp.facebook || {};
    const x = bp.x || {};
    const igNote = summary.instagram_status === 'paused_today'
      ? '<span class="apsales-progress__badge apsales-progress__badge--blocked">INS 今日暂停</span>'
      : '';
    return `
      <section class="apsales-progress__section">
        <h3>今日互动 · FB + X 非洲经销商 ${igNote}</h3>
        <div class="apsales-progress__meta-row">
          <span>计划: <strong>${summary.planned_at ? '已生成' : '待生成'}</strong></span>
          <span>发帖: ${m.posts || 0}</span>
          <span>评论: ${m.comments || 0}</span>
          <span>关注: ${m.follows || 0}</span>
          <span>回复: ${m.replies || 0}</span>
          <span>活跃窗口: ${summary.in_active_hours ? '✅ 是' : '⏸ 非活跃时段'}</span>
        </div>
        <div class="apsales-progress__channels">
          <div class="apsales-progress__channel-card">
            <h4>Facebook <span class="apsales-progress__badge">待 ${fb.pending || 0} · 完成 ${fb.completed || 0}</span></h4>
            <p>小组帖 + 个人页 + 评论 · 45–120 分钟间隔</p>
          </div>
          <div class="apsales-progress__channel-card">
            <h4>X <span class="apsales-progress__badge">待 ${x.pending || 0} · 完成 ${x.completed || 0}</span></h4>
            <p>搜索非洲汽配账号 · 评论 + 关注</p>
          </div>
        </div>
      </section>`;
  }

  function render(data) {
    const metrics = data.metrics || {};
    const hasRecords = data.has_records || (data.groups || []).length || (data.posts || []).length;
    const staleBlock = data.is_stale
      ? `<div class="apsales-progress__stale">⚠️ ${escapeHtml(data.stale_warning || '无进展')} — 已超过 ${escapeHtml(String(data.hours_since_last_action ?? '24'))} 小时无验证动作</div>`
      : '';

    const emptyAll = !hasRecords
      ? `<div class="apsales-progress__empty">
          尚无发帖或加入小组记录。子敬登记后会显示<strong>完整内容与可点击链接</strong>（帖文、小组、落地页）。<br><br>
          <strong>社媒 FB/IG/X 需先开户</strong> — 无账号的帖文会标记「无账号」，不会假装「待手动」。
        </div>`
      : '';

    const emailSent = metrics.emails_sent || 0;

    root.innerHTML = `
      ${staleBlock}
      <div class="apsales-progress__header">
        <div>
          <h2>推广动作审计记录</h2>
          <div class="apsales-progress__meta-row">
            <span>最后动作: <strong>${escapeHtml(data.last_verified_action_at || '尚无')}</strong></span>
            <span>邮件已发: ${emailSent}</span>
            <span>回复扫描: ${metrics.replies_scanned || 0}</span>
            <span>跟进草稿: ${metrics.followups_drafted || 0}</span>
            <span>总完成度: ${data.overall_completion_pct || 0}%</span>
          </div>
        </div>
      </div>
      ${renderChannels(data.executable_channels)}
      ${renderEngagementSummary(data.engagement_summary)}
      ${emptyAll}
      ${renderSection('今日互动动作', data.engagement, 'engagement')}
      ${renderSection('已登记帖文（含受阻）', data.posts, 'posts')}
      ${renderSection('已加入小组', data.groups, 'groups')}
      ${renderSection('客户回复跟进', data.followups, 'followups')}
      <p class="apsales-progress__footer">更新于 ${escapeHtml(data.updated_at || '—')} · 点击有全文的行可展开</p>
    `;

    bindExpandHandlers();
  }

  async function load() {
    try {
      const res = await fetch('/api/apsales/distribution-progress', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        root.innerHTML = '<div class="apsales-progress__error">请先登录 Admin 账号后刷新本页。</div>';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      root.innerHTML = `<div class="apsales-progress__error">加载失败: ${escapeHtml(err.message)}</div>`;
    }
  }

  load();
  setInterval(load, 60000);
})();
