import { createRemoteJWKSet, jwtVerify } from 'jose';
const keySets = new Map();
export function accessSettings(env) {
  const team = env.ACCESS_TEAM_DOMAIN || '';
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team) || !env.ACCESS_AUD || !env.ADMIN_EMAIL) return null;
  return { issuer:team, audience:env.ACCESS_AUD, email:env.ADMIN_EMAIL.toLowerCase() };
}
// Exposed separately so cryptographic verification can be tested with local signing keys.
export async function verifyReviewJWT(token, env, keySet) {
  const settings = accessSettings(env);
  if (!settings || !token) return null;
  try {
    const { payload } = await jwtVerify(token,keySet,{issuer:settings.issuer,audience:settings.audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email']});
    if (payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || payload.email.toLowerCase() !== settings.email) return null;
    return { email:settings.email, subject:payload.sub };
  } catch { return null; }
}
export async function authenticateReview(request,env,ctx) {
  const settings = accessSettings(env);
  if (!settings) return null;
  if (ctx?.access) {
    if (ctx.access.aud !== settings.audience) return null;
    try { const identity = await ctx.access.getIdentity();
      return typeof identity?.email === 'string' && identity.email.toLowerCase() === settings.email ? { email:settings.email, subject:identity.user_uuid || settings.email } : null;
    } catch { return null; }
  }
  // Never trust an unsigned email header or an admin token on the browser route.
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) return null;
  if (!keySets.has(settings.issuer)) keySets.set(settings.issuer,createRemoteJWKSet(new URL(settings.issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000}));
  return verifyReviewJWT(assertion,env,keySets.get(settings.issuer));
}
