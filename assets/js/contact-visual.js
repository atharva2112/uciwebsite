/* Contact visual: motion is opt-out, visibility-aware and never required to
   understand the illustration. No render loop or third-party dependencies. */
(() => {
  'use strict';
  const hero = document.querySelector('[data-contact-engineering]');
  if (!hero) return;
  const button = hero.querySelector('[data-ce-toggle]');
  const label = button.querySelector('[data-ce-toggle-label]');
  const symbol = button.querySelector('.ce-toggle-symbol');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let visible = true;
  const update = () => {
    const allowed = !reduced.matches && !navigator.webdriver;
    hero.classList.toggle('is-enhanced', allowed);
    hero.classList.toggle('is-running', allowed && !paused && visible && !document.hidden);
    button.hidden = !allowed;
    label.textContent = paused ? 'Play animation' : 'Pause animation';
    symbol.textContent = paused ? '▷' : 'Ⅱ';
  };
  button.addEventListener('click', () => { paused = !paused; update(); });
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { threshold: .05 }).observe(hero);
  }
  update();
})();
