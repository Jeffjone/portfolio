(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const encounter = document.getElementById('encounter');
  const portfolio = document.getElementById('portfolio');
  const panels = [...document.querySelectorAll('.game-panel')];
  const dialog = document.getElementById('game-dialog');
  const labels = { home: 'PALLET? NOPE. PLANO, TX.', projects: 'PROJECT LAB / THE PROJECT DEX', experience: 'ROUTE 002 / QUEST LOG', awards: 'BADGE GYM / BATTLE RECORD', skills: 'TRAINING GROUND / MOVE SET', room: 'HOME / OFF-DUTY SIDE QUESTS', signdex: 'VISITOR’S GUILD / SIGNDEX' };
  let entered = false;
  let opening = false;
  let toastTimer;
  let sound = false;
  let audio;
  let previousFocus;

  function beep() {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(660, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audio.currentTime + .06);
      gain.gain.setValueAtTime(.025, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .09);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + .1);
    } catch { /* Audio is optional; browser restrictions must not block navigation. */ }
  }
  function toast(message) {
    const element = document.getElementById('game-toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
  }
  function openDialog(label, content) {
    previousFocus = document.activeElement;
    document.getElementById('dialog-label').textContent = label;
    document.getElementById('dialog-content').replaceChildren(content);
    dialog.showModal();
  }
  function showPanel(id, focus = true) {
    if (!labels[id]) id = 'home';
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    document.querySelectorAll('[data-route]').forEach(link => {
      if (link.dataset.route === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.getElementById('location-label').textContent = labels[id];
    if (focus && entered) {
      const heading = document.querySelector(`#${id} h1, #${id} h2`);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      document.getElementById('game-content').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    document.dispatchEvent(new CustomEvent('game:navigate', { detail: id }));
  }
  function currentRoute() {
    const hash = location.hash.slice(1);
    return ({ top: 'home', about: 'room' })[hash] || hash || 'home';
  }
  window.PortfolioGame = { toast, openDialog, beep };
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => previousFocus?.focus({ preventScroll: true }));
  document.getElementById('sound-toggle').addEventListener('click', event => {
    sound = !sound;
    event.currentTarget.textContent = `Sound: ${sound ? 'ON' : 'OFF'}`;
    event.currentTarget.setAttribute('aria-pressed', String(sound));
  });
  document.addEventListener('click', event => {
    if (event.target.closest('button, a')) beep();
    const link = event.target.closest('[data-route]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const route = link.dataset.route;
    if (location.hash !== `#${route}`) history.pushState(null, '', `#${route}`);
    showPanel(route);
  });
  window.addEventListener('hashchange', () => showPanel(currentRoute()));
  window.addEventListener('popstate', () => showPanel(currentRoute()));
  showPanel(currentRoute(), false);
  document.body.classList.add('js-enabled', 'encounter-active');
  encounter.hidden = false;
  portfolio.inert = true;
  document.getElementById('enter-portfolio').addEventListener('click', event => {
    if (opening) return;
    opening = true;
    event.currentTarget.setAttribute('aria-disabled', 'true');
    document.getElementById('encounter-status').textContent = 'WELCOME, TRAINER. YOUR ADVENTURE STARTS HERE.';
    encounter.classList.add('is-opening');
    setTimeout(() => {
      encounter.hidden = true;
      portfolio.inert = false;
      entered = true;
      document.body.classList.remove('encounter-active');
      document.body.classList.add('portfolio-entered');
      showPanel(currentRoute());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, reducedMotion.matches ? 0 : 1600);
  });
})();
