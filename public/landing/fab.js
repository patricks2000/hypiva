// Phones: a "Contact" button stays in the corner, and hides while the contact form is on screen.
(function () {
  var fab = document.querySelector('.fab');
  var form = document.getElementById('contact');
  if (!fab || !form || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (e) { fab.classList.toggle('away', e[0].isIntersecting); }).observe(form);
})();
