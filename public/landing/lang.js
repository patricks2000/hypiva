// English / Dutch switch. English is in the page; Dutch lives in data-nl. Remembers the choice; ?lang=nl or ?lang=en forces one.
(function () {
  var els = document.querySelectorAll('[data-nl]');
  els.forEach(function (el) { el.setAttribute('data-en', el.innerHTML); });
  var form = document.getElementById('leadForm');
  var btn = document.getElementById('langBtn');
  var titles = { en: document.title, nl: 'UGC-campagnes | Hypiva' };
  function set(lang) {
    els.forEach(function (el) { el.innerHTML = el.getAttribute(lang === 'nl' ? 'data-nl' : 'data-en'); });
    document.documentElement.lang = lang;
    document.title = titles[lang];
    form.setAttribute('data-lang', lang);
    btn.textContent = lang === 'nl' ? 'EN' : 'NL';
    btn.setAttribute('aria-label', lang === 'nl' ? 'Switch to English' : 'Naar Nederlands');
    document.dispatchEvent(new Event('hypiva:lang'));
    try { localStorage.setItem('hypiva-lang', lang); } catch (e) {}
  }
  var q = (location.search.match(/[?&]lang=(nl|en)/) || [])[1];
  var saved = null; try { saved = localStorage.getItem('hypiva-lang'); } catch (e) {}
  var start = q || saved || (/^nl\b/i.test(navigator.language || '') ? 'nl' : 'en');
  btn.addEventListener('click', function () { set(document.documentElement.lang === 'nl' ? 'en' : 'nl'); });
  if (start === 'nl') set('nl');
})();
