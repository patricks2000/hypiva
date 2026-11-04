// Language switch: English / Dutch / French. English is in the page; Dutch lives in data-nl and French in data-fr
// (data-nl-placeholder / data-fr-placeholder for input hints, data-nl-title / data-fr-title on <html> for the tab title).
// Starts in the browser's language (Dutch for nl, French for fr, otherwise English) and remembers the choice;
// ?lang=en, ?lang=nl or ?lang=fr forces one. The language button cycles EN → NL → FR and shows the current language.
(function () {
  var LANGS = ['en', 'nl', 'fr'];
  var NAMES = { en: 'English', nl: 'Nederlands', fr: 'Français' };
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
      b.textContent = lang.toUpperCase();
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
  btns.forEach(function (b) {
    b.addEventListener('click', function () { set(LANGS[(LANGS.indexOf(root.lang) + 1) % LANGS.length]); });
  });
  set(start);
})();
