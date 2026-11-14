// Builds the cards (hypiva.com/influencers and the "Our UGC creators" block on the UGC page) and each person's own page
// (hypiva.com/influencers/<slug>) from influencers-data.js. One profile per person, whichever page you click from.
// Runs before lang.js, so the data-nl / data-fr texts are switched like the rest of the page.
(function () {
  var list = window.HYPIVA_INFLUENCERS || [];
  function esc(s) { return String(s || '').replace(/[<>"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function t(o) { return o ? ' data-nl="' + esc(o.nl) + '" data-fr="' + esc(o.fr) + '">' + (o.en || '') : '>'; }
  function tags(p, cls) { return p.tags.map(function (x) { return '<span class="' + cls + '"' + t(x) + '</span>'; }).join(''); }
  function has(p, s) { return (p.services || ['influencer']).indexOf(s) >= 0; }

  document.querySelectorAll('[data-infgrid]').forEach(function (grid) {
    var service = grid.getAttribute('data-infgrid');
    var from = service === 'ugc' ? '?from=ugc' : '';
    var people = list.filter(function (p) { return has(p, service); });
    if (!people.length) { var sec = grid.closest('[data-hide-empty]'); if (sec) sec.hidden = true; return; }
    grid.innerHTML = people.map(function (p) {
      var meta = service === 'ugc'
        ? '<span data-nl="UGC-creator" data-fr="Créatrice UGC">UGC creator</span> · <span' + t(p.language) + '</span>'
        : esc(p.followers) + ' <span data-nl="volgers op" data-fr="abonnés sur">followers on</span> ' + esc(p.platform) + ' · <span' + t(p.language) + '</span>';
      return '<a class="cr" href="/influencers/' + esc(p.slug) + from + '">' +
        '<div class="ph"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy" style="object-position:' + esc(p.photoPos || '50% 25%') + '"><span class="go" data-nl="Bekijk profiel →" data-fr="Voir le profil →">View profile →</span></div>' +
        '<div class="bd"><h3>' + esc(p.name) + '</h3><div class="meta">' + meta + '</div>' +
        '<div class="ctags">' + tags(p, 'ctag') + '</div></div></a>';
    }).join('') + grid.innerHTML;
  });

  var prof = document.getElementById('infProfile');
  if (prof) {
    var slug = (location.pathname.match(/\/influencers\/([a-z0-9-]+)/) || [])[1] || new URLSearchParams(location.search).get('id');
    var fromUgc = new URLSearchParams(location.search).get('from') === 'ugc';
    var p = list.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { location.replace('/influencers'); return; }
    document.title = p.name + ' | Hypiva';
    document.documentElement.setAttribute('data-nl-title', p.name + ' | Creator bij Hypiva');
    document.documentElement.setAttribute('data-fr-title', p.name + ' | Créatrice chez Hypiva');
    var mail = 'mailto:' + (p.email || 'patrick@hypiva.com') + '?subject=' + encodeURIComponent('Samenwerking met ' + p.name);
    var back = fromUgc
      ? '<a class="back" href="/ugc#ugc-creators" data-nl="← Alle UGC-creators" data-fr="← Tous les créateurs UGC">← All UGC creators</a>'
      : '<a class="back" href="/influencers" data-nl="← Alle influencers" data-fr="← Tous les influenceurs">← All influencers</a>';
    var badges = (has(p, 'influencer') ? '<span class="badge">Influencer</span>' : '') +
      (has(p, 'ugc') ? '<span class="badge" data-nl="UGC-creator" data-fr="Créatrice UGC">UGC creator</span>' : '');
    var stats = '<div class="stats">' +
      (has(p, 'influencer') ? '<div><b>' + esc(p.followers) + '</b><span data-nl="volgers op ' + esc(p.platform) + '" data-fr="abonnés sur ' + esc(p.platform) + '">followers on ' + esc(p.platform) + '</span></div>' : '') +
      '<div><b>🇳🇱</b><span' + t(p.language) + '</span></div>' +
      (p.region ? '<div><b>📍</b><span' + t(p.region) + '</span></div>' : '') + '</div>';
    prof.innerHTML = back +
      '<div class="phero">' +
        '<div class="pphoto"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" style="object-position:' + esc(p.photoPos || '50% 25%') + '"></div>' +
        '<div><div class="badges">' + badges + '</div><h1>' + esc(p.name) + '</h1>' + stats +
        '<p class="pabout"' + t(p.about) + '</p>' +
        '<div class="ptags">' + tags(p, 'ptag') + '</div>' +
        '<div class="ctas"><a class="btn primary" href="' + mail + '" data-nl="Samenwerken met ' + esc(p.name) + ' →" data-fr="Collaborer avec ' + esc(p.name) + ' →">Work with ' + esc(p.name) + ' →</a>' +
        (p.tiktok && has(p, 'influencer') ? '<a class="btn ghost" href="' + esc(p.tiktok) + '" target="_blank" rel="noopener">TikTok ↗</a>' : '') + '</div>' +
        '<p class="note" data-nl="Contact over samenwerkingen loopt altijd via Hypiva, niet rechtstreeks met de creator." data-fr="Les collaborations passent toujours par Hypiva, pas directement par le créateur.">Collaborations always go through Hypiva, not directly with the creator.</p></div>' +
      '</div>' +
      (p.gallery && p.gallery.length ? '<div class="pgal">' + p.gallery.map(function (g, i) { return '<img src="' + esc(g) + '" alt="" loading="lazy"' + (i === 0 ? ' class="wide"' : '') + '>'; }).join('') + '</div>' : '');
  }
})();
