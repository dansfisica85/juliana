/* Juliana Balbino — Painel Administrativo
 *
 * Funcionalidades:
 *   1) Login simples (apenas client-side, hash SHA-256 + sal estático armazenado em localStorage).
 *      ATENÇÃO: o site é estático (sem servidor), então este "login" é uma camada
 *      de conveniência que evita acesso casual. Não substitui autenticação real.
 *   2) Gerenciador de imagens: upload de fotos próprias (data URL) ou seleção
 *      a partir da busca Pexels para substituir cada slot do site.
 *   3) Curadoria da galeria Pexels (moda Milão, Paris, Nova York, jovens fashion etc.)
 *      A galeria fica salva em localStorage e é exibida na página de Moda.
 *   4) Visualização das inscrições do formulário (continua em form.js).
 */
(function () {
  // ---------- chaves ----------
  var PWHASH_KEY = 'jb_admin_pwhash';
  var SESSION_KEY = 'jb_admin_session';
  var IMAGES_KEY = 'jb_images';
  var GALLERY_KEY = 'jb_pexels_gallery';
  var PEXELS_KEY = 'jb_pexels_apikey';
  var SALT = 'juliana-balbino-comunicacao-imagem-2026';

  // Senha inicial padrão (substituída na primeira troca pela admin).
  var DEFAULT_PASSWORD = 'juliana2026';

  // ---------- catálogo de slots de imagem ----------
  // Cada slot corresponde a um elemento [data-img-key="..."] em alguma página.
  var SLOTS = [
    { key: 'home-hero', label: 'Início — Banner principal', page: 'index.html' },
    { key: 'home-post-moda', label: 'Início — Card "Moda"', page: 'index.html' },
    { key: 'home-post-bem', label: 'Início — Card "Bem-estar"', page: 'index.html' },
    { key: 'home-post-vida', label: 'Início — Card "Qualidade de Vida"', page: 'index.html' },

    { key: 'moda-hero', label: 'Moda — Banner', page: 'moda.html' },
    { key: 'moda-post-1', label: 'Moda — Card 1 (Outono 2026)', page: 'moda.html' },
    { key: 'moda-post-2', label: 'Moda — Card 2 (Cápsula)', page: 'moda.html' },
    { key: 'moda-post-3', label: 'Moda — Card 3 (Sustentável)', page: 'moda.html' },

    { key: 'bem-hero', label: 'Bem-estar — Banner', page: 'bem-estar.html' },
    { key: 'bem-post-1', label: 'Bem-estar — Card 1 (Meditação)', page: 'bem-estar.html' },
    { key: 'bem-post-2', label: 'Bem-estar — Card 2 (Respiração)', page: 'bem-estar.html' },
    { key: 'bem-post-3', label: 'Bem-estar — Card 3 (Yoga)', page: 'bem-estar.html' },

    { key: 'vida-hero', label: 'Qualidade de Vida — Banner', page: 'qualidade-vida.html' },
    { key: 'vida-post-1', label: 'Qualidade — Card 1 (Sono)', page: 'qualidade-vida.html' },
    { key: 'vida-post-2', label: 'Qualidade — Card 2 (Hidratação)', page: 'qualidade-vida.html' },
    { key: 'vida-post-3', label: 'Qualidade — Card 3 (Manhã)', page: 'qualidade-vida.html' }
  ];

  // ---------- presets de busca Pexels ----------
  var PEXELS_PRESETS = [
    { label: 'Moda Milão', query: 'milan fashion week street style' },
    { label: 'Moda Paris', query: 'paris fashion week elegant outfit' },
    { label: 'Moda Nova York', query: 'new york fashion street style' },
    { label: 'Jovens fashion', query: 'young adults fashionable outfit' },
    { label: 'Adultos elegantes', query: 'stylish adult portrait fashion' },
    { label: 'Lugares fashion', query: 'fashion city street architecture' },
    { label: 'Moda outono', query: 'autumn fashion warm tones' }
  ];

  // ---------- helpers de armazenamento ----------
  function getJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function setJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  function getImages() { return getJSON(IMAGES_KEY, {}); }
  function setImages(obj) { setJSON(IMAGES_KEY, obj); }
  function getGallery() { return getJSON(GALLERY_KEY, []); }
  function setGallery(arr) { setJSON(GALLERY_KEY, arr); }

  // ---------- hash SHA-256 ----------
  async function sha256(text) {
    var enc = new TextEncoder().encode(SALT + '|' + text);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function ensureDefaultPassword() {
    if (!localStorage.getItem(PWHASH_KEY)) {
      var h = await sha256(DEFAULT_PASSWORD);
      localStorage.setItem(PWHASH_KEY, h);
    }
  }

  function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === '1'; }
  function setLoggedIn(v) {
    if (v) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  }

  // ---------- escape ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- UI: login ----------
  function showLogin() {
    document.getElementById('login-section').style.display = '';
    document.getElementById('admin-section').style.display = 'none';
  }
  function showAdmin() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-section').style.display = '';
    renderImageSlots();
    renderGalleryCuration();
    var keyInput = document.getElementById('pexels-key');
    if (keyInput) keyInput.value = localStorage.getItem(PEXELS_KEY) || '';
  }

  async function handleLogin(e) {
    e.preventDefault();
    var pw = document.getElementById('login-password').value;
    var msg = document.getElementById('login-message');
    var hash = await sha256(pw);
    var stored = localStorage.getItem(PWHASH_KEY);
    if (hash === stored) {
      setLoggedIn(true);
      msg.className = 'admin-status';
      msg.textContent = '';
      showAdmin();
    } else {
      msg.className = 'admin-status error';
      msg.textContent = 'Senha incorreta. Tente novamente.';
    }
  }

  async function handleChangePassword() {
    var atual = prompt('Digite a senha atual:');
    if (atual == null) return;
    var hash = await sha256(atual);
    if (hash !== localStorage.getItem(PWHASH_KEY)) {
      alert('Senha atual incorreta.');
      return;
    }
    var nova = prompt('Nova senha (mínimo 6 caracteres):');
    if (!nova || nova.length < 6) { alert('Senha muito curta.'); return; }
    var conf = prompt('Confirme a nova senha:');
    if (nova !== conf) { alert('As senhas não conferem.'); return; }
    var nh = await sha256(nova);
    localStorage.setItem(PWHASH_KEY, nh);
    alert('Senha alterada com sucesso!');
  }

  function handleLogout() {
    setLoggedIn(false);
    showLogin();
  }

  // ---------- UI: image slots ----------
  function renderImageSlots() {
    var container = document.getElementById('image-slots');
    if (!container) return;
    var images = getImages();
    container.innerHTML = SLOTS.map(function (slot) {
      var current = images[slot.key];
      var preview = current
        ? '<div class="preview" style="background-image:url(' + JSON.stringify(current) + ');"></div>'
        : '<div class="preview"><span class="empty-label">Sem imagem</span></div>';
      return '<div class="image-slot" data-slot-key="' + esc(slot.key) + '">' +
        '<h4>' + esc(slot.label) + '</h4>' +
        '<span class="slot-key">' + esc(slot.key) + ' · ' + esc(slot.page) + '</span>' +
        preview +
        '<div class="actions">' +
          '<label>📁 Upload<input type="file" accept="image/*" hidden class="slot-file"></label>' +
          '<button type="button" class="slot-pexels">🔎 Pexels</button>' +
          '<button type="button" class="slot-clear danger">Remover</button>' +
        '</div>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.image-slot').forEach(function (el) {
      var key = el.getAttribute('data-slot-key');
      el.querySelector('.slot-file').addEventListener('change', function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Selecione uma imagem.'); return; }
        if (file.size > 4 * 1024 * 1024) {
          if (!confirm('Imagem maior que 4MB pode estourar o armazenamento do navegador. Continuar?')) return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var imgs = getImages();
          imgs[key] = reader.result;
          try { setImages(imgs); } catch (e) {
            alert('Falha ao salvar (armazenamento cheio?). Tente uma imagem menor.'); return;
          }
          renderImageSlots();
          flash('Imagem atualizada com sucesso!', 'success');
        };
        reader.readAsDataURL(file);
      });
      el.querySelector('.slot-pexels').addEventListener('click', function () {
        openPexelsPicker(key);
      });
      el.querySelector('.slot-clear').addEventListener('click', function () {
        if (!confirm('Remover a imagem deste slot? Voltará ao visual padrão.')) return;
        var imgs = getImages();
        delete imgs[key];
        setImages(imgs);
        renderImageSlots();
      });
    });
  }

  function flash(text, type) {
    var box = document.getElementById('admin-status');
    if (!box) return;
    box.className = 'admin-status ' + (type || 'info');
    box.textContent = text;
    setTimeout(function () { box.className = 'admin-status'; box.textContent = ''; }, 3500);
  }

  // ---------- Pexels API ----------
  function getPexelsKey() {
    return (document.getElementById('pexels-key') || {}).value
      || localStorage.getItem(PEXELS_KEY) || '';
  }

  async function searchPexels(query, perPage) {
    var key = getPexelsKey();
    if (!key) {
      throw new Error('Configure sua chave gratuita do Pexels primeiro (https://www.pexels.com/api/).');
    }
    localStorage.setItem(PEXELS_KEY, key);
    var url = 'https://api.pexels.com/v1/search?query=' +
      encodeURIComponent(query) + '&per_page=' + (perPage || 18) + '&orientation=portrait';
    var res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      var msg = 'Falha ao consultar Pexels (HTTP ' + res.status + ').';
      if (res.status === 401) msg += ' Verifique a chave de API.';
      throw new Error(msg);
    }
    var data = await res.json();
    return (data.photos || []).map(function (p) {
      return {
        id: p.id,
        thumb: p.src && (p.src.medium || p.src.small || p.src.tiny),
        src: p.src && (p.src.large || p.src.medium || p.src.original),
        large: p.src && (p.src.large2x || p.src.large || p.src.original),
        url: p.url,
        photographer: p.photographer,
        alt: p.alt || query
      };
    });
  }

  // ---------- Pexels picker (para um slot) ----------
  var pickerState = { slotKey: null, results: [] };

  function openPexelsPicker(slotKey) {
    pickerState.slotKey = slotKey;
    pickerState.results = [];
    var dialog = document.getElementById('pexels-picker');
    dialog.style.display = '';
    document.getElementById('pexels-picker-title').textContent =
      'Buscar foto no Pexels para: ' + (SLOTS.find(function (s) { return s.key === slotKey; }) || { label: slotKey }).label;
    document.getElementById('pexels-picker-results').innerHTML = '';
    document.getElementById('pexels-picker-query').value = '';
    document.getElementById('pexels-picker-query').focus();
  }

  function closePexelsPicker() {
    document.getElementById('pexels-picker').style.display = 'none';
    pickerState.slotKey = null;
  }

  async function runPexelsPickerSearch() {
    var q = document.getElementById('pexels-picker-query').value.trim();
    if (!q) return;
    var results = document.getElementById('pexels-picker-results');
    results.innerHTML = '<p style="color:var(--color-muted)">Buscando…</p>';
    try {
      var photos = await searchPexels(q, 18);
      pickerState.results = photos;
      if (!photos.length) { results.innerHTML = '<p>Nenhum resultado.</p>'; return; }
      results.innerHTML = photos.map(function (p, i) {
        return '<div class="pexels-result" data-i="' + i + '">' +
          '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) + '" loading="lazy">' +
          '<div class="credit">' + esc(p.photographer) + '</div>' +
          '</div>';
      }).join('');
      results.querySelectorAll('.pexels-result').forEach(function (el) {
        el.addEventListener('click', function () {
          var idx = parseInt(el.getAttribute('data-i'), 10);
          var photo = pickerState.results[idx];
          if (!photo || !pickerState.slotKey) return;
          var imgs = getImages();
          imgs[pickerState.slotKey] = photo.large || photo.src;
          setImages(imgs);
          closePexelsPicker();
          renderImageSlots();
          flash('Imagem do Pexels aplicada!', 'success');
        });
      });
    } catch (err) {
      results.innerHTML = '<p style="color:var(--color-error)">' + esc(err.message) + '</p>';
    }
  }

  // ---------- Curadoria da galeria pública ----------
  var galleryState = { results: [], selected: {} };

  function renderGalleryCuration() {
    var presetsBar = document.getElementById('gallery-presets');
    if (presetsBar) {
      presetsBar.innerHTML = PEXELS_PRESETS.map(function (p, i) {
        return '<button type="button" data-i="' + i + '">' + esc(p.label) + '</button>';
      }).join('');
      presetsBar.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-i'), 10);
          document.getElementById('gallery-query').value = PEXELS_PRESETS[idx].query;
          runGallerySearch();
        });
      });
    }
    renderGalleryCurrent();
  }

  function renderGalleryCurrent() {
    var box = document.getElementById('gallery-current');
    if (!box) return;
    var items = getGallery();
    if (!items.length) {
      box.innerHTML = '<p style="color:var(--color-muted)">A galeria pública está vazia.</p>';
      return;
    }
    box.innerHTML = '<p><strong>' + items.length + '</strong> foto(s) na galeria pública. ' +
      '<button type="button" id="gallery-clear" class="btn btn-outline" style="margin-left:0.5rem;">Esvaziar galeria</button></p>' +
      '<div class="pexels-results">' + items.map(function (it, i) {
        return '<div class="pexels-result" data-remove="' + i + '">' +
          '<img src="' + esc(it.thumb || it.src) + '" alt="' + esc(it.alt) + '">' +
          '<div class="credit">' + esc(it.photographer) + ' · clique p/ remover</div>' +
          '</div>';
      }).join('') + '</div>';
    box.querySelector('#gallery-clear').addEventListener('click', function () {
      if (confirm('Remover todas as fotos da galeria pública?')) {
        setGallery([]);
        renderGalleryCurrent();
      }
    });
    box.querySelectorAll('.pexels-result[data-remove]').forEach(function (el) {
      el.addEventListener('click', function () {
        var i = parseInt(el.getAttribute('data-remove'), 10);
        var arr = getGallery();
        arr.splice(i, 1);
        setGallery(arr);
        renderGalleryCurrent();
      });
    });
  }

  async function runGallerySearch() {
    var q = document.getElementById('gallery-query').value.trim();
    if (!q) return;
    var box = document.getElementById('gallery-results');
    box.innerHTML = '<p style="color:var(--color-muted)">Buscando…</p>';
    try {
      var photos = await searchPexels(q, 18);
      galleryState.results = photos;
      box.innerHTML = '<p style="color:var(--color-muted);font-size:0.9rem;">' +
          'Clique para selecionar/desmarcar. Depois clique em <em>Adicionar selecionadas</em>.</p>' +
        '<div class="pexels-results">' + photos.map(function (p, i) {
          return '<div class="pexels-result" data-i="' + i + '">' +
            '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) + '">' +
            '<div class="credit">' + esc(p.photographer) + '</div>' +
            '</div>';
        }).join('') + '</div>' +
        '<div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<button type="button" id="gallery-add" class="btn">Adicionar selecionadas à galeria</button>' +
        '</div>';
      galleryState.selected = {};
      box.querySelectorAll('.pexels-result').forEach(function (el) {
        el.addEventListener('click', function () {
          var i = parseInt(el.getAttribute('data-i'), 10);
          if (galleryState.selected[i]) {
            delete galleryState.selected[i];
            el.classList.remove('selected');
          } else {
            galleryState.selected[i] = true;
            el.classList.add('selected');
          }
        });
      });
      box.querySelector('#gallery-add').addEventListener('click', function () {
        var keys = Object.keys(galleryState.selected);
        if (!keys.length) { alert('Selecione pelo menos uma foto.'); return; }
        var current = getGallery();
        keys.forEach(function (k) {
          var p = galleryState.results[parseInt(k, 10)];
          if (p) current.push({
            src: p.large || p.src, thumb: p.thumb,
            url: p.url, photographer: p.photographer, alt: p.alt
          });
        });
        setGallery(current);
        flash('Adicionadas ' + keys.length + ' foto(s) à galeria pública.', 'success');
        renderGalleryCurrent();
      });
    } catch (err) {
      box.innerHTML = '<p style="color:var(--color-error)">' + esc(err.message) + '</p>';
    }
  }

  // ---------- Tabs ----------
  function setupTabs() {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');
        document.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.querySelectorAll('.admin-panel').forEach(function (p) {
          p.classList.toggle('active', p.id === 'panel-' + target);
        });
      });
    });
  }

  // ---------- bootstrap ----------
  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('login-section')) return; // não é a página admin
    await ensureDefaultPassword();

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-change-password').addEventListener('click', handleChangePassword);

    setupTabs();

    // Pexels picker controls
    document.getElementById('pexels-picker-search').addEventListener('click', runPexelsPickerSearch);
    document.getElementById('pexels-picker-query').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runPexelsPickerSearch(); }
    });
    document.getElementById('pexels-picker-close').addEventListener('click', closePexelsPicker);

    // Galeria pública
    var gs = document.getElementById('gallery-search');
    if (gs) gs.addEventListener('click', runGallerySearch);
    var gq = document.getElementById('gallery-query');
    if (gq) gq.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runGallerySearch(); }
    });

    // Salvar chave do Pexels manualmente
    document.getElementById('pexels-key-save').addEventListener('click', function () {
      var v = document.getElementById('pexels-key').value.trim();
      if (!v) { alert('Cole a sua chave do Pexels.'); return; }
      localStorage.setItem(PEXELS_KEY, v);
      flash('Chave do Pexels salva no navegador.', 'success');
    });

    if (isLoggedIn()) showAdmin();
    else showLogin();
  });
})();
