// Visual effects for the public pages: the 3D hero follows the mouse and the scroll position,
// cards tilt under the mouse, and sections rise into view while scrolling.
// Decoration only: if this file does not load, nothing on the page is hidden or broken.
(function () {
  'use strict';
  var d = document;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- Reading progress line under the top bar ----
  var nav = d.querySelector('nav.top');
  function progress() {
    if (!nav) return;
    var max = d.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--fx-p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
  }

  // ---- Hero scene: turns a little with the mouse and with the scroll position ----
  var stage = d.querySelector('.fx-stage');
  var want = { x: 0, y: 0 }, now = { x: 0, y: 0 }, pointer = { x: 0, y: 0 }, turn = 0, busy = false;
  function aim() {
    want.y = pointer.x * 22 + turn * (mouse ? -14 : -30);
    want.x = pointer.y * -14 + turn * 5;
    if (!busy) { busy = true; requestAnimationFrame(step); }
  }
  function step() {
    now.x += (want.x - now.x) * 0.09;
    now.y += (want.y - now.y) * 0.09;
    stage.style.setProperty('--rx', now.x.toFixed(2) + 'deg');
    stage.style.setProperty('--ry', now.y.toFixed(2) + 'deg');
    stage.style.setProperty('--gx', (50 - now.y * 2.2).toFixed(1) + '%');
    if (Math.abs(want.x - now.x) + Math.abs(want.y - now.y) > 0.02) requestAnimationFrame(step);
    else busy = false;
  }
  function scrollTurn() {
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
    var t = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
    turn = Math.max(-1, Math.min(1, t));
    aim();
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; progress(); if (!reduce) scrollTurn(); });
  }, { passive: true });
  progress();
  if (reduce) return;
  if (stage) scrollTurn();

  // ---- Sections rise into view (only the ones that start below the screen, so nothing flickers) ----
  var REVEAL = '.sec-h, #how > .wrap > .pill, #how > .wrap > h2, #how > .wrap > .sub, .step, .plan, .feat, .ex, .bar, .about, .review-cta, .review, .final, .faq details, .factors, .opts > *, .trustcard';
  var seen = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      seen.unobserve(el);
      el.classList.add('fx-in');
      setTimeout(function () { el.classList.remove('fx-r', 'fx-in'); el.style.transitionDelay = ''; }, 1500);
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function reveal(el) {
    if (!seen || el.classList.contains('fx-r') || el.closest('[hidden]')) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) return;
    var i = 0, s = el;
    while ((s = s.previousElementSibling) && i < 4) i++;
    el.style.transitionDelay = (i * 80) + 'ms';
    el.classList.add('fx-r');
    seen.observe(el);
  }
  d.querySelectorAll(REVEAL).forEach(reveal);
  // Reviews arrive later from the database
  var list = d.getElementById('reviewList');
  if (list && 'MutationObserver' in window) {
    new MutationObserver(function () { list.querySelectorAll('.review').forEach(reveal); }).observe(list, { childList: true });
  }

  if (!mouse) return;

  // ---- Mouse only: the hero follows the pointer, cards tilt under it ----
  var TILT = '.step, .plan, .feat, .review, .about, .bar, .review-cta';
  var card = null, last = null, queued = false;
  function release() {
    if (!card) return;
    card.style.transform = '';
    card.classList.remove('fx-tilt');
    card = null;
  }
  function tilt() {
    queued = false;
    var e = last;
    if (stage) {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
      aim();
    }
    var el = e.target && e.target.closest ? e.target.closest(TILT) : null;
    if (el && el.classList.contains('fx-r')) el = null;
    if (el !== card) { release(); card = el; if (el) el.classList.add('fx-tilt'); }
    if (!el) return;
    var r = el.getBoundingClientRect();
    var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    var max = Math.min(8, 2600 / r.width);
    el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * max).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * max).toFixed(2) + 'deg) translateY(-4px)';
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  }
  d.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    last = e;
    if (!queued) { queued = true; requestAnimationFrame(tilt); }
  }, { passive: true });
  d.documentElement.addEventListener('pointerleave', release);
})();
