import '../scripts/register-source-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {roleCvOutcome,reusablePreparedCv} from '../src/lib/onward-cv.mjs';
import {offerInSearchArea,normalizeSearchArea} from '../src/lib/search-area.mjs';
import {applyJobUpdate} from '../src/lib/mobile-domain.mjs';
import {operationKey} from '../src/lib/mobile-state.mjs';
import {rankSearchResults} from '../src/lib/job-search/index.mjs';

const matchBasis={currentScore:50,cvPotentialScore:65};
const prepared={versionId:'v1',language:'en',matchBasis,payload:{summary:'Relevant existing research',experience:[]},assessment:{scoringVersion:'role-fit-2-cv',baselineScore:50,draftScore:58,delta:8}};
const task={kind:'deep_match',status:'completed',inputVersionId:'v1',input:{url:'https://example.test/role'},result:{preparedCv:prepared}};
test('one assessed prepared payload and score survive draft and acceptance',()=>{
 assert.equal(reusablePreparedCv([task],'v1','https://example.test/role/','en',50),prepared);
 for(const [version,language,baseline] of [['v2','en',50],['v1','fr',50],['v1','en',51]]) assert.equal(reusablePreparedCv([task],version,task.input.url,language,baseline),null);
 const values=[{deepMatch:{...matchBasis,preparedCvScore:58}},{v1Match:matchBasis,cvDraft:{status:'pending',matchBasis,assessment:prepared.assessment}},{v1Match:matchBasis,cv:{file:'role.pdf',matchBasis,presentationScore:58}}];
 for(const value of values) assert.deepEqual([roleCvOutcome(value).baseline,roleCvOutcome(value).score,roleCvOutcome(value).gain,roleCvOutcome(value).ready],[50,58,8,true]);
 assert.equal(roleCvOutcome({deepMatch:{...matchBasis,cvPotentialScore:65}}).ready,false);
 assert.equal(roleCvOutcome({v1Match:matchBasis,cvDraft:{status:'pending',assessment:{baselineScore:70,draftScore:78,delta:8}}}).score,58);
 assert.equal(roleCvOutcome({v1Match:matchBasis,cvDraft:{status:'pending',assessment:null}}).ready,false);
});
test('prepared content identities separate application languages',()=>{
 const input={experience:'v1',url:task.input.url};
 assert.notEqual(operationKey('deep_match',{...input,applicationLanguage:'en'},{id:'v1'},[]),operationKey('deep_match',{...input,applicationLanguage:'fr'},{id:'v1'},[]));
});
test('explicit search geography rejects outside and ambiguous locations at ranking time',()=>{
 const area=normalizeSearchArea({scope:'city',city:' Paris  '});
 const offer=(id,location,country)=>({url:'https://example.test/'+id,title:'Research analyst internship',company:id,location,country,description:'Research reporting analysis',contractType:'Stage'});
 assert.equal(offerInSearchArea(offer('a','Paris','France'),area),true);
 assert.equal(offerInSearchArea(offer('b','Paris, Texas','US'),area),false);
 assert.equal(offerInSearchArea(offer('c','Paris',''),area),false);
 assert.equal(offerInSearchArea({...offer('d','Paris',''),source:'France Travail'},area),true);
 assert.equal(offerInSearchArea(offer('e','Villeparisis','France'),area),false);
 assert.equal(offerInSearchArea(offer('f','Lyon','France'),{scope:'france'}),true);
 const result=rankSearchResults({query:'Research analyst',country:'France',city:'Paris',searchArea:area,contractTypes:['Stage']},[offer('paris','Paris','France'),offer('lyon','Lyon','France'),offer('texas','Paris, Texas','US')],[]);
 assert.deepEqual(result.offers.map(o=>o.company),['paris']);
});
test('auto CV import detects real document language independently of analysis language',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-import-'));
 const previous=process.env.CAREER_OPS_ROOT;process.env.CAREER_OPS_ROOT=root;
 try {
  fs.mkdirSync(path.join(root,'data'),{recursive:true});
  fs.writeFileSync(path.join(root,'data/profiles.json'),JSON.stringify({version:1,defaultProfileId:'synthetic',profiles:[{id:'synthetic',name:'Synthetic',cvMarkdown:'data/cv.md',config:'data/config.yml',notes:'data/notes.md',candidatures:'data/candidatures.json'}]}));
  fs.writeFileSync(path.join(root,'data/cv.md'),'');fs.writeFileSync(path.join(root,'data/notes.md'),'');fs.writeFileSync(path.join(root,'data/config.yml'),'cv: {language: en}');
  const {saveImportedCv,currentCandidateVersion}=await import('../src/lib/mobile-history.ts');
  await saveImportedCv('synthetic','Formation et recherche avec des projets pour les entreprises.',currentCandidateVersion('synthetic').id,'auto','zh',['Stage']);
  let config=yaml.load(fs.readFileSync(path.join(root,'data/config.yml'),'utf8'));
  assert.equal(config.cv.language,'fr');assert.equal(config.cv.source_language,'fr');assert.equal(config.display.analysis_language,'zh');
  await saveImportedCv('synthetic','EDUCATION SKILLS Research with Python and databases for the team.',currentCandidateVersion('synthetic').id,'auto','fr',['CDI']);
  config=yaml.load(fs.readFileSync(path.join(root,'data/config.yml'),'utf8'));
  assert.equal(config.cv.language,'en');assert.equal(config.cv.source_language,'en');assert.equal(config.display.analysis_language,'fr');
 } finally {
  if(previous===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=previous;
  fs.rmSync(root,{recursive:true,force:true});
 }
});

test('reply autosave edits one draft without manufacturing received-reply events',()=>{
 const job={status:'À candidater',followup:{note:'Original'},replies:[{text:'Existing reply'}]};
 const updated=applyJobUpdate(applyJobUpdate(job,{replyNote:'Draft'}),{replyNote:'Draft updated'});
 assert.equal(updated.followup.replyNote,'Draft updated');assert.deepEqual(updated.replies,job.replies);
 assert.equal(applyJobUpdate(updated,{replyNote:''}).followup.replyNote,'');
 assert.throws(()=>applyJobUpdate(updated,{replyNote:'x'.repeat(12001)}));
 assert.equal(job.followup.replyNote,undefined);
});
