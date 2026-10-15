// Homepage: shows approved client reviews. The section stays hidden until there is at least one.
(function () {
  var box = document.getElementById('reviews');
  var list = document.getElementById('reviewList');
  if (!box || !list) return;
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var URL = 'https://fooxcixwmmdjursbsols.supabase.co/rest/v1/reviews?select=name,company,role,body,rating,photo_url&approved=eq.true&order=created_at.desc&limit=6';
  var PHOTOS = 'https://fooxcixwmmdjursbsols.supabase.co/storage/v1/object/public/review-photos/';
  function initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function get(u) { return fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); }
  get(URL)
    // Older database without the photo column: load the reviews without photos.
    .then(function (r) { return r.ok ? r : get(URL.replace(',photo_url', '')); })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (x) {
        var card = el('figure', 'review');
        card.appendChild(el('div', 'review-stars', '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating)));
        card.appendChild(el('blockquote', '', '“' + x.body + '”'));
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
        var sub = [x.role, x.company].filter(Boolean).join(', ');
        if (sub) txt.appendChild(el('span', '', sub));
        who.appendChild(txt);
        card.appendChild(who);
        list.appendChild(card);
      });
      box.hidden = false;
    })
    .catch(function () {});
})();
