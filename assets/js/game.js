(() => {
  'use strict';
  const { openDialog, toast } = window.PortfolioGame;
  const storageKey = 'jeffrey-project-dex-v1';
  const cards = [...document.querySelectorAll('.project-card')];
  const projects = cards.map((card, index) => ({
    id: String(index + 1), title: card.querySelector('h3').textContent,
    description: card.querySelector('p').textContent,
    chips: [...card.querySelectorAll('.chip')].map(chip => chip.textContent), card,
  }));
  let caught = new Set();
  let canSave = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) caught = new Set(saved.filter(id => projects.some(project => project.id === id)));
  } catch { canSave = false; }

  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function content(title) {
    const wrapper = node('div');
    const heading = node('h2', title); heading.id = 'dialog-title';
    wrapper.append(heading);
    return wrapper;
  }
  function updateDex() {
    document.querySelectorAll('[data-catch-count]').forEach(el => { el.textContent = `${caught.size} / 4`; });
    projects.forEach(project => {
      project.card.classList.toggle('caught', caught.has(project.id));
      project.card.querySelector('button').textContent = caught.has(project.id) ? '✓ View Dex entry' : 'Inspect encounter →';
    });
    document.getElementById('save-status').textContent = canSave ? 'Saved on this device.' : 'Storage unavailable. Progress lasts for this visit.';
  }
  function catchProject(project) {
    caught.add(project.id);
    try { localStorage.setItem(storageKey, JSON.stringify([...caught])); } catch { canSave = false; }
    updateDex();
    toast(caught.size === 4 ? 'Dex complete! You caught ’em all. Hire this trainer?' : `Gotcha! ${project.title} was added to your Dex.`);
  }
  document.querySelectorAll('[data-project-id]').forEach(button => button.addEventListener('click', () => {
    const project = projects.find(item => item.id === button.dataset.projectId);
    const wrapper = content(project.title);
    wrapper.prepend(node('div', `WILD PROJECT № 00${project.id} APPEARED!`, 'dialog-kicker'));
    wrapper.append(node('p', project.description));
    const chips = node('div', '', 'chips');
    project.chips.forEach(chip => chips.append(node('span', chip, 'chip')));
    wrapper.append(chips, node('p', 'It used PROBLEM SOLVING. It’s super effective!'));
    const catchButton = node('button', caught.has(project.id) ? '✓ Already in your Dex' : '◉ Catch this project', 'game-button primary');
    catchButton.disabled = caught.has(project.id);
    catchButton.addEventListener('click', () => {
      catchProject(project); catchButton.textContent = '✓ Added to your Dex'; catchButton.disabled = true;
      wrapper.append(node('p', 'Entry saved. Another curious encounter awaits.', 'feedback'));
    });
    wrapper.append(catchButton);
    openDialog('PROJECT ENCOUNTER', wrapper);
  }));
  document.querySelectorAll('.filter').forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(other => {
        other.classList.toggle('active', other === button);
        other.setAttribute('aria-pressed', String(other === button));
      });
      cards.forEach(card => card.classList.toggle('hidden-card', button.dataset.filter !== 'all' && !card.dataset.category.split(' ').includes(button.dataset.filter)));
    });
  });

  document.querySelectorAll('[data-profile]').forEach(button => button.addEventListener('click', () => {
    const wrapper = content('It’s Jeffrey!');
    const layout = node('div', '', 'profile-layout');
    const portrait = node('img'); portrait.src = 'assets/images/jeffrey-portrait.jpg'; portrait.alt = 'Jeffrey Jone smiling, wearing glasses and a navy suit'; portrait.width = 160; portrait.height = 160;
    const bio = node('div');
    bio.append(node('div', 'DEVELOPER / RESEARCHER / COMPETITOR', 'dialog-kicker'), node('p', 'I’m Jeffrey, a CS² Honors student at UT Dallas with a 4.0 GPA. I build software systems, work on machine learning, and research computational biomechanics.'), node('p', 'Away from the keyboard: boxing, soccer, astronomy, sketching, and a good mountain trail.'));
    const link = node('a', 'Open trainer résumé ↗', 'game-button'); link.href = 'assets/documents/Resume.pdf'; link.target = '_blank'; link.rel = 'noopener'; bio.append(link);
    layout.append(portrait, bio); wrapper.append(layout);
    openDialog('8-BIT → REAL-LIFE TRAINER', wrapper);
  }));

  const dialogues = [
    'Hey, trainer! I’m a CS² Honors student at UT Dallas. I build software, train models, and occasionally touch grass. The tall kind, obviously.',
    'Professor Oak gave you a Pokédex. I gave you a Project Dex. Mine has fewer dragons, but significantly more C++.',
    'There are four projects to catch. No random encounters, no grinding, and absolutely no 1% drop rates.',
    'Need a break from the main quest? Visit My Room for music, hobbies, and a quick look at the weather back home.',
    'Click my pixel portrait to meet the real trainer. Yes, the glasses survived the 8-bit conversion.'
  ];
  let dialogueIndex = 0;
  document.getElementById('next-dialogue').addEventListener('click', () => {
    dialogueIndex = (dialogueIndex + 1) % dialogues.length;
    document.getElementById('welcome-dialogue').textContent = dialogues[dialogueIndex];
  });
  const clues = [
    'I see with LiDAR, learn with reinforcement learning, and really prefer not to fly into walls.',
    'No internet? No problem. I relay encrypted messages between devices when networks are down.',
    'I use numerical models to explore how spinal tumor growth and cardiovascular strain interact.',
    'I’m a React + Node.js platform built for neurodiversity research and education.'
  ];
  let question = 0;
  document.getElementById('quiz-open').addEventListener('click', () => {
    const wrapper = content('Who’s that project?');
    const mystery = node('div', '?', 'quiz-mystery'); mystery.setAttribute('aria-hidden', 'true');
    const clue = node('p', clues[question]);
    const options = node('div', '', 'quiz-options');
    const feedback = node('p', '', 'feedback'); feedback.setAttribute('role', 'status');
    const next = node('button', 'Next mystery →', 'game-button'); next.hidden = true;
    function renderQuestion() {
      mystery.textContent = '?'; clue.textContent = clues[question]; feedback.textContent = ''; next.hidden = true; options.replaceChildren();
      projects.forEach((project, index) => {
        const option = node('button', project.title, 'game-button');
        option.addEventListener('click', () => {
          if (index !== question) { feedback.textContent = 'Not quite! The wild project used EVASION. Try again.'; return; }
          mystery.textContent = '✓'; feedback.textContent = `It’s ${project.title}! Your curiosity is super effective.`;
          options.querySelectorAll('button').forEach(button => { button.disabled = true; }); next.hidden = false; next.focus();
        }); options.append(option);
      });
    }
    next.addEventListener('click', () => { question = (question + 1) % projects.length; renderQuestion(); options.querySelector('button').focus(); });
    renderQuestion(); wrapper.append(mystery, clue, options, feedback, next); openDialog('PORTFOLIO QUIZ / NO GRINDING REQUIRED', wrapper);
  });

  const badgeQuips = ['C++ used PRECISION. The competition was impressed.', 'An algorithm a day keeps the time-limit exceeded away.', 'Math used CRITICAL THINKING. A critical hit!', 'Research used PERSISTENCE. The results are still evolving.'];
  document.querySelectorAll('.award-feature').forEach((award, index) => {
    const button = node('button', 'Inspect badge →', 'game-button badge-action');
    button.addEventListener('click', () => {
      const wrapper = content(award.querySelector('h3').textContent);
      wrapper.append(node('div', award.querySelector('.award-rank').textContent, 'award-rank'), node('p', award.querySelector('p').textContent), node('p', badgeQuips[index], 'feedback'));
      openDialog('BADGE CASE / ACHIEVEMENT UNLOCKED', wrapper);
    }); award.lastElementChild.append(button);
  });
  const hobbyQuips = {
    'AI / ML': 'Teaching a model new tricks. Its recall is usually better than mine.',
    'Quant Finance': 'Charts, probabilities, and a healthy respect for uncertainty.',
    'Systems': 'Somewhere, a race condition is plotting its next move.',
    'Computational Physics': 'The universe has excellent mechanics. The documentation could use work.',
    'Astronomy': 'Stargazing: the original open-world exploration.',
    'Boxing': 'A different kind of hit detection. No keyboard shortcuts.',
    'Soccer': 'Teamwork, stamina, and occasionally blaming the terrain.',
    'Mountain Climbing': 'The side quest with the best draw distance.',
    'Sketching': 'Rendering, but the GPU is a pencil.',
    'Carpentry': 'Building things with zero dependencies. Some assembly required.'
  };
  document.querySelectorAll('.interest').forEach(interest => {
    const button = node('button', interest.textContent, 'interest'); interest.replaceWith(button);
    button.addEventListener('click', () => {
      const wrapper = content(button.textContent); wrapper.append(node('p', hobbyQuips[button.textContent] || 'A new side quest awaits.'));
      openDialog('SIDE QUEST DISCOVERED', wrapper);
    });
  });
  updateDex();
})();
