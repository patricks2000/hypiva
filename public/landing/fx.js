// Visual effects for the public pages: the 3D hero follows the mouse and the scroll position, can be dragged and swiped,
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
  var grab = { x: 0, y: 0 }; // extra turn while the visitor drags the scene
  function aim() {
    want.y = pointer.x * 22 + turn * (mouse ? -14 : -30) + grab.y;
    want.x = pointer.y * -14 + turn * 5 + grab.x;
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

  // ---- Hero: drag it to turn it, swipe (or tap a dot) for the next picture ----
  // Homepage: the phone shows the next screen. UGC page: the next video card comes to the front.
  if (stage) (function () {
    var img = stage.querySelector('.phone img');
    var cards = [].slice.call(stage.querySelectorAll('.vc'));
    var shots = img ? [img.getAttribute('src'), '/landing/creator-phone.png', '/landing/examples/read-1.webp'] : [];
    var count = img ? shots.length : cards.length;
    if (count < 2) return;
    var index = 0, SPOTS = ['b', 'c', 'a']; // card i sits on spot (i - index): front, right, left
    if (img) img.draggable = false;

    var dots = d.createElement('div');
    dots.className = 'fx-dots';
    var HINT = { en: 'Drag or swipe', nl: 'Sleep of swipe', fr: 'Glissez pour voir la suite' };
    var html = '';
    for (var i = 0; i < count; i++) html += '<button type="button" aria-label="' + (i + 1) + ' / ' + count + '"></button>';
    dots.innerHTML = html + '<span></span>';
    stage.appendChild(dots);
    var hint = dots.querySelector('span');
    function label() { hint.textContent = HINT[d.documentElement.lang] || HINT.en; }
    label();
    d.addEventListener('hypiva:lang', label);

    var swapTimer = 0;
    function show(n) {
      index = (n % count + count) % count;
      [].forEach.call(dots.querySelectorAll('button'), function (b, i) { b.classList.toggle('on', i === index); });
      if (img) {
        stage.classList.toggle('fx-alt', index > 0); // the label in front of the screen steps aside
        img.classList.add('fx-swap');
        setTimeout(function () {
          img.onload = img.onerror = function () { img.classList.remove('fx-swap'); };
          img.src = shots[index];
        }, 170);
        return;
      }
      stage.classList.add('fx-swapping');
      cards.forEach(function (c, i) {
        c.classList.remove('a', 'b', 'c');
        c.classList.add(SPOTS[((i - 1 - index) % 3 + 3) % 3]);
      });
      clearTimeout(swapTimer);
      swapTimer = setTimeout(function () { stage.classList.remove('fx-swapping'); }, 650);
    }
    if (!img) index = 0; // the middle card (second in the page) starts in front
    [].forEach.call(dots.querySelectorAll('button'), function (b, i) {
      b.classList.toggle('on', i === 0);
      b.addEventListener('click', function () { show(i); });
    });

    var drag = null;
    function end(e, cancelled) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, moved = drag.moved, target = drag.target;
      drag = null;
      stage.classList.remove('fx-grabbing');
      grab.x = grab.y = 0;
      aim();
      if (cancelled) return;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { show(index + (dx < 0 ? 1 : -1)); return; }
      if (moved) return;
      // A tap: a card at the side comes to the front, the phone shows its next screen.
      var card = target && target.closest ? target.closest('.vc') : null;
      if (card && !card.classList.contains('b')) show(index + (card.classList.contains('c') ? 1 : -1));
      else if (img && target && target.closest && target.closest('.phone')) show(index + 1);
    }
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.fx-dots')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, target: e.target };
      stage.classList.add('fx-grabbing');
      if (!img || index) return;
      shots.slice(1).forEach(function (src) { new Image().src = src; }); // load the other screens ahead
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      grab.y = Math.max(-60, Math.min(60, dx * 0.4));
      grab.x = Math.max(-22, Math.min(22, -dy * 0.25));
      aim();
    }, { passive: true });
    window.addEventListener('pointerup', function (e) { end(e, false); });
    window.addEventListener('pointercancel', function (e) { end(e, true); });
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
  })();

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
