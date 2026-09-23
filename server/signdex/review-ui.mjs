export const reviewHTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SignDex · Review desk</title><link rel="stylesheet" href="./review/style.css"><script src="./review/app.js" defer></script></head>
<body><header><a href="./review" class="brand">✎ SIGNDEX <span>REVIEW DESK</span></a><a href="/cdn-cgi/access/logout" class="logout">Sign out</a></header><main><div class="intro"><p class="eyebrow">TRAINER MAIL / PRIVATE</p><h1>Your trainer mail awaits.</h1><p>Read each signature, then decide who joins the guestbook.</p><p id="identity" class="identity">Checking your session…</p></div><div class="toolbar"><nav aria-label="Signature status"><button data-status="pending" aria-pressed="true">Pending</button><button data-status="approved" aria-pressed="false">Approved</button><button data-status="rejected" aria-pressed="false">Rejected</button></nav><button id="refresh">↻ Refresh</button></div><p id="notice" role="status">Opening the inbox…</p><p id="notification-state"></p><section id="focus-entry" hidden aria-label="Signature from your email"></section><div id="entries" class="entries"></div><button id="more" hidden>Load more</button><p id="empty" hidden>No signatures here. You’re all caught up!</p></main><dialog id="delete-dialog" aria-labelledby="delete-title"><h2 id="delete-title">Delete this signature?</h2><p>This permanently removes it from the guestbook. Rejection hides it without deleting it.</p><div class="actions"><button id="delete-cancel">Keep signature</button><button id="delete-confirm" class="danger">Delete permanently</button></div></dialog><footer>Only your approved email can access this desk. Entries stay private until you approve them.</footer></body></html>`;
export const reviewCSS = `
:root{--ink:#302b3b;--purple:#6e5885;--paper:#fffdf4;--soft:#e8dfee}*{box-sizing:border-box}body{margin:0;background:#eeebdf;color:var(--ink);font:15px/1.6 system-ui,sans-serif;background-image:radial-gradient(#afa49d33 1px,transparent 1px);background-size:8px 8px}a{color:inherit}header,main,footer{max-width:1100px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #302b3b30;gap:15px}.brand{font:bold 18px monospace;text-decoration:none}.brand span{font:12px monospace;background:var(--soft);padding:7px}.logout{font-size:13px}.eyebrow{font:13px monospace;letter-spacing:2px;color:var(--purple)}h1{font:700 clamp(25px,4vw,42px)/1.3 monospace;letter-spacing:-1.5px}p{color:#655d6d}.identity{font:13px monospace;color:var(--purple)}button{font:600 14px system-ui;cursor:pointer;min-height:44px;padding:10px 16px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);box-shadow:3px 3px #302b3b25}button:disabled{opacity:.55;cursor:wait}button:hover:not(:disabled){background:var(--soft)}button:focus-visible,a:focus-visible{outline:3px solid #9266c6;outline-offset:4px}.toolbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:30px 0 20px}nav{display:flex;flex-wrap:wrap;gap:10px}button[aria-pressed=true],.approve{background:#d9c7e8}#notice{min-height:24px}#notification-state{font-size:12px}#focus-entry{border:2px dashed var(--purple);padding:18px;margin:24px 0}.entries{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.card{border:2px solid var(--ink);background:var(--paper);box-shadow:4px 4px #302b3b25;min-width:0}.card-head{background:var(--soft);padding:10px 18px;display:flex;justify-content:space-between;font:13px monospace;border-bottom:2px solid var(--ink)}.card-body{padding:22px}.card h2{font:italic 30px Georgia,serif;margin:0 0 10px;overflow-wrap:anywhere}.meta{font-size:13px;margin:4px 0;overflow-wrap:anywhere}.preferences{border-top:1px dashed #b4a1c5;margin-top:18px;padding-top:8px}.preferences dt{font:12px monospace;color:var(--purple);margin-top:12px}.preferences dd{margin:5px 0;font-size:14px;overflow-wrap:anywhere}.message{padding:14px;background:#ece5f1;white-space:pre-wrap;overflow-wrap:anywhere}.edition{font:11px monospace;overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.danger{color:#972e43}.error{color:#972e43!important}.success{color:#3e6b42!important}#empty{padding:35px;border:2px dashed #b4a1c5;text-align:center}#more{margin-top:24px}footer{font-size:12px;border-top:2px solid #302b3b20;margin-top:30px}dialog{max-width:450px;width:calc(100% - 32px);border:2px solid var(--ink);background:var(--paper);padding:24px}dialog::backdrop{background:#302b3ba0}[hidden]{display:none!important}@media(max-width:650px){header,main,footer{padding:20px}.entries{grid-template-columns:1fr}.brand span{display:none}h1{font-size:26px}.actions button{flex:1}.toolbar{gap:18px}}`;
export const reviewJS = String.raw`
(() => {
  const api = new URL('./review/api/',location.href);
  const entries = document.getElementById('entries'), notice = document.getElementById('notice');
  const refresh = document.getElementById('refresh'), more = document.getElementById('more');
  const focusEntry = document.getElementById('focus-entry');
  let status = 'pending', next = null, loading = false, mutating = false, generation = 0, deleteTarget = null;
  const focusId = new URL(location.href).searchParams.get('entry');
  const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  async function request(path,options={}) {
    let response;
    try { response=await fetch(new URL(path,api),{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-SignDex-Action':'review',...options.headers},signal:AbortSignal.timeout(15000)}); }
    catch { throw new Error('Could not reach SignDex. Your entry has not been removed from this view. Try Refresh.'); }
    if (response.redirected || !(response.headers.get('content-type')||'').includes('application/json')) throw new Error('Your session needs to be refreshed. Reload this page to sign in again.');
    const data=await response.json();if(!response.ok)throw new Error(data.error||'The action could not be completed.');return data;
  }
  function message(text,error=false){notice.textContent=text;notice.className=error?'error':'success';}
  function render(entry){
    const card=element('article',null,'card');card.dataset.id=entry.id;
    const head=element('div',null,'card-head');head.append(element('span',entry.status.toUpperCase()),element('time',new Date(entry.created_at).toLocaleDateString()));
    const body=element('div',null,'card-body');body.append(element('h2',entry.name));
    if(entry.work)body.append(element('p',entry.work,'meta'));if(entry.city)body.append(element('p',entry.city,'meta'));
    const preferences=element('dl',null,'preferences');
    for(const [label,value] of [['FAVORITE POKÉMON',entry.theme.pokemon.name],['FAVORITE GAME',entry.theme.game.name],['FAVORITE SERIES',entry.theme.show.name]])preferences.append(element('dt',label),element('dd',value));
    body.append(preferences);if(entry.message)body.append(element('p',entry.message,'message'));
    body.append(element('p','Edition '+entry.id,'edition'));
    const actions=element('div',null,'actions');
    for(const [label,action,cls] of [['Approve','approved','approve'],['Reject','rejected',''],['Delete','delete','danger']]){
      if(entry.status===action)continue;const button=element('button',label,cls);
      button.addEventListener('click',()=>{if(mutating||loading)return;if(action==='delete'){deleteTarget=entry;document.getElementById('delete-dialog').showModal();document.getElementById('delete-cancel').focus();}else update(entry,action);});actions.append(button);
    }
    body.append(actions);card.append(head,body);return card;
  }
  async function loadFocus(){
    if(!focusId || !/^[0-9a-f-]{36}$/i.test(focusId))return;
    focusEntry.hidden=false;
    try {const data=await request('signatures/'+focusId);focusEntry.replaceChildren(element('p','FROM YOUR EMAIL', 'eyebrow'),render(data.entry));}
    catch(error){focusEntry.replaceChildren(element('p',error.message));}
  }
  async function load(append=false){
    if(loading)return;loading=true;refresh.disabled=true;more.disabled=true;const current=++generation;
    message('Loading signatures…');
    try {
      const data=await request('signatures?status='+status+(append&&next?'&after='+encodeURIComponent(next):''));if(current!==generation)return;
      if(!append)entries.replaceChildren();data.entries.forEach(entry=>entries.append(render(entry)));
      next=data.next||null;more.hidden=!next;document.getElementById('empty').hidden=entries.children.length>0;
      message(entries.children.length+' '+status+' signature'+(entries.children.length===1?'':'s')+' shown.');
    }catch(error){message(error.message,true);}finally{loading=false;refresh.disabled=false;more.disabled=false;}
  }
  async function update(entry,action){
    if(mutating||loading)return;mutating=true;
    document.querySelectorAll('.actions button').forEach(button=>{button.disabled=true;});
    try {
      await request('signatures/'+entry.id,{method:action==='delete'?'DELETE':'PATCH',...(action==='delete'?{}:{body:JSON.stringify({status:action,expectedStatus:entry.status})})});
      await load();await loadFocus();message(action==='approved'?'Approved. This signature is now in the public guestbook.':action==='rejected'?'Rejected. This signature is hidden from the public book.':'Signature permanently deleted.');
    }catch(error){message(error.message,true);}finally{mutating=false;document.querySelectorAll('.actions button').forEach(button=>{button.disabled=false;});}
  }
  document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{
    if(loading||mutating)return;status=button.dataset.status;next=null;
    document.querySelectorAll('[data-status]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));load();
  }));
  refresh.addEventListener('click',async()=>{if(mutating)return;await load();await loadFocus();});more.addEventListener('click',()=>{if(!mutating)load(true);});
  document.getElementById('delete-cancel').addEventListener('click',()=>document.getElementById('delete-dialog').close());
  document.getElementById('delete-confirm').addEventListener('click',()=>{document.getElementById('delete-dialog').close();if(deleteTarget)update(deleteTarget,'delete');});
  (async()=>{try{const session=await request('session');document.getElementById('identity').textContent='Signed in as '+session.email;
    document.getElementById('notification-state').textContent=session.notifications?'Email alerts are enabled.':'Email alerts are not configured yet. You can review all entries here.';
    await load();await loadFocus();}catch(error){message(error.message,true);document.getElementById('identity').textContent='Sign-in required';}})();
})();`;
