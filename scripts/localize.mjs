// Builds real Dutch and French pages (/nl, /nl/ugc, /nl/influencers and the same under /fr) from the English pages.
// The translations already sit in the HTML as data-nl / data-fr attributes (lang.js swaps them in the browser).
// Search engines mostly read the page as served, so here the translation is written into the page itself,
// with its own title, description, canonical address and links to the other languages.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://www.hypiva.com';
const PAGES = {
  home: {
    file: 'index.html', path: '',
    nl: { title: 'TikTok marketing voor apps: betaal per resultaat | Hypiva', desc: 'TikTok marketing voor apps en merken. Het creatornetwerk van Hypiva post slideshows over jouw app op veel echte TikTok-accounts, in meerdere talen. Je betaalt alleen voor resultaat.', og: 'Echte creators. Echte views. Betaal per resultaat.' },
    fr: { title: 'Marketing TikTok pour apps : payez au résultat | Hypiva', desc: 'Marketing TikTok pour apps et marques. Le réseau de créateurs Hypiva publie des slideshows sur votre app sur de nombreux vrais comptes TikTok, en plusieurs langues. Vous payez uniquement au résultat.', og: 'De vrais créateurs. De vraies vues. Payez au résultat.' },
  },
  ugc: {
    file: 'influencers.html', path: '/ugc',
    nl: { title: "UGC laten maken | UGC-video's voor merken | Hypiva", desc: "UGC laten maken voor je merk: echte UGC-video's van Nederlandse, Engelstalige en Franstalige creators voor TikTok, Instagram en advertenties. Prijs in overleg, eerste video's meestal binnen 7 dagen.", og: "Echte UGC-video's van Nederlandse, Engelstalige en Franstalige creators. Wij regelen alles." },
    fr: { title: 'Vidéos UGC pour les marques | Créateurs UGC | Hypiva', desc: 'Faites créer des vidéos UGC pour votre marque : de vraies vidéos de créateurs francophones, anglophones et néerlandophones pour TikTok, Instagram et vos publicités. Prix sur demande, premières vidéos généralement sous 7 jours.', og: 'De vraies vidéos UGC par des créateurs francophones, anglophones et néerlandophones. Nous gérons tout.' },
  },
  influencers: {
    file: 'influencers-list.html', path: '/influencers',
    nl: { title: 'Influencer marketing | Influencer inhuren voor TikTok | Hypiva', desc: 'Influencer marketing voor merken, restaurants en zaken: onze Nederlandse influencers posten over jouw product op hun eigen TikTok. Eerlijk, in hun eigen stijl, en wij regelen alles.', og: 'Jouw merk op TikTok, door influencers die het echt leuk vinden.' },
    fr: { title: 'Marketing d’influence | Influenceurs TikTok | Hypiva', desc: 'Marketing d’influence pour marques, restaurants et commerces : nos influenceurs publient sur votre produit sur leur propre TikTok. Sincère, dans leur style, et nous gérons tout.', og: 'Votre marque sur TikTok, par des influenceurs qui l’aiment vraiment.' },
  },
};

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Reads the opening tag that starts at `i` (html[i] is "<"). Quoted values may contain "<" and ">". */
function readTag(html, i) {
  const m = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i, i + 40));
  if (!m) return null;
  const attrs = {};
  let p = i + m[0].length;
  for (;;) {
    while (/\s/.test(html[p])) p++;
    if (html[p] === '>') return { name: m[1].toLowerCase(), attrs, end: p + 1 };
    if (html[p] === '/' && html[p + 1] === '>') return { name: m[1].toLowerCase(), attrs, end: p + 2 };
    if (p >= html.length) return null;
    let s = p;
    while (!/[\s=>]/.test(html[p])) p++;
    const key = html.slice(s, p).toLowerCase();
    let value = '';
    if (html[p] === '=') {
      p++;
      const q = html[p];
      if (q === '"' || q === "'") { s = ++p; p = html.indexOf(q, p); value = html.slice(s, p); p++; }
      else { s = p; while (!/[\s>]/.test(html[p])) p++; value = html.slice(s, p); }
    }
    if (key) attrs[key] = value; else p++;
  }
}

/** Index of the closing tag that belongs to the element whose opening tag ended at `from`. */
function closeOf(html, name, from) {
  const re = new RegExp('<(/?)' + name + '\\b', 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (--depth === 0) return m.index; }
    else { const t = readTag(html, m.index); if (t) { depth++; re.lastIndex = t.end; } }
  }
  throw new Error('No closing tag for <' + name + '>');
}

