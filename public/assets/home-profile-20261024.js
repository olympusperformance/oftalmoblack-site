/* Ficha nível 0 adaptada para a home. Receptor e perguntas existentes. */
(() => {
      'use strict';
      const form = document.getElementById('perfil-form');
      if (!form) return;
      const fields = document.getElementById('form-fields');
      const button = document.getElementById('submit-button');
      const back = document.getElementById('back-button');
      const message = document.getElementById('form-message');
      const panels = [...form.querySelectorAll('[data-step]')];
      const otherGroup = document.getElementById('other-group');
      const otherCheckbox = document.getElementById('outro');
      const otherText = document.getElementById('outro-desafio');
      const phone = document.getElementById('whatsapp');
      const name = document.getElementById('nome');
      const email = document.getElementById('email');
      const challenges = [...form.querySelectorAll('[name="desafios"]')];
      let sending = false, pending = null, active = 'contatos', advanceTimer = null;
      const query = new URLSearchParams(window.location.search);
      const origem = ['stories','presencial'].includes(query.get('origem')) ? query.get('origem') : 'direto';
      const utm = {};
      for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid']) {
        const value = (query.get(key) || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
        if (value && !/[@\u0000-\u001f]/.test(value)) utm[key] = value;
      }
      const selected = key => form.querySelector('[name="' + key + '"]:checked')?.value || null;
      const steps = () => ['contatos','lentes',...(selected('lentes_premium') === 'sim' ? ['volume'] : []),'faturamento','desafios'];
      function phoneE164(value) {
        const raw = value.trim();
        if (!/^[+\d\s().-]+$/.test(raw) || raw.slice(1).includes('+')) return null;
        if (raw.startsWith('+') && !raw.startsWith('+55')) { const international = raw.replace(/\D/g, ''); return /^[1-9]\d{7,14}$/.test(international) ? '+' + international : null; }
        let digits = value.replace(/\D/g, '');
        if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
        if (!/^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/.test(digits)) return null;
        return '+55' + digits;
      }
      function cancelAdvance() { clearTimeout(advanceTimer); advanceTimer = null; }
      function syncOther() { otherGroup.hidden = !otherCheckbox.checked; otherText.disabled = !otherCheckbox.checked; otherText.required = otherCheckbox.checked; if (!otherCheckbox.checked) { otherText.value = ''; otherText.setCustomValidity(''); } }
      function progress() {
        const route = steps(), index = route.indexOf(active), count = route.length - 1;
        document.getElementById('question-meta').hidden = index === 0;
        document.getElementById('question-step').textContent = 'Pergunta ' + index + ' de ' + count;
        const bar = document.getElementById('research-progress'); bar.max = count; bar.value = index; bar.textContent = index + ' de ' + count; bar.setAttribute('aria-valuetext', index + ' de ' + count);
      }
      function render(focus = true) {
        cancelAdvance(); message.hidden = true;
        for (const panel of panels) { panel.hidden = panel.dataset.step !== active; panel.disabled = panel.hidden; }
        syncOther(); progress();
        back.hidden = active === 'contatos';
        button.textContent = active === 'desafios' ? 'Enviar minhas respostas' : 'Continuar';
        document.getElementById('navigation').className = 'navigation' + (active === 'contatos' ? ' contacts' : active === 'desafios' ? ' final' : '');
        if (focus) { panels.find(panel => panel.dataset.step === active).querySelector('h2').focus({preventScroll:true}); document.getElementById('home-profile').scrollIntoView({block:'start',behavior:'instant'}); }
      }
      function validateStep() {
        if (active === 'contatos') {
          name.setCustomValidity(name.value.trim().length >= 2 ? '' : 'Informe seu nome.');
          email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Confira o seu e-mail.');
          phone.setCustomValidity(phoneE164(phone.value) ? '' : 'Informe DDD e número. Para outros países, inclua + e o DDI.');
        }
        if (active === 'desafios') {
          challenges[0].setCustomValidity(challenges.some(input => input.checked) ? '' : 'Marque pelo menos um desafio.');
          otherText.setCustomValidity(otherCheckbox.checked && !otherText.value.trim() ? 'Conte qual é o outro desafio.' : '');
        }
        const panel = panels.find(panel => panel.dataset.step === active);
        const invalid = [...panel.querySelectorAll('input,textarea')].find(input => !input.checkValidity());
        if (invalid) { invalid.reportValidity(); return false; }
        return true;
      }
      function telemetry(action, extra = {}) { try { window.dispatchEvent(new CustomEvent('perfil-black:progress', { detail: { action, ...extra } })); } catch {} }
      function advance() { cancelAdvance(); if (sending || !validateStep()) return; const route = steps(), next = route[route.indexOf(active) + 1]; if (next) { if (active === 'contatos') telemetry('contact_complete'); active = next; render(); } }
      for (const input of form.querySelectorAll('input[type="radio"]')) {
        input.addEventListener('change', () => {
          if (input.name === 'lentes_premium' && input.value === 'nao') for (const volume of form.querySelectorAll('[name="volume_lentes"]')) volume.checked = false;
          progress();
        });
        input.addEventListener('click', () => { if (sending) return; cancelAdvance(); const current = active; advanceTimer = setTimeout(() => { if (active === current) advance(); }, 220); });
      }
      for (const input of challenges) input.addEventListener('change', () => { challenges[0].setCustomValidity(''); syncOther(); });
      for (const input of [name,email,phone,otherText]) input.addEventListener('input', () => input.setCustomValidity(''));
      back.addEventListener('click', () => { if (sending) return; cancelAdvance(); const route = steps(); active = route[Math.max(0, route.indexOf(active) - 1)]; render(); });
      form.addEventListener('keydown', event => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) cancelAdvance();
        if (event.key !== 'Enter' || event.isComposing || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'BUTTON') return;
        event.preventDefault();
        if (active !== 'desafios') advance();
      });
      function showMessage(text) { message.textContent = text; message.hidden = false; message.focus(); }
      function uuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return hex.slice(0,8) + '-' + hex.slice(8,12) + '-' + hex.slice(12,16) + '-' + hex.slice(16,20) + '-' + hex.slice(20);
      }
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending) return;
        cancelAdvance();
        if (active !== 'desafios') { advance(); return; }
        if (!validateStep()) return;
        // Validate the complete draft locally before sending. Hidden steps remain
        // disabled; if an earlier answer is absent, show that step for correction.
        const missing = name.value.trim().length < 2 || !phoneE164(phone.value) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById('email').value.trim()) ? 'contatos' : !selected('lentes_premium') ? 'lentes' : selected('lentes_premium') === 'sim' && !selected('volume_lentes') ? 'volume' : !selected('faturamento') ? 'faturamento' : null;
        if (missing) { active = missing; render(); validateStep(); return; }
        const endpointValue = document.querySelector('meta[name="perfil-endpoint"]').content.trim();
        const apiKey = document.querySelector('meta[name="perfil-api-key"]').content.trim();
        let endpoint;
        try {
          if (!endpointValue || !apiKey) throw new Error('unconfigured');
          endpoint = new URL(endpointValue, location.origin);
          if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost','127.0.0.1'].includes(endpoint.hostname))) throw new Error('unconfigured');
        } catch { showMessage('O envio está indisponível no momento. Suas respostas continuam aqui. Tente novamente mais tarde.'); return; }
        const payload = { nome: name.value.trim(), email: document.getElementById('email').value.trim(), whatsapp: phoneE164(phone.value), lentes_premium: selected('lentes_premium') === 'sim', volume_lentes: selected('lentes_premium') === 'sim' ? selected('volume_lentes') : null, faturamento: selected('faturamento'), desafios: challenges.filter(input => input.checked).map(input => input.value), outro_desafio: otherCheckbox.checked ? otherText.value.trim() : null, origem, utm, pagina: location.pathname };
        const fingerprint = JSON.stringify(payload);
        if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, payload: { submission_id: uuid(), ...payload } };
        const attempt = pending;
        telemetry('submit');
        sending = true; fields.disabled = true; button.textContent = 'Enviando respostas...'; form.setAttribute('aria-busy', 'true'); message.hidden = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        let received = false;
        try {
          const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': apiKey, 'Authorization': 'Bearer ' + apiKey }, body: JSON.stringify(attempt.payload), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
          let ack; try { ack = await response.json(); } catch { throw new Error('unconfirmed'); }
          if (!response.ok || ack?.ok !== true || ack.id !== attempt.payload.submission_id) throw new Error('unconfirmed');
          try { window.dispatchEvent(new CustomEvent('perfil-black:receipt', { detail: { ok: true, id: ack.id } })); } catch {}
          received = true; form.reset(); pending = null;
          for (const input of form.querySelectorAll('input,textarea')) input.value = '';
          form.remove(); document.getElementById('privacy-note').hidden = true;
          const commercial = document.getElementById('home-commercial');
          commercial.href = 'https://wa.me/5511993436267?text=' + encodeURIComponent('Olá! Preenchi o formulário no site do Club OftalmoBlack e quero conversar com a equipe sobre minha clínica.');
          document.getElementById('success').hidden = false; document.getElementById('success-title').focus({preventScroll:true});
          document.getElementById('home-profile').scrollIntoView({block:'start',behavior:'instant'});
        } catch { telemetry('error', { error_type: controller.signal.aborted ? 'timeout' : 'unconfirmed' }); showMessage('Não foi possível confirmar o recebimento. Suas respostas foram mantidas. Toque em enviar para tentar novamente.'); }
        finally { clearTimeout(timer); sending = false; if (!received) { fields.disabled = false; button.textContent = 'Enviar minhas respostas'; form.removeAttribute('aria-busy'); } }
      });
      render(false);
      button.disabled = false;
    })();
