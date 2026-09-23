import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import worker from '../server/signdex/worker.mjs';
import { openDatabase } from '../server/signdex/sqlite-adapter.mjs';
import { verifyReviewJWT, authenticateReview } from '../server/signdex/review-auth.mjs';
import { deliverNotifications, notificationPayload } from '../server/signdex/notifications.mjs';
const api='https://api.example', portfolio='https://portfolio.example';
const owner='joshj.jeffrey@gmail.com';
const valid=()=>({id:crypto.randomUUID(),name:'Review Trainer',pokemon:'pikachu',game:'emerald',series:'xy',consent:true});
const access={ACCESS_TEAM_DOMAIN:'https://test-team.cloudflareaccess.com',ACCESS_AUD:'review-audience',ADMIN_EMAIL:owner};
function setup(t) {
  const DB=openDatabase();t.after(()=>DB.close());
  const env={DB,...access,ALLOWED_ORIGINS:portfolio,RATE_LIMIT_SALT:'test-salt',ADMIN_TOKEN:'private-test-admin-token'};
  const ctx={access:{aud:access.ACCESS_AUD,async getIdentity(){return {email:owner,user_uuid:'owner-id'};}}};
  const call=(path,method='GET',body,headers={},context=ctx)=>worker.fetch(new Request(api+path,{method,headers:{Origin:path.startsWith('/review')?api:portfolio,'Content-Type':'application/json','X-SignDex-Action':'review',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,context);
  const submit=async()=>{const entry=valid();assert.equal((await call('/signatures','POST',entry)).status,202);return entry;};
  return {DB,env,ctx,call,submit};
}
test('JWT authentication verifies signature, issuer, audience, expiry, type and exact owner email',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='test-key';
  const keys=createLocalJWKSet({keys:[jwk]});
  const sign=(overrides={})=>new SignJWT({email:owner,type:'app',iss:access.ACCESS_TEAM_DOMAIN,aud:access.ACCESS_AUD,sub:'owner',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(privateKey);
  assert.deepEqual(await verifyReviewJWT(await sign(),access,keys),{email:owner,subject:'owner'});
  for(const override of [{email:'someone@example.com'},{aud:'another-app'},{iss:'https://evil.example'},{exp:1},{type:'service'},{email:null},{sub:null}])assert.equal(await verifyReviewJWT(await sign(override),access,keys),null);
  const token=await sign();assert.equal(await verifyReviewJWT(token.slice(0,-12)+'fakefakefake',access,keys),null);
  assert.equal(await authenticateReview(new Request(api,{headers:{'Cf-Access-Authenticated-User-Email':owner,Authorization:'Bearer private-test-admin-token'}}),access),null);
});
test('review routes fail closed, including assets and API; public signatures stay accessible',async t=>{
  const {call,env,ctx}=setup(t);
  for(const path of ['/review','/review/app.js','/review/style.css','/review/api/signatures']) {
    assert.equal((await call(path,'GET',undefined,{},{})).status,401);
    assert.equal((await call(path,'GET',undefined,{}, {access:{...ctx.access,aud:'wrong'}})).status,401);
    assert.equal((await call(path,'GET',undefined,{}, {access:{...ctx.access,async getIdentity(){return {email:'other@example.com'};}}})).status,401);
  }
  const page=await call('/review');assert.equal(page.status,200);assert.match(page.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(page.headers.get('Cache-Control'),'no-store');
  assert.equal(page.headers.get('Access-Control-Allow-Origin'),null);
  delete env.ACCESS_AUD;assert.equal((await call('/review')).status,503);
  assert.equal((await call('/signatures')).status,200);
});
test('review links only read; CSRF and stale decisions are refused; actions are audited',async t=>{
  const {call,submit,DB}=setup(t);const entry=await submit();const path='/review/api/signatures/'+entry.id;
  assert.equal((await call('/review?entry='+entry.id)).status,200);
  assert.equal((await (await call(path)).json()).entry.status,'pending');
  const body={status:'approved',expectedStatus:'pending'};
  assert.equal((await call(path,'PATCH',body,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call(path,'PATCH',body,{'X-SignDex-Action':''})).status,403);
  assert.equal((await call(path,'PATCH',{status:'approved'})).status,409);
  assert.equal((await call(path,'PATCH',body)).status,200);
  assert.equal((await call(path,'PATCH',{...body,status:'rejected'})).status,409);
  assert.equal((await (await call('/signatures')).json()).total,1);
  assert.equal((await DB.prepare('SELECT actor FROM moderation_events').first()).actor,owner);
  assert.equal((await call(path,'PATCH',{status:'rejected',expectedStatus:'approved'})).status,200);
  assert.equal((await (await call('/signatures')).json()).total,0);
  assert.equal((await call(path,'DELETE')).status,200);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM notification_outbox').first()).n,0);
  assert.equal((await call(path)).status,404);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM moderation_events').first()).n,3);
});
test('competing moderation decisions cannot overwrite each other or add a false audit record',async t=>{
  const {call,submit,DB}=setup(t);const entry=await submit();
  const responses=await Promise.all(['approved','rejected'].map(status=>call('/review/api/signatures/'+entry.id,'PATCH',{status,expectedStatus:'pending'})));
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM moderation_events').first()).n,1);
});
test('private pagination covers a large queue with stable same-time ordering',async t=>{
  const {call,DB}=setup(t);
  for(let i=0;i<103;i++)await DB.prepare('INSERT INTO signatures (id,name,pokemon,game,series,created_at,consent_version) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'Trainer','pikachu','emerald','xy','2026-09-23T00:00:00.000Z','public-v1').run();
  const first=await (await call('/review/api/signatures')).json();assert.equal(first.entries.length,100);assert(first.entries[0].theme.pokemon.name);
  const second=await (await call('/review/api/signatures?after='+encodeURIComponent(first.next))).json();assert.equal(second.entries.length,3);assert.equal(second.next,null);
  assert.equal(new Set([...first.entries,...second.entries].map(entry=>entry.id)).size,103);
});
function enable(env){Object.assign(env,{NOTIFICATIONS_ENABLED:'true',RESEND_API_KEY:'test-key-never-send',NOTIFICATION_FROM:'SignDex <review@example.com>',REVIEW_URL:api+'/review'});}
test('submission and notification are atomic, idempotent, private, and independent of email configuration',async t=>{
  const {submit,call,DB,env}=setup(t);const entry=await submit();await call('/signatures','POST',entry);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM notification_outbox').first()).n,1);
  assert.deepEqual(await deliverNotifications(env,()=>{throw Error('Must not call provider');}),{disabled:true});
  enable(env);const requests=[];
  const send=async(url,options)=>{requests.push({url,...options});return Response.json({id:'email-id'});};
  assert.deepEqual(await deliverNotifications(env,send),{sent:1,failed:0});
  await deliverNotifications(env,send);assert.equal(requests.length,1);
  assert.equal(requests[0].headers['Idempotency-Key'],'signdex-review/'+entry.id);
  const payload=JSON.parse(requests[0].body);assert.deepEqual(payload.to,[owner]);assert.match(payload.text,new RegExp(entry.id));
  assert(!payload.text.includes(env.ADMIN_TOKEN));assert(!payload.html.includes(env.RESEND_API_KEY));
  const escaped=notificationPayload({...entry,name:'<script>alert(1)</script>',message:'PRIVATE MESSAGE'},{review:api+'/review',from:'from@example.com',to:owner});
  assert(!escaped.html.includes('<script>'));assert(!escaped.html.includes('PRIVATE MESSAGE'));
  assert.equal((await DB.prepare('SELECT state,payload FROM notification_outbox').first()).payload,null);
  // A failed queue insert must also roll back its signature insert.
  DB.sqlite.exec("CREATE TRIGGER test_queue_failure BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT, 'test rollback'); END;");
  const other=valid();assert.equal((await call('/signatures','POST',other)).status,503);
  assert.equal(await DB.prepare('SELECT id FROM signatures WHERE id=?').bind(other.id).first(),null);
});
test('provider failure retries with an identical payload and key, then skips moderated entries',async t=>{
  const {submit,call,DB,env}=setup(t);const entry=await submit();enable(env);const requests=[];
  const failed=await deliverNotifications(env,async(_url,options)=>{requests.push(options);return new Response('secret provider details',{status:503});});
  assert.equal(failed.failed,1);
  const job=await DB.prepare('SELECT * FROM notification_outbox').first();assert.equal(job.state,'pending');assert.equal(job.last_error,'email-http-503');assert(job.available_at>Date.now());
  await deliverNotifications(env,()=>{throw Error('Not due');});
  await DB.prepare('UPDATE notification_outbox SET available_at=0').run();
  await deliverNotifications(env,async(_url,options)=>{requests.push(options);return Response.json({id:'retry-receipt'});});
  assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);
  const second=await submit();await call('/review/api/signatures/'+second.id,'PATCH',{status:'rejected',expectedStatus:'pending'});
  await deliverNotifications(env,()=>{throw Error('Do not notify rejected entries');});
  assert.equal((await DB.prepare('SELECT state FROM notification_outbox WHERE signature_id=?').bind(second.id).first()).state,'skipped');
  assert.equal((await DB.prepare('SELECT state FROM notification_outbox WHERE signature_id=?').bind(entry.id).first()).state,'sent');
});
test('overlapping dispatchers claim each notification once; retries are bounded',async t=>{
  const {submit,DB,env}=setup(t);await submit();enable(env);let calls=0;
  const send=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return Response.json({id:'one-email'});};
  await Promise.all([deliverNotifications(env,send),deliverNotifications(env,send)]);assert.equal(calls,1);
  const entry=await submit();
  await DB.prepare('UPDATE notification_outbox SET attempts=5 WHERE signature_id=?').bind(entry.id).run();
  await deliverNotifications(env,async()=>new Response(null,{status:429}));
  const job=await DB.prepare('SELECT * FROM notification_outbox WHERE signature_id=?').bind(entry.id).first();assert.equal(job.state,'failed');assert.equal(job.payload,null);assert.equal(job.attempts,6);
  await deliverNotifications(env,()=>{throw Error('Exhausted');});
});
