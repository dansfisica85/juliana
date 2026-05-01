/* Form de contato — envia para /api/submissions; cai em localStorage se offline. */
(function () {
  'use strict';
  var STORAGE_KEY = 'jb_submissions';

  function showFieldError(input, message) {
    var err = input.parentElement.querySelector('.field-error');
    if (err) { err.textContent = message; err.classList.add('visible'); }
    input.setAttribute('aria-invalid', 'true');
  }
  function clearFieldError(input) {
    var err = input.parentElement.querySelector('.field-error');
    if (err) { err.textContent = ''; err.classList.remove('visible'); }
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
      showFieldError(nome, 'Por favor, informe seu nome (mínimo 2 caracteres).'); ok = false;
    }
    if (!email.value.trim() || !isValidEmail(email.value.trim())) {
      showFieldError(email, 'Por favor, informe um e-mail válido.'); ok = false;
    }
    if (idade.value !== '') {
      var n = parseInt(idade.value, 10);
      if (isNaN(n) || n < 10 || n > 120) {
        showFieldError(idade, 'Idade deve estar entre 10 e 120.'); ok = false;
      }
    }
    if (consent && !consent.checked) {
      showFieldError(consent, 'É necessário concordar para enviar o formulário.'); ok = false;
    }
    return ok;
  }
  function showMessage(box, text, type) {
    box.textContent = text;
    box.className = 'form-message ' + type;
  }
  function saveLocal(data) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      arr.push(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) { /* noop */ }
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
    var interesses = Array.prototype.slice
      .call(form.querySelectorAll('input[name="interesses"]:checked'))
      .map(function (i) { return i.value; });
    var data = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      idade: form.idade.value ? parseInt(form.idade.value, 10) : null,
      cidade: form.cidade ? form.cidade.value.trim() : '',
      interesses: interesses,
      mensagem: form.mensagem ? form.mensagem.value.trim() : '',
      newsletter: form.newsletter ? !!form.newsletter.checked : false,
      enviadoEm: new Date().toISOString(),
    };
    fetch('/api/submissions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (r) {
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    }).then(function () {
      if (msg) showMessage(msg, 'Obrigada, ' + data.nome + '! Sua mensagem foi recebida com carinho. 💕', 'success');
      form.reset();
    }).catch(function () {
      saveLocal(data);
      if (msg) showMessage(msg, 'Mensagem registrada localmente (servidor offline). Obrigada, ' + data.nome + '!', 'success');
      form.reset();
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('contato-form');
    if (form) form.addEventListener('submit', handleSubmit);
  });
})();
