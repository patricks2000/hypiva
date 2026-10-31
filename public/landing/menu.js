// Mobile menu: the ☰ button opens a panel with all page links; tapping a link closes it.
(function () {
  var nav = document.querySelector('nav.top');
  var btn = document.querySelector('.menubtn');
  if (!nav || !btn) return;
  function close() { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('.mpanel a').forEach(function (a) { a.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
