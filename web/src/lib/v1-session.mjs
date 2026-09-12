import fs from 'node:fs';
import path from 'node:path';
import {randomBytes, randomUUID} from 'node:crypto';
import {withProfileLock, readJson, writeJson} from './mobile-state.mjs';

export const PREVIEW_COOKIE = 'jobpilot-v1-session';
const sessions = root => path.join(root, '.career-ops-web', 'v1-sessions');
export function previewToken(headers) {
  const bearer = headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (bearer) return bearer;
  return (headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(PREVIEW_COOKIE + '='))?.slice(PREVIEW_COOKIE.length + 1) || '';
}
export function readPreviewSession(root, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = readJson(path.join(sessions(root), token + '.json'));
  if (!session || session.expiresAt <= Date.now()) return null;
  const store = readJson(path.join(root, 'data', 'profiles.json'));
  return store?.profiles?.some(p => p.id === session.profileId) ? session : null;
}
// V1-only, unverified test-account labels; existing session authorization stays in place.
export function normalizePreviewEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}
export async function createPreviewSession(root, emailValue) {
  const email = normalizePreviewEmail(emailValue);
  const result = await withProfileLock(path.join(root, '.career-ops-web', 'profile-registry'), () => {
    const file = path.join(root, 'data', 'profiles.json');
    const store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {version:1, profiles:[]};
    if (!Array.isArray(store.profiles)) throw new Error('Invalid profile registry');
    const accountFile = path.join(root, '.career-ops-web', 'v1-accounts.json');
    const accounts = readJson(accountFile) || {version:1, accounts:[]};
    const existing = accounts.accounts.find(account => account.email === email);
    if (existing) {
      const profile = store.profiles.find(p => p.id === existing.profileId);
      if (!profile) throw new Error('The saved test profile is unavailable.');
      const token = randomBytes(32).toString('base64url');
      existing.lastSeenAt = new Date().toISOString();
      writeJson(accountFile, accounts);
      writeJson(path.join(sessions(root), token + '.json'), {profileId:profile.id, email, createdAt:Date.now(), expiresAt:Date.now() + 30*86400000});
      const hasCv = !!fs.readFileSync(path.join(root, profile.cvMarkdown), 'utf8').trim();
      return {token, profileId:profile.id, profiles:[profile.id], email, isNew:false, needsOnboarding:!hasCv};
    }
    const id = 'test-' + randomUUID().replaceAll('-', '');
    const base = `.career-ops-web/profiles/${id}`;
    const profile = {id, name:'', shortName:'', cvMarkdown:`${base}/cv.md`, config:`${base}/profile.yml`, notes:`${base}/notes.md`, candidatures:`${base}/candidatures.json`, legacyUntagged:false};
    fs.mkdirSync(path.join(root, base), {recursive:true});
    fs.writeFileSync(path.join(root, profile.cvMarkdown), '', 'utf8');
    fs.writeFileSync(path.join(root, profile.notes), '', 'utf8');
    fs.writeFileSync(path.join(root, profile.config), 'candidate: {}\nlocation:\n  country: France\ncv:\n  language: en\ntarget_roles:\n  primary: []\n  contract_types: []\n', 'utf8');
    writeJson(path.join(root, profile.candidatures), {version:1, jobs:[], updatedAt:new Date().toISOString()});
    store.profiles.push(profile);
    store.defaultProfileId ||= id;
    writeJson(file, store);
    accounts.accounts.push({email, profileId:id, createdAt:new Date().toISOString(), lastSeenAt:new Date().toISOString()});
    writeJson(accountFile, accounts);
    const token = randomBytes(32).toString('base64url');
    const session = {profileId:id, email, createdAt:Date.now(), expiresAt:Date.now() + 30*86400000};
    writeJson(path.join(sessions(root), token + '.json'), session);
    return {token, profileId:id, profiles:[id], email, isNew:true, needsOnboarding:true};
  });
  // Re-authentication must never advance the product journey. A returning user
  // resumes the exact persisted analysis/search/onboarding state; only the
  // explicit finishOnboarding action may mark the journey completed.
  return result;
}
export function revokePreviewSession(root, token) {
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) fs.rmSync(path.join(sessions(root), token + '.json'), {force:true});
}
export async function setProfileDisplayName(root, profileId, name, sourceCv) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0,100);
  const normalized = text => String(text).normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  if (!clean || !normalized(sourceCv).includes(normalized(clean))) return;
  await withProfileLock(path.join(root, '.career-ops-web', 'profile-registry'), () => {
    const file = path.join(root, 'data', 'profiles.json');
    const store = JSON.parse(fs.readFileSync(file,'utf8'));
    const profile = store.profiles.find(p=>p.id===profileId);
    if (!profile) throw new Error('Unknown profile');
    profile.name=clean; profile.shortName=clean.split(' ')[0];
    writeJson(file,store);
  });
}
