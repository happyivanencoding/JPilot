import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function listen(server) { server.listen(0, '127.0.0.1'); await once(server,'listening'); return server.address().port; }

test('gateway enforces owner sessions, origin checks, profile scope, revocation and USB-only login', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-gateway-test-'));
  const stub = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ cookie:req.headers.cookie, profiles:req.headers['x-jobpilot-profiles'], authorization:req.headers.authorization || null })); });
  const upstreamPort = await listen(stub);
  const reserve = http.createServer();
  const port = await listen(reserve); await new Promise(r => reserve.close(r));
  fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({host:'jobs.example.test',accounts:{'owner@example.test':['one','two']}}));
  const worker = spawn(process.execPath,['scripts/mobile-gateway.mjs'],{cwd:process.cwd(),env:{...process.env,JOBPILOT_GATEWAY_PORT:String(port),JOBPILOT_UPSTREAM:`http://127.0.0.1:${upstreamPort}`,JOBPILOT_ACCESS_CONFIG:path.join(dir,'config.json'),JOBPILOT_SESSION_FILE:path.join(dir,'sessions.json'),JOBPILOT_USB_LOGIN:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let errors=''; worker.stderr.on('data',b=>{errors+=b});
  try {
    await Promise.race([once(worker.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Gateway failed to start: '+errors)),10000).unref())]);
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base+'/api/mobile')).status,401);
    assert.equal((await fetch(base+'/api/mobile-auth/dev',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
    assert.equal((await fetch(base+'/api/mobile-auth/dev',{method:'POST',headers:{'Cf-Ray':'test'}})).status,403);
    // Fetch may normalize Host. Use HTTP directly to exercise the actual tunnel host.
    const remoteHostStatus = await new Promise((resolve,reject) => {
      const request = http.request(base+'/api/mobile-auth/dev',{method:'POST',headers:{Host:'jobs.example.test'}},response => { response.resume(); resolve(response.statusCode); });
      request.on('error',reject); request.end();
    });
    assert.equal(remoteHostStatus,403);
    assert.equal((await fetch(base+'/api/mobile-auth/bridge')).status,400);
    const auth = await (await fetch(base+'/api/mobile-auth/dev',{method:'POST'})).json();
    assert.ok(auth.token); assert.deepEqual(auth.profiles,['one','two']);
    const headers = {Authorization:`Bearer ${auth.token}`,'X-JobPilot-Profile':'two'};
    const forwarded = await (await fetch(base+'/api/mobile',{headers})).json();
    assert.equal(forwarded.cookie,'career-ops-profile=two');
    assert.equal(forwarded.profiles,'one,two');
    assert.equal(forwarded.authorization,null);
    assert.equal((await fetch(base+'/api/mobile?profileId=other',{headers})).status,403);
    assert.equal((await fetch(base+'/api/mobile',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({profileId:'other'})})).status,403);
    assert.equal((await fetch(base+'/api/mobile',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/mobile-auth/logout',{method:'POST',headers})).status,200);
    assert.equal((await fetch(base+'/api/mobile',{headers})).status,401);
  } finally {
    worker.kill(); await Promise.race([once(worker,'exit'),new Promise(r=>setTimeout(r,2000))]);
    await new Promise(r=>stub.close(r)); fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('gateway permits an explicit shared workspace only when every member has identical grants', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-shared-gateway-test-'));
  const stub = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ profiles:req.headers['x-jobpilot-profiles'] })); });
  const upstreamPort = await listen(stub);
  const reserve = http.createServer();
  const port = await listen(reserve); await new Promise(r => reserve.close(r));
  const configFile = path.join(dir,'config.json');
  const sessionFile = path.join(dir,'sessions.json');
  fs.writeFileSync(configFile,JSON.stringify({workspaceMode:'shared',host:'jobs.example.test',accounts:{'owner@example.test':['one','two'],'developer@example.test':['one','two']}}));
  fs.writeFileSync(sessionFile,JSON.stringify({developerToken:{email:'developer@example.test',profiles:['one','two'],expires:Date.now()+60_000}}));
  const worker = spawn(process.execPath,['scripts/mobile-gateway.mjs'],{cwd:process.cwd(),env:{...process.env,JOBPILOT_GATEWAY_PORT:String(port),JOBPILOT_UPSTREAM:`http://127.0.0.1:${upstreamPort}`,JOBPILOT_ACCESS_CONFIG:configFile,JOBPILOT_SESSION_FILE:sessionFile},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let errors=''; worker.stderr.on('data',b=>{errors+=b});
  try {
    await Promise.race([once(worker.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Shared gateway failed to start: '+errors)),10000).unref())]);
    const response = await (await fetch(`http://127.0.0.1:${port}/api/mobile`,{headers:{Authorization:'Bearer developerToken'}})).json();
    assert.equal(response.profiles,'one,two');
  } finally {
    worker.kill(); await Promise.race([once(worker,'exit'),new Promise(r=>setTimeout(r,2000))]);
    await new Promise(r=>stub.close(r)); fs.rmSync(dir,{recursive:true,force:true});
  }
});
