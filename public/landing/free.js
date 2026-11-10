// "Free sample" (homepage) and "Free video ideas" (UGC page) forms.
// Both send a normal request to the "brand-lead" function, with a label in the message so it is clear what was asked.
(function () {
  var TEXT = {
    en: { name: 'Please add your name.', email: 'Please add a valid email address.', what: 'Please tell us which app or product it is about.', max: 'You can add up to 5 images.', sending: 'Sending…', ok: 'Thanks! We got your request. You will hear from us within 2 working days.', err: 'Something went wrong. You can also email patrick@hypiva.com.' },
    nl: { name: 'Vul je naam in.', email: 'Vul een geldig e-mailadres in.', what: 'Vertel om welke app of welk product het gaat.', max: 'Je kunt maximaal 5 afbeeldingen toevoegen.', sending: 'Versturen…', ok: 'Dankjewel! We hebben je aanvraag ontvangen. Je hoort binnen 2 werkdagen van ons.', err: 'Er ging iets mis. Je kunt ook mailen naar patrick@hypiva.com.' },
    fr: { name: 'Indiquez votre nom.', email: 'Indiquez une adresse e-mail valide.', what: 'Dites-nous de quelle app ou de quel produit il s’agit.', max: 'Vous pouvez ajouter 5 images au maximum.', sending: 'Envoi…', ok: 'Merci ! Nous avons bien reçu votre demande. Vous aurez de nos nouvelles sous 2 jours ouvrés.', err: 'Une erreur est survenue. Vous pouvez aussi écrire à patrick@hypiva.com.' },
  };
  function T() { var l = document.documentElement.lang; return TEXT[l === 'nl' || l === 'fr' ? l : 'en']; }
  // Screenshots are shrunk to a JPEG in the browser (this also drops location data) and uploaded to public storage;
  // the links travel inside the request message. Files get a random name, so nobody can guess or overwrite them.
  var BASE = 'https://fooxcixwmmdjursbsols.supabase.co';
  var BUCKET = 'review-photos'; // shared upload bucket (random file names)
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb3hjaXh3bW1kanVyc2Jzb2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjgyNzMsImV4cCI6MjEwNjIwNDI3M30.QCKwmvOktHj8zA9JMetodaE2NX1F-uqN0qmRUnXmq20';
  var MAX = 5;
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }); }
  function toJpeg(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var src = window.URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        window.URL.revokeObjectURL(src);
        c.toBlob(function (b) { b ? resolve(b) : reject(); }, 'image/jpeg', 0.8);
      };
      img.onerror = function () { window.URL.revokeObjectURL(src); reject(); };
      img.src = src;
    });
  }
  function upload(blob) {
    var name = uuid();
    return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + name + '.jpg', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'image/jpeg' }, body: blob,
    }).then(function (r) { if (!r.ok) throw new Error(); return BASE + '/storage/v1/object/public/' + BUCKET + '/' + name + '.jpg'; })
      .catch(function () { return null; }); // screenshots are optional: the request still goes out
  }

  document.querySelectorAll('form.freeform').forEach(function (form) {
    var msg = form.querySelector('.formmsg');
    var btn = form.querySelector('button[type=submit]');
    var input = form.querySelector('.shots-input');
    var thumbs = form.querySelector('.shots-thumbs');
    var shots = []; // JPEG blobs
    function draw() {
      if (!thumbs) return;
      thumbs.textContent = '';
      shots.forEach(function (b, i) {
        var t = document.createElement('button');
        t.type = 'button'; t.className = 'shot'; t.setAttribute('aria-label', 'Remove');
        var im = document.createElement('img'); im.alt = ''; im.src = window.URL.createObjectURL(b);
        t.appendChild(im);
        t.addEventListener('click', function () { shots.splice(i, 1); draw(); });
        thumbs.appendChild(t);
      });
      form.classList.toggle('has-shots', shots.length > 0);
    }
    if (input) input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []).filter(function (f) { return /^image\//.test(f.type) && f.size < 20 * 1024 * 1024; });
      input.value = '';
      var room = MAX - shots.length;
      if (files.length > room) say(T().max);
      Promise.all(files.slice(0, room).map(function (f) { return toJpeg(f).catch(function () { return null; }); }))
        .then(function (bs) { bs.forEach(function (b) { if (b && shots.length < MAX) shots.push(b); }); draw(); });
    });
    function say(t, ok) { msg.textContent = t; msg.style.color = ok ? '#3DDC97' : '#FFC24B'; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {};
      new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
      if (!d.name) return say(T().name);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return say(T().email);
      if (!d.company) return say(T().what);
      var label = form.getAttribute('data-topic') || 'Free sample';
      var pageLang = document.documentElement.lang;
      var body = { name: d.name, email: d.email, company: d.company, website: d.website || '', lang: pageLang === 'nl' || pageLang === 'fr' ? pageLang : 'en',
        message: '[' + label + '] ' + d.company + (d.note ? '\n' + d.note : '') };
      var old = btn.innerHTML;
      btn.disabled = true; btn.textContent = T().sending;
      Promise.all(shots.map(upload)).then(function (urls) {
        urls = urls.filter(Boolean);
        if (urls.length) body.message += '\nScreenshots:\n' + urls.join('\n');
        return fetch(BASE + '/functions/v1/brand-lead', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }).then(function (r) { if (!r.ok) throw new Error(); form.reset(); shots = []; draw(); say(T().ok, true); })
        .catch(function () { say(T().err); })
        .then(function () { btn.disabled = false; btn.innerHTML = old; });
    });
  });
})();
