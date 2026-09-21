(() => {
  'use strict';
  const existing = document.getElementById('engine-catalog-root');
  function removePhotos() {
    existing.querySelectorAll('.ebay-listing-row__photo,.ap-listing-photo,.engine-model__image').forEach(el => el.remove());
  }
  if (existing) { removePhotos(); new MutationObserver(removePhotos).observe(existing, { childList: true, subtree: true }); }
  const root = document.getElementById('ghana-stock');
  if (!root) return;
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  function translate() {
    const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
    document.querySelectorAll('[data-gh-en]').forEach(el => { el.textContent = el.dataset[lang === 'zh' ? 'ghZh' : 'ghEn']; });
    const labels = Array.from(root.querySelectorAll('th'), el => el.textContent);
    rows.forEach(row => Array.from(row.cells).forEach((cell, i) => cell.dataset.label = labels[i]));
  }
  translate();
  new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.getElementById('ghana-search').addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    let count = 0;
    rows.forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); if (!row.hidden) count++; });
    document.getElementById('ghana-count').textContent = `${count} / ${rows.length}`;
    document.getElementById('ghana-empty').hidden = count !== 0;
  });

})();
