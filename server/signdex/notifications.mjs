import { accessSettings } from './review-auth.mjs';
const escapeHTML = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function notificationSettings(env) {
  if (env.NOTIFICATIONS_ENABLED !== 'true' || !env.RESEND_API_KEY || !env.NOTIFICATION_FROM || !accessSettings(env)) return null;
  try {
    const review = new URL(env.REVIEW_URL);
    if (review.protocol !== 'https:' || review.pathname !== '/review' || review.search || review.hash || review.username || review.password) return null;
    return { review:review.href, from:env.NOTIFICATION_FROM, to:env.ADMIN_EMAIL };
  } catch { return null; }
}
export function notificationPayload(entry,settings) {
  const link = settings.review + '?entry=' + encodeURIComponent(entry.id);
  // Keep visitor messages, workplaces, and cities out of notifications; review them on the private page.
  return { from:settings.from,to:[settings.to],subject:'New SignDex signature awaiting review',
    text:`A new SignDex signature from ${entry.name} is waiting for you.\n\nReview signature: ${link}\n\nSign in with your email, then choose Approve or Reject. Opening this link does not publish anything.`,
    html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#302b3b;max-width:540px"><p style="letter-spacing:2px;color:#6e5885">SIGNDEX · TRAINER MAIL</p><h1>A new trainer stopped by.</h1><p><strong>${escapeHTML(entry.name)}</strong> left a signature for your review.</p><p><a href="${escapeHTML(link)}" style="display:inline-block;padding:12px 20px;background:#6e5885;color:white;text-decoration:none;border-radius:4px">Review signature</a></p><p>Sign in with your email, then choose Approve or Reject. Opening this link does not publish anything.</p></div>` };
}
export async function deliverNotifications(env,send = fetch) {
  const settings = notificationSettings(env);
  if (!settings) return { disabled:true };
  // Claims survive worker restarts. A lease plus Resend's idempotency key handles overlapping runs.
  let sent = 0, failed = 0;
  for (let i=0;i<10;i++) {
    const now=Date.now();
    await env.DB.prepare("UPDATE notification_outbox SET state = 'skipped', payload = NULL WHERE state IN ('pending','sending') AND signature_id IN (SELECT id FROM signatures WHERE status != 'pending')").run();
    await env.DB.prepare("UPDATE notification_outbox SET state = 'failed', last_error = 'retry-window-expired', payload = NULL WHERE state IN ('pending','sending') AND first_attempt_at IS NOT NULL AND first_attempt_at < ?").bind(now-12*3600000).run();
    const job = await env.DB.prepare(`UPDATE notification_outbox SET state='sending', attempts=attempts+1, locked_until=?, first_attempt_at=COALESCE(first_attempt_at,?) WHERE signature_id = (SELECT signature_id FROM notification_outbox WHERE state IN ('pending','sending') AND available_at <= ? AND locked_until <= ? AND attempts < 6 ORDER BY available_at LIMIT 1) RETURNING *`).bind(now+60000,now,now,now).first();
    if (!job) break;
    const entry = await env.DB.prepare('SELECT id,name,status FROM signatures WHERE id = ?').bind(job.signature_id).first();
    if (!entry || entry.status !== 'pending') {
      await env.DB.prepare("UPDATE notification_outbox SET state='skipped',payload=NULL WHERE signature_id=?").bind(job.signature_id).run();continue;
    }
    const payload = job.payload || JSON.stringify(notificationPayload(entry,settings));
    if (!job.payload) await env.DB.prepare('UPDATE notification_outbox SET payload=? WHERE signature_id=?').bind(payload,job.signature_id).run();
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await send('https://api.resend.com/emails',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`signdex-review/${job.signature_id}`},body:payload});
      if (!response.ok) throw new Error(`email-http-${response.status}`);
      const data=await response.json();if (!data.id) throw new Error('email-invalid-receipt');
      await env.DB.prepare("UPDATE notification_outbox SET state='sent',sent_at=?,locked_until=0,last_error=NULL,payload=NULL WHERE signature_id=?").bind(Date.now(),job.signature_id).run();sent++;
    } catch (error) {
      const code=/^email-(http-\d+|invalid-receipt)$/.test(error.message)?error.message:'email-delivery-unavailable';
      const exhausted=job.attempts>=6;
      await env.DB.prepare('UPDATE notification_outbox SET state=?,available_at=?,locked_until=0,last_error=?,payload=CASE WHEN ? THEN NULL ELSE payload END WHERE signature_id=?').bind(exhausted?'failed':'pending',Date.now()+[60000,300000,900000,3600000,14400000,14400000][job.attempts-1],code,exhausted?1:0,job.signature_id).run();failed++;
      // Stop this invocation after a provider failure; the next cron retries without a busy loop.
      break;
    } finally { clearTimeout(timeout); }
  }
  return {sent,failed};
}
