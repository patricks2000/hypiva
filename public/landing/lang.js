// English / Dutch switch. English is in the page; Dutch lives in data-nl (data-nl-placeholder for input hints,
// data-nl-title on <html> for the tab title). Starts in English, remembers the choice; ?lang=nl or ?lang=en forces one.
(function () {
  var els = document.querySelectorAll('[data-nl]');
  els.forEach(function (el) { el.setAttribute('data-en', el.innerHTML); });
  var holders = document.querySelectorAll('[data-nl-placeholder]');
  holders.forEach(function (el) { el.setAttribute('data-en-placeholder', el.getAttribute('placeholder') || ''); });
  var form = document.getElementById('leadForm');
  var btns = document.querySelectorAll('#langBtn, .langbtn');
  var root = document.documentElement;
  var titles = { en: document.title, nl: root.getAttribute('data-nl-title') || document.title };
  function set(lang) {
    var nl = lang === 'nl';
    els.forEach(function (el) { el.innerHTML = el.getAttribute(nl ? 'data-nl' : 'data-en'); });
    holders.forEach(function (el) { el.setAttribute('placeholder', el.getAttribute(nl ? 'data-nl-placeholder' : 'data-en-placeholder')); });
    root.lang = lang;
    document.title = titles[lang];
    if (form) form.setAttribute('data-lang', lang);
    btns.forEach(function (b) {
      b.textContent = nl ? 'EN' : 'NL';
      b.setAttribute('aria-label', nl ? 'Switch to English' : 'Naar Nederlands');
    });
    document.dispatchEvent(new Event('hypiva:lang'));
    try { localStorage.setItem('hypiva-lang', lang); } catch (e) {}
  }
  var q = (location.search.match(/[?&]lang=(nl|en)/) || [])[1];
  var saved = null; try { saved = localStorage.getItem('hypiva-lang'); } catch (e) {}
  var start = q || saved || 'en';
  btns.forEach(function (b) { b.addEventListener('click', function () { set(root.lang === 'nl' ? 'en' : 'nl'); }); });
  if (start === 'nl') set('nl');
})();
