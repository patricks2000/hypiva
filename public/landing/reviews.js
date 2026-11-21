// Show approved client reviews for the page's service (data-service on #reviews: slideshows, ugc or all). The section stays hidden until there is at least one.
// With more than one review the cards sit in a row you can swipe through, with dots underneath.
// Each review shows in the page language (English, Dutch or French): the client's own words, or a translation with a small "Translated from ..." note.
(function () {
  var box = document.getElementById('reviews');
  var list = document.getElementById('reviewList');
  if (!box || !list) return;
  var ATTR = box.getAttribute('data-service');
  var SERVICE = ATTR === 'ugc' ? 'ugc' : ATTR === 'all' ? '' : 'slideshows';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var URL = 'https://fooxcixwmmdjursbsols.supabase.co/rest/v1/reviews?select=name,company,role,body,rating,photo_url,lang,translation,translations,service&approved=eq.true' + (SERVICE ? '&service=eq.' + SERVICE : '') + '&order=created_at.desc&limit=8';
  var PHOTOS = 'https://fooxcixwmmdjursbsols.supabase.co/storage/v1/object/public/review-photos/';
  function initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function get(u) { return fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); }
  // "Translated from <the client's language>", written in the page language.
  var FROM = {
    en: { en: 'Translated from English', nl: 'Vertaald uit het Engels', fr: "Traduit de l'anglais" },
    nl: { en: 'Translated from Dutch', nl: 'Vertaald uit het Nederlands', fr: 'Traduit du néerlandais' },
    fr: { en: 'Translated from French', nl: 'Vertaald uit het Frans', fr: 'Traduit du français' },
  };
  // The review in the page language: the client's own words, else a translation (newer "translations" per
  // language, or the older English <-> Dutch "translation"). With no translation the original is shown, without a note.
  function textFor(x, lang) {
    var src = x.lang || 'en';
    if (src === lang) return { text: x.body };
    var t = (x.translations && x.translations[lang]) || ((lang === 'en' || lang === 'nl') && (src === 'en' || src === 'nl') ? x.translation : null);
    return t ? { text: t, note: FROM[src] && FROM[src][lang] } : { text: x.body };
  }
  var TAG = { slideshows: { en: 'slideshow campaign', nl: 'slideshow-campagne', fr: 'campagne slideshow' }, ugc: { en: 'UGC campaign', nl: 'UGC-campagne', fr: 'campagne UGC' } };
  var rows = [];
  var dots = null;
  // Swipe row: one card at a time on a phone (the next one peeks in), two side by side on a wide screen.
  var css = document.createElement('style');
  css.textContent =
    '#reviewList.rv-swipe{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px;overscroll-behavior-x:contain;align-items:flex-start;overflow-y:hidden;transition:height .3s ease}' +
    '#reviewList.rv-swipe::-webkit-scrollbar{display:none}' +
    '#reviewList.rv-swipe>.review{flex:0 0 88%;scroll-snap-align:center}' +
    '@media(min-width:900px){#reviewList.rv-swipe{align-items:stretch}#reviewList.rv-swipe>.review{flex-basis:calc(50% - 9px);scroll-snap-align:start}}' +
    '.rv-dots{display:flex;justify-content:center;gap:10px;margin-top:18px}' +
    '.rv-dots button{width:10px;height:10px;padding:0;border-radius:50%;border:0;background:var(--line,#444);cursor:pointer;transition:background .2s,transform .2s}' +
    '.rv-dots button[aria-current=true]{background:var(--accent,#f26b3a);transform:scale(1.25)}';
  document.head.appendChild(css);
  function cards() { return Array.prototype.slice.call(list.children); }
  function current() {
    var cs = cards(), best = 0, d = Infinity, left = list.getBoundingClientRect().left;
    cs.forEach(function (c, i) { var x = Math.abs(c.getBoundingClientRect().left - left); if (x < d) { d = x; best = i; } });
    // At the end of the row the last card counts as the current one.
    if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 4) best = cs.length - 1;
    return best;
  }
  function mark() {
    if (!dots || !list.clientWidth) return;
    // All cards fit on screen (wide screen, two reviews): no dots needed.
    dots.hidden = list.scrollWidth <= list.clientWidth + 4;
    var i = current();
    // The row takes the height of the card in view, so a short review leaves no empty space under it.
    list.style.height = dots.hidden ? '' : (cards()[i].offsetHeight + 4) + 'px';
    Array.prototype.forEach.call(dots.children, function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
  }
  function swipe() {
    if (dots) dots.remove();
    dots = null;
    list.classList.toggle('rv-swipe', rows.length > 1);
    if (rows.length < 2) return;
    dots = el('div', 'rv-dots');
    rows.forEach(function (x, i) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Review ' + (i + 1));
      b.addEventListener('click', function () { list.scrollTo({ left: cards()[i].offsetLeft - list.offsetLeft }); });
      dots.appendChild(b);
    });
    list.after(dots);
    mark();
  }
  var tick;
  window.addEventListener('resize', function () { clearTimeout(tick); tick = setTimeout(mark, 100); });
  list.addEventListener('scroll', function () { clearTimeout(tick); tick = setTimeout(mark, 60); }, { passive: true });
  function render() {
    var lang = document.documentElement.lang;
    if (lang !== 'nl' && lang !== 'fr') lang = 'en';
    list.textContent = '';
    rows.forEach(function (x) {
      var t = textFor(x, lang);
      var card = el('figure', 'review');
      card.appendChild(el('div', 'review-stars', '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating)));
      card.appendChild(el('blockquote', '', '“' + t.text + '”'));
      if (t.note) card.appendChild(el('span', 'review-note', t.note));
      var who = el('figcaption');
      var pic;
      if (x.photo_url && x.photo_url.indexOf(PHOTOS) === 0) {
        pic = el('img', 'review-pic');
        pic.src = x.photo_url; pic.alt = ''; pic.loading = 'lazy'; pic.width = 48; pic.height = 48;
      } else {
        pic = el('div', 'review-pic', initials(x.name));
      }
      pic.setAttribute('aria-hidden', 'true');
      who.appendChild(pic);
      var txt = el('div');
      txt.appendChild(el('b', '', x.name));
      // Same as the small quote at the top of the homepage: "Founder, TheCozyDev (slideshow campaign)".
      var sub = [x.role, x.company].filter(Boolean).join(', '); // name, job title and company stay as the client wrote them
      var kind = '(' + TAG[x.service === 'ugc' ? 'ugc' : 'slideshows'][lang] + ')';
      txt.appendChild(el('span', '', sub ? sub + ' ' + kind : kind));
      who.appendChild(txt);
      card.appendChild(who);
      list.appendChild(card);
    });
    swipe();
  }
  document.addEventListener('hypiva:lang', function () { if (rows.length) render(); });
  get(URL)
    // Older database without the translation or photo columns: load the reviews without them.
    .then(function (r) { return r.ok ? r : get(URL.replace(',translations', '')); })
    .then(function (r) { return r.ok ? r : get(URL.replace(',lang,translation,translations,service', '').replace(/&service=eq\.\w+/, '')); })
    .then(function (r) { return r.ok ? r : get(URL.replace(',photo_url,lang,translation,translations,service', '').replace(/&service=eq\.\w+/, '')); })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) {
      if (!data || !data.length) return;
      rows = data;
      render();
      box.hidden = false;
      mark();
    })
    .catch(function () {});
})();
