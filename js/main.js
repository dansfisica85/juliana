/* Shared site behaviors: highlight active nav link, set footer year */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Active nav link highlight
    var path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var target = href.split('/').pop();
      if (target === path) link.classList.add('active');
    });

    // Footer year
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
