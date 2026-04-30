/* Form handling: validation + storage in localStorage
 * Submissions are saved under the key 'jb_submissions' as a JSON array.
 */
(function () {
  var STORAGE_KEY = 'jb_submissions';

  function getSubmissions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSubmission(data) {
    var list = getSubmissions();
    list.push(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function showFieldError(input, message) {
    var err = input.parentElement.querySelector('.field-error');
    if (err) {
      err.textContent = message;
      err.classList.add('visible');
    }
    input.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(input) {
    var err = input.parentElement.querySelector('.field-error');
    if (err) {
      err.textContent = '';
      err.classList.remove('visible');
    }
    input.removeAttribute('aria-invalid');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validate(form) {
    var ok = true;
    var nome = form.querySelector('#nome');
    var email = form.querySelector('#email');
    var idade = form.querySelector('#idade');
    var consent = form.querySelector('#consent');

    [nome, email, idade].forEach(clearFieldError);
    if (consent) clearFieldError(consent);

    if (!nome.value.trim() || nome.value.trim().length < 2) {
      showFieldError(nome, 'Por favor, informe seu nome (mínimo 2 caracteres).');
      ok = false;
    }
    if (!email.value.trim() || !isValidEmail(email.value.trim())) {
      showFieldError(email, 'Por favor, informe um e-mail válido.');
      ok = false;
    }
    if (idade.value !== '') {
      var n = parseInt(idade.value, 10);
      if (isNaN(n) || n < 10 || n > 120) {
        showFieldError(idade, 'Idade deve estar entre 10 e 120.');
        ok = false;
      }
    }
    if (consent && !consent.checked) {
      showFieldError(consent, 'É necessário concordar para enviar o formulário.');
      ok = false;
    }
    return ok;
  }

  function showMessage(box, text, type) {
    box.textContent = text;
    box.className = 'form-message ' + type;
  }

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var msg = form.querySelector('.form-message');
    if (msg) { msg.className = 'form-message'; msg.textContent = ''; }

    if (!validate(form)) {
      if (msg) showMessage(msg, 'Verifique os campos destacados e tente novamente.', 'error');
      return;
    }

    // Collect interesses (checkbox group)
    var interesses = Array.prototype.slice
      .call(form.querySelectorAll('input[name="interesses"]:checked'))
      .map(function (i) { return i.value; });

    var data = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      idade: form.idade.value ? parseInt(form.idade.value, 10) : null,
      cidade: form.cidade ? form.cidade.value.trim() : '',
      interesses: interesses,
      mensagem: form.mensagem ? form.mensagem.value.trim() : '',
      newsletter: form.newsletter ? !!form.newsletter.checked : false,
      enviadoEm: new Date().toISOString()
    };

    try {
      saveSubmission(data);
    } catch (err) {
      if (msg) showMessage(msg, 'Não foi possível salvar localmente. Tente novamente.', 'error');
      return;
    }

    if (msg) showMessage(msg, 'Obrigada, ' + data.nome + '! Sua mensagem foi recebida com carinho. 💕', 'success');
    form.reset();
  }

  /* Admin page rendering */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString('pt-BR');
    } catch (e) { return iso; }
  }

  function renderAdmin() {
    var container = document.getElementById('submissions-container');
    if (!container) return;
    var data = getSubmissions();
    var countEl = document.getElementById('submissions-count');
    if (countEl) countEl.textContent = data.length;

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<h3>Nenhuma inscrição ainda</h3>' +
        '<p>Quando alguém preencher o formulário em <a href="contato.html">Contato</a>, os dados aparecerão aqui.</p>' +
        '</div>';
      return;
    }

    var rows = data.slice().reverse().map(function (s) {
      return '<tr>' +
        '<td>' + formatDate(s.enviadoEm) + '</td>' +
        '<td>' + escapeHtml(s.nome) + '</td>' +
        '<td>' + escapeHtml(s.email) + '</td>' +
        '<td>' + (s.idade != null ? escapeHtml(s.idade) : '—') + '</td>' +
        '<td>' + escapeHtml(s.cidade || '—') + '</td>' +
        '<td>' + escapeHtml((s.interesses || []).join(', ') || '—') + '</td>' +
        '<td>' + escapeHtml(s.mensagem || '—') + '</td>' +
        '<td>' + (s.newsletter ? 'Sim' : 'Não') + '</td>' +
        '</tr>';
    }).join('');

    container.innerHTML = '<div class="table-wrapper"><table class="submissions">' +
      '<thead><tr>' +
      '<th>Data</th><th>Nome</th><th>E-mail</th><th>Idade</th>' +
      '<th>Cidade</th><th>Interesses</th><th>Mensagem</th><th>Newsletter</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function exportJSON() {
    var data = getSubmissions();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'inscricoes-juliana-balbino.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    if (confirm('Tem certeza que deseja apagar TODAS as inscrições? Esta ação não pode ser desfeita.')) {
      localStorage.removeItem(STORAGE_KEY);
      renderAdmin();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('contato-form');
    if (form) form.addEventListener('submit', handleSubmit);

    renderAdmin();
    var exp = document.getElementById('btn-export');
    if (exp) exp.addEventListener('click', exportJSON);
    var clr = document.getElementById('btn-clear');
    if (clr) clr.addEventListener('click', clearAll);
  });
})();
