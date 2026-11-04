// Homepage campaign request form: sends to the Supabase edge function "brand-lead".
(function () {
  var form = document.getElementById('leadForm');
  var msg = document.getElementById('leadMsg');
  if (!form) return;
  var topic = form.getAttribute('data-topic');
  // Read the language each time: the pages can switch between English, Dutch and French.
  function lang() { var l = form.getAttribute('data-lang'); return l === 'nl' || l === 'fr' ? l : 'en'; }
  var TEXT = {
    nl: { name: 'Vul je naam in.', email: 'Vul een geldig e-mailadres in.', sending: 'Versturen…', ok: 'Dankjewel! We hebben je aanvraag ontvangen en proberen binnen één werkdag te reageren.', also: ' Je kunt ook mailen naar patrick@hypiva.com.', send: 'Verstuur', err: 'Er ging iets mis.' },
    fr: { name: 'Indiquez votre nom.', email: 'Indiquez une adresse e-mail valide.', sending: 'Envoi…', ok: 'Merci ! Nous avons bien reçu votre demande et essayons de répondre sous un jour ouvré.', also: ' Vous pouvez aussi écrire à patrick@hypiva.com.', send: 'Envoyer la demande', err: 'Une erreur est survenue.' },
    en: { name: 'Please add your name.', email: 'Please add a valid email address.', sending: 'Sending…', ok: 'Thanks! We got your request and try to reply within one working day.', also: ' You can also email patrick@hypiva.com.', send: 'Send request', err: 'Something went wrong' },
  };
  function T() { return TEXT[lang()]; }
  var startCurrency = (form.querySelector('input[name=currency]:checked') || {}).value || 'USD';

  // Currency toggle: rewrite the budget options with $ or €.
  function setCurrency(cur) {
    var sym = cur === 'EUR' ? '€' : '$';
    form.querySelectorAll('select[name=budget] option[data-label]').forEach(function (o) {
      o.textContent = (o.getAttribute('data-label-' + lang()) || o.getAttribute('data-label')).split('{c}').join(sym);
    });
  }
  form.querySelectorAll('input[name=currency]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) setCurrency(r.value); });
  });
  setCurrency(startCurrency);
  document.addEventListener('hypiva:lang', function () {
    setCurrency((form.querySelector('input[name=currency]:checked') || {}).value || startCurrency);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v); });
    if (!data.name.trim()) { msg.textContent = T().name; msg.style.color = '#FFC24B'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) { msg.textContent = T().email; msg.style.color = '#FFC24B'; return; }
    // The UGC page asks for a number of videos and a budget per video instead of a total budget; both travel inside the message.
    var extra = [data.videos && 'Videos: ' + data.videos, data.per_video && 'Budget per video: ' + data.per_video].filter(Boolean).join(' · ');
    if (extra) data.message = extra + '\n' + (data.message || '');
    delete data.videos; delete data.per_video;
    if (topic) data.message = '[' + topic + '] ' + (data.message || '');
    var btn = form.querySelector('button'); btn.disabled = true; btn.textContent = T().sending;
    fetch('https://fooxcixwmmdjursbsols.supabase.co/functions/v1/brand-lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error || T().err);
        form.reset(); setCurrency(startCurrency);
        msg.textContent = T().ok; msg.style.color = '#3DDC97';
      })
      .catch(function (err) { msg.textContent = err.message + T().also; msg.style.color = '#FFC24B'; })
      .then(function () { btn.disabled = false; btn.textContent = T().send; });
  });
})();
