import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/signdex/worker.mjs';
import { openDatabase } from '../server/signdex/sqlite-adapter.mjs';
const origin = 'https://portfolio.example';
const admin = 'a-long-test-admin-token';
const model = globalThis.SignDexModel;
const valid = (overrides = {}) => ({id:crypto.randomUUID(),name:'Alex O’Connor',work:'CS student',city:'Plano',message:'A lovely portfolio!',pokemon:'pikachu',game:'emerald',series:'xy',consent:true,...overrides});
function setup(t) {
  const DB = openDatabase();t.after(() => DB.close());
  const env = {DB,ALLOWED_ORIGINS:origin,RATE_LIMIT_SALT:'test-salt-is-not-a-production-secret',ADMIN_TOKEN:admin,ENVIRONMENT:'production'};
  const call = (path,method = 'GET',body,headers = {}) => worker.fetch(new Request('https://api.example' + path,{method,headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1',...(body !== undefined ? {'Content-Type':'application/json'} : {}),...headers},...(body !== undefined ? {body:JSON.stringify(body)} : {})}),env);
  return {DB,env,call};
}
test('catalogue and answer-based card themes are complete and deterministic',() => {
  assert.equal(globalThis.SignDexPokemon.length,1025);
  assert.equal(model.theme(valid()).pokemon.type,'electric');
  assert.equal(model.theme(valid({pokemon:'charizard'})).pokemon.type,'fire');
  assert.equal(model.theme(valid()).game.region,'Hoenn');
  assert.equal(model.theme(valid()).title,'Kalos challenger');
  const entry = valid();assert.deepEqual(model.theme(entry),model.theme(entry));
  assert.notEqual(model.theme(entry).seed,model.theme({...entry,id:crypto.randomUUID()}).seed);
});
test('required/optional fields and targeted offensive-language checks',() => {
  assert.deepEqual(model.validate(valid({work:'',city:'',message:''})).errors,{});
  for (const key of ['name','pokemon','game','series','consent']) assert(model.validate(valid({[key]:key === 'consent' ? false : ''})).errors[key]);
  for (const word of ['f u c k','sh1t','s.h.i.t','f\u200buck','FÜÇK','kill yourself','you are worthless']) assert(model.isDisrespectful(word),word);
  for (const phrase of ['Scunthorpe','Class of 2030','Bass player','Dickinson College','A lovely hello']) assert.equal(model.isDisrespectful(phrase),false,phrase);
  for (const key of ['name','work','city','message']) assert(model.validate(valid({[key]:'you suck'})).errors[key]);
  assert(model.validate(valid({name:'x'.repeat(41)})).errors.name);
  assert(model.validate(valid({message:'<img src=x onerror=alert(1)>'})).errors.message);
  assert(model.validate(valid({work:'https://spam.example'})).errors.work);
  assert(model.validate(valid({pokemon:'not-a-species',game:'invented',series:'invented'})).errors.pokemon);
});
test('signatures stay private until review, then appear across clients; reject/delete work',async t => {
  const {call} = setup(t);const entry = valid();
  let response = await call('/signatures','POST',entry);assert.equal(response.status,202);
  assert.equal((await (await call('/signatures')).json()).entries.length,0);
  assert.equal((await call('/admin/signatures')).status,401);
  const auth = {Authorization:`Bearer ${admin}`};
  let list = await (await call('/admin/signatures','GET',undefined,auth)).json();assert.equal(list.entries[0].name,entry.name);
  assert.equal((await call(`/admin/signatures/${entry.id}`,'PATCH',{status:'approved'},auth)).status,200);
  list = await (await call('/signatures','GET',undefined,{'CF-Connecting-IP':'192.0.2.2'})).json();
  assert.equal(list.entries[0].id,entry.id);assert.equal(list.total,1);
  assert.equal(list.entries[0].status,undefined);assert.equal(list.entries[0].consent_version,undefined);
  await call(`/admin/signatures/${entry.id}`,'PATCH',{status:'rejected'},auth);
  assert.equal((await (await call('/signatures')).json()).entries.length,0);
  await call(`/admin/signatures/${entry.id}`,'DELETE',undefined,auth);
  assert.equal((await call(`/admin/signatures/${entry.id}`,'PATCH',{status:'approved'},auth)).status,404);
});
test('server validates independently, restricts origins, bounds payloads, and rejects bot fields',async t => {
  const {call,env} = setup(t);
  assert.equal((await call('/signatures','POST',valid({name:'f u c k'}))).status,422);
  assert.equal((await call('/signatures','POST',valid({consent:false}))).status,422);
  assert.equal((await call('/signatures','POST',valid({website:'spam'}))).status,400);
  assert.equal((await call('/signatures','POST',valid(),{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('/signatures','POST',valid(),{Origin:''})).status,403);
  assert.equal((await call('/signatures','POST',valid({message:'x'.repeat(5000)}))).status,413);
  assert.equal((await call('/signatures','POST',valid(),{'Content-Type':'text/plain'})).status,415);
  assert.equal((await call('/signatures','POST',null)).status,400);
  assert.equal((await call('/admin/signatures','GET',undefined,{Authorization:'Bearer wrong'})).status,401);
  const preflight = await call('/signatures','OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const broken = await worker.fetch(new Request('https://api.example/signatures'),{...env,DB:null});assert.equal(broken.status,503);
  const malformed = await worker.fetch(new Request('https://api.example/signatures',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{'}),env);assert.equal(malformed.status,400);
});
test('idempotent retries do not duplicate entries; durable rate limit is enforced',async t => {
  const {call,DB} = setup(t);const entry = valid();
  assert.equal((await call('/signatures','POST',entry)).status,202);
  for (let i=0;i<8;i++) assert.equal((await call('/signatures','POST',entry)).status,202);
  assert.equal((await call('/signatures','POST',{...entry,name:'Different'})).status,409);
  for (let i=0;i<4;i++) assert.equal((await call('/signatures','POST',valid())).status,202);
  const blocked = await call('/signatures','POST',valid());assert.equal(blocked.status,429);assert.equal(blocked.headers.get('Retry-After'),'3600');
  assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM signatures').first()).count,5);
  const limit = await DB.prepare('SELECT key FROM rate_limits').first();assert.match(limit.key,/^[0-9a-f]{64}$/);assert(!limit.key.includes('192.0.2.1'));
  assert.equal((await call('/signatures','POST',valid(),{'CF-Connecting-IP':'192.0.2.2'})).status,202);
});
test('public pagination excludes pending and rejected rows without duplicating same-time entries',async t => {
  const {call,DB} = setup(t);
  for (let i=0;i<17;i++) {
    const entry = valid();
    await DB.prepare('INSERT INTO signatures (id,name,pokemon,game,series,status,created_at,consent_version) VALUES (?,?,?,?,?,?,?,?)').bind(entry.id,entry.name,entry.pokemon,entry.game,entry.series,i === 16 ? 'pending' : i === 15 ? 'rejected' : 'approved','2026-09-22T12:00:00.000Z','public-v1').run();
  }
  const first = await (await call('/signatures')).json();assert.equal(first.total,15);assert.equal(first.entries.length,12);assert(first.next);
  const second = await (await call('/signatures?before=' + encodeURIComponent(first.next))).json();assert.equal(second.entries.length,3);assert.equal(second.next,null);
  assert.equal(new Set([...first.entries,...second.entries].map(entry=>entry.id)).size,15);
  assert.equal((await call('/signatures?before=invalid')).status,400);
});
