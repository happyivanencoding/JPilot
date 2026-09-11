import '../scripts/register-source-loader.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {blockBMatches,reportTableValue} from '../src/lib/report-job-fields.mjs';
import {alreadyLocalized,translationKey,translationLooksLikeTarget} from '../src/lib/localization-core.mjs';
const previousRoot=process.env.CAREER_OPS_ROOT;
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-display-'));
process.env.CAREER_OPS_ROOT=root;
fs.mkdirSync(path.join(root,'data'));
fs.writeFileSync(path.join(root,'data/profiles.json'),JSON.stringify({version:1,defaultProfileId:'fixture-a',profiles:['fixture-a','fixture-b'].map(id=>({id,name:id,shortName:id,cvMarkdown:`data/${id}/cv.md`,config:`data/${id}/profile.yml`,notes:`data/${id}/notes.md`,candidatures:`data/${id}/candidatures.json`}))}));
let calls=0,broken=false;
globalThis.__testLocalize=async options=>{
  calls++;options.onRun?.({runId:`fixture-${calls}`,sessionId:'',transport:'deepseek-direct'});
  await new Promise(r=>setTimeout(r,20));
  const rows=JSON.parse(options.prompt.slice(options.prompt.lastIndexOf('\n')+1));
  const french=options.prompt.includes('into French');
  options.onFinalText(JSON.stringify({translations:rows.map(row=>{const tokens=row.text.match(/⟦P\d+⟧/g)||[];let skeleton=row.text;tokens.forEach((token,i)=>{skeleton=skeleton.replace(token,`¤${i}¤`)});skeleton=skeleton.replace(/[\p{L}]+/gu,' ');tokens.forEach((token,i)=>{skeleton=skeleton.replace(`¤${i}¤`,token)});skeleton=skeleton.replace(/\s+/g,' ').trim();return {id:row.id,text:broken?'错误输出':french?`Explication française complète ${skeleton}`:`中文说明 这是完整翻译内容 ${skeleton}`};})}));
};
const stub='data:text/javascript,'+encodeURIComponent('export async function runTranslationTransport(options){return globalThis.__testLocalize(options)}');
const hooks=registerHooks({resolve(specifier,context,next){return specifier==='@/lib/model-transport'?{url:stub,shortCircuit:true}:next(specifier,context)}});
const {localizeDisplay}=await import('../src/lib/display-localization.ts');
const {historyDirectory}=await import('../src/lib/mobile-history.ts');
const {readJson}=await import('../src/lib/mobile-state.mjs');
after(()=>{hooks.deregister();delete globalThis.__testLocalize; if(previousRoot===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=previousRoot;fs.rmSync(root,{recursive:true,force:true})});
async function finished(profile,value,options={}) {
  let view=await localizeDisplay(profile,'zh',value,'result',options);
  for(let n=0;n<200 && view.localization?.pending && !view.localization?.failed;n++) {
    await new Promise(r=>setTimeout(r,10));view=await localizeDisplay(profile,'zh',value,'result');
  }
  return view;
}
const source={markdown:'Le profil présente un écart : 2.8/5, français B1. Source https://example.org/job/42',score:2.8,status:'completed',before:'English source CV',after:'English proposed CV',cv:{text:'Source CV'},jd:'Description du poste originale'};

async function finishedScope(profile,locale,value,scope,options={}) {
  let view=await localizeDisplay(profile,locale,value,scope,options);
  for(let n=0;n<200 && view.localization?.pending && !view.localization?.failed;n++) {
    await new Promise(r=>setTimeout(r,10));view=await localizeDisplay(profile,locale,value,scope,{...options,schedule:false});
  }
  return view;
}
test('concurrent display reads share one translation and never mutate authoritative values',async()=>{
  const original=structuredClone(source);
  const views=await Promise.all(Array.from({length:12},()=>localizeDisplay('fixture-a','zh',source,'result',{identity:'result-1'})));
  assert(views.every(v=>v.localization.pending));
  const view=await finished('fixture-a',source,{identity:'result-1'});
  assert.equal(view.localization.pending,false);assert.equal(calls,1);
  assert.match(view.markdown,/2\.8\/5/);assert.match(view.markdown,/B1/);assert.match(view.markdown,/https:\/\/example.org\/job\/42/);
  for(const key of ['score','status','before','after','cv','jd'])assert.deepEqual(view[key],source[key]);
  assert.deepEqual(source,original);
});
test('locale roundtrip and reopening reuse disk cache; result identity cannot alter a score',async()=>{
  const count=calls;
  const french=await localizeDisplay('fixture-a','fr',source,'result');assert.equal(french.markdown,source.markdown);
  const chinese=await finished('fixture-a',{...source,score:4.1},{identity:'result-2'});
  assert.equal(chinese.score,4.1);assert.equal(chinese.localization.pending,false);assert.equal(calls,count);
});
test('the same source in another profile cannot read the first profile cache',async()=>{
  const count=calls;const view=await finished('fixture-b',source);
  assert.equal(view.localization.pending,false);assert.equal(calls,count+1);
});
test('changed source gets a new operation; malformed evidence is not cached or auto-retried',async()=>{
  const changed={...source,markdown:'Un nouvel écart documenté : 3.1/5 et niveau B2.'};
  broken=true;const count=calls;const failed=await finished('fixture-a',changed);
  assert.equal(failed.localization.failed,true);assert.equal(calls,count+2,'one bounded repair pass is attempted inside the same operation');
  await finished('fixture-a',changed);assert.equal(calls,count+2,'failure still requires an explicit user retry');
  const operation=readJson(path.join(historyDirectory('fixture-a'),'localizations/zh/active.json'));
  assert.equal(operation.status,'failed');assert.ok(operation.repairSegments>=1);
  broken=false;const recovered=await finished('fixture-a',changed,{retry:true});
  assert.equal(recovered.localization.pending,false);assert.match(recovered.markdown,/3\.1\/5/);assert.equal(calls,count+3);
});
test('French wrappers around Chinese facts still require localization',()=>{
  assert.equal(alreadyLocalized('Mettre en avant : 已核实的营销实习。','zh'),false);
  assert.equal(alreadyLocalized('Comment répondez-vous à cet écart : 法语 B1 ?','zh'),false);
  assert.equal(alreadyLocalized('已核实的 ESSEC Marketing 实习。','zh'),true);
});
test('Chinese report tables preserve gap, partial and unknown states instead of defaulting strong',()=>{
  const report='## B) 匹配分析\n| 岗位要求 | 已有证据 | 匹配情况 |\n| --- | --- | --- |\n| 法语 | B1 | 存在差距 |\n| 营销 | 一段实习 | 部分匹配 |\n| Excel | 已记录 | 强匹配 |\n| Python | 待核实 | 待确认 |\n## C) 下一步';
  assert.deepEqual(blockBMatches(report).map(r=>r.fit),['Écart','Partiel','Fort','À confirmer']);
  assert.equal(blockBMatches(report)[0].evidence,'B1');
  assert.equal(reportTableValue('| 工作地点 | Paris |','Lieu','Location','工作地点'),'Paris');
});
test('French and English report headings retain their existing structured projection',()=>{
  for(const label of ['Exigence','Requirement']) {
    const report=`## B) Match\n| ${label} | Evidence | Fit |\n| --- | --- | --- |\n| Python | CV | Partial |\n| Excel | CV | Fort |\n| French | B1 | No match |\n## C) Suite`;
    assert.deepEqual(blockBMatches(report).map(r=>r.fit),['Partiel','Fort','Écart']);
  }
});


test('tailored CV improvement analysis follows UI language while the CV draft body stays in material language',async()=>{
  const job={id:'job-draft-localization',company:'Fixture',role:'Analyst',score:3.2,summary:'Analyse enregistrée.',cvDraft:{
    id:'draft-loc',status:'pending',notesLocale:'fr',atsScore:72,atsPass:false,
    payload:{summary:'English application summary',experience:[{company:'Fixture',role:'Intern',bullets:['English evidence bullet']}],skills:[{category:'IT',items:['SQL']}]},
    changes:['Mettre en avant les preuves les plus pertinentes.'],
    atsIssues:[{severity:'critical',message:'No email address found.'}],
    assessment:{baselineScore:60,draftScore:74,delta:14,summary:'Le brouillon met mieux en avant les preuves existantes.',improvements:['Les preuves pertinentes apparaissent plus tôt.'],remainingGaps:['Le budget reste non documenté.'],revision:1}
  }};
  const original=structuredClone(job),count=calls;
  const view=await finishedScope('fixture-a','zh',job,'job',{identity:'job-draft-localization'});
  assert.equal(view.localization.pending,false);assert.ok(calls>count);
  assert.match(view.cvDraft.assessment.summary,/^中文说明 /);assert.match(view.cvDraft.assessment.improvements[0],/^中文说明 /);assert.match(view.cvDraft.assessment.remainingGaps[0],/^中文说明 /);
  assert.match(view.cvDraft.changes[0],/^中文说明 /);assert.match(view.cvDraft.atsIssues[0].message,/^中文说明 /);
  assert.equal(view.cvDraft.payload.summary,'English application summary');assert.deepEqual(view.cvDraft.payload,job.cvDraft.payload);
  assert.equal(view.cvDraft.assessment.baselineScore,60);assert.equal(view.cvDraft.assessment.draftScore,74);assert.equal(view.cvDraft.assessment.delta,14);
  assert.deepEqual(job,original);
});


test('a dirty French cache containing Chinese is invalidated and translated again',async()=>{
  const sourceText='这是一段应该被翻译成法语的简历改进分析。';
  assert.equal(translationLooksLikeTarget(sourceText,'fr'),false);
  const key=translationKey(sourceText),cache=path.join(historyDirectory('fixture-a'),'localizations/fr/segments',key+'.json');
  fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify({locale:'fr',source:sourceText,translation:sourceText,operationId:'dirty'}));
  const job={id:'dirty-fr-job',cvDraft:{notesLocale:'zh',assessment:{baselineScore:60,draftScore:70,delta:10,summary:sourceText,improvements:[],remainingGaps:[]}}};
  const count=calls;let view=await localizeDisplay('fixture-a','fr',job,'job',{identity:'dirty-fr-job'});assert.equal(view.localization.pending,true);
  for(let n=0;n<200 && view.localization.pending && !view.localization.failed;n++){await new Promise(r=>setTimeout(r,10));view=await localizeDisplay('fixture-a','fr',job,'job',{schedule:false,identity:'dirty-fr-job'});}
  assert.equal(view.localization.pending,false);assert.equal(view.localization.failed,false);assert.ok(calls>count);assert.notEqual(view.cvDraft.assessment.summary,sourceText);assert.equal(translationLooksLikeTarget(view.cvDraft.assessment.summary,'fr'),true);
});

