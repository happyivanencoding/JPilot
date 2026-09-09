import '../scripts/register-source-loader.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {blockBMatches,reportTableValue} from '../src/lib/report-job-fields.mjs';
import {alreadyLocalized} from '../src/lib/localization-core.mjs';
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
  options.onFinalText(JSON.stringify({translations:rows.map(row=>({id:row.id,text:broken?'错误输出':`中文说明 ${row.text}`}))}));
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
  assert.equal(failed.localization.failed,true);assert.equal(calls,count+1);
  await finished('fixture-a',changed);assert.equal(calls,count+1,'failure requires an explicit retry');
  const operation=readJson(path.join(historyDirectory('fixture-a'),'localizations/zh/active.json'));
  assert.equal(operation.status,'failed');
  broken=false;const recovered=await finished('fixture-a',changed,{retry:true});
  assert.equal(recovered.localization.pending,false);assert.match(recovered.markdown,/3\.1\/5/);assert.equal(calls,count+2);
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
