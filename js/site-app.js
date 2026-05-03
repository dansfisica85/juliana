/* eslint-disable no-var */
/**
 * Juliana Balbino — site-app.js
 *
 * Responsável por todo o comportamento dinâmico das páginas públicas:
 *  - Pinta a paleta de outono e mantém o ano atualizado.
 *  - Aplica imagens/vídeos personalizados (slots do admin) em [data-img-key]
 *    ou [data-video-key]; cai na pasta fotos/ quando ainda
 *    não foram definidos.
 *  - Distribui automaticamente as fotos/vídeos da pasta fotos/
 *    pelo site, com destaque para roupas escuras e vídeos como background
 *    silencioso em loop.
 *  - Renderiza a galeria pública (curadoria das fotos da Juliana) em .looks-gallery.
 *  - Mostra um botão admin discreto no canto superior direito que abre o
 *    modal de login e leva ao painel após autenticação.
 */
(function () {
  'use strict';

  var API = '/api';

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fetchJson(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    opts.headers = Object.assign(
      { 'Accept': 'application/json' },
      opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      opts.headers || {}
    );
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error(data && data.error ? data.error : ('http_' + r.status));
          err.status = r.status; err.data = data; throw err;
        }
        return data;
      });
    });
  }

  // -------------------------------------------------------------------------
  // Slots / galeria / mídia local
  // -------------------------------------------------------------------------
  var state = {
    slots: {},                  // { key: {kind, src, caption, featured} }
    gallery: [],                // [{src, thumb, url, photographer, alt}]
    localMedia: { images: [], videos: [], featured: [], all: [] },
    me: null,                   // {username} se logado
    texts: {},                  // { key: 'string' } textos editáveis
  };

  function loadAll() {
    return Promise.all([
      fetchJson(API + '/content/slots').catch(function () { return { slots: {} }; }),
      fetchJson(API + '/content/gallery').catch(function () { return { items: [] }; }),
      // Preferimos o manifest estático (servido pelo CDN do Vercel) — é mais
      // rápido e funciona mesmo quando a Function não consegue ler o disco.
      fetch('/fotos/manifest.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (manifest) {
          if (manifest && manifest.files) return { files: manifest.files };
          return fetchJson(API + '/local-media').catch(function () { return { files: [] }; });
        }),
      fetchJson(API + '/auth/me').catch(function () { return null; }),
      fetchJson(API + '/content/texts').catch(function () { return { texts: {} }; }),
    ]).then(function (r) {
      state.slots = (r[0] && r[0].slots) || {};
      state.gallery = ((r[1] && r[1].items) || []).map(function (it) {
        return {
          src: it.src,
          thumb: it.thumb || it.src,
          url: it.page_url || it.url || '',
          caption: it.photographer || it.alt || '',
          alt: it.alt || 'Foto da Juliana',
        };
      });
      var files = (r[2] && r[2].files) || [];
      state.localMedia = {
        all: files,
        images: files.filter(function (f) { return f.kind === 'image'; }),
        videos: files.filter(function (f) { return f.kind === 'video'; }),
        featured: files.filter(function (f) { return f.kind === 'image' && f.featured; }),
      };
      state.me = r[3] && r[3].user ? r[3].user : null;
      state.texts = (r[4] && r[4].texts) || {};
    });
  }

  // ----- Categorias --------------------------------------------------------
  // Cada slot do site tem prefixo: moda-*, bem-*, vida-*, home-post-moda etc.
  // Mapeamos para a categoria devolvida pela API (`moda` | `bem-estar` | `vida`).
  function categoryForKey(key) {
    if (!key) return null;
    if (/^moda(-|$)/.test(key) || /post-moda$/.test(key)) return 'moda';
    if (/^bem(-|$)/.test(key) || /post-bem$/.test(key)) return 'bem-estar';
    if (/^vida(-|$)/.test(key) || /post-vida$/.test(key)) return 'vida';
    return null;
  }
  function imagesForCategory(cat) {
    if (!cat) return state.localMedia.images;
    var pool = state.localMedia.images.filter(function (f) { return f.category === cat; });
    return pool.length ? pool : state.localMedia.images;
  }
  function featuredForCategory(cat) {
    if (!cat) return state.localMedia.featured;
    var pool = state.localMedia.featured.filter(function (f) { return f.category === cat; });
    return pool.length ? pool : state.localMedia.featured;
  }

  // Distribuição determinística (mesma key sempre cai no mesmo arquivo).
  function pickStable(arr, key) {
    if (!arr || !arr.length) return null;
    var h = 0;
    for (var i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    return arr[Math.abs(h) % arr.length];
  }

  function defaultFor(key) {
    var cat = categoryForKey(key);
    var feat = featuredForCategory(cat);
    var pool = feat.length ? feat : imagesForCategory(cat);
    var pick = pickStable(pool, key);
    return pick ? pick.url : null;
  }

  function defaultVideoFor(key) {
    var pick = pickStable(state.localMedia.videos, 'vid:' + key);
    return pick ? pick.url : null;
  }

  // -------------------------------------------------------------------------
  // Aplicação nos elementos
  // -------------------------------------------------------------------------
  function applyImageSlot(el) {
    var key = el.getAttribute('data-img-key');
    var slot = state.slots[key];
    var src = slot && slot.src ? slot.src : defaultFor(key);
    if (!src) return;

    if (slot && slot.kind === 'video') {
      attachVideoBackground(el, src);
      return;
    }
    if (el.tagName === 'IMG') {
      el.src = src;
    } else {
      el.style.backgroundImage = 'url("' + String(src).replace(/"/g, '\\"') + '")';
      el.classList.add('has-image');
    }
    if (slot && slot.featured) el.classList.add('is-featured-dark');
  }

  function applyVideoSlot(el) {
    var key = el.getAttribute('data-video-key');
    var slot = state.slots[key];
    var src = slot && slot.kind === 'video' && slot.src
      ? slot.src
      : defaultVideoFor(key);
    if (!src) {
      // sem vídeo disponível — usa imagem como fallback
      var img = (slot && slot.kind === 'image' && slot.src) || defaultFor(key);
      if (img) {
        el.style.backgroundImage = 'url("' + String(img).replace(/"/g, '\\"') + '")';
        el.classList.add('has-image');
      }
      return;
    }
    attachVideoBackground(el, src);
  }

  function attachVideoBackground(el, src) {
    if (el.querySelector(':scope > video.jb-bg-video')) return; // idempotente
    var v = document.createElement('video');
    v.className = 'jb-bg-video';
    v.src = src;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    el.classList.add('has-bg-video');
    el.insertBefore(v, el.firstChild);
    // Algumas vezes o autoplay é bloqueado até o usuário interagir:
    var tryPlay = function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    tryPlay();
    document.addEventListener('click', tryPlay, { once: true, passive: true });
  }

  function applyAll() {
    applyTexts();
    $$('[data-img-key]').forEach(applyImageSlot);
    $$('[data-video-key]').forEach(applyVideoSlot);
    distributeExtras();
    renderHighlights();
    renderGallery();
  }

  // ----- Textos editáveis pelo admin --------------------------------------
  function applyTexts() {
    if (!state.texts) return;
    $$('[data-text-key]').forEach(function (el) {
      var key = el.getAttribute('data-text-key');
      var val = state.texts[key];
      if (val == null || val === '') return;
      // Se o elemento tem data-text-html="1", interpreta como HTML simples
      if (el.getAttribute('data-text-html') === '1') {
        el.innerHTML = String(val);
      } else {
        el.textContent = String(val);
      }
    });
  }

  // ----- Destaques editáveis: foto + frase motivacional -------------------
  // Procura blocos [data-jb-highlights="<categoria>"] e renderiza as fotos
  // e frases definidas pelo admin em slots `hl-<categoria>-1..3` (foto)
  // e textos `hl-<categoria>-1-text..3-text`.
  function renderHighlights() {
    $$('[data-jb-highlights]').forEach(function (host) {
      var cat = host.getAttribute('data-jb-highlights') || pageCategory() || 'moda';
      var fallbackPool = featuredForCategory(cat);
      if (!fallbackPool.length) fallbackPool = imagesForCategory(cat);
      var html = '';
      for (var i = 1; i <= 3; i++) {
        var imgKey = 'hl-' + cat + '-' + i;
        var txtKey = 'hl-' + cat + '-' + i + '-text';
        var slot = state.slots[imgKey];
        var src = slot && slot.src
          ? slot.src
          : (fallbackPool[(i - 1) % fallbackPool.length] && fallbackPool[(i - 1) % fallbackPool.length].url);
        if (!src) continue;
        var text = (state.texts && state.texts[txtKey]) || defaultMotivation(cat, i);
        var even = i % 2 === 0;
        html += '<article class="highlight-row' + (even ? ' reverse' : '') + '">' +
          '<figure class="highlight-photo"><img src="' + escapeAttr(src) + '" alt="" loading="lazy"></figure>' +
          '<div class="highlight-text"><blockquote>' + escapeAttr(text) + '</blockquote></div>' +
        '</article>';
      }
      host.innerHTML = html;
    });
  }

  function defaultMotivation(cat, i) {
    var bank = {
      'moda': [
        'Vista o que te faz bem — o estilo nasce da autenticidade.',
        'A moda passa, o estilo permanece. Escolha o que combina com você.',
        'Cada look é um lembrete: você merece se sentir linda todo dia.',
      ],
      'bem-estar': [
        'Cuidar de si é o gesto mais bonito que existe.',
        'Respira fundo: hoje é um bom dia para começar de novo.',
        'A paz começa em pequenos rituais diários.',
      ],
      'vida': [
        'Pequenos hábitos transformam grandes vidas.',
        'Durma, hidrate, mova-se — seu corpo agradece em silêncio.',
        'Viva com propósito; o resto se ajeita.',
      ],
    };
    var arr = bank[cat] || bank.moda;
    return arr[(i - 1) % arr.length];
  }

  // Distribui automaticamente uma faixa de destaques quando há um container
  // com [data-jb-featured] na página. Aceita opcionalmente data-jb-category
  // para limitar a uma categoria específica.
  function distributeExtras() {
    var host = $('[data-jb-featured]');
    if (!host) return;
    var cat = host.getAttribute('data-jb-category') || pageCategory();
    var featured = featuredForCategory(cat);
    if (!featured.length) {
      featured = imagesForCategory(cat).slice(0, 8);
    }
    if (!featured.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = featured.slice(0, 8).map(function (m) {
      return '<figure class="featured-card">' +
        '<img src="' + escapeAttr(m.url) + '" alt="' + escapeAttr(m.name) + '" loading="lazy">' +
        '</figure>';
    }).join('');
  }

  // Deduz a categoria da página atual a partir do nome do arquivo.
  function pageCategory() {
    var path = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (path.indexOf('moda') === 0) return 'moda';
    if (path.indexOf('bem-estar') === 0) return 'bem-estar';
    if (path.indexOf('qualidade-vida') === 0) return 'vida';
    return null;
  }

  function renderGallery() {
    var container = $('.looks-gallery') || $('.pexels-gallery');
    if (!container) return;
    var items = state.gallery;
    if (!items.length) {
      // Fallback: monta uma galeria com as fotos locais da categoria atual.
      var cat = pageCategory();
      var pool = imagesForCategory(cat);
      if (!pool.length) {
        container.innerHTML = '<p class="gallery-empty">A galeria ainda não foi configurada. Adicione fotos no painel administrativo.</p>';
        return;
      }
      items = pool.slice(0, 24).map(function (m) {
        return { src: m.url, thumb: m.url, alt: m.name, caption: '' };
      });
    }
    container.innerHTML = '<div class="gallery-grid">' + items.map(function (it) {
      var fig = '<figure class="gallery-item">' +
        '<img src="' + escapeAttr(it.thumb || it.src) + '" alt="' + escapeAttr(it.alt) + '" loading="lazy">';
      if (it.caption) fig += '<figcaption class="gallery-caption">' + escapeAttr(it.caption) + '</figcaption>';
      return fig + '</figure>';
    }).join('') + '</div>';
  }

  // -------------------------------------------------------------------------
  // Botão admin discreto + modal de login
  // -------------------------------------------------------------------------
  function ensureAdminButton() {
    if (document.getElementById('jb-admin-fab')) return;
    if (document.body.classList.contains('admin-page')) return; // já está no admin
    var btn = document.createElement('button');
    btn.id = 'jb-admin-fab';
    btn.type = 'button';
    btn.title = 'Acesso administrativo';
    btn.setAttribute('aria-label', 'Acesso administrativo');
    btn.innerHTML = '<span aria-hidden="true">◆</span>';
    btn.addEventListener('click', function () {
      if (state.me) {
        window.location.href = 'admin.html';
      } else {
        openLoginModal();
      }
    });
    document.body.appendChild(btn);
  }

  function openLoginModal() {
    var existing = document.getElementById('jb-login-modal');
    if (existing) { existing.classList.add('open'); return; }
    var wrap = document.createElement('div');
    wrap.id = 'jb-login-modal';
    wrap.className = 'jb-modal open';
    wrap.innerHTML =
      '<div class="jb-modal-backdrop" data-close="1"></div>' +
      '<div class="jb-modal-card" role="dialog" aria-modal="true" aria-labelledby="jb-login-title">' +
        '<button type="button" class="jb-modal-close" data-close="1" aria-label="Fechar">×</button>' +
        '<h2 id="jb-login-title">Acesso administrativo</h2>' +
        '<p class="jb-modal-hint">Apenas o proprietário do site precisa entrar aqui.</p>' +
        '<form id="jb-login-form" autocomplete="off">' +
          '<label>Login<input type="text" name="username" autocomplete="username" required></label>' +
          '<label>Senha<input type="password" name="password" autocomplete="current-password" required></label>' +
          '<div class="jb-modal-msg" role="alert"></div>' +
          '<button type="submit" class="btn">Entrar</button>' +
        '</form>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.close) wrap.classList.remove('open');
    });
    $('#jb-login-form', wrap).addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget;
      var msg = $('.jb-modal-msg', wrap);
      msg.textContent = '';
      msg.className = 'jb-modal-msg';
      fetchJson(API + '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: f.username.value.trim(), password: f.password.value }),
      }).then(function (r) {
        state.me = r.user;
        window.location.href = 'admin.html';
      }).catch(function (err) {
        msg.className = 'jb-modal-msg error';
        msg.textContent = err && err.status === 401
          ? 'Login ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente.';
      });
    });
  }

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    // ano no rodapé
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
    // link ativo
    var path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    $$('.nav-links a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
      if (href === path) link.classList.add('active');
    });

    loadAll().then(function () {
      applyAll();
      ensureAdminButton();
    }).catch(function () {
      ensureAdminButton();
    });
  });

  // expõe util para outros scripts (admin.js)
  window.JB = {
    api: API,
    fetchJson: fetchJson,
    reload: loadAll,
    apply: applyAll,
  };
})();
