// Writes a real HTML page per influencer/creator (dist/profiles/<slug>.html, served at /influencers/<slug>)
// from public/landing/influencers-data.js, using the same profile markup as the browser (influencers-page.js).
// Search engines then see the name, text, photos and form without running JavaScript, with their own title,
// description, share image and structured data (ProfilePage + Person).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const SITE = 'https://www.hypiva.com';
const attr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = (s) => String(s || '').replace(/&#39;/g, "'");

export function influencerPages(dist) {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('landing/influencers-data.js', dist), 'utf8'), ctx);
  vm.runInContext(readFileSync(new URL('landing/influencers-page.js', dist), 'utf8'), ctx);
  const people = ctx.HYPIVA_INFLUENCERS || [];
  const template = readFileSync(new URL('influencer-profile.html', dist), 'utf8');
  mkdirSync(new URL('profiles/', dist), { recursive: true });
  for (const p of people) {
    const url = `${SITE}/influencers/${p.slug}`;
    const roles = [(p.services || []).includes('influencer') && 'TikTok influencer', (p.services || []).includes('ugc') && 'UGC creator'].filter(Boolean).join(' & ');
    const title = `${p.name}, ${roles} | Hypiva`;
    const desc = plain(p.about.en) + ` Work with ${p.name} through Hypiva.`;
    const image = SITE + (p.share || p.photo);
    const ld = { '@context': 'https://schema.org', '@type': 'ProfilePage', url, name: title, mainEntity: {
      '@type': 'Person', name: p.name, description: plain(p.about.en), image, url,
      ...(p.tiktok ? { sameAs: [p.tiktok] } : {}),
      affiliation: { '@type': 'Organization', name: 'Hypiva', url: SITE + '/' } } };
    let html = template
      .replace(/<html lang="en"[^>]*>/, `<html lang="en" data-nl-title="${attr(`${p.name} | Creator bij Hypiva`)}" data-fr-title="${attr(`${p.name} | Créatrice chez Hypiva`)}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${attr(desc)}">`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${attr(title)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${attr(desc)}">`)
      .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${image}">\n<meta property="og:type" content="profile">\n<meta property="og:url" content="${url}">\n<meta name="twitter:card" content="summary_large_image">\n<link rel="canonical" href="${url}">`)
      .replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`)
      .replace('<div class="wrap pwrap" id="infProfile"></div>', `<div class="wrap pwrap" id="infProfile">${ctx.HypivaInfluencers.profileHTML(p)}</div>`);
    if (!html.includes('class="phero"')) throw new Error('Profile markup missing for ' + p.slug);
    writeFileSync(new URL(`profiles/${p.slug}.html`, dist), html);
  }
  console.log('Profile pages: ' + people.map((p) => '/influencers/' + p.slug).join(', '));
}