/** Writes the `lang` texts into the page, the same way lang.js does in the browser. */
function translate(html, lang) {
  let out = '', i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const tag = readTag(html, lt);
    if (!tag) { out += '<'; i = lt + 1; continue; }
    let open = html.slice(lt, tag.end);
    if (tag.name === 'script' || tag.name === 'style') { // raw text: copy untouched
      const end = html.indexOf('</' + tag.name, tag.end);
      out += html.slice(lt, end); i = end; continue;
    }
    const hint = tag.attrs['data-' + lang + '-placeholder'];
    if (hint !== undefined) open = open.replace(/(\splaceholder=)("[^"]*"|'[^']*')/, () => ` placeholder="${attr(decode(hint))}"`);
    const text = tag.attrs['data-' + lang];
    if (text !== undefined) {
      const end = closeOf(html, tag.name, tag.end);
      out += open + decode(text); i = end; continue;
    }
    out += open; i = tag.end;
  }
  return out;
}


const strip = (h) => decode(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const LOCALE = { en: 'en_US', nl: 'nl_NL', fr: 'fr_FR' };
const SERVICE = {
  home: { en: 'TikTok slideshow campaigns for apps', nl: 'TikTok-slideshowcampagnes voor apps', fr: 'Campagnes de slideshows TikTok pour apps' },
  ugc: { en: 'UGC videos for brands', nl: "UGC-video's voor merken", fr: 'Vidéos UGC pour les marques' },
  influencers: { en: 'Influencer marketing', nl: 'Influencer marketing', fr: 'Marketing d’influence' },
};

/** Structured data for search engines: the company, the service on this page and its FAQ, read from the page itself. */
function structured(html, key, lang, url, desc) {
  const faq = [...html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } }))
    .filter((x) => x.name && x.acceptedAnswer.text);
  const org = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Hypiva', url: SITE + '/', logo: SITE + '/landing/icon.png', email: 'patrick@hypiva.com',
    founder: { '@type': 'Person', name: 'Patrick' }, address: { '@type': 'PostalAddress', addressCountry: 'NL' } };
  const graph = [org,
    { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'Hypiva', publisher: { '@id': SITE + '/#org' }, inLanguage: ['en', 'nl', 'fr'] },
    { '@type': 'Service', name: SERVICE[key][lang], description: desc, url, provider: { '@id': SITE + '/#org' }, serviceType: SERVICE[key].en, areaServed: ['NL', 'BE', 'FR', 'Worldwide'] }];
  if (faq.length) graph.push({ '@type': 'FAQPage', url, inLanguage: lang, mainEntity: faq });
  return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') + '</script>';
}

/** Social sharing tags (link previews in WhatsApp, LinkedIn, X) and structured data, added to the head. */
function headExtras(html, key, lang, url, desc) {
  html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/landing/og-card.jpg">`);
  const tags = [`<meta property="og:type" content="website">`, `<meta property="og:url" content="${url}">`, `<meta property="og:site_name" content="Hypiva">`,
    `<meta property="og:locale" content="${LOCALE[lang]}">`, `<meta name="twitter:card" content="summary_large_image">`, structured(html, key, lang, url, desc)].join('\n');
  return once(html, /<\/head>/, tags + '\n</head>');
}

const once = (html, from, to) => { if (!from.test(html)) throw new Error('Not found in page: ' + from); return html.replace(from, () => to); };

export function localize(dist) {
  for (const [key, page] of Object.entries(PAGES)) {
    const source = new URL(page.file, dist);
    // Every language version points to all the others, so search engines show each visitor the right one.
    const alternates = [['en', page.path || '/'], ['nl', '/nl' + page.path], ['fr', '/fr' + page.path], ['x-default', page.path || '/']]
      .map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${SITE}${p}">`).join('\n');
    const english = once(readFileSync(source, 'utf8'), /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}${page.path || '/'}">\n${alternates}`);
    const enDesc = decode((/<meta name="description" content="([^"]*)"/.exec(english) || [])[1] || '');
    writeFileSync(source, headExtras(english, key, 'en', SITE + (page.path || '/'), enDesc));
    for (const lang of ['nl', 'fr']) {
      const t = page[lang], url = `${SITE}/${lang}${page.path}`;
      let html = translate(english, lang);
      html = once(html, /<html lang="en"/, `<html lang="${lang}"`);
      html = once(html, /<title>[^<]*<\/title>/, `<title>${t.title.replace(/&/g, '&amp;')}</title>`);
      html = once(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${attr(t.desc)}">`);
      html = once(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${attr(t.title)}">`);
      html = once(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${attr(t.og)}">`);
      html = once(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
      // Links between the two pages stay inside the language.
      html = html.replace(/href="\/(ugc|influencers)?(#[\w-]*)?"/g, (_, sub, hash) => `href="/${lang}${sub ? '/' + sub : ''}${hash || ''}"`);
      html = headExtras(html, key, lang, url, t.desc);
      mkdirSync(new URL(lang + '/', dist), { recursive: true });
      writeFileSync(new URL(`${lang}/${page.path ? page.path.slice(1) : 'index'}.html`, dist), html);
    }
  }
  console.log('Dutch and French pages at /nl, /nl/ugc, /nl/influencers, /fr, /fr/ugc, /fr/influencers');
}
