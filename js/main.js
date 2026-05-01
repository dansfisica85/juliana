/* Juliana Balbino — comportamento global do site
 *  - Destaca o link de navegação ativo
 *  - Atualiza ano do rodapé
 *  - Aplica imagens personalizadas (upload pelo admin) em elementos com [data-img-key]
 *  - Renderiza a galeria Pexels (curada pelo admin) em .pexels-gallery
 *
 * Os dados ficam apenas no navegador (localStorage), pois o site é estático.
 */
(function () {
  var IMAGES_KEY = 'jb_images';
  var GALLERY_KEY = 'jb_pexels_gallery';

  function getImages() {
    var custom = {};
    try {
      var raw = localStorage.getItem(IMAGES_KEY);
      if (raw) custom = JSON.parse(raw) || {};
    } catch (e) { custom = {}; }
    var defaults = window.JB_DEFAULT_IMAGES || {};
    // customizado tem prioridade sobre defaults
    var merged = {};
    Object.keys(defaults).forEach(function (k) { merged[k] = defaults[k]; });
    Object.keys(custom).forEach(function (k) { merged[k] = custom[k]; });
    return merged;
  }

  function getGallery() {
    try {
      var raw = localStorage.getItem(GALLERY_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (e) {}
    return window.JB_DEFAULT_GALLERY || [];
  }

  function applyImages() {
    var images = getImages();
    document.querySelectorAll('[data-img-key]').forEach(function (el) {
      var key = el.getAttribute('data-img-key');
      var src = images[key];
      if (!src) return;
      if (el.tagName === 'IMG') {
        el.src = src;
      } else {
        el.style.backgroundImage = 'url("' + src.replace(/"/g, '\\"') + '")';
        el.classList.add('has-image');
      }
    });
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderGallery() {
    var container = document.querySelector('.pexels-gallery');
    if (!container) return;
    var items = getGallery();
    if (!items.length) {
      container.innerHTML = '<div class="gallery-empty">' +
        '<p>A galeria ainda não foi configurada. As fotos aparecem aqui assim que forem selecionadas no painel administrativo.</p>' +
        '</div>';
      return;
    }
    var html = '<div class="gallery-grid">' + items.map(function (it) {
      var src = escapeAttr(it.src);
      var alt = escapeAttr(it.alt || 'Foto de moda');
      var photographer = escapeAttr(it.photographer || 'Fotógrafo Pexels');
      var url = escapeAttr(it.url || 'https://www.pexels.com');
      return '<figure class="gallery-item">' +
        '<img src="' + src + '" alt="' + alt + '" loading="lazy">' +
        '<figcaption class="gallery-caption">Foto: <a href="' + url + '" target="_blank" rel="noopener">' + photographer + '</a> · Pexels</figcaption>' +
        '</figure>';
    }).join('') + '</div>' +
      '<p class="pexels-credit">Imagens gratuitas via <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>.</p>';
    container.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var target = href.split('/').pop();
      if (target === path) link.classList.add('active');
    });

    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    applyImages();
    renderGallery();
  });
})();
