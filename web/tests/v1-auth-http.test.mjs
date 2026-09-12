import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('HTTP gate enforces login modes, arbitrary admin IDs, profile isolation and fresh gate after logout',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-auth-http-'));
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
  const web=fileURLToPath(new URL('../',import.meta.url));
  const worker=spawn(process.execPath,[path.join(web,'node_modules/next/dist/bin/next'),'start','-p',String(port)],{cwd:web,env:{...process.env,CAREER_OPS_ROOT:root,JOBPILOT_V1_PREVIEW:'1',CAREER_OPS_WEB_ALLOWED_HOSTS:'127.0.0.1',JOBPILOT_GOOGLE_CLIENT_ID:'test-client',JOBPILOT_V1_TEST_CODE:'ONWARDV1',JOBPILOT_V1_ADMIN_CODE:'ANSHUN'},stdio:['ignore','pipe','pipe']});
  let logs='';worker.stdout.on('data',v=>{logs+=v;});worker.stderr.on('data',v=>{logs+=v;});
  const base=`http://127.0.0.1:${port}`,jar=new Map();
  const call=async(url,body,headers={})=>{
    const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...headers},body:body?JSON.stringify(body):undefined});
    for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],i=pair.indexOf('=');if(pair.slice(i+1))jar.set(pair.slice(0,i),pair.slice(i+1));else jar.delete(pair.slice(0,i));}
    return r;
  };
  try {
    for(let i=0;i<100;i++){try{if((await fetch(base+'/api/v1/session')).ok)break;}catch{}if(i===99)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
    assert.equal((await call('/api/mobile')).status,401);
    assert.equal((await call('/api/v1/session',{action:'login',id:'a'})).status,403);
    assert.equal((await call('/api/v1/session',{action:'verifyCode',code:'wrong'})).status,401);
    let r=await call('/api/v1/session',{action:'verifyCode',code:'ONWARDV1'});assert.equal(r.status,200);assert.equal((await r.json()).loginMode,'google');
    assert.equal((await call('/api/v1/session',{action:'login',email:'fake@gmail.com'})).status,403);
    assert.equal((await call('/api/v1/session',{action:'google',credential:'forged'})).status,401);
    assert.equal((await call('/api/v1/session')).status,200);assert.equal((await (await call('/api/v1/session')).json()).authenticated,false);
    r=await call('/api/v1/session',{action:'verifyCode',code:'ANSHUN'});assert.equal((await r.json()).loginMode,'admin');
    assert.equal((await call('/api/v1/session',{action:'login',id:' '})).status,400);
    r=await call('/api/v1/session',{action:'login',id:'QA 任意 ID / 1'});assert.equal(r.status,200);const first=await r.json();assert.equal(first.needsOnboarding,true);
    assert.equal((await call('/api/mobile?profileId=someone-else')).status,403);
    assert.equal((await call('/api/v1/session')).status,200);
    await call('/api/v1/session',{action:'logout'});assert.equal((await call('/api/mobile')).status,401);
    assert.equal((await call('/api/v1/session',{action:'login',id:'QA 任意 ID / 1'})).status,403);
    await call('/api/v1/session',{action:'verifyCode',code:'ANSHUN'});
    r=await call('/api/v1/session',{action:'login',id:'QA 任意 ID / 1'});assert.equal((await r.json()).profileId,first.profileId);
    await call('/api/v1/session',{action:'logout'});
    const state=await (await call('/api/v1/session')).json();assert.equal(state.loginMode,'');assert.equal(state.authenticated,false);
    assert.equal((await call('/api/v1/session',{action:'verifyCode',code:'ANSHUN'},{'sec-fetch-site':'cross-site',origin:'https://other.example'})).status,403);
  } finally {
    worker.kill();await once(worker,'exit');
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(),'onward-auth-http-')));fs.rmSync(root,{recursive:true,force:true});
  }
});
