// Homepage and UGC page: show approved client reviews for that page's service (data-service on #reviews). The section stays hidden until there is at least one.
// Each review shows in the page language: the client's own words, or the admin's translation with a "Translated from ..." note.
(function () {
  var box = document.getElementById('reviews');
  var list = document.getElementById('reviewList');
  if (!box || !list) return;
  var SERVICE = box.getAttribute('data-service') === 'ugc' ? 'ugc' : 'slideshows';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var URL = 'https://fooxcixwmmdjursbsols.supabase.co/rest/v1/reviews?select=name,company,role,body,rating,photo_url,lang,translation,service&approved=eq.true&service=eq.' + SERVICE + '&order=created_at.desc&limit=6';
  var PHOTOS = 'https://fooxcixwmmdjursbsols.supabase.co/storage/v1/object/public/review-photos/';
  function initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function get(u) { return fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); }
  var FROM = { en: { en: 'Translated from English', nl: 'Vertaald uit het Engels' }, nl: { en: 'Translated from Dutch', nl: 'Vertaald uit het Nederlands' } };
  var TAG = { slideshows: { en: 'slideshow campaign', nl: 'slideshow-campagne', fr: 'campagne slideshow' }, ugc: { en: 'UGC campaign', nl: 'UGC-campagne', fr: 'campagne UGC' } };
  var rows = [];
  function render() {
    var lang = document.documentElement.lang;
    var page = lang === 'nl' ? 'nl' : 'en'; // reviews and their translations exist in English and Dutch; French pages read the English version
    var label = lang === 'fr' ? 'fr' : page;
    list.textContent = '';
    rows.forEach(function (x) {
      var own = (x.lang || 'en') === page || !x.translation;
      var card = el('figure', 'review');
      card.appendChild(el('div', 'review-stars', '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating)));
      card.appendChild(el('blockquote', '', '“' + (own ? x.body : x.translation) + '”'));
      if (!own) card.appendChild(el('span', 'review-note', FROM[x.lang][page]));
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
      var sub = [x.role, x.company].filter(Boolean).join(', ');
      var kind = '(' + TAG[x.service === 'ugc' ? 'ugc' : 'slideshows'][label] + ')';
      txt.appendChild(el('span', '', sub ? sub + ' ' + kind : kind));
      who.appendChild(txt);
      card.appendChild(who);
      list.appendChild(card);
    });
  }
  document.addEventListener('hypiva:lang', function () { if (rows.length) render(); });
  get(URL)
    // Older database without the translation or photo columns: load the reviews without them.
    .then(function (r) { return r.ok ? r : get(URL.replace(',lang,translation,service', '')); })
    .then(function (r) { return r.ok ? r : get(URL.replace(',photo_url,lang,translation,service', '')); })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) {
      if (!data || !data.length) return;
      rows = data;
      render();
      box.hidden = false;
    })
    .catch(function () {});
})();
