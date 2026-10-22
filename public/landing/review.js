// Review form on hypiva.com/write-review: saves straight into the "reviews" table (it starts hidden until an admin approves it).
// An optional photo is cropped to a 400x400 JPEG in the browser (this also drops location data) and uploaded to the "review-photos" bucket first.
(function () {
  var BASE = 'https://fooxcixwmmdjursbsols.supabase.co';
  var URL = BASE + '/rest/v1/reviews';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var form = document.getElementById('reviewForm');
  var msg = document.getElementById('reviewMsg');
  var counter = document.getElementById('counter');
  var photoInput = document.getElementById('photoInput');
  var photoPrev = document.getElementById('photoPrev');
  var photoBtn = document.getElementById('photoBtn');
  if (!form) return;
  var text = form.querySelector('textarea[name=body]');
  var photo = null; // JPEG blob, ready to upload
  text.addEventListener('input', function () { counter.textContent = text.value.length + ' / 600'; });
  // English and Dutch texts; the page language comes from the switch in lang.js.
  var TEXT = {
    en: { choose: 'Choose photo', change: 'Change photo', type: 'Please pick a JPG, PNG or WebP image.', big: 'That photo is too big. Please pick one under 15 MB.', read: 'We could not read that photo. Please try another one.', thanks: 'Thanks! We got your review.', rating: 'Please pick a rating.', name: 'Please add your name.', more: 'Please write a few more words.', sending: 'Sending…', ok: 'Thank you! 💜 Your review will show on our website after a quick check.', err: 'Something went wrong. You can also email your review to patrick@hypiva.com.', send: 'Send review' },
    nl: { choose: 'Kies foto', change: 'Andere foto', type: 'Kies een JPG-, PNG- of WebP-afbeelding.', big: 'Die foto is te groot. Kies er een onder 15 MB.', read: 'We konden die foto niet lezen. Probeer een andere.', thanks: 'Dankjewel! We hebben je review ontvangen.', rating: 'Kies een beoordeling.', name: 'Vul je naam in.', more: 'Schrijf nog een paar woorden.', sending: 'Versturen…', ok: 'Dankjewel! 💜 Je review verschijnt op onze website na een korte check.', err: 'Er ging iets mis. Je kunt je review ook mailen naar patrick@hypiva.com.', send: 'Verstuur review' },
  };
  function T() { return document.documentElement.lang === 'nl' ? TEXT.nl : TEXT.en; }
  function say(t, ok) { msg.textContent = t; msg.style.color = ok ? '#3DDC97' : '#FFC24B'; }
  document.addEventListener('hypiva:lang', function () { photoBtn.textContent = photo ? T().change : T().choose; });

  function resetPhoto() {
    photo = null;
    photoPrev.textContent = '+';
    photoBtn.textContent = T().choose;
  }

  // Square crop from the centre, scaled to 400x400.
  function toJpeg(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var src = window.URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas');
        c.width = c.height = 400;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 400, 400);
        window.URL.revokeObjectURL(src);
        c.toBlob(function (b) { b ? resolve(b) : reject(); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { window.URL.revokeObjectURL(src); reject(); };
      img.src = src;
    });
  }

  photoInput.addEventListener('change', function () {
    var f = photoInput.files && photoInput.files[0];
    if (!f) return resetPhoto();
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { photoInput.value = ''; resetPhoto(); return say(T().type); }
    if (f.size > 15 * 1024 * 1024) { photoInput.value = ''; resetPhoto(); return say(T().big); }
    toJpeg(f).then(function (b) {
      photo = b;
      var img = document.createElement('img');
      img.alt = '';
      img.src = window.URL.createObjectURL(b);
      photoPrev.textContent = '';
      photoPrev.appendChild(img);
      photoBtn.textContent = T().change;
      say('');
    }).catch(function () { photoInput.value = ''; resetPhoto(); say(T().read); });
  });

  function uploadPhoto() {
    if (!photo) return Promise.resolve(null);
    var name = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); });
    return fetch(BASE + '/storage/v1/object/review-photos/' + name + '.jpg', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'image/jpeg' },
      body: photo,
    }).then(function (r) {
      if (!r.ok) throw new Error();
      return BASE + '/storage/v1/object/public/review-photos/' + name + '.jpg';
    }).catch(function () { return null; }); // photo is optional: send the review without it
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = {};
    new FormData(form).forEach(function (v, k) { if (typeof v === 'string') d[k] = v.trim(); });
    if (d.website) { form.reset(); resetPhoto(); return say(T().thanks, true); } // bot
    if (!d.rating) return say(T().rating);
    if (!d.name) return say(T().name);
    if (d.body.length < 10) return say(T().more);
    var btn = form.querySelector('button'); btn.disabled = true; btn.textContent = T().sending;
    uploadPhoto().then(function (photoUrl) {
      var row = { name: d.name.slice(0, 80), company: (d.company || '').slice(0, 100), role: (d.role || '').slice(0, 80), body: d.body.slice(0, 600), rating: Number(d.rating) };
      if (photoUrl) row.photo_url = photoUrl;
      return fetch(URL, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
    }).then(function (r) {
      if (!r.ok) throw new Error();
      form.reset(); resetPhoto(); counter.textContent = '0 / 600';
      say(T().ok, true);
    }).catch(function () {
      say(T().err);
    }).then(function () { btn.disabled = false; btn.textContent = T().send; });
  });
})();
