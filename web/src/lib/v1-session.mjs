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
export async function createPreviewSession(root) {
  return withProfileLock(path.join(root, '.career-ops-web', 'profile-registry'), () => {
    const file = path.join(root, 'data', 'profiles.json');
    const store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {version:1, profiles:[]};
    if (!Array.isArray(store.profiles)) throw new Error('Invalid profile registry');
    const id = 'test-' + randomUUID().replaceAll('-', '');
    const base = `.career-ops-web/profiles/${id}`;
    const profile = {id, name:'', shortName:'', cvMarkdown:`${base}/cv.md`, config:`${base}/profile.yml`, notes:`${base}/notes.md`, candidatures:`${base}/candidatures.json`, legacyUntagged:false};
    fs.mkdirSync(path.join(root, base), {recursive:true});
    fs.writeFileSync(path.join(root, profile.cvMarkdown), '', 'utf8');
    fs.writeFileSync(path.join(root, profile.notes), '', 'utf8');
    fs.writeFileSync(path.join(root, profile.config), 'candidate: {}\ncv:\n  language: en\ntarget_roles:\n  primary: []\n  contract_types: []\n', 'utf8');
    writeJson(path.join(root, profile.candidatures), {version:1, jobs:[], updatedAt:new Date().toISOString()});
    store.profiles.push(profile);
    store.defaultProfileId ||= id;
    writeJson(file, store);
    const token = randomBytes(32).toString('base64url');
    const session = {profileId:id, createdAt:Date.now(), expiresAt:Date.now() + 30*86400000};
    writeJson(path.join(sessions(root), token + '.json'), session);
    return {token, profileId:id, profiles:[id]};
  });
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
