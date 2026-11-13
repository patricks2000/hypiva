// Builds the influencer cards (hypiva.com/creators) and each influencer's own page (hypiva.com/creators/<slug>)
// from influencers-data.js. Runs before lang.js, so the data-nl / data-fr texts are switched like the rest of the page.
(function () {
  var list = window.HYPIVA_INFLUENCERS || [];
  function esc(s) { return String(s || '').replace(/[<>"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function t(o) { return o ? ' data-nl="' + esc(o.nl) + '" data-fr="' + esc(o.fr) + '">' + (o.en || '') : '>'; }
  function tags(p) { return p.tags.map(function (x) { return '<span class="tag"' + t(x) + '</span>'; }).join(''); }

  var grid = document.getElementById('infGrid');
  if (grid) {
    grid.innerHTML = list.map(function (p) {
      return '<a class="cr" href="/creators/' + esc(p.slug) + '">' +
        '<div class="ph"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy" style="object-position:' + esc(p.photoPos || '50% 25%') + '"><span class="go" data-nl="Bekijk profiel →" data-fr="Voir le profil →">View profile →</span></div>' +
        '<div class="bd"><h3>' + esc(p.name) + '</h3>' +
        '<div class="meta"><span' + t(p.role) + '</span> · ' + esc(p.followers) + ' <span data-nl="volgers op" data-fr="abonnés sur">followers on</span> ' + esc(p.platform) + '</div>' +
        '<div class="tags">' + tags(p) + '</div></div></a>';
    }).join('') + grid.innerHTML;
  }

  var prof = document.getElementById('infProfile');
  if (prof) {
    var slug = (location.pathname.match(/\/creators\/([a-z0-9-]+)/) || [])[1] || new URLSearchParams(location.search).get('id');
    var p = list.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { location.replace('/creators'); return; }
    document.title = p.name + ' | Hypiva';
    document.documentElement.setAttribute('data-nl-title', p.name + ' | Influencer bij Hypiva');
    document.documentElement.setAttribute('data-fr-title', p.name + ' | Influenceuse chez Hypiva');
    var mail = 'mailto:patrick@hypiva.com?subject=' + encodeURIComponent('Samenwerking met ' + p.name);
    prof.innerHTML =
      '<a class="back" href="/creators" data-nl="← Alle influencers" data-fr="← Tous les influenceurs">← All influencers</a>' +
      '<div class="phero">' +
        '<div class="pphoto"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" style="object-position:' + esc(p.photoPos || '50% 25%') + '"></div>' +
        '<div><div class="eyebrow"' + t(p.role) + '</div><h1>' + esc(p.name) + '</h1>' +
        '<div class="stats"><div><b>' + esc(p.followers) + '</b><span data-nl="volgers op ' + esc(p.platform) + '" data-fr="abonnés sur ' + esc(p.platform) + '">followers on ' + esc(p.platform) + '</span></div>' +
        '<div><b>🇳🇱</b><span' + t(p.language) + '</span></div><div><b>📍</b><span' + t(p.region) + '</span></div></div>' +
        '<p class="pabout"' + t(p.about) + '</p>' +
        '<div class="tags">' + tags(p) + '</div>' +
        '<div class="ctas"><a class="btn primary" href="' + mail + '" data-nl="Samenwerken met ' + esc(p.name) + ' →" data-fr="Collaborer avec ' + esc(p.name) + ' →">Work with ' + esc(p.name) + ' →</a>' +
        (p.tiktok ? '<a class="btn ghost" href="' + esc(p.tiktok) + '" target="_blank" rel="noopener">TikTok ↗</a>' : '') + '</div>' +
        '<p class="note" data-nl="Contact over samenwerkingen loopt altijd via Hypiva, niet rechtstreeks met de influencer." data-fr="Les collaborations passent toujours par Hypiva, pas directement par l&#39;influenceur.">Collaborations always go through Hypiva, not directly with the influencer.</p></div>' +
      '</div>' +
      (p.gallery && p.gallery.length ? '<div class="pgal">' + p.gallery.map(function (g, i) { return '<img src="' + esc(g) + '" alt="" loading="lazy"' + (i === 0 ? ' class="wide"' : '') + '>'; }).join('') + '</div>' : '');
  }
})();
