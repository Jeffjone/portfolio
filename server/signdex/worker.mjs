import '../../assets/js/signdex-pokemon.js';
import '../../assets/js/signdex-model.js';

const { validate } = globalThis.SignDexModel;
const publicColumns = 'id, name, work, city, message, pokemon, game, series, created_at';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });

async function boundedJSON(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw { status: 415, message: 'Please submit JSON.' };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, message: 'The signature is missing.' };
  let size = 0, text = ''; const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw { status: 413, message: 'This signature is too long.' }; }
    text += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { throw { status: 400, message: 'The signature could not be read.' }; }
}
async function secureEqual(actual, expected) {
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a,b] = await Promise.all([digest(actual),digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function rateLimit(request, env) {
  const address = request.headers.get('CF-Connecting-IP') || (env.ENVIRONMENT === 'development' ? 'local-visitor' : 'unknown');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.RATE_LIMIT_SALT), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(address));
  const identity = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  const now = Date.now(), cutoff = now - 3600000;
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(cutoff).run();
  const result = await env.DB.prepare('INSERT INTO rate_limits (key, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(identity,now).first();
  return result.attempts <= 5;
}
async function handle(request, env) {
  const url = new URL(request.url);
  if (!env.DB || !env.RATE_LIMIT_SALT) return json({ error: 'SignDex is not connected yet. Please try again later.' },503);
  if (url.pathname === '/signatures' && request.method === 'GET') {
    const before = url.searchParams.get('before');
    if (before && !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[0-9a-f-]{36}$/i.test(before)) return json({ error: 'Invalid page cursor.' },400);
    let statement;
    if (before) {
      const [date,id] = before.split('|');
      statement = env.DB.prepare(`SELECT ${publicColumns} FROM signatures WHERE status = 'approved' AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 13`).bind(date,date,id);
    } else statement = env.DB.prepare(`SELECT ${publicColumns} FROM signatures WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 13`);
    const { results } = await statement.all();
    const entries = results.slice(0,12), last = entries[entries.length - 1];
    const total = await env.DB.prepare("SELECT COUNT(*) AS count FROM signatures WHERE status = 'approved'").first();
    return json({ entries, total: total.count, next: results.length > 12 ? `${last.created_at}|${last.id}` : null });
  }
  if (url.pathname === '/signatures' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if (!origin) return json({ error: 'Submit your signature through the portfolio.' },403);
    const body = await boundedJSON(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid signature.' },400);
    if (body.website) return json({ error: 'We could not accept this signature.' },400);
    if (!uuid.test(body.id || '')) return json({ error: 'Please refresh the form and try again.' },400);
    const { value,errors } = validate(body);
    if (Object.keys(errors).length) return json({ error: 'Please check the highlighted fields.', fields: errors },422);
    // The random receipt is also an idempotency key, so network retries do not duplicate signatures.
    const existing = await env.DB.prepare('SELECT id, name, work, city, message, pokemon, game, series FROM signatures WHERE id = ?').bind(body.id).first();
    if (existing) {
      const same = ['name','work','city','message','pokemon','game','series'].every(key => existing[key] === value[key]);
      return same ? json({ id: body.id, status: 'pending-review' },202) : json({ error: 'This receipt was already used. Start a new signature.' },409);
    }
    if (!await rateLimit(request,env)) return json({ error: 'You’ve signed several times recently. Please try again in an hour.' },429,{ 'Retry-After': '3600' });
    await env.DB.prepare('INSERT INTO signatures (id,name,work,city,message,pokemon,game,series,created_at,consent_version) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,value.name,value.work,value.city,value.message,value.pokemon,value.game,value.series,new Date().toISOString(),'public-v1').run();
    return json({ id: body.id, status: 'pending-review' },202);
  }
  if (url.pathname.startsWith('/admin/')) {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16 || !await secureEqual(request.headers.get('Authorization') || '',`Bearer ${env.ADMIN_TOKEN}`)) return json({ error: 'Unauthorized.' },401);
    if (url.pathname === '/admin/signatures' && request.method === 'GET') {
      const status = url.searchParams.get('status') || 'pending';
      if (!['pending','approved','rejected'].includes(status)) return json({ error: 'Invalid status.' },400);
      const { results } = await env.DB.prepare(`SELECT ${publicColumns}, status FROM signatures WHERE status = ? ORDER BY created_at ASC LIMIT 100`).bind(status).all();
      return json({ entries: results });
    }
    const match = url.pathname.match(/^\/admin\/signatures\/([0-9a-f-]+)$/i);
    if (match && request.method === 'PATCH') {
      if (!uuid.test(match[1])) return json({ error: 'Invalid signature ID.' },400);
      const body = await boundedJSON(request);
      if (!['approved','rejected'].includes(body?.status)) return json({ error: 'Choose approved or rejected.' },400);
      const record = await env.DB.prepare('SELECT * FROM signatures WHERE id = ?').bind(match[1]).first();
      if (!record) return json({ error: 'Signature not found.' },404);
      if (body.status === 'approved' && Object.keys(validate({ ...record, consent: true }).errors).length) return json({ error: 'This signature fails the current content rules.' },422);
      await env.DB.prepare('UPDATE signatures SET status = ?, reviewed_at = ? WHERE id = ?').bind(body.status,new Date().toISOString(),match[1]).run();
      return json({ id: match[1], status: body.status });
    }
    if (match && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM signatures WHERE id = ?').bind(match[1]).run();
      return json({ deleted: true });
    }
  }
  return json({ error: 'Not found.' },404);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return json({ error: 'This origin is not allowed.' },403);
    const headers = { 'Vary': 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
    if (request.method === 'OPTIONS') return new Response(null,{ status:204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age':'600' } });
    let response;
    try { response = await handle(request, env); }
    catch (error) { response = json({ error: error.status ? error.message : 'SignDex is temporarily unavailable. Please try again.' },error.status || 503); }
    for (const [key,value] of Object.entries(headers)) response.headers.set(key,value);
    return response;
  }
};
