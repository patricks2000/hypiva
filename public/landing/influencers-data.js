// The influencers shown on hypiva.com/influencers and the UGC page. To add someone: copy one block, change the texts,
// put their photos in /landing/<slug>/ and the card + their own page (/influencers/<slug>) appear automatically.
// Texts have an English, Dutch (nl) and French (fr) version. Never put prices or private details (home town, workplace) here.
window.HYPIVA_INFLUENCERS = [
  {
    slug: 'joos',
    name: 'Joos',
    photo: '/landing/joos/bench.webp',
    photoPos: '50% 22%',
    followers: '28k+',
    platform: 'TikTok',
    services: ['influencer', 'ugc'], // 'influencer' = shown on /influencers, 'ugc' = shown on the UGC page
    role: { en: 'Sporty micro-influencer', nl: 'Sportieve micro-influencer', fr: 'Micro-influenceuse sportive' },
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
      en: 'Joos is a sporty, upbeat creator who loves training, going out for food and trying new things. She shares honestly what she thinks, from lunch spots and snacks to beauty, fashion and perfume. That is why her followers trust her tips.',
      nl: 'Joos is een sportieve, vrolijke creator die graag traint, uit eten gaat en nieuwe dingen uitprobeert. Ze deelt eerlijk wat ze ervan vindt, van lunchspots en snacks tot beauty, mode en parfum. Daarom vertrouwen haar volgers haar tips.',
      fr: 'Joos est une créatrice sportive et pétillante qui adore s&#39;entraîner, sortir manger et tester de nouvelles choses. Elle dit franchement ce qu&#39;elle pense, des adresses lunch aux snacks, en passant par la beauté, la mode et le parfum. C&#39;est pour ça que son audience fait confiance à ses conseils.'
    },
    gallery: ['/landing/joos/laugh.webp', '/landing/joos/selfie.webp', '/landing/joos/sport.webp'],
    tiktok: 'https://www.tiktok.com/@joosie.vdgrint'
  }
];
