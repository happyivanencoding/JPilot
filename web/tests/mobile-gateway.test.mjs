import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { generateKeyPairSync, sign } from 'node:crypto';

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

test('gateway gives admins all profiles but ordinary users exactly one profile', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-account-scope-test-'));
  const stub = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ profiles:req.headers['x-jobpilot-profiles'],role:req.headers['x-jobpilot-role'],cookie:req.headers.cookie })); });
  const upstreamPort = await listen(stub);
  const reserve = http.createServer();
  const port = await listen(reserve); await new Promise(r => reserve.close(r));
  const configFile = path.join(dir,'config.json'),sessionFile = path.join(dir,'sessions.json'),profilesFile=path.join(dir,'profiles.json');
  fs.writeFileSync(profilesFile,JSON.stringify({profiles:[{id:'one'},{id:'two'}]}));
  fs.writeFileSync(configFile,JSON.stringify({host:'jobs.example.test',accounts:{'owner@example.test':{role:'admin'},'member@gmail.com':{role:'user',profileId:'one'}}}));
  fs.writeFileSync(sessionFile,JSON.stringify({adminToken:{email:'owner@example.test',expires:Date.now()+60_000},memberToken:{email:'member@gmail.com',expires:Date.now()+60_000}}));
  const worker = spawn(process.execPath,['scripts/mobile-gateway.mjs'],{cwd:process.cwd(),env:{...process.env,JOBPILOT_GATEWAY_PORT:String(port),JOBPILOT_UPSTREAM:`http://127.0.0.1:${upstreamPort}`,JOBPILOT_ACCESS_CONFIG:configFile,JOBPILOT_SESSION_FILE:sessionFile,JOBPILOT_PROFILE_REGISTRY:profilesFile},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let errors=''; worker.stderr.on('data',b=>{errors+=b});
  try {
    await Promise.race([once(worker.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Gateway failed to start: '+errors)),10000).unref())]);
    const base=`http://127.0.0.1:${port}`;
    const admin=await (await fetch(base+'/api/mobile',{headers:{Authorization:'Bearer adminToken'}})).json();
    assert.equal(admin.profiles,'one,two');assert.equal(admin.role,'admin');
    const member=await (await fetch(base+'/api/mobile',{headers:{Authorization:'Bearer memberToken'}})).json();
    assert.equal(member.profiles,'one');assert.equal(member.role,'user');assert.equal(member.cookie,'career-ops-profile=one');
    assert.equal((await fetch(base+'/api/mobile?profileId=two',{headers:{Authorization:'Bearer memberToken'}})).status,403);
  } finally {
    worker.kill(); await Promise.race([once(worker,'exit'),new Promise(r=>setTimeout(r,2000))]);
    await new Promise(r=>stub.close(r)); fs.rmSync(dir,{recursive:true,force:true});
  }
});

function googleToken(privateKey,kid,clientId,email){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const head=encode({alg:'RS256',kid,typ:'JWT'}),body=encode({iss:'https://accounts.google.com',aud:clientId,sub:'google-user',email,email_verified:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
  return `${head}.${body}.${sign('RSA-SHA256',Buffer.from(`${head}.${body}`),privateKey).toString('base64url')}`;
}

test('Google login uses the allowlist for both Web sessions and Android pairing', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-google-test-'));
  const stub=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({profiles:req.headers['x-jobpilot-profiles'],role:req.headers['x-jobpilot-role']}));});
  const upstreamPort=await listen(stub),jwksServer=http.createServer();
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=publicKey.export({format:'jwk'});jwk.kid='google-test';jwk.alg='RS256';
  jwksServer.on('request',(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[jwk]}));});const jwksPort=await listen(jwksServer);
  const reserve=http.createServer();const port=await listen(reserve);await new Promise(r=>reserve.close(r));
  const clientId='123456789-jobpilot.apps.googleusercontent.com',configFile=path.join(dir,'config.json'),sessionFile=path.join(dir,'sessions.json'),profilesFile=path.join(dir,'profiles.json');
  fs.writeFileSync(profilesFile,JSON.stringify({profiles:[{id:'mine'}]}));
  fs.writeFileSync(configFile,JSON.stringify({host:'jobs.example.test',googleClientId:clientId,accounts:{'member@gmail.com':{role:'user',profileId:'mine'}}}));
  const worker=spawn(process.execPath,['scripts/mobile-gateway.mjs'],{cwd:process.cwd(),env:{...process.env,JOBPILOT_GATEWAY_PORT:String(port),JOBPILOT_UPSTREAM:`http://127.0.0.1:${upstreamPort}`,JOBPILOT_ACCESS_CONFIG:configFile,JOBPILOT_SESSION_FILE:sessionFile,JOBPILOT_PROFILE_REGISTRY:profilesFile,JOBPILOT_GOOGLE_JWKS_URL:`http://127.0.0.1:${jwksPort}`},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let errors='';worker.stderr.on('data',b=>{errors+=b});
  try{
    await Promise.race([once(worker.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Google gateway failed to start: '+errors)),10000).unref())]);
    const base=`http://127.0.0.1:${port}`,credential=googleToken(privateKey,jwk.kid,clientId,'member@gmail.com');
    const browser=await fetch(base+'/api/mobile-auth/google/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential})});assert.equal(browser.status,200);
    const browserCookie=browser.headers.get('set-cookie').split(';')[0];
    const browserState=await (await fetch(base+'/api/mobile',{headers:{Cookie:browserCookie}})).json();assert.equal(browserState.profiles,'mine');assert.equal(browserState.role,'user');
    const start=await (await fetch(base+'/api/mobile-auth/start',{method:'POST'})).json();assert.equal(start.provider,'google');assert.match(start.url,/\/api\/mobile-auth\/google\?request=/);
    const linked=await fetch(base+'/api/mobile-auth/google/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential,requestId:start.requestId})});assert.equal(linked.status,200);
    const mobile=await (await fetch(base+'/api/mobile-auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:start.requestId,verifier:start.verifier})})).json();assert.ok(mobile.token);assert.deepEqual(mobile.profiles,['mine']);assert.equal(mobile.role,'user');
    const outsider=googleToken(privateKey,jwk.kid,clientId,'outsider@gmail.com');assert.equal((await fetch(base+'/api/mobile-auth/google/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:outsider})})).status,400);
    fs.writeFileSync(configFile,JSON.stringify({host:'jobs.example.test',googleClientId:clientId,accounts:{}}));
    assert.equal((await fetch(base+'/api/mobile',{headers:{Cookie:browserCookie}})).status,401,'revocation takes effect without restarting the gateway');
  } finally {
    worker.kill();await Promise.race([once(worker,'exit'),new Promise(r=>setTimeout(r,2000))]);await new Promise(r=>stub.close(r));await new Promise(r=>jwksServer.close(r));fs.rmSync(dir,{recursive:true,force:true});
  }
});
