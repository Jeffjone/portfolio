(() => {
  'use strict';
  const model = globalThis.SignDexModel;
  const form = document.getElementById('signdex-form');
  const submit = document.getElementById('signature-submit');
  const result = document.getElementById('signature-result');
  const bookStatus = document.getElementById('signature-book-status');
  const connection = document.getElementById('signdex-connection');
  const refresh = document.getElementById('signature-refresh');
  const more = document.getElementById('signature-more');
  const entries = document.getElementById('signature-entries');
  const fields = Object.fromEntries(['name','work','city','pokemon','game','series','message','consent'].map(key => [key,document.getElementById(`signature-${key}`)]));
  const freshId = () => crypto.randomUUID();
  let edition = freshId(), pending = false, sending = false, lastAttempt = null, next = null, loading = false, loaded = false;
  let api = '', configError = false;
  const configured = globalThis.SignDexConfig?.apiBase || '';
  if (configured) {
    try {
      const url = new URL(configured,location.href);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Invalid API');
      if (url.username || url.password || url.search || url.hash) throw new Error('Invalid API');
      api = url.href.replace(/\/$/,'');
    } catch { configError = true; }
  }
  const element = (tag,text,className) => {
    const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node;
  };
  const pokemonByName = new Map();
  const options = document.createDocumentFragment();
  for (const pokemon of globalThis.SignDexPokemon) {
    pokemonByName.set(model.normalize(pokemon.name).toLowerCase(),pokemon.id);
    pokemonByName.set(pokemon.id,pokemon.id);
    const option = element('option'); option.value = pokemon.name; options.append(option);
  }
  document.getElementById('signdex-pokemon-options').append(options);
  for (const [key,list] of [['game',model.games],['series',model.series]]) {
    list.forEach(item => { const option = element('option',item.name);option.value = item.id;fields[key].append(option); });
  }
  function readForm() {
    const value = Object.fromEntries(Object.entries(fields).map(([key,input]) => [key,key === 'consent' ? input.checked : input.value]));
    value.pokemon = pokemonByName.get(model.normalize(value.pokemon).toLowerCase()) || '';
    value.website = document.getElementById('signature-website').value;
    return value;
  }
  function card(entry,label) {
    const theme = model.theme(entry);
    const article = element('article',null,`signature-card signature-pattern-${theme.pattern}`);
    article.dataset.edition = entry.id;
    article.style.setProperty('--signature-paper',theme.paper); article.style.setProperty('--signature-ink',theme.ink);
    article.style.setProperty('--signature-tilt',`${(theme.seed % 5) - 2}deg`);
    const top = element('div',null,'signature-card-top');
    top.append(element('span','SIGNDEX / TRAINER SIGNATURE'),element('span',label));
    const art = element('div',null,'signature-card-art');
    const seal = element('div',null,'signature-seal'); seal.setAttribute('aria-hidden','true');
    let bits = theme.seed || 1;
    const cells = Array.from({length:7},() => Array(7).fill(false));
    for (let row = 0; row < 7; row++) for (let col = 0; col < 4; col++) {
      bits ^= bits << 13; bits ^= bits >>> 17; bits ^= bits << 5;
      cells[row][col] = cells[row][6-col] = (bits >>> 0) % 2 === 0;
    }
    cells.flat().forEach(filled => seal.append(element('i',null,filled ? 'filled' : '')));
    const partner = element('div',null,'signature-partner');
    partner.append(element('strong',`${theme.symbol} ${theme.pokemon.name}`),element('span',`№ ${String(theme.pokemon.number).padStart(3,'0')} · ${theme.pokemon.type.toUpperCase()}`));
    art.append(seal,partner);
    const body = element('div',null,'signature-card-body');
    body.append(element('h4',entry.name || 'Your trainer name','signature-name'),element('div',theme.title,'signature-title'));
    if (entry.work) body.append(element('p',entry.work,'signature-bio'));
    if (entry.city) body.append(element('p',`⌂ ${entry.city}`,'signature-bio'));
    const favorites = element('dl',null,'signature-favorites');
    favorites.append(element('dt',`FAVORITE GAME / ${theme.game.region.toUpperCase()}`),element('dd',theme.game.name),element('dt','FAVORITE ANIMATED SERIES'),element('dd',theme.show.name));
    body.append(favorites);
    if (entry.message) body.append(element('p',entry.message,'signature-message'));
    const bottom = element('div',null,'signature-card-bottom');
    if (entry.created_at && Number.isFinite(Date.parse(entry.created_at))) {
      const time = element('time',new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(entry.created_at)));
      time.dateTime = entry.created_at; bottom.append(time);
    }
    bottom.append(element('span',`EDITION ${entry.id}`));
    article.append(top,art,body,bottom);
    return article;
  }
  function preview() {
    const value = readForm();
    for (const key of Object.keys(model.limits)) if (model.isDisrespectful(value[key])) value[key] = 'Please edit this field';
    const sample = { ...value, id:edition, pokemon:value.pokemon || 'pikachu', game:value.game || 'new', series:value.series || 'new' };
    document.getElementById('signature-preview').replaceChildren(card(sample,pending ? 'PENDING REVIEW' : 'PREVIEW'));
    document.getElementById('signature-characters').textContent = `${[...fields.message.value].length} / 200`;
  }
  function showErrors(errors) {
    for (const [key,input] of Object.entries(fields)) {
      document.getElementById(`error-${key}`).textContent = errors[key] || '';
      if (errors[key]) input.setAttribute('aria-invalid','true'); else input.removeAttribute('aria-invalid');
    }
    const key = Object.keys(fields).find(name => errors[name]);
    if (key) fields[key].focus();
  }
  async function request(path,options = {}) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),10000);
    try {
      const response = await fetch(api + path,{ ...options,signal:controller.signal });
      const data = await response.json();
      if (!response.ok) throw { message:data.error || 'SignDex is unavailable. Please try again.', fields:data.fields };
      return data;
    } catch (error) {
      if (error.fields || (error.message && !(error instanceof Error))) throw error;
      throw { message:'SignDex could not be reached. Your details are still here; try again when the connection returns.' };
    } finally { clearTimeout(timeout); }
  }
  async function loadBook(append = false) {
    if (!api || loading) return;
    loading = true; refresh.disabled = true; more.disabled = true;
    bookStatus.textContent = 'Opening the signature book…';
    try {
      const data = await request('/signatures' + (append && next ? '?before=' + encodeURIComponent(next) : ''));
      if (!Array.isArray(data.entries) || !Number.isInteger(data.total) || data.total < 0) throw { message:'The book could not be read. Please try again.' };
      const cards = document.createDocumentFragment();
      for (const entry of data.entries) {
        if (typeof entry.id !== 'string' || Object.keys(model.validate({...entry,consent:true}).errors).length) continue;
        cards.append(card(entry,'SIGNED'));
      }
      if (!append) entries.replaceChildren();
      entries.append(cards);
      next = typeof data.next === 'string' ? data.next : null;
      more.hidden = !next;
      bookStatus.textContent = data.total ? `${data.total} approved signature${data.total === 1 ? '' : 's'} · Showing ${entries.children.length}.` : 'The first page is waiting for a trainer. Leave the first signature!';
      loaded = true;
    } catch (error) { bookStatus.textContent = error.message; }
    finally { loading = false; refresh.disabled = false; more.disabled = false; }
  }
  function inputChanged(event) {
    if (sending) return;
    if (pending) { pending = false; edition = freshId(); result.textContent = 'You’re creating a new signature. Your previous submission is still awaiting review.'; }
    const value = readForm();
    if (lastAttempt && JSON.stringify(value) !== lastAttempt) { edition = freshId(); lastAttempt = null; }
    submit.disabled = configError;
    submit.textContent = api ? '✎ Sign the book' : 'Check my signature';
    if (event.target.name && fields[event.target.name]) {
      document.getElementById(`error-${event.target.name}`).textContent = '';
      event.target.removeAttribute('aria-invalid');
    }
    preview();
  }
  form.addEventListener('input',inputChanged);
  form.addEventListener('change',inputChanged);
  form.addEventListener('submit',async event => {
    event.preventDefault(); if (sending || pending || configError) return;
    const raw = readForm(); const { value,errors } = model.validate(raw);
    showErrors(errors);
    if (Object.keys(errors).length) { result.textContent = 'A few details need attention before you can sign.'; return; }
    if (!api) { result.textContent = 'Your signature is ready to preview. Nothing was saved or shared: the public book is not connected yet.'; result.focus(); return; }
    sending = true; submit.disabled = true; submit.textContent = 'Sending your signature…';
    // Freeze the form until the request settles, so the receipt always matches the submitted preview.
    const controls = [...form.querySelectorAll('input,select,textarea')]; controls.forEach(control => { control.disabled = true; });
    lastAttempt = JSON.stringify(raw);
    try {
      const receipt = await request('/signatures',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,id:edition,website:raw.website}) });
      if (receipt.id !== edition || receipt.status !== 'pending-review') throw { message:'The receipt could not be confirmed. Try again; duplicate submissions are protected.' };
      pending = true;
      result.textContent = 'Signature received! Your card is awaiting review and will appear in the public book after approval. Keep your edition ID if you need to request removal.';
      submit.textContent = '✓ Received · awaiting review';
      preview(); result.focus();
    } catch (error) {
      result.textContent = error.message;
      // Re-enable first so invalid fields can receive focus.
      controls.forEach(control => { control.disabled = false; });
      if (error.fields) showErrors(error.fields);
      submit.textContent = 'Try signing again';
    } finally {
      sending = false; submit.disabled = pending; controls.forEach(control => { control.disabled = false; });
    }
  });
  refresh.addEventListener('click',() => loadBook());
  more.addEventListener('click',() => loadBook(true));
  document.addEventListener('game:navigate',event => { if (event.detail === 'signdex' && !loaded) loadBook(); });
  if (api) {
    connection.textContent = 'The guestbook is shared with other visitors. New signatures appear after review; your preview stays private until then.';
    submit.textContent = '✎ Sign the book'; refresh.disabled = false;
    if (location.hash === '#signdex') loadBook();
  } else {
    connection.textContent = configError ? 'The shared book is temporarily unavailable. Please try again later.' : 'Preview mode: design your signature below. The shared guestbook is not connected yet, so nothing will be submitted or published.';
    submit.textContent = configError ? 'SignDex unavailable' : 'Check my signature';
    bookStatus.textContent = 'No public signatures are available until the shared book is connected.';
  }
  submit.disabled = configError;
  preview();
})();
