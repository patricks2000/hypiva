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
    likes: '700K+', // total likes on the platform, shown next to the followers
    tagline: { en: 'Always with a <span class="hl">smile.</span>', nl: 'Altijd met een <span class="hl">lach.</span>', fr: 'Toujours avec le <span class="hl">sourire.</span>' },
    platform: 'TikTok',
    services: ['influencer', 'ugc'], // 'influencer' = shown on /influencers, 'ugc' = shown on the UGC page
    language: { en: 'Dutch', nl: 'Nederlands', fr: 'Néerlandais' },
    region: { en: 'Central Netherlands', nl: 'Midden-Nederland', fr: 'Centre des Pays-Bas' },
    tags: [
      { en: 'Food & restaurants', nl: 'Eten & restaurants', fr: 'Cuisine & restaurants' },
      { en: 'Beauty', nl: 'Beauty', fr: 'Beauté' },
      { en: 'Fashion & jewellery', nl: 'Mode & sieraden', fr: 'Mode & bijoux' },
      { en: 'Perfume', nl: 'Parfum', fr: 'Parfum' },
      { en: 'Sport', nl: 'Sport', fr: 'Sport' }
    ],
    about: {
      en: 'Joos is an upbeat creator who makes videos about the things she enjoys herself: going out for food and discovering lunch spots, snacks, beauty and skincare, fashion and jewellery, perfume and sport.',
      nl: 'Joos is een vrolijke creator die video&#39;s maakt over de dingen die ze zelf leuk vindt: uit eten gaan en lunchspots ontdekken, snacks, beauty en skincare, mode en sieraden, parfum en sport.',
      fr: 'Joos est une créatrice pétillante qui fait des vidéos sur ce qu&#39;elle aime : sortir manger et découvrir des adresses lunch, les snacks, la beauté et les soins, la mode et les bijoux, le parfum et le sport.'
    },
    gallery: ['/landing/joos/laugh.webp', '/landing/joos/selfie.webp', '/landing/joos/sport.webp'],
    email: 'joos@hypiva.com', // alias of patrick@hypiva.com, lands under the Gmail label 'Joos'
    tiktok: 'https://www.tiktok.com/@joosie.vdgrint'
  },
  {
    slug: 'valerie',
    name: 'Valerie',
    photo: '/landing/valerie/dinner.webp',
    photoPos: '50% 30%',
    share: '/landing/valerie/share.jpg',
    followers: '12k+',
    likes: '298K+',
    tagline: { en: 'An eye for <span class="hl">style.</span>', nl: 'Oog voor <span class="hl">stijl.</span>', fr: 'L&#39;œil pour le <span class="hl">style.</span>' },
    platform: 'TikTok',
    services: ['influencer', 'ugc'],
    language: { en: 'Dutch', nl: 'Nederlands', fr: 'Néerlandais' },
    region: { en: 'East Netherlands', nl: 'Oost-Nederland', fr: 'Est des Pays-Bas' },
    tags: [
      { en: 'Fashion & styling', nl: 'Mode & styling', fr: 'Mode & stylisme' },
      { en: 'Beauty', nl: 'Beauty', fr: 'Beauté' },
      { en: 'Sport', nl: 'Sport', fr: 'Sport' },
      { en: 'Food & restaurants', nl: 'Eten & restaurants', fr: 'Cuisine & restaurants' }
    ],
    about: {
      en: 'Valerie is creative and has an eye for detail. She loves styling and fashion (which she also studies), beauty, sport and discovering new places to eat. Spontaneous and always up for a fun new collaboration.',
      nl: 'Valerie is creatief en heeft oog voor detail. Ze houdt van styling en mode (daar studeert ze ook in), beauty, sporten en nieuwe eettentjes ontdekken. Spontaan en altijd in voor een leuke nieuwe samenwerking.',
      fr: 'Valerie est créative et a l&#39;œil pour le détail. Elle aime le stylisme et la mode (qu&#39;elle étudie aussi), la beauté, le sport et découvrir de nouvelles adresses. Spontanée et toujours partante pour une nouvelle collaboration.'
    },
    gallery: ['/landing/valerie/autumn.webp', '/landing/valerie/menu.webp', '/landing/valerie/mirror.webp'],
    email: 'valerie@hypiva.com', // alias of patrick@hypiva.com (create it in Google Workspace)
    tiktok: 'https://www.tiktok.com/@valsmidttt'
  }
];
