import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingAutosave} from '../src/components/jobpilot/tracking-autosave.mjs';
import {createAnalytics} from '../src/components/jobpilot/analytics.ts';

test('autosave serializes edits and preserves newer edits after a failed write', async()=>{
 const written=[],states=[];let fail=true;
 const saver=trackingAutosave(async patch=>{written.push(patch);if(fail){fail=false;throw Error('offline');}},state=>states.push(state),60000);
 saver.edit({note:'first'});await saver.flush();assert.equal(saver.dirty,true);
 saver.edit({note:'latest',replyNote:'reply'});await saver.flush();
 assert.deepEqual(written,[{note:'first'},{note:'latest',replyNote:'reply'}]);
 assert.equal(saver.dirty,false);assert.equal(states.at(-1),'saved');
});

test('normal result navigation does not abandon AI wait; backgrounding does', async t=>{
 const document=new EventTarget();document.hidden=false;
 const window=new EventTarget(),received=[];
 t.mock.method(globalThis,'fetch',async(_url,init)=>{received.push(...JSON.parse(init.body).events);return {ok:true};});
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document=document;globalThis.window=window;
 const analytics=createAnalytics('synthetic-profile');
 try{
   analytics.enter('onboarding_analysis');
   analytics.begin('analysis-one','analysis');
   analytics.enter('onboarding_direction');
   analytics.bind('analysis-one',{id:'analysis-task',kind:'analysis',status:'completed'});
   await analytics.flush();await new Promise(r=>setImmediate(r));await analytics.flush();
   assert.equal(received.filter(e=>e.event==='ai_wait'&&e.status==='abandoned').length,0);
   assert.equal(received.filter(e=>e.event==='ai_wait'&&e.status==='completed').length,1);
   analytics.begin('search-one','search');document.hidden=true;
   document.dispatchEvent(new Event('visibilitychange'));
   await new Promise(r=>setImmediate(r));await analytics.flush();
   assert.equal(received.filter(e=>e.event==='ai_wait'&&e.status==='abandoned').length,1);
   assert.ok(received.every(e=>!('profileId' in e)&&!('email' in e)));
 }finally{analytics.dispose();globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
