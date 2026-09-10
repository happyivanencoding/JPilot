// JobPilot's small authenticated edge. The existing loopback Web engine is unchanged.
// Native tokens never grant access to AgentDock itself. No cloud database is introduced.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createPublicKey, verify, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkRequest, isLoopbackHost } from '../src/lib/request-origin.mjs';

const root = process.env.CAREER_OPS_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const privateRoot = path.join(root, '.career-ops-web');
const configFile = process.env.JOBPILOT_ACCESS_CONFIG || path.join(privateRoot, 'mobile-access.json');
const sessionFile = process.env.JOBPILOT_SESSION_FILE || path.join(privateRoot, 'mobile-sessions.json');
const profileRegistry = process.env.JOBPILOT_PROFILE_REGISTRY || path.join(root,'data','profiles.json');
let settings = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
const configuredAccounts = Object.entries(settings.accounts || {});
if (!configuredAccounts.length) throw new Error('JobPilot requires at least one configured account.');
const upstream = new URL(process.env.JOBPILOT_UPSTREAM || 'http://127.0.0.1:3000');
if (!isLoopbackHost(upstream.hostname)) throw new Error('Upstream must remain loopback.');
const port = Number(process.env.JOBPILOT_GATEWAY_PORT || 3002);
const sessions = fs.existsSync(sessionFile) ? JSON.parse(fs.readFileSync(sessionFile, 'utf8')) : {};
const pairs = new Map();
let cloudflareJwks = { keys: [], until: 0 }, googleJwks = { keys: [], until: 0 };
const googleClientId = () => process.env.JOBPILOT_GOOGLE_CLIENT_ID || settings.googleClientId || '';
const googleJwksUrl = process.env.JOBPILOT_GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
const secret = () => randomBytes(32).toString('base64url');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const htmlEscape = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cookies(header = '') { return Object.fromEntries(header.split(';').map(x => x.trim().split(/=(.*)/s)).filter(x => x.length > 1).map(([k,v]) => [k,v])); }
function profileIds() {
  try { return JSON.parse(fs.readFileSync(profileRegistry,'utf8')).profiles.map(p=>p.id).filter(Boolean); }
  catch { return []; }
}
function account(email) {
  const normalized=String(email || '').trim().toLowerCase(), spec=settings.accounts?.[normalized];
  if (Array.isArray(spec) && spec.length) return {email:normalized,role:'legacy',profiles:[...new Set(spec)]};
  if (spec?.role === 'admin') {
    const profiles=profileIds();if(!profiles.length)throw new Error('Aucun profil JobPilot disponible.');
    return {email:normalized,role:'admin',profiles};
  }
  if (spec?.role === 'user' && typeof spec.profileId === 'string' && profileIds().includes(spec.profileId)) return {email:normalized,role:'user',profiles:[spec.profileId]};
  throw new Error('Compte non autorisé pour JobPilot.');
}
function persist() {
  for (const [key, value] of Object.entries(sessions)) if (value.expires < Date.now()) delete sessions[key];
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  const tmp = sessionFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sessions), { mode: 0o600 }); fs.renameSync(tmp, sessionFile);
}
function issue(email) {
  const access=account(email),token = secret();
  sessions[token] = { email:access.email, expires: Date.now() + 30 * 86400_000 };
  persist();
  return { token, role:access.role, profiles:access.profiles, expiresAt: sessions[token].expires };
}
async function signedClaims(assertion,{issuer,audience,jwksUrl,cache,label}) {
  const parts = String(assertion || '').split('.');
  if (parts.length !== 3) throw new Error(`${label} invalide.`);
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const issuers = Array.isArray(issuer) ? issuer : [issuer];
  if (header.alg !== 'RS256' || !issuers.includes(claims.iss) || !audiences.includes(audience) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || (claims.nbf && claims.nbf * 1000 > Date.now() + 30_000)) throw new Error(`${label} expirée ou non destinée à JobPilot.`);
  if (cache.until < Date.now() || !cache.keys.some(k => k.kid === header.kid)) {
    const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Clés ${label} indisponibles.`);
    const value=await response.json();cache.keys=Array.isArray(value.keys)?value.keys:[];cache.until=Date.now()+3600_000;
  }
  const key = cache.keys.find(k => k.kid === header.kid);
  if (!key || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error(`Signature ${label} invalide.`);
  return claims;
}
async function cloudflareIdentity(assertion) {
  if (!assertion || !settings.teamDomain || !settings.audience) throw new Error('Connexion Cloudflare Access requise.');
  const issuer = 'https://' + settings.teamDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const claims=await signedClaims(assertion,{issuer,audience:settings.audience,jwksUrl:issuer+'/cdn-cgi/access/certs',cache:cloudflareJwks,label:'Cloudflare'});
  return account(claims.email);
}
async function googleIdentity(credential) {
  const clientId=googleClientId();
  if(!clientId)throw new Error('Connexion Google non configurée.');
  const claims=await signedClaims(credential,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,jwksUrl:googleJwksUrl,cache:googleJwks,label:'Google'});
  if(claims.email_verified !== true || typeof claims.email !== 'string' || !claims.email.includes('@') || !claims.sub)throw new Error('Google n’a pas confirmé cette adresse e-mail.');
  return account(claims.email);
}
function json(res, code, data, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function page(res, text, body = '') {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" });
  res.end(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1"><title>JobPilot</title><style>body{background:#f4f2f8;color:#26213b;font:17px system-ui;max-width:480px;margin:12vh auto;padding:28px}main{padding:30px;border-radius:30px;background:white;box-shadow:0 12px 60px #34315412}h1{font-size:34px}button{border:0;background:#554993;color:white;padding:16px 22px;border-radius:18px;font:inherit;width:100%;margin-top:20px}</style><main><h1>JobPilot</h1><p>${htmlEscape(text)}</p>${body}</main></html>`);
}
function googlePage(res, requestId = '') {
  const clientId=googleClientId();
  if(!clientId)return page(res,'Google 登录尚未配置。请联系 JobPilot 管理员。');
  const nonce=secret(),request=JSON.stringify(String(requestId || ''));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}' https://accounts.google.com/gsi/client; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com/gsi/; img-src data: https://lh3.googleusercontent.com; frame-ancestors 'none'`});
  res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 JobPilot</title><style>body{background:#f4f2f8;color:#26213b;font:16px system-ui;max-width:420px;margin:12vh auto;padding:24px}main{padding:30px;border-radius:24px;background:white;box-shadow:0 12px 60px #34315412}h1{font-size:32px;margin:.2em 0}#google{margin:28px 0 18px}#status{font-size:14px;color:#655f75;line-height:1.5}</style><main><strong>JOBPILOT</strong><h1>使用 Google 登录</h1><p>只有提前受邀的邮箱可以进入。普通用户登录后只会看到自己的档案。</p><div id="google"></div><p id="status">请选择你的 Google 账号。</p></main><script nonce="${nonce}" src="https://accounts.google.com/gsi/client" async></script><script nonce="${nonce}">const status=document.getElementById('status');const requestId=${request};async function finish(response){try{status.textContent='正在确认受邀邮箱…';const r=await fetch('/api/mobile-auth/google/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential,requestId})});const v=await r.json();if(!r.ok)throw new Error(v.error||'登录失败');if(v.mobile){status.textContent='登录成功。请回到 JobPilot App。';return}location.replace(v.redirect||'/')}catch(e){status.textContent=e.message||'登录失败，请重试'}}window.onload=()=>{google.accounts.id.initialize({client_id:${JSON.stringify(clientId)},callback:finish,use_fedcm_for_prompt:true});google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large',shape:'rectangular',text:'signin_with',width:300})};</script></html>`);
}
async function readBody(req, limit = 13 * 1024 * 1024) {
  const chunks = []; let count = 0;
  for await (const chunk of req) { count += chunk.length; if (count > limit) throw new Error('Requête trop volumineuse.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
function requestAllowed(req) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  // Access returns through a cross-site top-level GET. It is not an API write;
  // the bridge still verifies the signed application-specific identity below.
  const navigation = req.method === 'GET' && req.headers['sec-fetch-mode'] === 'navigate'
    && req.headers['sec-fetch-dest'] === 'document'
    && (pathname === '/api/mobile-auth/bridge' || !pathname.startsWith('/api/'));
  return checkRequest({ host: req.headers.host, origin: navigation ? undefined : req.headers.origin,
    secFetchSite: navigation ? undefined : req.headers['sec-fetch-site'], allowedHosts: new Set(settings.host ? [settings.host] : []) });
}
function sessionFor(req) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : cookies(req.headers.cookie).jobpilot_session;
  const session = token && sessions[token];
  if(!(session?.expires > Date.now()))return null;
  try {
    const access=account(session.email);
    return {token,...session,email:access.email,role:access.role,profiles:access.profiles};
  } catch { return null; }
}

export const server = http.createServer(async (req, res) => {
  try {
    if(fs.existsSync(configFile))settings=JSON.parse(fs.readFileSync(configFile,'utf8'));
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;
    const allow = requestAllowed(req);
    if (!allow.ok) return json(res, 403, { error: allow.reason });
    for (const [key, p] of pairs) if (p.expires < Date.now()) pairs.delete(key);
    if (pathname === '/api/mobile-auth/login' && req.method === 'GET') {
      res.writeHead(302,{Location:googleClientId()?'/api/mobile-auth/google':'/api/mobile-auth/bridge','Cache-Control':'no-store'});return res.end();
    }
    if (pathname === '/api/mobile-auth/start' && req.method === 'POST') {
      const useGoogle=Boolean(googleClientId());
      if (!settings.host || (!useGoogle && !settings.audience)) return json(res, 503, { error: 'La connexion distante n’est pas encore configurée.' });
      if (pairs.size >= 200) return json(res, 429, { error: 'Trop de demandes de connexion.' });
      const id = randomUUID(), verifier = secret();
      pairs.set(id, { verifier, expires: Date.now() + 10 * 60_000 });
      const loginPath=useGoogle?`/api/mobile-auth/google?request=${encodeURIComponent(id)}`:`/api/mobile-auth/bridge?request=${encodeURIComponent(id)}`;
      return json(res, 200, { requestId: id, verifier, provider:useGoogle?'google':'cloudflare', url: `https://${settings.host}${loginPath}` });
    }
    if (pathname === '/api/mobile-auth/exchange' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 4096)).toString());
      const pair = pairs.get(body.requestId);
      if (!pair || !equal(pair.verifier, body.verifier)) return json(res, 400, { error: 'Demande de connexion expirée.' });
      if (!pair.identity) return json(res, 202, { pending: true });
      const result = issue(pair.identity.email);
      pairs.delete(body.requestId);
      return json(res, 200, result);
    }
    if (pathname === '/api/mobile-auth/google' && req.method === 'GET') return googlePage(res,url.searchParams.get('request') || '');
    if (pathname === '/api/mobile-auth/google/exchange' && req.method === 'POST') {
      const body=JSON.parse((await readBody(req,20000)).toString());
      const who=await googleIdentity(body.credential);
      const id=String(body.requestId || '');
      if(id){const pair=pairs.get(id);if(!pair)return json(res,400,{error:'Cette demande a expiré. Revenez dans JobPilot et relancez la connexion.'});pair.identity=who;return json(res,200,{ok:true,mobile:true});}
      const auth=issue(who.email);
      return json(res,200,{ok:true,redirect:'/'},{'Set-Cookie':`jobpilot_session=${auth.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`});
    }
    if (pathname === '/api/mobile-auth/bridge') {
      const who = await cloudflareIdentity(req.headers['cf-access-jwt-assertion']);
      const id = url.searchParams.get('request');
      if (id) {
        const pair = pairs.get(id);
        if (!pair) return page(res, 'Cette demande a expiré. Revenez dans JobPilot et relancez la connexion.');
        if (req.method === 'POST') {
          const body = new URLSearchParams((await readBody(req, 4096)).toString());
          if (!equal(pair.nonce, body.get('nonce')) || !equal(pair.nonce, cookies(req.headers.cookie).jobpilot_bridge)) return json(res, 403, { error: 'Confirmation invalide.' });
          pair.identity = who;
          return page(res, 'Connexion approuvée. Vous pouvez revenir dans l’application JobPilot.');
        }
        pair.nonce = secret();
        res.setHeader('Set-Cookie', `jobpilot_bridge=${pair.nonce}; Path=/api/mobile-auth/bridge; HttpOnly; Secure; SameSite=Strict; Max-Age=600`);
        return page(res, 'Autorisez uniquement une connexion que vous venez de démarrer sur votre propre téléphone.', `<form method="post"><input type="hidden" name="nonce" value="${pair.nonce}"><button>Connecter mon application</button></form>`);
      }
      const auth = issue(who.email);
      res.writeHead(302, { Location: '/', 'Set-Cookie': `jobpilot_session=${auth.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`, 'Cache-Control': 'no-store' }); return res.end();
    }
    if (pathname === '/api/mobile-auth/dev' && req.method === 'POST') {
      if (process.env.JOBPILOT_USB_LOGIN !== '1' || !isLoopbackHost(req.headers.host) || req.headers['cf-ray'] || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) return json(res, 403, { error: 'Connexion USB locale uniquement.' });
      const owner = Object.entries(settings.accounts || {})[0];
      if (!owner) return json(res, 503, { error: 'Configurer le propriétaire local JobPilot.' });
      return json(res, 200, issue(owner[0]));
    }
    const session = sessionFor(req);
    if (!session) {
      if (pathname.startsWith('/api/')) return json(res, 401, { error: 'Connexion JobPilot requise.' });
      res.writeHead(302, { Location: '/api/mobile-auth/login', 'Cache-Control': 'no-store' }); return res.end();
    }
    if (pathname === '/api/mobile-auth/logout' && req.method === 'POST') {
      delete sessions[session.token]; persist(); return json(res, 200, { ok: true });
    }
    const content = !['GET','HEAD'].includes(req.method) ? await readBody(req) : null;
    let body;
    if (req.headers['content-type']?.includes('application/json') && content?.length) body = JSON.parse(content.toString());
    const jar = cookies(req.headers.cookie);
    const explicit = [url.searchParams.get('profileId'), body?.profileId, req.headers['x-jobpilot-profile']].filter(Boolean);
    if (explicit.some(p => !session.profiles.includes(p))) return json(res, 403, { error: 'Profil non autorisé.' });
    const selected = explicit[0] || (session.profiles.includes(jar['career-ops-profile']) ? jar['career-ops-profile'] : session.profiles[0]);
    // Never forward caller-supplied identity/privilege headers or bearer tokens to external links.
    const forwardHeaders = { ...req.headers, host: upstream.host, cookie: `career-ops-profile=${selected}`, 'x-jobpilot-profiles': session.profiles.join(','), 'x-jobpilot-role': session.role };
    for (const name of ['authorization', 'cf-access-jwt-assertion', 'x-jobpilot-profile', 'x-jobpilot-profiles', 'x-jobpilot-role', 'x-forwarded-host', 'x-forwarded-for', 'cf-connecting-ip', 'connection']) delete forwardHeaders[name];
    forwardHeaders['x-jobpilot-profiles']=session.profiles.join(',');forwardHeaders['x-jobpilot-role']=session.role;
    if (forwardHeaders.origin) forwardHeaders.origin = upstream.origin;
    if (content) forwardHeaders['content-length'] = String(content.length);
    const proxy = http.request({ hostname: upstream.hostname, port: upstream.port || 80, method: req.method, path: req.url, headers: forwardHeaders }, response => {
      const headers = { ...response.headers, 'Cache-Control': 'no-store' };
      delete headers['transfer-encoding'];
      res.writeHead(response.statusCode || 502, headers); response.pipe(res);
    });
    proxy.setTimeout(1000 * 1000, () => proxy.destroy(new Error('Upstream timeout')));
    proxy.on('error', () => { if (!res.headersSent) json(res, 502, { error: 'Le moteur JobPilot local est indisponible.' }); else res.destroy(); });
    if (content) proxy.write(content);
    proxy.end();
  } catch (e) { if (!res.headersSent) json(res, 400, { error: e instanceof Error ? e.message : 'Requête invalide.' }); else res.destroy(); }
});
server.requestTimeout = 0;
server.listen(port, '127.0.0.1', () => console.log(`JobPilot gateway ready on 127.0.0.1:${port}; remote auth ${settings.audience ? 'configured' : 'not configured'}`));
