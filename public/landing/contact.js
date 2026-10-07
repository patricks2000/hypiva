// Homepage campaign request form: sends to the Supabase edge function "brand-lead".
(function () {
  var form = document.getElementById('leadForm');
  var msg = document.getElementById('leadMsg');
  if (!form) return;
  var topic = form.getAttribute('data-topic');
  // Read the language each time: the influencer page can switch between English and Dutch.
  function isNl() { return form.getAttribute('data-lang') === 'nl'; }
  var TEXT = {
    nl: { name: 'Vul je naam in.', email: 'Vul een geldig e-mailadres in.', sending: 'Versturen…', ok: 'Dankjewel! We hebben je aanvraag ontvangen en reageren binnen één werkdag.', also: ' Je kunt ook mailen naar patrick@hypiva.com.', send: 'Verstuur', err: 'Er ging iets mis.' },
    en: { name: 'Please add your name.', email: 'Please add a valid email address.', sending: 'Sending…', ok: 'Thanks! We got your request and reply within one working day.', also: ' You can also email patrick@hypiva.com.', send: 'Send request', err: 'Something went wrong' },
  };
  function T() { return isNl() ? TEXT.nl : TEXT.en; }
  var startCurrency = (form.querySelector('input[name=currency]:checked') || {}).value || 'USD';

  // Currency toggle: rewrite the budget options with $ or €.
  function setCurrency(cur) {
    var sym = cur === 'EUR' ? '€' : '$';
    form.querySelectorAll('select[name=budget] option[data-label]').forEach(function (o) {
      o.textContent = ((isNl() && o.getAttribute('data-label-nl')) || o.getAttribute('data-label')).split('{c}').join(sym);
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
