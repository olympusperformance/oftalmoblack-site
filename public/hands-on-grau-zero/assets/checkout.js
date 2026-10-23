(() => {
  'use strict';
  const acquisition = new URLSearchParams(location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'aid', 'src', 'sck', 'fbclid', 'gclid', 'gbraid', 'wbraid'];
  const buttons = [...document.querySelectorAll('[data-checkout]')];
  const targets = new Map(buttons.map(button => [button, button.href]));
  const decorate = button => {
    const url = new URL(targets.get(button));
    for (const key of keys) {
      const value = acquisition.get(key);
      if (value && value.length <= 500) url.searchParams.set(key, value);
    }
    button.href = url.href;
  };
  for (const button of buttons) {
    decorate(button);
    button.addEventListener('click', () => {
      decorate(button);
      window.dispatchEvent(new CustomEvent('hands-on:checkout', {
        detail: { cta_location: button.dataset.ctaLocation }
      }));
    });
  }
  document.querySelector('[data-whatsapp]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('hands-on:contact'));
  });
})();
