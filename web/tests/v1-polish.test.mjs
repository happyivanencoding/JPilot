import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {directionDescriptor,planDirectionSearch,compactDirectionHistory,V1_SEARCH_REVISION} from '../src/lib/v1-directions.mjs';
import {normalizeDeepMatch,matchScoreView,projectV1JobScores,friendlyGapTitle} from '../src/lib/v1-match.mjs';
import {estimatedProgress,searchProgress} from '../src/lib/v1-progress.mjs';
import {professionalReferenceHtml,textCvLayout} from '../src/lib/backend/reference-template.mjs';
const now=Date.parse('2026-09-11T10:00:00Z');
const task=(id,query,extra={})=>({id,kind:'search',createdAt:'2026-09-11T09:00:00Z',status:'completed',inputVersionId:'cv-a',input:{query},result:{offers:[]},...extra});
test('bilingual equivalents merge, unrelated specialisms and another CV do not',()=>{
 const a=directionDescriptor('Assistant export commercial junior');
 assert.equal(directionDescriptor('Export sales assistant').key,a.key);
 assert.equal(directionDescriptor('出口销售支持').key,a.key);
 assert.notEqual(directionDescriptor('Export customs compliance').key,a.key);
 assert.notEqual(directionDescriptor('Business development energy').key,directionDescriptor('Business development finance').key);
 const plan=planDirectionSearch([task('one','Assistant export commercial junior')],{query:'Export sales assistant'},'cv-a',{},now);
 assert.equal(plan.reuse.id,'one');assert.equal(plan.reason,'merged');
 assert.equal(planDirectionSearch([task('one','Assistant export commercial junior')],{query:'Export sales assistant'},'cv-b',{},now).reason,'new');
});
test('one active selection is reused; six new directions per day still allow cached browsing',()=>{
 const active=task('active','business development',{status:'running'});
 assert.equal(planDirectionSearch([active],{query:'logistics'},'cv-a',{},now).reason,'active');
 const tasks=Array.from({length:6},(_,i)=>task(String(i),'unique '+i));
 assert.equal(planDirectionSearch(tasks,{query:'new role'},'cv-a',{},now).reason,'daily-limit');
 assert.equal(planDirectionSearch(tasks,{query:'unique 2'},'cv-a',{},now).reuse.id,'2');
 assert.equal(planDirectionSearch([active,...tasks],{query:'unique 2'},'cv-a',{},now).reuse.id,'2','existing results can be opened while another direction prepares');
 assert.equal(compactDirectionHistory([task('1','export sales'),task('2','assistant commercial export'),task('3','data analyst')]).length,2);
});
test('search revision invalidates stale cached zero-result directions without deleting history',()=>{
 const old=task('old','Technical Lead FinOps Paris',{input:{query:'Technical Lead FinOps Paris',directionKey:'finops-lead-paris-technical'}});
 const fresh=planDirectionSearch([old],{query:'Technical Lead FinOps Paris',searchRevision:V1_SEARCH_REVISION},'cv-a',{},now);
 assert.equal(fresh.reason,'new');
 const current=task('current','Technical Lead FinOps Paris',{input:{query:'Technical Lead FinOps Paris',directionKey:'finops-lead-paris-technical',searchRevision:V1_SEARCH_REVISION}});
 assert.equal(planDirectionSearch([current],{query:'Technical Lead FinOps Paris',searchRevision:V1_SEARCH_REVISION},'cv-a',{},now).reuse.id,'current');
});
test('AI action buttons progress left-to-right while first-run full-screen water remains bottom-up',()=>{
 const css=fs.readFileSync(new URL('../src/components/jobpilot/onward.css',import.meta.url),'utf8');
 const androidButton=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/PilotDesign.kt',import.meta.url),'utf8');
 const androidWater=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/CvAnalysisWater.kt',import.meta.url),'utf8');
 assert.match(css,/\.jp-ai-button\.liquid \.jp-ai-button-fill\{[^}]*width:var\(--jp-ai-progress,0%\)[^}]*height:100%/);
 assert.match(css,/\.jp-liquid-status \.jp-ai-button-fill\{[^}]*width:100%[^}]*height:var\(--jp-ai-progress,0%\)/);
 assert.match(androidButton,/val liquidRight=size\.width\*progress/);
 assert.match(androidWater,/val waterY = size\.height \* \(1 - level\)/);
});
test('role-CV detail keeps the same before-after score surface even when uplift is zero',()=>{
 const web=fs.readFileSync(new URL('../src/components/jobpilot/cv-outcome.tsx',import.meta.url),'utf8');
 const android=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/OnwardCvOutcome.kt',import.meta.url),'utf8');
 assert.match(web,/if\(outcome\.ready && detail\)/);
 assert.match(web,/匹配分没有变化/);
 assert.match(android,/if\(\(detail&&ready\)\|\|gain>0\)/);
 assert.match(android,/匹配分没有变化/);
});
test('final rubric understands fit independently of retrieval score without an artificial 60 floor',()=>{
 const source={scoring_version:'role-fit-2',score_components:{role:25,duties:21,tools_languages:12,level:14},current_score:72,cv_potential_score:80,capability_potential_score:90};
 const match=normalizeDeepMatch(source,{score:35});
 assert.equal(match.currentScore,72);assert.equal(match.cvPotentialScore,80);
 const weak=normalizeDeepMatch({...source,score_components:{role:8,duties:6,tools_languages:4,level:5},cv_potential_score:28},{score:35});
 assert.equal(weak.currentScore,23);assert.equal(weak.cvPotentialScore,28);
 assert.deepEqual(matchScoreView({deepMatch:match}),{baseline:72,current:72,potential:80,forecast:80,reviewed:false,reviewedScore:null});
});
test('draft/header/card share the same baseline and capped upside; internal assessments are not rewritten',()=>{
 const job={v1Match:{currentScore:41,cvPotentialScore:49},cvDraft:{atsScore:85,assessment:{baselineScore:56,draftScore:76,delta:20}}};
 const projected=projectV1JobScores(job);
 assert.equal(projected.matchScore.current,41);
 assert.deepEqual(projected.cvDraft.assessment,{baselineScore:41,draftScore:49,delta:8});
 assert.equal(job.cvDraft.assessment.baselineScore,56);
});
test('estimated liquid progress decelerates and reaches 100 only for actual success',()=>{
 const curve=[0,10,20,30,40].map(t=>estimatedProgress(t,'running'));
 assert.ok(curve[2]-curve[1]>curve[4]-curve[3]);assert.ok(estimatedProgress(1000,'running')<1);
 assert.ok(estimatedProgress(70,'failed')<1);assert.equal(estimatedProgress(70,'completed'),1);
 const search=task('1','export');
 assert.equal(searchProgress(search,{availableCount:4,offers:[{deepMatchState:'loading'}],ready:false}).status,'running');
 assert.equal(searchProgress(search,{availableCount:4,offers:[{deepMatchState:'ready'}],ready:false}).status,'running','translation is still pending');
 assert.equal(searchProgress(search,{availableCount:4,offers:[{deepMatchState:'ready'}],ready:true}).status,'completed');
 assert.equal(searchProgress(search,{availableCount:4,offers:[],ready:false,failed:true}).status,'failed');
});
test('plain gaps turn unknown ability into a check, not an invented shortfall',()=>{
 assert.equal(friendlyGapTitle('Portuguese not demonstrated'),'Clarify Portuguese');
 assert.equal(friendlyGapTitle('葡萄牙语水平未得到证明'),'补充葡萄牙语说明');
 assert.equal(friendlyGapTitle('Limited export experience'),'Limited export experience');
});
test('the professional template preserves source sections, hierarchy, and escapes source HTML',()=>{
 const layout=textCvLayout('Yuki Tanaka\nCONTACT\nyuki@example.test\nPROFILE\nExport sales support.\nEDUCATION\n### NEOMA Business School\n2025 - 2027\n- International business\nEXPERIENCE\n### Sales assistant\n- Customer support\nSKILLS\nExcel & <script>\nLANGUAGES\nFrench B2');
 const html=professionalReferenceHtml({layoutSource:layout,language:'en'});
 assert.match(html,/<h1>Yuki Tanaka/);assert.match(html,/<h2>Education/);assert.match(html,/<h3>Sales assistant/);assert.match(html,/<li>Customer support/);assert.match(html,/French B2/);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/Excel &amp; &lt;script&gt;/);
});
