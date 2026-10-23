// Homepage example slideshows: a tap (or Enter) shows the next slide, and after the last one it starts again.
(function () {
  document.querySelectorAll('.ex-slides').forEach(function (box) {
    function next() {
      var w = box.clientWidth;
      var i = Math.round(box.scrollLeft / w) + 1;
      box.scrollTo({ left: i >= box.children.length ? 0 : i * w, behavior: 'smooth' });
    }
    box.addEventListener('click', next);
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } });
  });
})();
