// Review form on hypiva.com/write-review: saves straight into the "reviews" table (it starts hidden until an admin approves it).
(function () {
  var URL = 'https://fooxcixwmmdjursbsols.supabase.co/rest/v1/reviews';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var form = document.getElementById('reviewForm');
  var msg = document.getElementById('reviewMsg');
  var counter = document.getElementById('counter');
  if (!form) return;
  var text = form.querySelector('textarea[name=body]');
  text.addEventListener('input', function () { counter.textContent = text.value.length + ' / 600'; });
  function say(t, ok) { msg.textContent = t; msg.style.color = ok ? '#3DDC97' : '#FFC24B'; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = {};
    new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
    if (d.website) { form.reset(); return say('Thanks! We got your review.', true); } // bot
    if (!d.rating) return say('Please pick a rating.');
    if (!d.name) return say('Please add your name.');
    if (d.body.length < 10) return say('Please write a few more words.');
    var btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
    fetch(URL, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ name: d.name.slice(0, 80), company: (d.company || '').slice(0, 100), role: (d.role || '').slice(0, 80), body: d.body.slice(0, 600), rating: Number(d.rating) }),
    }).then(function (r) {
      if (!r.ok) throw new Error();
      form.reset(); counter.textContent = '0 / 600';
      say('Thank you! 💜 Your review will show on our website after a quick check.', true);
    }).catch(function () {
      say('Something went wrong. You can also email your review to patrick@hypiva.com.');
    }).then(function () { btn.disabled = false; btn.textContent = 'Send review'; });
  });
})();
