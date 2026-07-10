'use strict';
/* ── Home v4 — Jiji Marketplace ── */

(function () {

  /* TAB SWITCHING */
  function initTabs() {
    const tabs = document.querySelectorAll('.j-tab');
    const panels = document.querySelectorAll('.j-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        panels.forEach(p => p.style.display = 'none');
        tab.classList.add('is-active');
        const target = document.getElementById(tab.dataset.target);
        if (target) target.style.display = '';
      });
    });
  }

  /* FILTER PILLS */
  function initPills() {
    document.querySelectorAll('.j-pills').forEach(group => {
      const pills = group.querySelectorAll('.j-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          pills.forEach(p => p.classList.remove('is-active'));
          pill.classList.add('is-active');
        });
      });
    });
  }

  /* HOT-TAG forwarding (search bar integration) */
  function initHotTags() {
    document.querySelectorAll('[data-v3-hot-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.v3HotTag;
        const input = document.querySelector('.v3-header-search input');
        if (input) {
          input.value = q;
          input.closest('form')?.submit();
        }
      });
    });
  }

  /* PRICE CALCULATOR (interactive) */
  function initCalc() {
    const input = document.getElementById('j-calc-input');
    if (!input) return;
    function update() {
      const v = parseFloat(input.value) || 0;
      document.querySelectorAll('[data-calc]').forEach(el => {
        const ratio = parseFloat(el.dataset.calc);
        el.textContent = '$' + Math.round(v * ratio).toLocaleString();
      });
    }
    input.addEventListener('input', update);
    update();
  }

  /* HERO CAROUSEL — eBay-style */
  function initCarousel() {
    const track   = document.querySelector('.ap-carousel__track');
    if (!track) return;
    const carousel = track.closest('.ap-carousel');
    const slides   = track.querySelectorAll('.ap-slide');
    const dots     = carousel.querySelectorAll('.ap-dot');
    const btnPrev  = carousel.querySelector('.ap-ctrl--prev');
    const btnNext  = carousel.querySelector('.ap-ctrl--next');
    const btnPause = carousel.querySelector('.ap-ctrl--pause');
    const total    = slides.length;
    let current    = 0;
    let paused     = false;
    let timer;

    function goTo(n) {
      current = (n + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
    }
    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function startAuto() {
      if (paused) return;
      clearInterval(timer);
      timer = setInterval(next, 5500);
    }
    function stopAuto() { clearInterval(timer); }

    btnNext?.addEventListener('click', () => { stopAuto(); next(); startAuto(); });
    btnPrev?.addEventListener('click', () => { stopAuto(); prev(); startAuto(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { stopAuto(); goTo(i); startAuto(); }));

    btnPause?.addEventListener('click', () => {
      paused = !paused;
      btnPause.classList.toggle('is-paused', paused);
      paused ? stopAuto() : startAuto();
    });

    /* pause on hover */
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', () => { if (!paused) startAuto(); });

    startAuto();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initPills();
    initHotTags();
    initCalc();
    initCarousel();
  });
})();
