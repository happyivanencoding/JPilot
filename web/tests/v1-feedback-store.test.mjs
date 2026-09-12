import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {saveV1Feedback} from '../src/lib/v1-feedback-store.mjs';

test('feedback survey persists the remaining interview answers and willingness-to-pay after reopen question removal',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-feedback-')),before=process.env.CAREER_OPS_ROOT;
 process.env.CAREER_OPS_ROOT=root;t.after(()=>{if(before===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=before;fs.rmSync(root,{recursive:true,force:true});});
 const saved=saveV1Feedback('tester-a',{kind:'survey',useful:'Role CV',distrust:'Match score',nextStep:'Job detail',alternative:'Job sites',willingnessToPay:'Depends on price',note:'Keep it simple'});
 assert.equal(saved.kind,'survey');
 const database=new DatabaseSync(path.join(root,'.career-ops-web','v1-feedback.sqlite'));
 try{const row=database.prepare('SELECT kind,useful,distrust,next_step,reopen,alternative,willingness_to_pay,note FROM feedback WHERE id=?').get(saved.id);assert.deepEqual(Object.fromEntries(Object.entries(row)),{kind:'survey',useful:'Role CV',distrust:'Match score',next_step:'Job detail',reopen:'',alternative:'Job sites',willingness_to_pay:'Depends on price',note:'Keep it simple'});}finally{database.close();}
});


test('combined feedback and issue entry persists as one free-form feedback record',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-feedback-freeform-')),before=process.env.CAREER_OPS_ROOT;
 process.env.CAREER_OPS_ROOT=root;t.after(()=>{if(before===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=before;fs.rmSync(root,{recursive:true,force:true});});
 const saved=saveV1Feedback('tester-b',{kind:'feedback',note:'The city field overflowed and I would like a clearer CV preview.'});
 assert.equal(saved.kind,'feedback');
 const database=new DatabaseSync(path.join(root,'.career-ops-web','v1-feedback.sqlite'));
 try{const row=database.prepare('SELECT kind,reopen,note FROM feedback WHERE id=?').get(saved.id);assert.deepEqual(Object.fromEntries(Object.entries(row)),{kind:'feedback',reopen:'',note:'The city field overflowed and I would like a clearer CV preview.'});}finally{database.close();}
});