test('V1 career and deep-match explanations follow UI language without translating search/tool tokens',async()=>{
  const snapshot={
    analysis:{markdown:'Analyse de profil.',careerDirections:[{title:'Analyste CRM',why:'Le parcours marketing est cohérent.',evidence:['Expérience de campagne documentée.'],searchQuery:'CRM Analyst'}],searchKeywords:['CRM Analyst','Power BI']},
    discovery:{offers:[{url:'https://example.test/v1-role',why:'Offre pertinente.',fastMatch:{strengths:[{title:'excel',evidence:'CV 中已出现 excel'}],gaps:[{title:'power bi',reason:'岗位描述提到 power bi，当前档案未发现明确证据'}]},deepMatch:{roleSummary:'Analyser les campagnes CRM et les segments clients.',responsibilities:['Construire des analyses de segmentation.'],requirements:[{title:'Analyse CRM',why:'Compétence centrale.'}],tools:['Salesforce','Power BI'],strengths:[{title:'Expérience marketing',evidence:'Une campagne est documentée.'}],presentationGaps:[{title:'Résultats peu visibles',why:'Les preuves sont trop tardives.'}],capabilityGaps:[{title:'Power BI',why:'Non démontré dans le dossier.',nextAction:'Construire un projet réel.'}],cvPotentialReason:'Les preuves existantes peuvent être mieux présentées.'}}]},
    jobs:[],dashboard:{}
  };
  const original=structuredClone(snapshot);
  const view=await finishedScope('fixture-a','zh',snapshot,'snapshot',{identity:'v1-snapshot'});
  assert.equal(view.localization.pending,false);
  assert.match(view.analysis.careerDirections[0].why,/^中文说明 /);
  assert.match(view.discovery.offers[0].deepMatch.roleSummary,/^中文说明 /);
  assert.match(view.discovery.offers[0].deepMatch.capabilityGaps[0].nextAction,/^中文说明 /);
  assert.equal(view.discovery.offers[0].fastMatch.gaps[0].reason,'岗位描述提到 power bi，当前档案未发现明确证据');
  assert.equal(view.analysis.careerDirections[0].searchQuery,'CRM Analyst');
  assert.deepEqual(view.analysis.searchKeywords,['CRM Analyst','Power BI']);
  assert.deepEqual(view.discovery.offers[0].deepMatch.tools,['Salesforce','Power BI']);
  const french=await finishedScope('fixture-b','fr',snapshot,'snapshot',{identity:'v1-snapshot-fr'});
  assert.equal(french.localization.pending,false);
  assert.notEqual(french.discovery.offers[0].fastMatch.gaps[0].reason,'岗位描述提到 power bi，当前档案未发现明确证据');
  assert.equal(translationLooksLikeTarget(french.discovery.offers[0].fastMatch.gaps[0].reason,'fr'),true);
  assert.equal(french.analysis.careerDirections[0].searchQuery,'CRM Analyst');
  assert.deepEqual(french.analysis.searchKeywords,['CRM Analyst','Power BI']);
  assert.deepEqual(french.discovery.offers[0].deepMatch.tools,['Salesforce','Power BI']);
  assert.deepEqual(snapshot,original);
});
