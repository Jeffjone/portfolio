const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const encounter = document.getElementById('encounter');
const portfolio = document.getElementById('portfolio');
const enterButton = document.getElementById('enter-portfolio');
let opening = false;

document.body.classList.add('js-enabled', 'encounter-active');
encounter.hidden = false;
portfolio.inert = true;

function finishEncounter() {
  encounter.hidden = true;
  portfolio.inert = false;
  document.body.classList.remove('encounter-active');
  document.body.classList.add('portfolio-entered');
  const destination = document.getElementById(window.location.hash.slice(1));
  document.getElementById('portfolio-heading').focus({ preventScroll: true });
  if (destination) destination.scrollIntoView({ behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
  startPortfolio();
}

enterButton.addEventListener('click', () => {
  if (opening) return;
  opening = true;
  enterButton.setAttribute('aria-disabled', 'true');
  document.getElementById('encounter-status').textContent = 'ENCOUNTER FOUND. WELCOME, TRAINER.';
  encounter.classList.add('is-opening');
  // A timer also completes the transition if CSS animations are interrupted.
  window.setTimeout(finishEncounter, reducedMotion.matches ? 0 : 1600);
});

document.getElementById('year').textContent = new Date().getFullYear();

const words = ['use move: BUILD', 'use move: RESEARCH', 'use move: LEARN'];
const target = document.getElementById('typed-command');
let wi = 0, ci = 0, deleting = false;
function typeLoop() {
  const word = words[wi];
  target.textContent = deleting ? word.slice(0, ci--) : word.slice(0, ci++);
  let delay = deleting ? 38 : 68;
  if (!deleting && ci === word.length + 1) { deleting = true; delay = 1050; }
  if (deleting && ci < 0) { deleting = false; ci = 0; wi = (wi + 1) % words.length; delay = 300; }
  setTimeout(typeLoop, delay);
}
function startPortfolio() {
  if (!reducedMotion.matches) typeLoop();
  else target.textContent = words[0];

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

const filters = document.querySelectorAll('.filter');
const cards = document.querySelectorAll('.project-card');
filters.forEach(btn => btn.addEventListener('click', () => {
  filters.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  cards.forEach(card => {
    const match = filter === 'all' || card.dataset.category.split(' ').includes(filter);
    card.classList.toggle('hidden-card', !match);
  });
}));

// Subtle psychic-energy cursor field.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (e) => {
    document.body.style.setProperty('--orb-x', `${e.clientX}px`);
    document.body.style.setProperty('--orb-y', `${e.clientY}px`);
  }, { passive: true });
}

// Optional glow mode.
const modeToggle = document.getElementById('mode-toggle');
modeToggle.addEventListener('click', () => {
  document.body.classList.toggle('psychic-mode');
  const on = document.body.classList.contains('psychic-mode');
  modeToggle.setAttribute('aria-pressed', String(on));
  modeToggle.title = on ? 'Disable psychic glow' : 'Enable psychic glow';
});

// Gentle tilt on project cards for a collectible-card feel.
if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(800px) rotateX(${-y * 3.5}deg) rotateY(${x * 4.5}deg) translateY(-3px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}
