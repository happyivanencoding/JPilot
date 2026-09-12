import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync, sign} from 'node:crypto';
import {issueGate, readGate, consumeGate, revokeGate, recordAuthAttempt, verifyGoogleCredential, V1_GATE_TTL_MS} from '../../src/lib/v1-auth.mjs';
const now = 1800000000000;
const pair = generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...pair.publicKey.export({format: 'jwk'}), kid: 'fixture', alg: 'RS256', use: 'sig'};
const claims = {iss: 'https://accounts.google.com', aud: 'test-client', exp: now / 1000 + 60, sub: 'google-subject', email: 'User@example.com', email_verified: true};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(changes = {}, privateKey = pair.privateKey, header = {}) {
  const data = encode({alg: 'RS256', kid: 'fixture', ...header}) + '.' + encode({...claims, ...changes});
  return data + '.' + sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url');
}
const verifyOptions = {clientId: 'test-client', now, fetchImpl: async () => ({ok: true, json: async () => ({keys: [jwk]})})};
function fixture(t) {const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onward-auth-test-')); t.after(() => fs.rmSync(root, {recursive: true, force: true})); return root;}

test('gates distinguish modes, persist, expire and can be consumed only once', t => {
  const root = fixture(t), gate = issueGate(root, 'ONWARDV1', {now, googleCode: 'ONWARDV1', adminCode: 'ANSHUN'});
  assert.equal(gate.mode, 'google'); assert.equal(gate.token.length, 43);
  assert.equal(gate.nonce.length, 43); assert.equal(readGate(root, gate.token, {now}).nonce, gate.nonce);
  assert.equal(readGate(root, gate.token, {now}).mode, 'google');
  assert.equal(readGate(root, gate.token, {now: now + V1_GATE_TTL_MS}), null);
  assert.equal(consumeGate(root, gate.token, {now}).mode, 'google');
  assert.equal(consumeGate(root, gate.token, {now}), null);
  const admin = issueGate(root, 'ANSHUN', {googleCode: 'ONWARDV1', adminCode: 'ANSHUN'});
  assert.equal(admin.mode, 'admin'); assert.equal(revokeGate(root, admin.token), true); assert.equal(readGate(root, admin.token), null);
  assert.equal(readGate(root, '../escape'), null);
  assert.throws(() => issueGate(root, 'wrong', {googleCode: 'ONWARDV1', adminCode: 'ANSHUN'}), {code: 'INVALID_GATE_CODE'});
});

test('rate limit is persisted, isolated by key and resets after its window', async t => {
  const root = fixture(t), options = {now, limit: 2, windowMs: 1000};
  assert.equal((await recordAuthAttempt(root, 'ip-a', options)).allowed, true);
  assert.equal((await recordAuthAttempt(root, 'ip-a', options)).allowed, true);
  assert.equal((await recordAuthAttempt(root, 'ip-a', options)).allowed, false);
  assert.equal((await recordAuthAttempt(root, 'ip-b', options)).allowed, true);
  assert.equal((await recordAuthAttempt(root, 'ip-a', {...options, now: now + 1001})).allowed, true);
});

test('Google RSA verification returns verified subject and normalized email', async () => {
  assert.deepEqual(await verifyGoogleCredential(jwt(), verifyOptions), {email: 'user@example.com', sub: 'google-subject'});
  assert.deepEqual(await verifyGoogleCredential(jwt({nonce: 'gate-nonce'}), {...verifyOptions, nonce: 'gate-nonce'}), {email: 'user@example.com', sub: 'google-subject'});
  await assert.rejects(verifyGoogleCredential(jwt({nonce: 'other'}), {...verifyOptions, nonce: 'gate-nonce'}), {code: 'GOOGLE_NONCE'});
  await assert.rejects(verifyGoogleCredential(jwt(), {...verifyOptions, nonce: 'gate-nonce'}), {code: 'GOOGLE_NONCE'});
});

test('Google verification rejects forged signatures and invalid identity claims', async () => {
  const other = generateKeyPairSync('rsa', {modulusLength: 2048});
  await assert.rejects(verifyGoogleCredential(jwt({}, other.privateKey), verifyOptions), {code: 'GOOGLE_SIGNATURE'});
  for (const changes of [{iss: 'https://evil.example'}, {aud: 'another-client'}, {exp: now / 1000}, {email_verified: false}, {email_verified: 'true'}, {sub: ''}, {email: 'bad'}, {nbf: now / 1000 + 120}, {aud: ['test-client', 'other']}, {azp: 'other'}]) await assert.rejects(verifyGoogleCredential(jwt(changes), verifyOptions));
  await assert.rejects(verifyGoogleCredential(jwt({}, pair.privateKey, {alg: 'none'}), verifyOptions));
  await assert.rejects(verifyGoogleCredential('not.a.jwt', verifyOptions));
});
