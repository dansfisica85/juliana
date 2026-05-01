/* Curadoria padrão de imagens Pexels — Juliana Balbino
 * Aplicada automaticamente em todas as páginas quando o admin ainda não
 * personalizou um slot ou esvaziou a galeria.
 *
 * Licença: Pexels License (gratuito p/ uso pessoal e comercial). Crédito
 * ao fotógrafo é exibido na galeria pública (.pexels-gallery).
 *
 * Cada item de galeria tem: id (Pexels), src (imagem), photographer e url.
 * Para os slots, basta uma URL otimizada do CDN images.pexels.com.
 */
(function () {
  function pUrl(id, w) {
    return 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id +
      '.jpeg?auto=compress&cs=tinysrgb&w=' + (w || 1200);
  }

  // ---- imagens padrão para os slots do site ----
  // Tema: outono, moda elegante, jovens e adultos fashion, lugares fashion.
  window.JB_DEFAULT_IMAGES = {
    // Início
    'home-hero':       pUrl(32777150, 1600), // Paris — duo elegante
    'home-post-moda':  pUrl(34636954, 1200), // Outono — Eiffel
    'home-post-bem':   pUrl(30133898, 1200), // Mulher em banco no outono
    'home-post-vida':  pUrl(11184117, 1200), // Estilosa em dia ensolarado

    // Moda
    'moda-hero':       pUrl(28751142, 1600), // Paris — cabelos rosa
    'moda-post-1':     pUrl(32012724, 1200), // Milão — vestido rosa
    'moda-post-2':     pUrl(34212256,  1200), // Cápsula — dupla urbana
    'moda-post-3':     pUrl(13221661, 1200), // Denim — sustentável

    // Bem-estar
    'bem-hero':        pUrl(35051589, 1600), // Mulher encostada em árvore
    'bem-post-1':      pUrl(9551347,  1200), // Jovem em verde — meditação
    'bem-post-2':      pUrl(30133898, 1200), // Outono relax
    'bem-post-3':      pUrl(6220702,  1200), // Grupo — comunidade

    // Qualidade de Vida
    'vida-hero':       pUrl(31836988, 1600), // NY — primavera
    'vida-post-1':     pUrl(12551614, 1200), // NY — vista de cima
    'vida-post-2':     pUrl(30664982, 1200), // NY — caminhada de inverno
    'vida-post-3':     pUrl(34636953, 1200)  // Paris — escadas
  };

  // ---- galeria pública padrão (Moda — Milão, Paris, Nova York) ----
  window.JB_DEFAULT_GALLERY = [
    // Milão
    { id: 32012721, src: pUrl(32012721, 1200), thumb: pUrl(32012721, 600),
      url: 'https://www.pexels.com/photo/elegant-woman-walking-in-front-of-milan-cathedral-32012721/',
      photographer: 'Mihaela Claudia Puscas', alt: 'Elegante caminhando à frente do Duomo de Milão' },
    { id: 32676666, src: pUrl(32676666, 1200), thumb: pUrl(32676666, 600),
      url: 'https://www.pexels.com/photo/stylish-woman-in-galleria-vittorio-emanuele-ii-32676666/',
      photographer: 'Mihaela Claudia Puscas', alt: 'Mulher fashion na Galleria Vittorio Emanuele II' },
    { id: 32012735, src: pUrl(32012735, 1200), thumb: pUrl(32012735, 600),
      url: 'https://www.pexels.com/photo/stylish-woman-wearing-winter-fashion-in-milan-32012735/',
      photographer: 'Mihaela Claudia Puscas', alt: 'Look de inverno em Milão' },
    { id: 32408157, src: pUrl(32408157, 1200), thumb: pUrl(32408157, 600),
      url: 'https://www.pexels.com/photo/elegant-young-woman-posing-in-milan-32408157/',
      photographer: 'Mihaela Claudia Puscas', alt: 'Jovem elegante posando em Milão' },
    { id: 33374427, src: pUrl(33374427, 1200), thumb: pUrl(33374427, 600),
      url: 'https://www.pexels.com/photo/stylish-woman-on-red-scooter-in-milan-street-33374427/',
      photographer: 'Sebastian Dziomba', alt: 'Estilosa de scooter em rua de Milão' },

    // Paris
    { id: 32251871, src: pUrl(32251871, 1200), thumb: pUrl(32251871, 600),
      url: 'https://www.pexels.com/photo/chic-fashion-scene-on-parisian-street-32251871/',
      photographer: 'Pedro Paixao', alt: 'Cena fashion em rua parisiense' },
    { id: 32777150, src: pUrl(32777150, 1200), thumb: pUrl(32777150, 600),
      url: 'https://www.pexels.com/photo/elegant-street-fashion-in-paris-pink-attire-32777150/',
      photographer: 'KabVisuals', alt: 'Dupla rosa na Paris Fashion Week' },
    { id: 30892614, src: pUrl(30892614, 1200), thumb: pUrl(30892614, 600),
      url: 'https://www.pexels.com/photo/elegant-woman-posing-in-paris-with-eiffel-tower-30892614/',
      photographer: 'Rachel Brooks', alt: 'Mulher elegante e a Torre Eiffel' },
    { id: 34636954, src: pUrl(34636954, 1200), thumb: pUrl(34636954, 600),
      url: 'https://www.pexels.com/photo/chic-autumn-fashion-with-eiffel-tower-backdrop-34636954/',
      photographer: 'Rachel Brooks', alt: 'Look de outono em frente à Torre Eiffel' },
    { id: 30341569, src: pUrl(30341569, 1200), thumb: pUrl(30341569, 600),
      url: 'https://www.pexels.com/photo/fashionable-woman-at-louvre-pyramid-in-paris-30341569/',
      photographer: 'Julia Maks', alt: 'Vestido poá na Pirâmide do Louvre' },

    // Nova York
    { id: 28516392, src: pUrl(28516392, 1200), thumb: pUrl(28516392, 600),
      url: 'https://www.pexels.com/photo/woman-using-smartphone-walking-in-new-york-city-28516392/',
      photographer: 'FollowingNYC', alt: 'Estilosa caminhando em Nova York' },
    { id: 29408373, src: pUrl(29408373, 1200), thumb: pUrl(29408373, 600),
      url: 'https://www.pexels.com/photo/stylish-woman-in-trendy-black-outfit-on-new-york-street-29408373/',
      photographer: 'FollowingNYC', alt: 'Look preto em rua de Nova York' },
    { id: 13640062, src: pUrl(13640062, 1200), thumb: pUrl(13640062, 600),
      url: 'https://www.pexels.com/photo/woman-in-glamour-outfit-on-city-street-13640062/',
      photographer: 'FollowingNYC', alt: 'Modelo loira em look vibrante (NYC)' },
    { id: 31836988, src: pUrl(31836988, 1200), thumb: pUrl(31836988, 600),
      url: 'https://www.pexels.com/photo/stylish-spring-portrait-in-new-york-city-street-31836988/',
      photographer: 'Rachel Brooks', alt: 'Retrato de primavera em Nova York' },
    { id: 19494946, src: pUrl(19494946, 1200), thumb: pUrl(19494946, 600),
      url: 'https://www.pexels.com/photo/trio-19494946/',
      photographer: 'FollowingNYC', alt: 'Trio fashion em Nova York' },

    // Jovens / adultos fashion
    { id: 30304820, src: pUrl(30304820, 1200), thumb: pUrl(30304820, 600),
      url: 'https://www.pexels.com/photo/trendy-fashion-influencers-in-stylish-urban-setting-30304820/',
      photographer: 'Musa Yilmaz', alt: 'Jovens fashion em ambiente urbano' },
    { id: 29871347, src: pUrl(29871347, 1200), thumb: pUrl(29871347, 600),
      url: 'https://www.pexels.com/photo/fashionable-young-couple-posing-outdoors-29871347/',
      photographer: 'Daniwura TCI', alt: 'Casal jovem fashion ao ar livre' },
    { id: 18460329, src: pUrl(18460329, 1200), thumb: pUrl(18460329, 600),
      url: 'https://www.pexels.com/photo/young-brunette-in-pink-jacket-18460329/',
      photographer: 'OSS Leos', alt: 'Jovem morena de jaqueta rosa' }
  ];
})();
