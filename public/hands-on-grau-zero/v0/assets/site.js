(() => {
  'use strict';
  const form = document.getElementById('candidatura-form');
  if (!form) return;
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const preview = document.getElementById('form-preview-note');
  const continueButton = form.querySelector('[data-testid="continue-step"]');
  const backButton = form.querySelector('[data-testid="back-step"]');
  const panels = [...form.querySelectorAll('[data-step-panel]')];
  const progress = document.getElementById('step-progress');
  const progressLabel = document.getElementById('step-label');
  const intro = document.getElementById('form-intro');
  const fields = [...form.querySelectorAll('input, select, textarea')];
  const enums = {
    experiencia_catarata: ['ainda_nao_opero', 'iniciando_supervisao', 'opero_autonomia'],
    experiencia_lentes: ['ainda_nao_implanto', 'poucos_casos', 'regularmente'],
    oferta_premium: ['nao', 'alguns_casos', 'rotina'],
    clinica: ['proprietario', 'socio', 'nao']
  };
  const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'aid', 'fbclid', 'gclid'];
  // Keep attribution and the retry identity stable for this page view. Never store candidate data.
  const params = new URLSearchParams(location.search);
  const attribution = Object.fromEntries(attributionKeys.map((key) => [key, (params.get(key) || '').slice(0, 500)]));
  const safePage = (value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? (url.origin + url.pathname).slice(0, 2000) : '';
    } catch { return ''; }
  };
  const page = safePage(location.href);
  const referrer = safePage(document.referrer);
  let submitting = false;
  let completed = false;
  let retry = null;
  let currentStep = 1;
  let started = false;
  const progressEvent = (action, extra = {}) => {
    window.dispatchEvent(new CustomEvent('hands-on:progress', { detail: { action, ...extra } }));
  };

  const setStep = (step, focusFirst = true) => {
    currentStep = step;
    for (const panel of panels) panel.hidden = Number(panel.dataset.stepPanel) !== step;
    progress.dataset.step = String(step);
    progress.setAttribute('aria-valuenow', String(step));
    progress.setAttribute('aria-valuetext', step === 1 ? 'Etapa 1 de 2: Seus dados' : 'Etapa 2 de 2: Sua prática');
    progressLabel.textContent = step === 1 ? '1 de 2 · Seus dados' : '2 de 2 · Sua prática';
    intro.textContent = step === 1 ? 'Comece pelos seus dados.' : 'Conte um pouco sobre sua prática.';
    status.hidden = true;
    if (focusFirst) {
      const first = panels.find((panel) => Number(panel.dataset.stepPanel) === step).querySelector('input, select, textarea');
      first.focus({ preventScroll: true });
      first.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  };

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = false;
    status.focus({ preventScroll: true });
    status.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  };
  const refreshPreview = () => { preview.hidden = Boolean(form.dataset.formEndpoint.trim()); };
  refreshPreview();
  new MutationObserver(refreshPreview).observe(form, { attributes: true, attributeFilter: ['data-form-endpoint'] });
  for (const field of fields) {
    const clearError = () => { field.setCustomValidity(''); field.removeAttribute('aria-invalid'); };
    field.addEventListener('input', clearError);
    field.addEventListener('change', clearError);
    const start = () => {
      if (!started) { started = true; progressEvent('start'); }
    };
    field.addEventListener('input', start);
    field.addEventListener('change', start);
  }
  const invalid = (name, message) => {
    const field = form.elements[name];
    const panelStep = Number(field.closest('[data-step-panel]').dataset.stepPanel);
    if (panelStep !== currentStep) setStep(panelStep, false);
    if (message) field.setCustomValidity(message);
    field.setAttribute('aria-invalid', 'true');
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    field.reportValidity();
    return false;
  };
  const validate = (stepOnly = null) => {
    const candidates = fields.filter((field) => stepOnly === null || Number(field.closest('[data-step-panel]').dataset.stepPanel) === stepOnly);
    for (const field of candidates) { field.setCustomValidity(''); field.removeAttribute('aria-invalid'); }
    for (const field of candidates) {
      if (!field.checkValidity()) return invalid(field.name);
    }
    const nameLength = form.elements.nome.value.trim().length;
    if (nameLength < 2 || nameLength > 140) return invalid('nome', 'Informe seu nome completo, entre 2 e 140 caracteres.');
    const phone = form.elements.whatsapp.value;
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
      return invalid('whatsapp', 'Informe um telefone com 10 a 15 dígitos, incluindo DDD e, se necessário, o código do país.');
    }
    if (!/^\d{1,10}$/.test(form.elements.crm.value)) return invalid('crm', 'Informe o número do CRM, usando somente dígitos.');
    if (!states.includes(form.elements.uf.value)) return invalid('uf', 'Selecione a UF do seu CRM.');
    if (stepOnly === 1) return true;
    const volume = Number(form.elements.cirurgias_mes.value);
    if (!Number.isInteger(volume) || volume < 0 || volume > 10000) return invalid('cirurgias_mes', 'Informe um número inteiro entre 0 e 10000.');
    for (const [name, values] of Object.entries(enums)) {
      if (!values.includes(form.elements[name].value)) return invalid(name, 'Selecione uma das opções.');
    }
    if (form.elements.objetivo.value.trim().length > 2000) return invalid('objetivo', 'Use até 2000 caracteres e não inclua dados de pacientes.');
    return true;
  };
  const lockFields = (value) => {
    for (const field of fields) field.disabled = value;
    continueButton.disabled = value;
    backButton.disabled = value;
  };
  const advance = () => {
    if (!submitting && !completed && validate(1)) {
      progressEvent('advance');
      setStep(2);
    }
  };
  continueButton.addEventListener('click', advance);
  backButton.addEventListener('click', () => { if (!submitting && !completed) setStep(1); });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && currentStep === 1 && event.target.matches('input')) {
      event.preventDefault();
      advance();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || completed) return;
    if (currentStep === 1) { advance(); return; }
    // A preview never sends, even when the visitor has filled all fields.
    const endpoint = form.dataset.formEndpoint.trim();
    if (!endpoint) {
      showStatus('Esta é uma prévia. O envio de candidaturas ainda não está habilitado. Nenhum dado foi enviado.', 'error');
      return;
    }
    if (!validate()) return;
    let endpointUrl;
    try {
      endpointUrl = new URL(endpoint, location.href);
      const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(endpointUrl.hostname);
      if (endpointUrl.protocol !== 'https:' && !(endpointUrl.protocol === 'http:' && loopback)) throw new Error('invalid_endpoint');
    } catch {
      showStatus('Não foi possível confirmar o envio. Seus dados continuam no formulário. Tente novamente.', 'error');
      return;
    }
    const data = new FormData(form);
    const payload = {
      schema_version: 1,
      produto: 'hands_on_grau_zero',
      nome: data.get('nome').trim(),
      whatsapp: data.get('whatsapp').replace(/\D/g, ''),
      crm: data.get('crm').trim(),
      uf: data.get('uf'),
      experiencia_catarata: data.get('experiencia_catarata'),
      cirurgias_mes: Number(data.get('cirurgias_mes')),
      experiencia_lentes: data.get('experiencia_lentes'),
      oferta_premium: data.get('oferta_premium'),
      clinica: data.get('clinica'),
      objetivo: data.get('objetivo').trim(),
      ...attribution,
      page,
      referrer
    };
    const signature = JSON.stringify(payload);
    if (!retry || retry.signature !== signature) {
      if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
        showStatus('Não foi possível confirmar o envio. Seus dados continuam no formulário. Tente novamente.', 'error');
        return;
      }
      retry = { signature, id: window.crypto.randomUUID() };
    }
    payload.request_id = retry.id;
    const capi = window.handsOnCapi;
    const useCapi = capi && endpointUrl.href === capi.endpoint;
    const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (useCapi) {
      headers.apikey = capi.key;
      payload.tracking = capi.context();
      payload.qa = capi.qa;
    }
    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Enviando candidatura…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = true;
    lockFields(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), useCapi ? 30000 : 15000);
    progressEvent('submit');
    let errorType = 'network';
    try {
      const response = await fetch(endpointUrl.href, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'follow'
      });
      if (!response.ok) { errorType = 'http'; throw new Error('http_error'); }
      errorType = 'unconfirmed';
      const receipt = await response.json();
      if (receipt.ok !== true || receipt.request_id !== payload.request_id) throw new Error('unconfirmed');
      completed = true;
      showStatus('Candidatura recebida. Nossa equipe entrará em contato pelo WhatsApp informado para conversar sobre seu perfil e apresentar as informações da turma.', 'success');
      submit.textContent = 'Candidatura recebida';
      window.dispatchEvent(new CustomEvent('hands-on:receipt', { detail: { ok: true, request_id: receipt.request_id, tracking_mode: receipt.tracking_mode || 'production' } }));
    } catch {
      progressEvent('error', { error_type: controller.signal.aborted ? 'timeout' : errorType });
      showStatus('Não foi possível confirmar o envio. Seus dados continuam no formulário. Tente novamente.', 'error');
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      form.removeAttribute('aria-busy');
      if (!completed) {
        lockFields(false);
        submit.disabled = false;
        submit.textContent = 'Enviar candidatura';
      }
    }
  });
  submit.disabled = false;
  continueButton.disabled = false;
  setStep(1, false);
})();
