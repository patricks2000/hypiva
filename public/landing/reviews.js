// Homepage: shows approved client reviews. The section stays hidden until there is at least one.
(function () {
  var box = document.getElementById('reviews');
  var list = document.getElementById('reviewList');
  if (!box || !list) return;
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var URL = 'https://fooxcixwmmdjursbsols.supabase.co/rest/v1/reviews?select=name,company,role,body,rating&approved=eq.true&order=created_at.desc&limit=6';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  fetch(URL, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (x) {
        var card = el('figure', 'review');
        card.appendChild(el('div', 'review-stars', '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating)));
        card.appendChild(el('blockquote', '', '“' + x.body + '”'));
        var who = el('figcaption');
        who.appendChild(el('b', '', x.name));
        var sub = [x.role, x.company].filter(Boolean).join(', ');
        if (sub) who.appendChild(el('span', '', sub));
        card.appendChild(who);
        list.appendChild(card);
      });
      box.hidden = false;
    })
    .catch(function () {});
})();
