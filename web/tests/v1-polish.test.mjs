import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {directionDescriptor,planDirectionSearch,compactDirectionHistory,V1_SEARCH_REVISION} from '../src/lib/v1-directions.mjs';
import {broadCareerDirections} from '../src/lib/career-directions.mjs';
import {parseOrientation} from '../src/lib/v1-journey.mjs';
import {deepMatchPrompt,normalizeDeepMatch,matchScoreView,projectV1JobScores,friendlyGapTitle} from '../src/lib/v1-match.mjs';
import {visibleRoleRequirements} from '../src/components/jobpilot/role-detail.mjs';
import {estimatedProgress,searchProgress} from '../src/lib/v1-progress.mjs';
import {professionalReferenceHtml,professionalTailoredHtml,textCvLayout} from '../src/lib/backend/reference-template.mjs';
import {jdEmphasisKeywords} from '../src/lib/cv-jd-emphasis.mjs';
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
test('direction budget and history are scoped to Candidate Version, while manual refresh bypasses cache',()=>{
 const six=Array.from({length:6},(_,i)=>task(String(i),'unique '+i));
 assert.equal(planDirectionSearch(six,{query:'new role'},'cv-b',{},now).reason,'new','a new CV gets its own exploration budget');
 const refreshed=planDirectionSearch(six,{query:'unique 2',refresh:true},'cv-a',{},now);
 assert.equal(refreshed.reason,'refresh');assert.ok(refreshed.refreshSequence>=1);assert.equal(refreshed.reuse,undefined);
 assert.equal(planDirectionSearch([...six,task('refresh','unique 2',{input:{query:'unique 2',refreshSequence:1}})],{query:'brand new'},'cv-a',{},now).reason,'daily-limit','refreshing a direction does not create a seventh direction slot');
 const history=compactDirectionHistory([task('a','export sales'),task('b','export sales',{inputVersionId:'cv-b'})]);
 assert.equal(history.length,2,'the same direction remains visible for two CV evidence versions');
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
 const waterCss=fs.readFileSync(new URL('../src/components/jobpilot/cv-water.css',import.meta.url),'utf8');
 const androidButton=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/PilotDesign.kt',import.meta.url),'utf8');
 const androidWater=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/CvAnalysisWater.kt',import.meta.url),'utf8');
 assert.match(css,/\.jp-ai-button\.liquid \.jp-ai-button-fill\{[^}]*width:var\(--jp-ai-progress,0%\)[^}]*height:100%/);
 assert.match(css,/\.jp-liquid-status \.jp-ai-button-fill\{[^}]*width:100%[^}]*height:var\(--jp-ai-progress,0%\)/);
 assert.match(androidButton,/val liquidRight=size\.width\*progress/);
 assert.match(androidWater,/val waterY = size\.height \* \(1 - level\)/);
 assert.match(waterCss,/\.jp-cv-water-level\{[^}]*background:transparent/);
 const water=fs.readFileSync(new URL('../src/components/jobpilot/cv-water.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(waterCss,/\.jp-cv-water-level:after/);
 assert.match(waterCss,/height:calc\(100% \+ 32px\)/);
 assert.equal((water.match(/<svg /g)||[]).length,1,'one continuous shape avoids translucent fill overlap seams');
 assert.match(water,/V1000 H0 Z/);
 assert.match(water,/translateY\(\$\{100-percent\}%\)/);
});
test('French orientation output is detected as French and common supply-chain directions stay market-readable',()=>{
 const parsed=parseOrientation({
  candidateName:'Hugo Pelletier',markdown:'Votre expérience terrain et vos analyses supply chain ouvrent plusieurs pistes opérationnelles à Paris.',
  strengths:[{title:'Pilotage par les données',evidence:'Tableau Power BI utilisé en revue.'}],growthAreas:[{title:'SQL',nextAction:'Faire un projet simple.'}],
  careerDirections:[
   {title:'Planification supply chain',searchQuery:'Supply Planner Paris'},
   {title:'Achats et approvisionnement',searchQuery:'Approvisionneur junior Paris'},
   {title:'Coordination logistique',searchQuery:'Coordinateur logistique junior Paris'},
   {title:'Amélioration continue industrielle',searchQuery:'Ingénieur amélioration continue junior Paris'},
  ],
 },'Hugo Pelletier\nM2 Supply Chain');
 assert.equal(parsed.outputLocale,'fr');
 const broad=broadCareerDirections(parsed.careerDirections,'fr',[]);
 assert.deepEqual(broad.map(row=>row.title),['Planification supply chain','Achats et approvisionnement','Coordination logistique','Amélioration continue industrielle']);
 assert.deepEqual(broad.map(row=>row.searchQuery),['planificateur supply chain','approvisionneur','coordinateur logistique','ingenieur amelioration continue']);
 assert.equal(new Set(broad.map(row=>directionDescriptor(row.searchQuery).key)).size,4,'distinct career directions must not collapse onto one cached search');
});
test('role-CV detail keeps the same before-after score surface even when uplift is zero',()=>{
 const web=fs.readFileSync(new URL('../src/components/jobpilot/cv-outcome.tsx',import.meta.url),'utf8');
 const android=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/OnwardCvOutcome.kt',import.meta.url),'utf8');
 assert.match(web,/if\(outcome\.ready && detail\)/);
 assert.match(web,/匹配分没有变化/);
 assert.match(android,/if\(\(detail&&ready\)\|\|gain>0\)/);
 assert.match(android,/匹配分没有变化/);
});
test('job detail records application status from one dropdown and has no tracking page',()=>{
 const sheets=fs.readFileSync(new URL('../src/components/jobpilot/sheets.tsx',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../src/components/jobpilot/onward.css',import.meta.url),'utf8');
 assert.match(sheets,/data-testid="job-tracking-stage"/);
 assert.match(sheets,/queueTracking\(job,offer,\{status:value\},true\)/);
 assert.match(sheets,/aria-label=\{tr\("投递状态","Statut de candidature","Application status"\)\}/);
 assert.doesNotMatch(sheets,/<span>\{tr\("跟踪投递","Suivre la candidature","Track application"\)\}<\/span>/);
 assert.doesNotMatch(sheets,/data-testid="toggle-job-tracking"/);assert.doesNotMatch(sheets,/data-testid="inline-job-tracking"/);
 assert.doesNotMatch(sheets,/Votre correspondance|onward-match-summary/);
 assert.match(sheets,/requestedTab===1\?1:0/);
 assert.match(sheets,/labels=\{\[tr\("匹配", "Match", "Fit"\), "CV"\]\}/);
 assert.doesNotMatch(sheets,/labels=\{\[tr\("匹配", "Match", "Fit"\), "CV", tr\("跟踪"/);
 assert.doesNotMatch(sheets,/pre-generation-cv-guidance|cv-guidance-facts|cv-guidance-preferences|Ajouter un détail ou une préférence|这些补充只影响这个岗位版本/);
 assert.match(sheets,/compactHeader/);
 assert.match(css,/\.jp-sheet-header\.compact\{position:absolute/);
 assert.match(css,/\.onward-job-hero-copy h1\{[^}]*font-size:27px;line-height:29px/);
 assert.doesNotMatch(css,/\.onward-cv-guidance/);
 assert.doesNotMatch(sheets,/来源：\$\{job\.source/);
});
test('job detail keeps plain duties first and removes duplicate metadata requirements',()=>{
 const requirements=[
  {title:'为期六个月的实习',why:'职位信息明确要求为期六个月的实习。'},
  {title:'在马赛工作',why:'所述工作地点为法国马赛。'},
  {title:'无需出差',why:'职位信息说明无需出差。'},
  {title:'法语工作水平',why:'需要能够使用法语完成日常会议与报告。'},
  {title:'商科或工程硕士',why:'Master level in business or engineering.'},
  {title:'2027年3月开始实习',why:'明确从 2027年3月 开始。'},
 ];
 const visible=visibleRoleRequirements(requirements,{location:'Marseille',contract:'Stage'});
 assert.deepEqual(visible.map(x=>x.title),['法语工作水平','商科或工程硕士','2027年3月开始实习']);
 const sheets=fs.readFileSync(new URL('../src/components/jobpilot/sheets.tsx',import.meta.url),'utf8');
 assert.ok(sheets.indexOf('主要职责')<sheets.indexOf('岗位要求'),'duties render before requirements');
 assert.match(sheets,/visibleRoleRequirements/);
 assert.match(sheets,/icon=\{false\}/);
 assert.doesNotMatch(sheets,/查看分析并准备岗位版 CV|Voir l’analyse et préparer le CV ciblé|Review analysis and prepare the role CV/);
 assert.doesNotMatch(sheets,/Prochaine étape|Next step/);
});
test('deep match prompt requests more plain duties and only hard selection criteria',()=>{
 const prompt=deepMatchPrompt({candidate:{sources:{cv:{text:'CV'},notes:{text:''}}},offer:{title:'Stage PMO',description:'Description',contractType:'Stage'},fastMatch:{score:50},jobIntelligence:null,language:'zh'});
 assert.match(prompt,/Responsibilities must be 4-6 concrete duties/);
 assert.match(prompt,/Requirements must contain only candidate qualifications or hard selection criteria/);
 assert.match(prompt,/Do NOT repeat the contract type, internship duration, work location/);
});
test('role CV review has only preview keep reject controls and no pre-generation score promise',()=>{
 const sheets=fs.readFileSync(new URL('../src/components/jobpilot/sheets.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(sheets,/生成前不承诺加分|Aucun gain n’est promis avant la génération|No score gain is promised before generation/);
 assert.doesNotMatch(sheets,/手动修改这个版本|Modifier manuellement cette version|Edit this version manually/);
 assert.match(sheets,/查看为这个岗位定制的专属简历/);
 assert.match(sheets,/Voir le CV conçu pour cette offre/);
 assert.match(sheets,/View the CV tailored for this role/);
 assert.match(sheets,/data-testid="accept-tailored-draft"/);
 assert.match(sheets,/data-testid="reject-tailored-draft"/);
});
test('first-run guidance is actionable, search diagnostics are hidden, and visible water never claims 100%',()=>{
 const onboarding=fs.readFileSync(new URL('../src/components/jobpilot/onboarding.tsx',import.meta.url),'utf8');
 const catalog=fs.readFileSync(new URL('../src/components/jobpilot/catalog.tsx',import.meta.url),'utf8');
 const water=fs.readFileSync(new URL('../src/components/jobpilot/cv-water.tsx',import.meta.url),'utf8');
 assert.match(onboarding,/À partir de votre CV, Onward voit déjà ces atouts/);assert.match(onboarding,/jp-v1-direction-title/);assert.match(onboarding,/DirectionMedallion/);assert.match(onboarding,/ArrowRight/);
 assert.doesNotMatch(catalog,/\{data\.v1\?\.searchNotice\}/);assert.doesNotMatch(catalog,/搜索暂未完成/);assert.doesNotMatch(catalog,/换一个方向，或稍后再试/);
 assert.match(water,/Math\.min\(96,/);assert.match(onboarding,/aria-valuemax=\{96\}/);
 assert.match(onboarding,/data-testid="privacy-brief"/);assert.doesNotMatch(onboarding,/CvPrivacyDialog/);
});
test('JD emphasis skill bolds only grounded terms already present in the generated CV',()=>{
 const payload={summary:'Data analyst using Excel and Power BI for reporting.',experience:[{company:'Library',role:'Assistant',bullets:['Built Excel tracking reports.']}],skills:[{category:'Tools',items:['Excel','Power BI']}]};
 const job={v1Match:{deepMatch:{tools:['Excel','SQL','Power BI'],requirements:[{title:'Data analysis'}],responsibilities:['Build reporting dashboards']}},cv:{keywords:['Excel','Power BI']}};
 const keywords=jdEmphasisKeywords(job,payload);
 assert.ok(keywords.some(value=>/Excel/i.test(value)));assert.ok(keywords.some(value=>/Power BI/i.test(value)));assert.ok(!keywords.some(value=>/^SQL$/i.test(value)),'missing JD terms must not be inserted');
 const layout=textCvLayout('Candidate Name\nPROFILE\nData analyst using Excel and Power BI for reporting.\nEXPERIENCE\n### Library — 2026\nAssistant\n- Built Excel tracking reports.\nSKILLS\nExcel · Power BI');
 const html=professionalTailoredHtml({content:'x',layoutSource:layout,tailoredPayload:payload,language:'en',emphasisKeywords:keywords});
 assert.match(html,/<strong>Excel<\/strong>/i);assert.match(html,/<strong>Power BI<\/strong>/i);assert.doesNotMatch(html,/<strong>SQL<\/strong>/i);
});
test('tailored renderer replaces a foreign-language source header with the normalized application identity',()=>{
 const layout=textCvLayout('李若晴\n巴黎 · +33 6 00 00 00 00 · ruoqing.li@example.com\nPROFILE\nAnalyst.\nEXPERIENCE\n### Library — 2026\nAssistant');
 const html=professionalTailoredHtml({content:'x',layoutSource:layout,tailoredPayload:{summary:'Analyst.',experience:[{company:'Library',role:'Assistant',bullets:['Excel reporting.']}]},language:'en',candidate:{name:'Ruoqing Li',location:'Paris',phone:'+33 6 00 00 00 00',email:'ruoqing.li@example.com',linkedin:{display:''}}});
 assert.match(html,/Ruoqing Li/);assert.match(html,/Paris/);assert.doesNotMatch(html,/[\u3400-\u9fff]/u);assert.equal((html.match(/ruoqing\.li@example\.com/g)||[]).length,1);
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
 assert.equal(searchProgress(search,{availableCount:4,offers:[{deepMatchState:'loading'}],ready:false}).status,'completed','Deep Match no longer blocks search completion');
 assert.equal(searchProgress(search,{availableCount:4,offers:[{deepMatchState:'ready'}],ready:false}).status,'completed','translation no longer blocks search completion');
 assert.equal(searchProgress({...search,status:'running'},{availableCount:4,offers:[],ready:false}).status,'running');
 assert.equal(searchProgress({...search,status:'failed'},{availableCount:4,offers:[],ready:false}).status,'failed');
});
test('plain gaps turn unknown ability into a check, not an invented shortfall',()=>{
 assert.equal(friendlyGapTitle('Portuguese not demonstrated'),'Clarify Portuguese');
 assert.equal(friendlyGapTitle('葡萄牙语水平未得到证明'),'补充葡萄牙语说明');
 assert.equal(friendlyGapTitle('Limited export experience'),'Limited export experience');
});
test('the professional template preserves source sections, hierarchy, and escapes source HTML',()=>{
 const layout=textCvLayout('Yuki Tanaka\nCONTACT\nyuki@example.test\nPROFILE\nExport sales support.\nEDUCATION\n### NEOMA Business School\n2025 - 2027\n- International business\nEXPERIENCE\n### Sales assistant\n- Customer support\nSKILLS\nExcel & <script>\nLANGUAGES\nFrench B2');
 const html=professionalReferenceHtml({layoutSource:layout,language:'en'});
 assert.match(html,/<h1>Yuki Tanaka/);assert.match(html,/<h2>Education/i);assert.match(html,/<h3>Sales assistant/);assert.match(html,/<li>Customer support/);assert.match(html,/French B2/);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/Excel &amp; &lt;script&gt;/);
});

test('a provider outage empty search can retry instead of reusing a false-zero cache',()=>{
 const partial=task('partial','analyste crédit',{result:{offers:[],searchMetrics:{providers:[{id:'jsearch',status:'error'},{id:'france-travail',status:'ok'}]}}});
 assert.equal(planDirectionSearch([partial],{query:'analyste crédit'},'cv-a',{},now).reason,'new');
});
