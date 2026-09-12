import fs from 'node:fs';
import path from 'node:path';
import {createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify} from 'node:crypto';
import {withProfileLock} from './mobile-state.mjs';

export const V1_GATE_COOKIE = 'jobpilot-v1-gate';
export const V1_GATE_TTL_MS = 10 * 60_000;
export function adminTimeCode(now=Date.now(),seed=process.env.JOBPILOT_V1_ADMIN_CODE||''){
  if(!seed)return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const slot=`${parts.year}${parts.month}${parts.day}-${parts.hour}`,suffix=createHmac('sha256',seed).update(slot).digest('hex').slice(0,6).toUpperCase();
  return `ONWARDADMIN-${slot}-${suffix}`;
}
const googleKeys = {keys: [], until: 0};
const digest = value => createHash('sha256').update(value).digest('hex');
const directory = root => path.join(root, '.career-ops-web', 'v1-auth-gates');
const tokenFile = (root, token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) ? path.join(directory(root), digest(token) + '.json') : null;
const failure = (message, code, status = 401) => Object.assign(new Error(message), {code, status});
const sameCode = (a, b) => timingSafeEqual(Buffer.from(digest(a), 'hex'), Buffer.from(digest(b), 'hex'));

export function issueGate(root, code, options = {}) {
  const value = typeof code === 'string' ? code.trim() : '';
  const now = options.now ?? Date.now();
  const googleCode = options.googleCode ?? process.env.JOBPILOT_V1_TEST_CODE ?? 'ONWARDV1';
  const adminCode = options.adminCode ?? process.env.JOBPILOT_V1_ADMIN_CODE ?? 'ANSHUN';
  const configuredTesterCodes=String(options.testerCodes ?? process.env.JOBPILOT_V1_TEST_CODES ?? '').split(',').map(code=>code.trim()).filter(Boolean);
  const testerCodes=[googleCode,...configuredTesterCodes];
  const adminCodes=[adminCode,adminTimeCode(now,adminCode),adminTimeCode(now-3600_000,adminCode)];
  if (!googleCode || !adminCode || googleCode === adminCode) throw failure('Test access is not configured.', 'GATE_CONFIG', 503);
  const valid=value && value.length<=256;
  const mode=valid && testerCodes.some(candidate=>sameCode(value,candidate)) ? 'google' : valid && adminCodes.some(candidate=>sameCode(value,candidate)) ? 'admin' : null;
  if (!mode) throw failure('Invalid test code.', 'INVALID_GATE_CODE');
  const token = randomBytes(32).toString('base64url');
  const gate = {mode, nonce: randomBytes(32).toString('base64url'), createdAt: now, expiresAt: now + V1_GATE_TTL_MS};
  fs.mkdirSync(directory(root), {recursive: true, mode: 0o700});
  fs.writeFileSync(tokenFile(root, token), JSON.stringify(gate), {flag: 'wx', mode: 0o600});
  return {token, ...gate};
}

export function readGate(root, token, options = {}) {
  const file = tokenFile(root, token);
  if (!file) return null;
  try {
    const gate = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!['google', 'admin'].includes(gate.mode) || !Number.isFinite(gate.expiresAt) || gate.expiresAt <= (options.now ?? Date.now())) return null;
    return gate;
  } catch {return null;}
}

export function revokeGate(root, token) {
  const file = tokenFile(root, token);
  if (!file) return false;
  try {fs.unlinkSync(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}
}

export function consumeGate(root, token, options = {}) {
  const gate = readGate(root, token, options);
  // A racing worker must successfully remove this exact ticket before it can authenticate.
  return gate && revokeGate(root, token) ? gate : null;
}

/** Invoke before each code/credential attempt. Use a trusted server-derived key. */
export async function recordAuthAttempt(root, key, options = {}) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('An authentication rate-limit key is required.');
  const now = options.now ?? Date.now();
  const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : 15 * 60_000;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
  const folder = path.join(directory(root), 'attempts', digest(key.slice(0, 1000)));
  return withProfileLock(folder, () => {
    const file = path.join(folder, 'attempt.json');
    let state;
    try {state = JSON.parse(fs.readFileSync(file, 'utf8'));} catch {state = null;}
    if (!state || !Number.isFinite(state.resetAt) || state.resetAt <= now || !Number.isInteger(state.count)) state = {count: 0, resetAt: now + windowMs};
    const allowed = state.count < limit;
    state.count = Math.min(limit, state.count + 1);
    fs.mkdirSync(folder, {recursive: true, mode: 0o700});
    fs.writeFileSync(file, JSON.stringify(state), {mode: 0o600});
    return {allowed, remaining: Math.max(0, limit - state.count), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((state.resetAt - now) / 1000))};
  });
}

export async function verifyGoogleCredential(credential, options = {}) {
  const clientId = options.clientId ?? process.env.JOBPILOT_GOOGLE_CLIENT_ID;
  if (typeof clientId !== 'string' || !clientId.trim()) throw failure('Google sign-in is not configured.', 'GOOGLE_CONFIG', 503);
  if (typeof credential !== 'string' || credential.length > 20000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credential)) throw failure('Invalid Google credential.', 'GOOGLE_INVALID');
  const parts = credential.split('.');
  let header, claims;
  try {header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());} catch {throw failure('Invalid Google credential.', 'GOOGLE_INVALID');}
  const now = options.now ?? Date.now(), audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || !audiences.includes(clientId) || (claims.azp !== undefined && claims.azp !== clientId) || (audiences.length > 1 && claims.azp !== clientId) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf * 1000 > now + 30_000))) throw failure('Google credential is expired or for another application.', 'GOOGLE_INVALID');
  const cache = options.cache ?? (options.fetchImpl ? {keys: [], until: 0} : googleKeys);
  if (cache.until <= now || !cache.keys?.some(key => key.kid === header.kid)) {
    const response = await (options.fetchImpl || fetch)('https://www.googleapis.com/oauth2/v3/certs', {signal: AbortSignal.timeout(10000), redirect: 'error'});
    if (!response.ok) throw failure('Google signing keys are unavailable.', 'GOOGLE_KEYS', 503);
    const value = await response.json();
    cache.keys = Array.isArray(value?.keys) ? value.keys : []; cache.until = now + 3600_000;
  }
  const key = cache.keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  let valid = false;
  try {valid = !!key && verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), createPublicKey({key, format: 'jwk'}), Buffer.from(parts[2], 'base64url'));} catch {valid = false;}
  if (!valid) throw failure('Invalid Google signature.', 'GOOGLE_SIGNATURE');
  if (options.nonce !== undefined && (typeof options.nonce !== 'string' || !options.nonce || claims.nonce !== options.nonce)) throw failure('Google credential does not match this sign-in attempt.', 'GOOGLE_NONCE');
  if (claims.email_verified !== true || typeof claims.email !== 'string' || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 255) throw failure('Google has not verified this identity.', 'GOOGLE_IDENTITY');
  return {email: claims.email.trim().toLowerCase(), sub: claims.sub};
}
