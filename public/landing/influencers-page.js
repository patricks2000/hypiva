// Builds the cards (hypiva.com/influencers and the "Our UGC creators" block on the UGC page) and each person's own page
// (hypiva.com/influencers/<slug>) from influencers-data.js. One profile per person, whichever page you click from.
// The profile pages are also written as real HTML at build time (scripts/influencer-pages.mjs uses profileHTML below),
// so search engines see them without running JavaScript. Runs before lang.js, so data-nl / data-fr texts get switched too.
(function (root) {
  function esc(s) { return String(s || '').replace(/[<>"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function t(o) { return o ? ' data-nl="' + esc(o.nl) + '" data-fr="' + esc(o.fr) + '">' + (o.en || '') : '>'; }
  function tags(p, cls) { return p.tags.map(function (x) { return '<span class="' + cls + '"' + t(x) + '</span>'; }).join(''); }
  function has(p, s) { return (p.services || ['influencer']).indexOf(s) >= 0; }

  // The request form, the same one as on the other pages (contact.js sends it to the "brand-lead" function).
  function formHTML(p) {
    var mail = p && p.email || 'patrick@hypiva.com';
    var topic = p ? 'Influencer: ' + p.name : 'Influencer';
    return '<form id="leadForm" class="lead" novalidate data-lang="en" data-topic="' + esc(topic) + '">' +
      '<div class="row2">' +
        '<label><span data-nl="Je naam" data-fr="Votre nom">Your name</span><input name="name" required maxlength="100" autocomplete="name"></label>' +
        '<label><span data-nl="E-mail" data-fr="E-mail">Email</span><input name="email" type="email" required maxlength="200" autocomplete="email"></label>' +
      '</div>' +
      '<label><span data-nl="Bedrijf, merk of zaak" data-fr="Entreprise, marque ou commerce">Company, brand or venue</span><input name="company" maxlength="120" autocomplete="organization"></label>' +
      '<label><span data-nl="Wat wil je promoten?" data-fr="Que voulez-vous promouvoir ?">What do you want to promote?</span><textarea name="message" rows="4" maxlength="1900"></textarea></label>' +
      '<label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<button class="btn primary" type="submit" data-nl="Verstuur" data-fr="Envoyer la demande">Send request</button>' +
      '<p class="formmsg" id="leadMsg" role="status"></p>' +
    '</form>' +
    '<p class="note"><span data-nl="Liever mailen?" data-fr="Vous préférez l&#39;e-mail ?">Prefer email?</span> <a href="mailto:' + esc(mail) + '?subject=' + encodeURIComponent('Samenwerking' + (p ? ' met ' + p.name : '')) + '" style="color:var(--accent);font-weight:700">' + esc(mail) + '</a></p>' +
    '<p class="note" data-nl="Contact over samenwerkingen loopt altijd via Hypiva, niet rechtstreeks met de ' + (p ? 'creator' : 'influencer') + '." data-fr="Les collaborations passent toujours par Hypiva, pas directement par ' + (p ? 'le créateur' : 'l&#39;influenceur') + '.">Collaborations always go through Hypiva, not directly with the ' + (p ? 'creator' : 'influencer') + '.</p>';
  }

  // A person's profile: photo, labels, numbers, text, tags, buttons, gallery and the request form.
  function profileHTML(p) {
    var badges = (has(p, 'influencer') ? '<span class="badge">Influencer</span>' : '') +
      (has(p, 'ugc') ? '<span class="badge" data-nl="UGC-creator" data-fr="Créatrice UGC">UGC creator</span>' : '');
    var stats = '<div class="stats">' +
      (has(p, 'influencer') ? '<div><b>' + esc(p.followers) + '</b><span data-nl="volgers op ' + esc(p.platform) + '" data-fr="abonnés sur ' + esc(p.platform) + '">followers on ' + esc(p.platform) + '</span></div>' : '') +
      '<div><b>🇳🇱</b><span' + t(p.language) + '</span></div>' +
      (p.region ? '<div><b>📍</b><span' + t(p.region) + '</span></div>' : '') + '</div>';
    return '<a class="back" href="/influencers" data-nl="← Alle influencers" data-fr="← Tous les influenceurs">← All influencers</a>' +
      '<div class="phero">' +
        '<div class="pphoto"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" style="object-position:' + esc(p.photoPos || '50% 25%') + '"></div>' +
        '<div><div class="badges">' + badges + '</div><h1>' + esc(p.name) + '</h1>' + stats +
        '<p class="pabout"' + t(p.about) + '</p>' +
        '<div class="ptags">' + tags(p, 'ptag') + '</div>' +
        '<div class="ctas"><a class="btn primary" href="#contact" data-nl="Samenwerken met ' + esc(p.name) + ' →" data-fr="Collaborer avec ' + esc(p.name) + ' →">Work with ' + esc(p.name) + ' →</a>' +
        (p.tiktok && has(p, 'influencer') ? '<a class="btn ghost" href="' + esc(p.tiktok) + '" target="_blank" rel="noopener">TikTok ↗</a>' : '') + '</div></div>' +
      '</div>' +
      (p.gallery && p.gallery.length ? '<div class="pgal">' + p.gallery.map(function (g, i) { return '<img src="' + esc(g) + '" alt="' + esc(p.name) + '" loading="lazy"' + (i === 0 ? ' class="wide"' : '') + '>'; }).join('') + '</div>' : '') +
      '<div class="final pform" id="contact"><h2 data-nl="Samenwerken met ' + esc(p.name) + '?" data-fr="Collaborer avec ' + esc(p.name) + ' ?">Work with ' + esc(p.name) + '?</h2>' +
        '<p data-nl="Vertel kort over je merk of zaak en wat je in gedachten hebt. We reageren meestal binnen een dag." data-fr="Présentez brièvement votre marque ou commerce et votre idée. Nous répondons généralement sous un jour.">Tell us briefly about your brand or venue and what you have in mind. We usually reply within a day.</p>' +
        formHTML(p) + '</div>';
  }

  root.HypivaInfluencers = { profileHTML: profileHTML, formHTML: formHTML };
  if (typeof document === 'undefined') return; // used at build time, no page here

  var list = root.HYPIVA_INFLUENCERS || [];

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

  // The request form on the influencers overview.
  var slot = document.getElementById('infForm');
  if (slot && !slot.firstChild) slot.innerHTML = formHTML(null);

  var prof = document.getElementById('infProfile');
  if (prof) {
    var fromUgc = new URLSearchParams(location.search).get('from') === 'ugc';
    if (!prof.querySelector('.phero')) {
      // Fallback when the page was not built ahead (e.g. a new person before the next deploy).
      var slug = (location.pathname.match(/\/influencers\/([a-z0-9-]+)/) || [])[1] || new URLSearchParams(location.search).get('id');
      var p = list.filter(function (x) { return x.slug === slug; })[0];
      if (!p) { location.replace('/influencers'); return; }
      document.title = p.name + ' | Hypiva';
      document.documentElement.setAttribute('data-nl-title', p.name + ' | Creator bij Hypiva');
      document.documentElement.setAttribute('data-fr-title', p.name + ' | Créatrice chez Hypiva');
      prof.innerHTML = profileHTML(p);
    }
    if (fromUgc) {
      var back = prof.querySelector('.back');
      if (back) {
        back.setAttribute('href', '/ugc#ugc-creators');
        back.setAttribute('data-nl', '← Alle UGC-creators');
        back.setAttribute('data-fr', '← Tous les créateurs UGC');
        back.textContent = '← All UGC creators';
      }
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
