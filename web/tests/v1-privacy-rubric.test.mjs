import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CV_PRIVACY_VERSION,recordCvChoice,assertCvConsent,assertNotWithdrawn,privacyRecord,privacyRecipients} from '../src/lib/cv-privacy.mjs';
import {anchoredBreakdown,MATCH_METHOD} from '../src/lib/match-rubric.mjs';
import {deepMatchPrompt,normalizeDeepMatch,projectV1JobScores} from '../src/lib/v1-match.mjs';
import {displaySlots} from '../src/lib/localization-core.mjs';
import {operationKey} from '../src/lib/mobile-state.mjs';
const result=(ratings={role:3,duties:3,tools_languages:2,level:4})=>({scoring_version:'role-fit-2',scoring_method:MATCH_METHOD,ratings,score_rationale:Object.fromEntries(Object.keys(ratings).map(key=>[key,{reason:'Relevant student projects, but limited production practice.',job_evidence:'Experience with SQL',cv_evidence:'University SQL project',unknown:false}]))});
test('fixed anchors calculate exact awarded and deducted points, never a free-form AI total',()=>{
 const raw={...result(),current_score:99};const normal=normalizeDeepMatch(raw,{score:18});
 assert.equal(normal.currentScore,76);assert.deepEqual(normal.scoreComponents,{role:23,duties:23,tools_languages:10,level:20});
 assert.equal(normal.scoreBreakdown.reduce((n,r)=>n+r.deducted,0),24);
 for(const r of normal.scoreBreakdown)assert.equal(r.points+r.deducted,r.max);
 assert.equal(normal.scoringMethod,MATCH_METHOD);
});
test('invalid rubric data is refused and declared unknown criteria stay neutral',()=>{
 const missing=result();delete missing.score_rationale.role;assert.throws(()=>anchoredBreakdown(missing),/Incomplete/);
 assert.throws(()=>anchoredBreakdown(result({role:5,duties:3,tools_languages:2,level:4})),/Incomplete/);
 const unknown=result();unknown.score_rationale.role.unknown=true;assert.equal(anchoredBreakdown(unknown).rows[0].rating,2);
 unknown.ratings.role=2;assert.equal(anchoredBreakdown(unknown).rows[0].points,15);
});
test('retrieval score, provider URL, company, old intelligence and CV ids do not perturb the scoring prompt',()=>{
 const args={candidate:{id:'a',sources:{cv:{text:'Student, SQL project'},notes:{text:''}}},offer:{url:'https://example.com/a',title:'Data Engineer',description:'SQL and Python. Apprenticeship.',company:'A',contractType:'Alternance'},fastMatch:{score:22},jobIntelligence:{roleSummary:'cached'}};
 const changed={...args,candidate:{...args.candidate,id:'b'},fastMatch:{score:94},offer:{...args.offer,url:'https://example.com/b',company:'B'},jobIntelligence:{roleSummary:'different'}};
 assert.equal(deepMatchPrompt(args),deepMatchPrompt(changed));
 const version={id:'same-cv'};assert.equal(operationKey('deep_match',{experience:'v1',url:args.offer.url,uiLocale:'en'},version,[]),operationKey('deep_match',{experience:'v1',url:args.offer.url,uiLocale:'zh'},version,[]));
 assert.match(operationKey('deep_match',{experience:'v1',url:args.offer.url},version,[]),/anchored/);
});
test('score localization can translate the explanation but never points or original source excerpts',()=>{
 const deep=normalizeDeepMatch(result(),{score:10});const slots=displaySlots({deepMatch:deep},'offer');
 assert.ok(slots.some(s=>s.path.includes('scoreBreakdown')&&s.path.at(-1)==='reason'));
 assert.ok(!slots.some(s=>['points','deducted','rating','max','jobEvidence','candidateEvidence'].includes(s.path.at(-1))));
 assert.deepEqual(normalizeDeepMatch({scoring_version:'role-fit-2',score_components:{role:10,duties:10,tools_languages:5,level:0}},{score:25}).scoreBreakdown,[]);
});
test('CV consent is explicit, versioned, profile-scoped, and withdrawal is pending rather than fake deletion',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jp-privacy-'));const a=path.join(root,'a'),b=path.join(root,'b');fs.mkdirSync(a);fs.mkdirSync(b);
 try {
  assert.throws(()=>assertCvConsent(a),/read and accept/);
  for(const acknowledged of [false,undefined,'true'])await assert.rejects(()=>recordCvChoice(a,{action:'accept',version:CV_PRIVACY_VERSION,acknowledged,locale:'en'}),/read and accept/);
  await assert.rejects(()=>recordCvChoice(a,{action:'accept',version:'old',acknowledged:true,locale:'en'}),/current/);
  assert.equal(privacyRecord(a),null);
  const record=await recordCvChoice(a,{action:'accept',version:CV_PRIVACY_VERSION,acknowledged:true,locale:'zh'});
  assert.equal(record.locale,'zh');assert.ok(Date.parse(record.acceptedAt));assert.equal(assertCvConsent(a).version,CV_PRIVACY_VERSION);
  assert.throws(()=>assertCvConsent(b),/read and accept/);
  fs.writeFileSync(path.join(a,'original.txt'),'original unchanged');
  const withdrawn=await recordCvChoice(a,{action:'withdraw'});assert.equal(withdrawn.deletionStatus,'pending');assert.ok(withdrawn.withdrawnAt);
  assert.throws(()=>assertCvConsent(a),/withdrawn/);assert.throws(()=>assertNotWithdrawn(a),/withdrawn/);assertNotWithdrawn(b);
  assert.equal(fs.readFileSync(path.join(a,'original.txt'),'utf8'),'original unchanged');
  await assert.rejects(()=>recordCvChoice(a,{action:'accept',version:CV_PRIVACY_VERSION,acknowledged:true,locale:'en'}),/pending/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('notice displays actual configured endpoint domains without disclosing credential/path/query',()=>{
 assert.deepEqual(privacyRecipients({JOBPILOT_OPENAI_CHAT_URL:'https://api.example.com/private?key=no',JOBPILOT_DEEPSEEK_CHAT_URL:'https://translate.example.org/api'}),{analysis:'api.example.com',translation:'translate.example.org'});
});

test('rejecting a draft releases its frozen baseline so a new CV can receive a fresh assessment',()=>{
 const old={currentScore:20,cvPotentialScore:30};const deep=normalizeDeepMatch(result(),{});
 const job={url:'https://example.com/new-cv',v1Match:old,cvDraft:{status:'rejected',baseVersionId:'old-cv',matchBasis:old}};
 const projected=projectV1JobScores(job,[{kind:'deep_match',status:'completed',inputVersionId:'new-cv',input:{url:job.url},result:{deepMatch:deep}}],'new-cv');
 assert.equal(projected.matchScore.current,76);assert.equal(projected.matchScore.reviewed,false);
});
