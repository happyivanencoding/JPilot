import '../scripts/register-source-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {roleCvJourney,roleCvOutcome} from '../src/lib/onward-cv.mjs';
import {offerInSearchArea,normalizeSearchArea} from '../src/lib/search-area.mjs';
import {applyJobUpdate} from '../src/lib/mobile-domain.mjs';
import {operationKey} from '../src/lib/mobile-state.mjs';
import {rankSearchResults} from '../src/lib/job-search/index.mjs';
import {professionalTailoredHtml} from '../src/lib/backend/reference-template.mjs';

const matchBasis={currentScore:50,cvPotentialScore:65};
const prepared={versionId:'v1',language:'en',matchBasis,payload:{summary:'Relevant existing research',experience:[]},assessment:{scoringVersion:'role-fit-2-cv',baselineScore:50,draftScore:58,delta:8}};
const task={kind:'deep_match',status:'completed',inputVersionId:'v1',input:{url:'https://example.test/role'},result:{deepMatch:matchBasis}};
test('public CV uplift exists only for a real assessed draft or accepted document',()=>{
 const values=[{v1Match:matchBasis,cvDraft:{status:'pending',matchBasis,assessment:prepared.assessment}},{v1Match:matchBasis,cv:{file:'role.pdf',matchBasis,presentationScore:58}}];
 for(const value of values) assert.deepEqual([roleCvOutcome(value).baseline,roleCvOutcome(value).score,roleCvOutcome(value).gain,roleCvOutcome(value).ready],[50,58,8,true]);
 assert.deepEqual(roleCvOutcome({deepMatch:{...matchBasis,preparedCvScore:58}}),{baseline:50,score:50,gain:0,ready:false,kind:'none'});
 assert.equal(roleCvOutcome({deepMatch:{...matchBasis,cvPotentialScore:65}}).ready,false);
 assert.equal(roleCvOutcome({v1Match:matchBasis,cvDraft:{status:'pending',assessment:{baselineScore:70,draftScore:78,delta:8}}}).score,58);
 assert.equal(roleCvOutcome({v1Match:matchBasis,cvDraft:{status:'pending',assessment:null}}).ready,false);
});
test('Optimize CV journey has one current score, one presentation score and one quick-boost potential',()=>{
 const deep={currentScore:50,cvPotentialScore:54,capabilityPotentialScore:65,quickBoosts:[
  {kind:'confirm_existing',title:'Demand analysis experience',why:'The CV hints at similar work.',nextAction:'Confirm one real example',potential:4},
  {kind:'confirm_existing',title:'User support experience',why:'Service work may overlap.',nextAction:'Add a concrete example',potential:3},
  {kind:'quick_build',title:'Business Analysis mini-project',why:'A short case can show the workflow.',nextAction:'Build one case',potential:5},
  {kind:'quick_build',title:'Role-relevant tool practice',why:'The posting names this tool.',nextAction:'Complete a focused exercise',potential:3},
 ]};
 const basis={...deep,deepMatch:deep};
 const before=roleCvJourney({v1Match:basis});
 assert.deepEqual([before.current,before.optimised,before.optimisedEstimated,before.capability,before.quickBoosts.length],[50,54,true,65,4]);
 const after=roleCvJourney({v1Match:basis,cvDraft:{status:'pending',matchBasis:basis,assessment:{scoringVersion:'role-fit-2-cv',baselineScore:50,draftScore:54,delta:4}}});
 assert.deepEqual([after.current,after.optimised,after.optimisedEstimated,after.capability,after.expressionGain,after.totalGain],[50,54,false,65,4,15]);
 assert.deepEqual(after.quickBoosts.map(item=>item.kind),['confirm_existing','confirm_existing','quick_build','quick_build']);
});
test('deep-match identity ignores application CV language; CV generation owns that dimension',()=>{
 const input={experience:'v1',url:task.input.url};
 assert.equal(operationKey('deep_match',{...input,applicationLanguage:'en'},{id:'v1'},[]),operationKey('deep_match',{...input,applicationLanguage:'fr'},{id:'v1'},[]));
 assert.notEqual(operationKey('cv',{jobId:'j1',applicationLanguage:'en'},{id:'v1'},[{id:'j1',url:task.input.url}]),operationKey('cv',{jobId:'j1',applicationLanguage:'fr'},{id:'v1'},[{id:'j1',url:task.input.url}]));
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
test('application CV language stays independent from uploaded source and analysis language',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-import-'));
 const previous=process.env.CAREER_OPS_ROOT;process.env.CAREER_OPS_ROOT=root;
 try {
  fs.mkdirSync(path.join(root,'data'),{recursive:true});
  fs.writeFileSync(path.join(root,'data/profiles.json'),JSON.stringify({version:1,defaultProfileId:'synthetic',profiles:[{id:'synthetic',name:'Synthetic',cvMarkdown:'data/cv.md',config:'data/config.yml',notes:'data/notes.md',candidatures:'data/candidatures.json'}]}));
  fs.writeFileSync(path.join(root,'data/cv.md'),'');fs.writeFileSync(path.join(root,'data/notes.md'),'');fs.writeFileSync(path.join(root,'data/config.yml'),'cv: {language: en}');
  const {saveImportedCv,currentCandidateVersion}=await import('../src/lib/mobile-history.ts');
  await saveImportedCv('synthetic','Formation et recherche avec des projets pour les entreprises.',currentCandidateVersion('synthetic').id,'en','zh',['Stage']);
  let config=yaml.load(fs.readFileSync(path.join(root,'data/config.yml'),'utf8'));
  assert.equal(config.cv.language,'en');assert.equal(config.cv.source_language,'fr');assert.equal(config.display.analysis_language,'zh');
  await saveImportedCv('synthetic','EDUCATION SKILLS Research with Python and databases for the team.',currentCandidateVersion('synthetic').id,'fr','fr',['CDI']);
  config=yaml.load(fs.readFileSync(path.join(root,'data/config.yml'),'utf8'));
  assert.equal(config.cv.language,'fr');assert.equal(config.cv.source_language,'en');assert.equal(config.display.analysis_language,'fr');
  await saveImportedCv('synthetic','教育 经历 技能 项目',currentCandidateVersion('synthetic').id,'en','en',['Stage']);
  config=yaml.load(fs.readFileSync(path.join(root,'data/config.yml'),'utf8'));
  assert.equal(config.cv.language,'en');assert.equal(config.cv.source_language,'auto');assert.equal(config.display.analysis_language,'en');
 } finally {
  if(previous===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=previous;
  fs.rmSync(root,{recursive:true,force:true});
 }
});

test('role CV layout translation covers source-only text that survives the tailored payload',async()=>{
 const {roleCvLayoutSurface,applyRoleCvLayoutTranslation}=await import('../src/lib/tailored-cv.ts');
 const layout={name:'李若晴',headline:'数据分析师',contact:['巴黎 · +33 6 00 00 00 00 · ruoqing@example.test'],sections:[
  {kind:'experience',title:'工作经历',blocks:[{kind:'entry',text:'图书馆 — 2026'},{kind:'bullet',text:'整理数据'}]},
  {kind:'languages',title:'语言',blocks:[{kind:'text',text:'中文：母语 · 法语：B2'}]},
 ],footer:['更新于 2026']};
 const payload={summary:'Data analyst.',experience:[{company:'Library',role:'Assistant',location:'Paris',dates:'2026',bullets:['Organised data.']}],skills:[]};
 const surface=roleCvLayoutSurface(layout,payload);
 assert.deepEqual(surface.sections[0].blocks,[],'tailored experience content is replaced, so only its source title survives');
 assert.deepEqual(surface.sections[1].blocks,['中文：母语 · 法语：B2']);
 const translated=applyRoleCvLayoutTranslation(layout,{name:'Ruoqing Li',headline:'Data Analyst',contact:['Paris · +33 6 00 00 00 00 · ruoqing@example.test'],sections:[
  {kind:'experience',title:'Experience',blocks:[]},
  {kind:'languages',title:'Languages',blocks:['Chinese: Native · French: B2']},
 ],footer:['Updated 2026']},payload);
 const html=professionalTailoredHtml({content:'',layoutSource:translated,language:'en',tailoredPayload:payload});
 assert.match(html,/Ruoqing Li/);assert.match(html,/Chinese: Native/);assert.match(html,/Organised data/);assert.doesNotMatch(html,/[\u3400-\u9fff]/u);
});

test('reply autosave edits one draft without manufacturing received-reply events',()=>{
 const job={status:'À candidater',followup:{note:'Original'},replies:[{text:'Existing reply'}]};
 const updated=applyJobUpdate(applyJobUpdate(job,{replyNote:'Draft'}),{replyNote:'Draft updated'});
 assert.equal(updated.followup.replyNote,'Draft updated');assert.deepEqual(updated.replies,job.replies);
 assert.equal(applyJobUpdate(updated,{replyNote:''}).followup.replyNote,'');
 assert.throws(()=>applyJobUpdate(updated,{replyNote:'x'.repeat(12001)}));
 assert.equal(job.followup.replyNote,undefined);
});
