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
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) typeLoop();
else target.textContent = words[0];

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

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
