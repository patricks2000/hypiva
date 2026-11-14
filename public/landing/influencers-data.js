// The influencers shown on hypiva.com/influencers and the UGC page. To add someone: copy one block, change the texts,
// put their photos in /landing/<slug>/ and the card + their own page (/influencers/<slug>) appear automatically.
// Texts have an English, Dutch (nl) and French (fr) version. Never put prices or private details (home town, workplace) here.
window.HYPIVA_INFLUENCERS = [
  {
    slug: 'joos',
    name: 'Joos',
    photo: '/landing/joos/bench.webp',
    photoPos: '50% 22%',
    share: '/landing/joos/share.jpg', // 1200x630 picture for link previews (WhatsApp, LinkedIn)
    followers: '28k+',
    platform: 'TikTok',
    services: ['influencer', 'ugc'], // 'influencer' = shown on /influencers, 'ugc' = shown on the UGC page
    language: { en: 'Dutch', nl: 'Nederlands', fr: 'Néerlandais' },
    region: { en: 'Central Netherlands', nl: 'Midden-Nederland', fr: 'Centre des Pays-Bas' },
    tags: [
      { en: '🍽️ Food & restaurants', nl: '🍽️ Eten & restaurants', fr: '🍽️ Cuisine & restaurants' },
      { en: '💄 Beauty', nl: '💄 Beauty', fr: '💄 Beauté' },
      { en: '👗 Fashion & jewellery', nl: '👗 Mode & sieraden', fr: '👗 Mode & bijoux' },
      { en: '🌸 Perfume', nl: '🌸 Parfum', fr: '🌸 Parfum' },
      { en: '🏋️‍♀️ Sport', nl: '🏋️‍♀️ Sport', fr: '🏋️‍♀️ Sport' }
    ],
    about: {
      en: 'Joos is an upbeat creator who makes videos about the things she enjoys herself: going out for food and discovering lunch spots, snacks, beauty and skincare, fashion and jewellery, perfume and sport.',
      nl: 'Joos is een vrolijke creator die video&#39;s maakt over de dingen die ze zelf leuk vindt: uit eten gaan en lunchspots ontdekken, snacks, beauty en skincare, mode en sieraden, parfum en sport.',
      fr: 'Joos est une créatrice pétillante qui fait des vidéos sur ce qu&#39;elle aime : sortir manger et découvrir des adresses lunch, les snacks, la beauté et les soins, la mode et les bijoux, le parfum et le sport.'
    },
    gallery: ['/landing/joos/laugh.webp', '/landing/joos/selfie.webp', '/landing/joos/sport.webp'],
    email: 'joos@hypiva.com', // alias of patrick@hypiva.com, lands under the Gmail label 'Joos'
    tiktok: 'https://www.tiktok.com/@joosie.vdgrint'
  }
];
