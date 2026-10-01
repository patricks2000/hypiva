// Homepage campaign request form: sends to the Supabase edge function "brand-lead".
(function () {
  var form = document.getElementById('leadForm');
  var msg = document.getElementById('leadMsg');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v); });
    if (!data.name.trim()) { msg.textContent = 'Please add your name.'; msg.style.color = '#FFC24B'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) { msg.textContent = 'Please add a valid email address.'; msg.style.color = '#FFC24B'; return; }
    var btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
    fetch('https://fooxcixwmmdjursbsols.supabase.co/functions/v1/brand-lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error || 'Something went wrong');
        form.reset();
        msg.textContent = 'Thanks! We got your request and reply within one working day.'; msg.style.color = '#3DDC97';
      })
      .catch(function (err) { msg.textContent = err.message + ' You can also email patrick@hypiva.com.'; msg.style.color = '#FFC24B'; })
      .then(function () { btn.disabled = false; btn.textContent = 'Send request'; });
  });
})();
