/* eslint-disable no-var */
/**
 * Painel administrativo — Juliana Balbino
 *  Requer estar logado (ver botão flutuante em site-app.js).
 *  Conversa com /api/* via fetchJson (cookies HttpOnly).
 */
(function () {
  'use strict';
  var API = '/api';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
  }
  function fetchJson(url, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    }
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var e = new Error(data && data.error ? data.error : ('http_' + r.status));
          e.status = r.status; e.data = data; throw e;
        }
        return data;
      });
    });
  }
  function setStatus(text, type) {
    var el = $('#admin-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'admin-status' + (type ? ' ' + type : '');
    if (text) setTimeout(function () { if (el.textContent === text) { el.textContent = ''; el.className = 'admin-status'; } }, 4000);
  }

  // -------------------------------------------------------------------------
  // Catálogo dos slots editáveis (chave => rótulo amigável)
  // -------------------------------------------------------------------------
  var SLOT_CATALOG = [
    { group: 'Início', items: [
      { key: 'home-hero',      label: 'Hero principal' },
      { key: 'home-post-moda', label: 'Card — Moda' },
      { key: 'home-post-bem',  label: 'Card — Bem-estar' },
      { key: 'home-post-vida', label: 'Card — Qualidade de Vida' },
    ]},
    { group: 'Moda', items: [
      { key: 'moda-hero',   label: 'Hero da página Moda' },
      { key: 'moda-post-1', label: 'Card 1' },
      { key: 'moda-post-2', label: 'Card 2' },
      { key: 'moda-post-3', label: 'Card 3' },
      { key: 'hl-moda-1',   label: 'Destaque 1 (foto)' },
      { key: 'hl-moda-2',   label: 'Destaque 2 (foto)' },
      { key: 'hl-moda-3',   label: 'Destaque 3 (foto)' },
    ]},
    { group: 'Bem-estar', items: [
      { key: 'bem-hero',   label: 'Hero da página Bem-estar' },
      { key: 'bem-post-1', label: 'Card 1' },
      { key: 'bem-post-2', label: 'Card 2' },
      { key: 'bem-post-3', label: 'Card 3' },
      { key: 'hl-bem-estar-1', label: 'Destaque 1 (foto)' },
      { key: 'hl-bem-estar-2', label: 'Destaque 2 (foto)' },
      { key: 'hl-bem-estar-3', label: 'Destaque 3 (foto)' },
    ]},
    { group: 'Qualidade de Vida', items: [
      { key: 'vida-hero',   label: 'Hero da página Qualidade de Vida' },
      { key: 'vida-post-1', label: 'Card 1' },
      { key: 'vida-post-2', label: 'Card 2' },
      { key: 'vida-post-3', label: 'Card 3' },
      { key: 'hl-vida-1',   label: 'Destaque 1 (foto)' },
      { key: 'hl-vida-2',   label: 'Destaque 2 (foto)' },
      { key: 'hl-vida-3',   label: 'Destaque 3 (foto)' },
    ]},
  ];

  // Catálogo de TEXTOS editáveis pelo admin
  var TEXT_CATALOG = [
    { group: 'Início', items: [
      { key: 'home-hero-title',   label: 'Hero — título', rows: 1 },
      { key: 'home-hero-tagline', label: 'Hero — descrição', rows: 3 },
    ]},
    { group: 'Moda', items: [
      { key: 'moda-hero-title',   label: 'Hero — título', rows: 1 },
      { key: 'moda-hero-tagline', label: 'Hero — descrição', rows: 3 },
      { key: 'hl-moda-1-text',    label: 'Destaque 1 — frase motivacional', rows: 2 },
      { key: 'hl-moda-2-text',    label: 'Destaque 2 — frase motivacional', rows: 2 },
      { key: 'hl-moda-3-text',    label: 'Destaque 3 — frase motivacional', rows: 2 },
    ]},
    { group: 'Bem-estar', items: [
      { key: 'bem-hero-title',         label: 'Hero — título', rows: 1 },
      { key: 'bem-hero-tagline',       label: 'Hero — descrição', rows: 3 },
      { key: 'hl-bem-estar-1-text',    label: 'Destaque 1 — frase motivacional', rows: 2 },
      { key: 'hl-bem-estar-2-text',    label: 'Destaque 2 — frase motivacional', rows: 2 },
      { key: 'hl-bem-estar-3-text',    label: 'Destaque 3 — frase motivacional', rows: 2 },
    ]},
    { group: 'Qualidade de Vida', items: [
      { key: 'vida-hero-title',   label: 'Hero — título', rows: 1 },
      { key: 'vida-hero-tagline', label: 'Hero — descrição', rows: 3 },
      { key: 'hl-vida-1-text',    label: 'Destaque 1 — frase motivacional', rows: 2 },
      { key: 'hl-vida-2-text',    label: 'Destaque 2 — frase motivacional', rows: 2 },
      { key: 'hl-vida-3-text',    label: 'Destaque 3 — frase motivacional', rows: 2 },
    ]},
  ];

  // -------------------------------------------------------------------------
  // Estado
  // -------------------------------------------------------------------------
  var st = {
    me: null,
    slots: {},
    uploads: [],
    localMedia: [],
    texts: {},
  };

  // -------------------------------------------------------------------------
  // Login & sessão
  // -------------------------------------------------------------------------
  function showLogin() {
    $('#login-section').style.display = '';
    $('#admin-section').style.display = 'none';
  }
  function showAdmin() {
    $('#login-section').style.display = 'none';
    $('#admin-section').style.display = '';
    var who = $('#admin-username'); if (who && st.me) who.textContent = st.me.username;
    var pu = $('#profile-username'); if (pu && st.me) pu.value = st.me.username;
  }

  function bindLogin() {
    var f = $('#login-form');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = $('#login-message');
      msg.textContent = ''; msg.className = 'admin-status';
      fetchJson(API + '/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: f.querySelector('[name=username]').value.trim(),
          password: f.querySelector('[name=password]').value,
        }),
      }).then(function (r) {
        st.me = r.user;
        showAdmin();
        loadAll();
      }).catch(function (err) {
        msg.className = 'admin-status error';
        msg.textContent = err.status === 401 ? 'Login ou senha incorretos.' : 'Falha ao entrar.';
      });
    });
  }

  function bindLogout() {
    $('#btn-logout').addEventListener('click', function () {
      fetchJson(API + '/auth/logout', { method: 'POST' }).finally(function () {
        st.me = null;
        showLogin();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------------
  function bindTabs() {
    $$('.admin-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.admin-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var tab = b.getAttribute('data-tab');
        $$('.admin-panel').forEach(function (p) { p.classList.remove('active'); });
        var target = $('#panel-' + tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------
  function bindProfile() {
    $('#profile-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.currentTarget;
      fetchJson(API + '/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          newUsername: f.newUsername.value.trim(),
          currentPassword: f.currentPassword.value,
          newPassword: f.newPassword.value || undefined,
        }),
      }).then(function (r) {
        st.me = r.user;
        $('#admin-username').textContent = r.user.username;
        f.currentPassword.value = ''; f.newPassword.value = '';
        setStatus('Perfil atualizado com sucesso.', 'success');
      }).catch(function (err) {
        var map = {
          invalid_current_password: 'Senha atual incorreta.',
          weak_password: 'Senha nova precisa ter pelo menos 8 caracteres.',
          invalid_username: 'Login deve ter 3-40 caracteres (letras, números, . _ -).',
        };
        setStatus(map[err.message] || 'Não foi possível salvar o perfil.', 'error');
      });
    });
  }

  // -------------------------------------------------------------------------
  // Carregamento principal
  // -------------------------------------------------------------------------
  function loadAll() {
    return Promise.all([
      fetchJson(API + '/content/slots'),
      fetchJson(API + '/uploads'),
      fetchJson(API + '/local-media'),
      fetchJson(API + '/content/texts').catch(function () { return { texts: {} }; }),
    ]).then(function (r) {
      st.slots = r[0].slots || {};
      st.uploads = r[1].files || [];
      st.localMedia = r[2].files || [];
      st.texts = r[3].texts || {};
      renderSlots();
      renderLibrary();
      renderTexts();
    }).catch(function () { setStatus('Falha ao carregar dados.', 'error'); });
  }

  // -------------------------------------------------------------------------
  // Textos editáveis
  // -------------------------------------------------------------------------
  function renderTexts() {
    var host = $('#text-slots');
    if (!host) return;
    host.innerHTML = TEXT_CATALOG.map(function (g) {
      return '<div class="slot-group"><h3>' + esc(g.group) + '</h3>' +
        '<div class="text-grid">' + g.items.map(function (it) {
          var v = st.texts[it.key] != null ? st.texts[it.key] : '';
          var rows = it.rows || 2;
          var input = rows > 1
            ? '<textarea data-text-key="' + esc(it.key) + '" rows="' + rows + '">' + esc(v) + '</textarea>'
            : '<input type="text" data-text-key="' + esc(it.key) + '" value="' + esc(v) + '">';
          return '<label class="text-field"><span><strong>' + esc(it.label) + '</strong>' +
            '<small>' + esc(it.key) + '</small></span>' + input + '</label>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function bindTexts() {
    var save = $('#texts-save');
    if (!save) return;
    save.addEventListener('click', function () {
      var fields = $$('#text-slots [data-text-key]');
      var payload = {};
      fields.forEach(function (f) {
        payload[f.getAttribute('data-text-key')] = f.value || '';
      });
      fetchJson(API + '/content/texts', {
        method: 'PUT', body: JSON.stringify({ texts: payload }),
      }).then(function (r) {
        st.texts = Object.assign({}, st.texts, payload);
        setStatus('Textos salvos (' + r.count + ').', 'success');
      }).catch(function () { setStatus('Falha ao salvar textos.', 'error'); });
    });
  }

  // -------------------------------------------------------------------------
  // Slots
  // -------------------------------------------------------------------------
  function renderSlots() {
    var host = $('#image-slots');
    if (!host) return;
    host.innerHTML = SLOT_CATALOG.map(function (g) {
      return '<div class="slot-group"><h3>' + esc(g.group) + '</h3>' +
        '<div class="slot-grid">' + g.items.map(slotCard).join('') + '</div></div>';
    }).join('');
    $$('[data-slot-action]', host).forEach(function (btn) {
      btn.addEventListener('click', onSlotAction);
    });
  }

  function slotCard(it) {
    var cur = st.slots[it.key];
    var preview = cur && cur.src
      ? (cur.kind === 'video'
          ? '<video src="' + esc(cur.src) + '" muted loop playsinline></video>'
          : '<img src="' + esc(cur.src) + '" alt="">')
      : '<div class="slot-empty">Sem mídia personalizada</div>';
    var featured = cur && cur.featured ? ' checked' : '';
    return '<div class="slot-card" data-key="' + esc(it.key) + '">' +
      '<div class="slot-preview">' + preview + '</div>' +
      '<div class="slot-info">' +
        '<strong>' + esc(it.label) + '</strong>' +
        '<small>' + esc(it.key) + '</small>' +
        '<label class="slot-featured"><input type="checkbox"' + featured + ' data-slot-action="toggle-featured"> Destaque (roupa escura)</label>' +
        '<div class="slot-actions">' +
          '<button type="button" class="btn btn-outline" data-slot-action="pick-library">Escolher da biblioteca</button>' +
          '<button type="button" class="btn btn-outline" data-slot-action="upload">Enviar arquivo</button>' +
          '<button type="button" class="btn" data-slot-action="reset" style="background:var(--color-error);">Limpar</button>' +
        '</div>' +
      '</div></div>';
  }

  function onSlotAction(e) {
    var card = e.target.closest('.slot-card');
    if (!card) return;
    var key = card.getAttribute('data-key');
    var action = e.target.getAttribute('data-slot-action');
    if (action === 'reset') {
      fetchJson(API + '/content/slots/' + encodeURIComponent(key), { method: 'DELETE' })
        .then(function () { delete st.slots[key]; renderSlots(); setStatus('Mídia removida.', 'success'); });
    } else if (action === 'toggle-featured') {
      var cur = st.slots[key];
      if (!cur) { e.target.checked = false; setStatus('Defina uma mídia primeiro.', 'error'); return; }
      saveSlot(key, cur.kind, cur.src, cur.caption || '', !!e.target.checked);
    } else if (action === 'upload') {
      pickFileForSlot(key);
    } else if (action === 'pick-library') {
      openLibraryFor(key);
    }
  }

  function saveSlot(key, kind, src, caption, featured) {
    return fetchJson(API + '/content/slots/' + encodeURIComponent(key), {
      method: 'PUT',
      body: JSON.stringify({ kind: kind, src: src, caption: caption || '', featured: !!featured }),
    }).then(function () {
      st.slots[key] = { kind: kind, src: src, caption: caption || '', featured: !!featured };
      renderSlots();
      setStatus('Mídia atualizada.', 'success');
    });
  }

  function pickFileForSlot(key) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.onchange = function () {
      if (!inp.files || !inp.files[0]) return;
      var fd = new FormData(); fd.append('file', inp.files[0]);
      setStatus('Enviando…');
      fetchJson(API + '/uploads', { method: 'POST', body: fd })
        .then(function (r) { return saveSlot(key, r.kind, r.url, '', false); })
        .then(function () { return fetchJson(API + '/uploads'); })
        .then(function (r) { st.uploads = r.files || []; renderLibrary(); })
        .catch(function () { setStatus('Falha no upload.', 'error'); });
    };
    inp.click();
  }

  // -------------------------------------------------------------------------
  // Biblioteca (uploads + jubalbinodeoliveira/)
  // -------------------------------------------------------------------------
  function renderLibrary() {
    var host = $('#library-list');
    if (!host) return;
    var list = [].concat(
      st.uploads.map(function (f) { return Object.assign({ source: 'upload' }, f); }),
      st.localMedia.map(function (f) { return Object.assign({ source: 'local' }, f); })
    );
    if (!list.length) {
      host.innerHTML = '<p class="hint">Nenhuma mídia ainda. Envie fotos/vídeos ou adicione arquivos em <code>fotos/</code>.</p>';
      return;
    }
    host.innerHTML = list.map(function (m) {
      var thumb = m.kind === 'video'
        ? '<video src="' + esc(m.url) + '" muted></video>'
        : '<img src="' + esc(m.url) + '" alt="">';
      return '<figure class="lib-card" data-url="' + esc(m.url) + '" data-kind="' + esc(m.kind) + '" data-source="' + esc(m.source) + '" data-name="' + esc(m.name) + '">' +
        thumb +
        '<figcaption>' +
          '<small>' + esc(m.source === 'local' ? ('fotos' + (m.category ? ' · ' + m.category : '')) : 'upload') + (m.featured ? ' · destaque' : '') + '</small>' +
          '<span>' + esc(m.name) + '</span>' +
          (m.source === 'upload'
            ? '<button type="button" class="btn-link danger" data-lib-action="delete">excluir</button>'
            : '') +
        '</figcaption></figure>';
    }).join('');
    $$('.lib-card', host).forEach(function (card) {
      card.addEventListener('click', function (ev) {
        var act = ev.target.getAttribute('data-lib-action');
        if (act === 'delete') {
          ev.stopPropagation();
          var name = card.getAttribute('data-name');
          if (!confirm('Excluir ' + name + '?')) return;
          fetchJson(API + '/uploads/' + encodeURIComponent(name), { method: 'DELETE' })
            .then(function () { return fetchJson(API + '/uploads'); })
            .then(function (r) { st.uploads = r.files || []; renderLibrary(); });
          return;
        }
        // clicar no card => se houver slot pendente, atribui
        if (st._pendingSlot) {
          var url = card.getAttribute('data-url');
          var kind = card.getAttribute('data-kind');
          saveSlot(st._pendingSlot, kind, url, '', false);
          closePicker();
        }
      });
    });
  }

  function bindLibraryUpload() {
    var inp = $('#library-upload');
    if (!inp) return;
    inp.addEventListener('change', function () {
      if (!inp.files || !inp.files.length) return;
      var files = Array.prototype.slice.call(inp.files);
      setStatus('Enviando ' + files.length + ' arquivo(s)…');
      Promise.all(files.map(function (f) {
        var fd = new FormData(); fd.append('file', f);
        return fetchJson(API + '/uploads', { method: 'POST', body: fd });
      })).then(function () {
        return fetchJson(API + '/uploads');
      }).then(function (r) {
        st.uploads = r.files || []; renderLibrary();
        setStatus('Upload concluído.', 'success'); inp.value = '';
      }).catch(function () { setStatus('Falha no upload.', 'error'); });
    });
  }

  // -------------------------------------------------------------------------
  // Picker (modal) p/ slot escolher da biblioteca
  // -------------------------------------------------------------------------
  function openLibraryFor(key) {
    st._pendingSlot = key;
    var picker = $('#picker'); if (!picker) return;
    $('#picker-title').textContent = 'Escolher mídia para ' + key;
    $('#picker-tabs').innerHTML = '';
    $('#picker-results').innerHTML = '';
    fetchJson(API + '/local-media').then(function (r) {
      st.localMedia = r.files || [];
      $('#picker-results').innerHTML = renderPickerLibrary();
      bindPickerLibraryClicks();
    });
    picker.classList.add('open');
  }
  function renderPickerLibrary() {
    var list = [].concat(
      st.uploads.map(function (f) { return Object.assign({ source: 'upload' }, f); }),
      st.localMedia.map(function (f) { return Object.assign({ source: 'local' }, f); })
    );
    if (!list.length) return '<p class="hint">Nenhuma mídia disponível ainda. Envie fotos/vídeos na aba <em>Biblioteca</em>.</p>';
    return '<div class="picker-grid">' + list.map(function (m) {
      var thumb = m.kind === 'video'
        ? '<video src="' + esc(m.url) + '" muted></video>'
        : '<img src="' + esc(m.url) + '" alt="">';
      return '<figure class="pick-card" data-url="' + esc(m.url) + '" data-kind="' + esc(m.kind) + '" data-name="' + esc(m.name) + '">' +
        thumb + '<figcaption>' + esc(m.name) + '</figcaption></figure>';
    }).join('') + '</div>';
  }
  function bindPickerLibraryClicks() {
    $$('#picker-results .pick-card').forEach(function (c) {
      c.addEventListener('click', function () {
        if (!st._pendingSlot) return;
        saveSlot(st._pendingSlot, c.getAttribute('data-kind'), c.getAttribute('data-url'), '', false)
          .then(closePicker);
      });
    });
  }
  function closePicker() {
    var p = $('#picker'); if (p) p.classList.remove('open');
    st._pendingSlot = null;
  }
  function bindPicker() {
    var p = $('#picker'); if (!p) return;
    p.addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.close) closePicker();
    });
  }

  // -------------------------------------------------------------------------
  // Galeria pública (curadoria com fotos da Juliana)
  // -------------------------------------------------------------------------
  function bindGallery() {
    var save = $('#gallery-save'); if (!save) return;
    save.addEventListener('click', saveGallery);
    refreshGallery();
  }
  function refreshGallery() {
    Promise.all([
      fetchJson(API + '/content/gallery'),
      fetchJson(API + '/local-media'),
    ]).then(function (r) {
      st.localMedia = (r[1] && r[1].files) || [];
      renderGalleryPicker();
      renderCurrentGallery((r[0] && r[0].items) || []);
    });
  }
  function renderGalleryPicker() {
    var out = $('#gallery-results');
    var list = [].concat(
      st.uploads.map(function (f) { return Object.assign({ source: 'upload' }, f); }),
      st.localMedia.map(function (f) { return Object.assign({ source: 'local' }, f); })
    ).filter(function (m) { return m.kind === 'image'; });
    if (!list.length) {
      out.innerHTML = '<p class="hint">Nenhuma foto disponível. Envie fotos na aba <em>Biblioteca</em> ou adicione em <code>fotos/</code>.</p>';
      return;
    }
    out.innerHTML = '<p class="hint">Clique em uma foto para adicioná-la à galeria.</p>' +
      '<div class="picker-grid">' + list.map(function (m) {
        return '<figure class="pick-card" data-payload=\'' +
          esc(JSON.stringify({
            id: 'lib-' + (m.id || m.name),
            src: m.url, thumb: m.url, url: m.url,
            photographer: 'Juliana Balbino',
            alt: m.name,
          })) + '\'>' +
          '<img src="' + esc(m.url) + '" alt="' + esc(m.name) + '">' +
          '<figcaption>' + esc(m.name) + '</figcaption></figure>';
      }).join('') + '</div>';
    $$('.pick-card', out).forEach(function (c) {
      c.addEventListener('click', function () {
        var host = $('#gallery-current');
        var arr = host.dataset.items ? JSON.parse(host.dataset.items) : [];
        arr.push(JSON.parse(c.getAttribute('data-payload')));
        renderCurrentGallery(arr);
      });
    });
  }
  function renderCurrentGallery(items) {
    var host = $('#gallery-current');
    if (!items.length) {
      host.innerHTML = '<p class="hint">Galeria vazia. Selecione fotos acima para adicioná-las.</p>';
      host.dataset.items = '[]';
      return;
    }
    host.innerHTML = '<div class="gallery-grid">' + items.map(function (it, i) {
      return '<figure class="gallery-item" data-i="' + i + '">' +
        '<img src="' + esc(it.thumb || it.src) + '" alt="' + esc(it.alt || '') + '">' +
        '<figcaption>' + esc(it.photographer || '') + '</figcaption>' +
        '<button class="btn-link danger" data-i="' + i + '" type="button">remover</button>' +
      '</figure>';
    }).join('') + '</div>';
    host.dataset.items = JSON.stringify(items);
    $$('.btn-link.danger[data-i]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var arr = JSON.parse(host.dataset.items || '[]');
        arr.splice(parseInt(b.getAttribute('data-i'), 10), 1);
        renderCurrentGallery(arr);
      });
    });
  }
  function saveGallery() {
    var host = $('#gallery-current');
    var items = host.dataset.items ? JSON.parse(host.dataset.items) : [];
    fetchJson(API + '/content/gallery', {
      method: 'PUT', body: JSON.stringify({ items: items }),
    }).then(function () { setStatus('Galeria salva (' + items.length + ').', 'success'); })
      .catch(function () { setStatus('Falha ao salvar a galeria.', 'error'); });
  }

  // -------------------------------------------------------------------------
  // Inscrições
  // -------------------------------------------------------------------------
  function loadSubmissions() {
    return fetchJson(API + '/submissions').then(function (r) {
      var items = r.items || [];
      $('#submissions-count').textContent = items.length;
      var host = $('#submissions-container');
      if (!items.length) {
        host.innerHTML = '<div class="empty-state"><h3>Nenhuma inscrição ainda</h3></div>';
        return;
      }
      host.innerHTML = '<div class="table-wrapper"><table class="submissions">' +
        '<thead><tr><th>Data</th><th>Nome</th><th>E-mail</th><th>Idade</th><th>Cidade</th><th>Interesses</th><th>Mensagem</th><th>News.</th></tr></thead>' +
        '<tbody>' + items.map(function (s) {
          return '<tr>' +
            '<td>' + esc(s.created_at) + '</td>' +
            '<td>' + esc(s.nome) + '</td>' +
            '<td>' + esc(s.email) + '</td>' +
            '<td>' + esc(s.idade != null ? s.idade : '—') + '</td>' +
            '<td>' + esc(s.cidade || '—') + '</td>' +
            '<td>' + esc(s.interesses || '—') + '</td>' +
            '<td>' + esc(s.mensagem || '—') + '</td>' +
            '<td>' + (s.newsletter ? 'Sim' : 'Não') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
    });
  }
  function bindSubmissions() {
    $('#btn-export').addEventListener('click', function () {
      fetchJson(API + '/submissions').then(function (r) {
        var blob = new Blob([JSON.stringify(r.items || [], null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'inscricoes-juliana-balbino.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
    $('#btn-clear').addEventListener('click', function () {
      if (!confirm('Apagar TODAS as inscrições?')) return;
      fetchJson(API + '/submissions', { method: 'DELETE' }).then(loadSubmissions);
    });
  }

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('admin-page');
    bindLogin();
    bindLogout();
    bindTabs();
    bindProfile();
    bindLibraryUpload();
    bindPicker();
    bindGallery();
    bindSubmissions();
    bindTexts();

    fetchJson(API + '/auth/me').then(function (r) {
      st.me = r.user;
      showAdmin();
      loadAll();
      loadSubmissions();
    }).catch(function () { showLogin(); });
  });
})();
