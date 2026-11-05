// Language switch: English / Dutch / French. English is in the page; Dutch lives in data-nl and French in data-fr
// (data-nl-placeholder / data-fr-placeholder for input hints, data-nl-title / data-fr-title on <html> for the tab title).
// Starts in the browser's language (Dutch for nl, French for fr, otherwise English) and remembers the choice;
// ?lang=en, ?lang=nl or ?lang=fr forces one. The language button shows the current language and opens a small menu to pick another.
(function () {
  var LANGS = ['en', 'nl', 'fr'];
  var NAMES = { en: 'English', nl: 'Nederlands', fr: 'Français' };
  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';
  var els = document.querySelectorAll('[data-nl], [data-fr]');
  els.forEach(function (el) { el.setAttribute('data-en', el.innerHTML); });
  var holders = document.querySelectorAll('[data-nl-placeholder], [data-fr-placeholder]');
  holders.forEach(function (el) { el.setAttribute('data-en-placeholder', el.getAttribute('placeholder') || ''); });
  var form = document.getElementById('leadForm');
  var btns = document.querySelectorAll('#langBtn, .langbtn');
  var root = document.documentElement;
  var titles = { en: document.title, nl: root.getAttribute('data-nl-title') || document.title, fr: root.getAttribute('data-fr-title') || document.title };
  function pick(el, lang, attr) {
    // Falls back to English when a text has no translation in the chosen language.
    return el.getAttribute('data-' + lang + attr) || el.getAttribute('data-en' + attr);
  }
  function set(lang) {
    if (LANGS.indexOf(lang) < 0) lang = 'en';
    els.forEach(function (el) { el.innerHTML = pick(el, lang, ''); });
    holders.forEach(function (el) { el.setAttribute('placeholder', pick(el, lang, '-placeholder')); });
    root.lang = lang;
    document.title = titles[lang];
    if (form) form.setAttribute('data-lang', lang);
    btns.forEach(function (b) {
      b.innerHTML = GLOBE + '<span>' + lang.toUpperCase() + '</span>' + CHEVRON;
      b.setAttribute('aria-label', 'Language: ' + NAMES[lang]);
    });
    document.dispatchEvent(new Event('hypiva:lang'));
    try { localStorage.setItem('hypiva-lang', lang); } catch (e) {}
  }
  var q = (location.search.match(/[?&]lang=(nl|en|fr)/) || [])[1];
  var saved = null; try { saved = localStorage.getItem('hypiva-lang'); } catch (e) {}
  if (LANGS.indexOf(saved) < 0) saved = null;
  // No choice yet: follow the browser's language.
  var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
  var first = langs[0] || '';
  var browser = /^nl\b/i.test(first) ? 'nl' : /^fr\b/i.test(first) ? 'fr' : 'en';
  var start = q || saved || browser;
  // Tapping the button opens a small menu with the three languages (instead of cycling blindly).
  var FLAGS = { en: '🇬🇧', nl: '🇳🇱', fr: '🇫🇷' };
  var CHEVRON = '<svg class="lchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var css = document.createElement('style');
  css.textContent =
    '.langbtn{display:inline-flex;align-items:center;gap:5px}.langbtn svg{width:15px;height:15px;flex:none}' +
    '.langmenu{position:fixed;z-index:1000;min-width:190px;padding:6px;background:#15171c;border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.55);opacity:0;transform:translateY(-6px) scale(.98);transform-origin:top right;transition:opacity .14s,transform .14s;pointer-events:none}' +
    '.langmenu.show{opacity:1;transform:none;pointer-events:auto}' +
    '.langmenu button{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;border-radius:11px;color:#f4f4f5;font:inherit;font-size:15px;font-weight:600;padding:11px 12px;cursor:pointer;text-align:left}' +
    '.langmenu button:hover,.langmenu button:focus-visible{background:rgba(255,255,255,.07);outline:none}' +
    '.langmenu button[aria-checked="true"]{background:rgba(255,106,61,.13);color:#ff8a5c}' +
    '.langmenu .flag{font-size:19px;line-height:1}.langmenu .name{flex:1}' +
    '.langmenu .tick{width:16px;height:16px;opacity:0}.langmenu button[aria-checked="true"] .tick{opacity:1}' +
    '.langbtn .lchev{width:12px !important;height:12px !important;color:currentColor !important;opacity:.6;transition:transform .15s}.langbtn[aria-expanded="true"] .lchev{transform:rotate(180deg)}';
  document.head.appendChild(css);
  var TICK = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var menu = document.createElement('div');
  menu.className = 'langmenu'; menu.setAttribute('role', 'menu');
  menu.innerHTML = LANGS.map(function (l) {
    return '<button type="button" role="menuitemradio" data-l="' + l + '"><span class="flag">' + FLAGS[l] + '</span><span class="name">' + NAMES[l] + '</span>' + TICK + '</button>';
  }).join('');
  document.body.appendChild(menu);
  var opener = null;
  function closeMenu() {
    menu.classList.remove('show');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    opener = null;
  }
  function openMenu(b) {
    var r = b.getBoundingClientRect();
    menu.style.top = (r.bottom + 8) + 'px';
    menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    menu.querySelectorAll('button').forEach(function (m) { m.setAttribute('aria-checked', String(m.getAttribute('data-l') === root.lang)); });
    menu.classList.add('show');
    opener = b; b.setAttribute('aria-expanded', 'true');
  }
  menu.addEventListener('click', function (e) {
    var m = e.target.closest('button'); if (!m) return;
    set(m.getAttribute('data-l')); closeMenu();
  });
  btns.forEach(function (b) {
    b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (opener === b) closeMenu(); else { closeMenu(); openMenu(b); }
    });
  });
  document.addEventListener('click', function (e) { if (opener && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, { passive: true });
  set(start);
})();
