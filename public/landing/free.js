// "Free sample" (homepage) and "Free video ideas" (UGC page) forms.
// Both send a normal request to the "brand-lead" function, with a label in the message so it is clear what was asked.
(function () {
  var TEXT = {
    en: { name: 'Please add your name.', email: 'Please add a valid email address.', what: 'Please tell us which app or product it is about.', sending: 'Sending…', ok: 'Thanks! We got your request. You will hear from us within 2 working days.', err: 'Something went wrong. You can also email patrick@hypiva.com.' },
    nl: { name: 'Vul je naam in.', email: 'Vul een geldig e-mailadres in.', what: 'Vertel om welke app of welk product het gaat.', sending: 'Versturen…', ok: 'Dankjewel! We hebben je aanvraag ontvangen. Je hoort binnen 2 werkdagen van ons.', err: 'Er ging iets mis. Je kunt ook mailen naar patrick@hypiva.com.' },
    fr: { name: 'Indiquez votre nom.', email: 'Indiquez une adresse e-mail valide.', what: 'Dites-nous de quelle app ou de quel produit il s’agit.', sending: 'Envoi…', ok: 'Merci ! Nous avons bien reçu votre demande. Vous aurez de nos nouvelles sous 2 jours ouvrés.', err: 'Une erreur est survenue. Vous pouvez aussi écrire à patrick@hypiva.com.' },
  };
  function T() { var l = document.documentElement.lang; return TEXT[l === 'nl' || l === 'fr' ? l : 'en']; }
  document.querySelectorAll('form.freeform').forEach(function (form) {
    var msg = form.querySelector('.formmsg');
    var btn = form.querySelector('button');
    function say(t, ok) { msg.textContent = t; msg.style.color = ok ? '#3DDC97' : '#FFC24B'; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {};
      new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
      if (!d.name) return say(T().name);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return say(T().email);
      if (!d.company) return say(T().what);
      var label = form.getAttribute('data-topic') || 'Free sample';
      var body = { name: d.name, email: d.email, company: d.company, website: d.website || '',
        message: '[' + label + '] ' + d.company + (d.note ? '\n' + d.note : '') };
      var old = btn.innerHTML;
      btn.disabled = true; btn.textContent = T().sending;
      fetch('https://fooxcixwmmdjursbsols.supabase.co/functions/v1/brand-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(function (r) { if (!r.ok) throw new Error(); form.reset(); say(T().ok, true); })
        .catch(function () { say(T().err); })
        .then(function () { btn.disabled = false; btn.innerHTML = old; });
    });
  });
})();
