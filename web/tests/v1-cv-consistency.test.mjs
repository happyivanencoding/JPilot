import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizeRoleCvReview,roleCvReviewPrompt} from '../src/lib/v1-cv-review.mjs';
import {normalizeDeepMatch,projectV1JobScores,matchScoreView,v1CvAssessment,deepMatchPrompt} from '../src/lib/v1-match.mjs';
import {buildProviderInput,rankSearchResults} from '../src/lib/job-search/index.mjs';
import {searchRequestFromConfig} from '../src/lib/job-search/mobile-context.mjs';
import {detectedDocumentLanguage,publicError} from '../src/lib/language-contract.mjs';
import {professionalReferenceHtml,professionalTailoredHtml} from '../src/lib/backend/reference-template.mjs';
import {renderTailoredCv} from '../src/lib/backend/cv-document.mjs';
const basis={currentScore:31,cvPotentialScore:43,deepMatch:{scoringVersion:'role-fit-2',capabilityGaps:[{title:'C# experience',why:'C# projects are not in the CV'}]}};
test('a forecast of 43 does not force a reviewed draft of 39 upward',()=>{
 const review=normalizeRoleCvReview(basis,{raw_draft_score:39,improvements:['A concrete project is now in the summary'],remaining_gaps:['C# experience']});
 assert.equal(review.baselineScore,31);assert.equal(review.draftScore,39);assert.equal(review.delta,8);
 const job={url:'https://example.com/job',v1Match:basis,cvDraft:{status:'pending',baseVersionId:'cv-a',matchBasis:basis,assessment:review}};
 const projection=projectV1JobScores(job,[{kind:'deep_match',status:'completed',inputVersionId:'cv-a',input:{url:job.url},result:{deepMatch:{scoringVersion:'role-fit-2',currentScore:90,cvPotentialScore:100}}}],'cv-a');
 assert.equal(projection.matchScore.potential,43);assert.equal(projection.matchScore.reviewedScore,39);assert.equal(projection.matchScore.forecast,43);assert.equal(projection.matchScore.reviewed,true);
 assert.equal(v1CvAssessment(projection,projection.cvDraft.assessment).draftScore,39);assert.equal(projection.v1Match.currentScore,31);
});
test('legacy drafts project one actual score without overwriting raw assessments',()=>{
 const old={baselineScore:66,draftScore:74,delta:8};const job={v1Match:basis,cvDraft:{status:'pending',assessment:old}};
 assert.equal(matchScoreView(job).potential,43);assert.equal(matchScoreView(job).reviewedScore,39);assert.equal(projectV1JobScores(job).cvDraft.assessment.draftScore,39);assert.equal(old.baselineScore,66);
 assert.equal(matchScoreView({...job,cvDraft:{...job.cvDraft,status:'rejected'}}).potential,43);
});
test('negative or unsupported changes retain the baseline or original ceiling',()=>{
 assert.equal(normalizeRoleCvReview(basis,{raw_draft_score:20}).draftScore,31);assert.equal(normalizeRoleCvReview(basis,{raw_draft_score:100}).draftScore,43);
 assert.throws(()=>normalizeRoleCvReview(basis,{raw_draft_score:'invalid'}));
 const prompt=roleCvReviewPrompt({basis,master:'Original',draft:'Actual',job:{role:'Backend'},locale:'zh'});
 assert.match(prompt,/SAME frozen/);assert.match(prompt,/31\/100/);assert.match(prompt,/NOT a promised/);assert.match(prompt,/NOT language ability/i);
 assert.match(deepMatchPrompt({candidate:{},offer:{},fastMatch:{}}),/Never infer language proficiency/);
});
test('output language neither filters search nor claims a language skill',()=>{
 const config={cv:{language:'en',source_language:'en'},display:{analysis_language:'zh'},target_roles:{primary:['backend developer'],contract_types:['Stage']},location:{country:'France'},languages:{french:'B2',english:'B2'}};
 const english=searchRequestFromConfig('backend developer',config);
 const french=searchRequestFromConfig('backend developer',{...config,cv:{language:'fr',source_language:'fr'},display:{analysis_language:'fr'}});
 assert.deepEqual(english,french);assert.deepEqual(english.contractTypes,['Stage']);assert.equal(english.languages.french,'B2');
 assert.equal(detectedDocumentLanguage('EDUCATION SKILLS Research with Python and databases. Experience in software.'),'en');
});
test('French and English titles share recall while a known wrong contract is excluded',()=>{
 const req={query:'backend developer Python',targetRoles:[],country:'France',city:'Paris',contractTypes:['Stage'],fallbackPolicy:'closest'};
 const input=buildProviderInput(req);assert.ok(input.franceTravailQueries.some(x=>/developpeur backend/.test(x)));assert.ok(input.queries.some(x=>/developpeur backend/.test(x)));
 const offer=(id,title,type)=>({url:'https://example.com/'+id,title,company:id,location:'Paris',country:'France',description:'Python API PostgreSQL',contractType:type,postedAt:'2026-09-10'});
 const result=rankSearchResults(req,[offer('fr','Stage developpeur backend Python','Stage'),offer('en','Backend developer Python internship','Stage'),offer('wrong','Backend developer Python - Freelance','unknown')],[],{now:Date.parse('2026-09-11')});
 assert.deepEqual(new Set(result.offers.map(x=>x.company)),new Set(['fr','en']));assert.equal(result.offers[0].searchRelevance,result.offers[1].searchRelevance);
 const alternance=rankSearchResults({...req,contractTypes:['Alternance']},[offer('alt','Alternant developpeur backend Python','unknown')],[],{now:Date.parse('2026-09-11')});
 assert.equal(alternance.offers[0].contractType,'Alternance');
});
test('V1 tailored CV keeps the original identity/contact/layout family while replacing wording',()=>{
 const layout={name:'Thomas Nguyen',headline:'Ingénieur énergie',contact:['thomas@example.com','+33 6 12 34 56 78'],sections:[
  {kind:'contact',blocks:[{kind:'text',text:'thomas@example.com · +33 6 12 34 56 78 · Lyon'}]},
  {kind:'profile',blocks:[{kind:'text',text:'Profil original.'}]},
  {kind:'experience',blocks:[{kind:'entry',text:'ENGIE — 2026'},{kind:'bullet',text:'Analyse énergétique.'}]},
  {kind:'languages',blocks:[{kind:'text',text:'Français C1, Anglais C1'}]},
 ],footer:[]};
 const source=professionalReferenceHtml({content:'',layoutSource:layout,language:'fr'});
 const tailored=professionalTailoredHtml({content:'',layoutSource:layout,language:'fr',tailoredPayload:{summary:'Profil ciblé.',experience:[{company:'ENGIE',dates:'2026',role:'Stagiaire',location:'Lyon',bullets:['Analyse de 14 bâtiments.']}],skills:[{category:'Outils',items:['Python','Excel']}]}});
 for(const expected of ['Thomas Nguyen','thomas@example.com','+33 6 12 34 56 78','Français C1, Anglais C1'])assert.match(tailored,new RegExp(expected.replace(/[+.*?^${}()|[\]\\]/g,'\\$&')));
 assert.equal((tailored.match(/thomas@example\.com/g)||[]).length,1);assert.equal((tailored.match(/\+33 6 12 34 56 78/g)||[]).length,1);
 assert.match(tailored,/Profil ciblé/);assert.match(tailored,/Analyse de 14 bâtiments/);assert.doesNotMatch(tailored,/Profil original/);
 assert.equal(tailored.match(/font:10pt\/1\.24 Arial/g)?.length,source.match(/font:10pt\/1\.24 Arial/g)?.length);
});
test('V1 tailored CV flattens a detected two-column topology into A4 and exposes a compact retry mode',()=>{
 const layout={name:'Youness Kinani',headline:'Enterprise Platform & IT',contact:['youness@example.com','(+33) 6 12 34 56 78'],columnCount:2,columnFractions:[.76,.24],pageCount:1,pageWidth:960,pageHeight:540,sections:[
  {kind:'skills',column:0,title:'TECHNICAL SKILLS',blocks:[{kind:'text',text:'FinOps, TBM, SQL, APIs'}]},
  {kind:'experience',column:1,title:'PROFESSIONAL EXPERIENCE',blocks:[{kind:'entry',text:'IBM — 2022–Present'},{kind:'bullet',text:'Cloud cost governance.'}]},
  {kind:'education',column:0,title:'EDUCATION',blocks:[{kind:'entry',text:'ENSIAS — 2016'}]},
 ],footer:[]};
 const tailoredPayload={summary:'FinOps Technical Lead.',experience:[{company:'IBM',dates:'2022–Present',role:'Technical Lead',location:'Paris',bullets:['Chargeback and showback governance.','Cloud cost monitoring.']}],education:[{title:'Computer Science Engineering Degree',org:'ENSIAS',year:'2016'}],skills:[{category:'FinOps',items:['TBM','Cloudability','SQL']}]};
 const html=professionalTailoredHtml({content:'',layoutSource:layout,language:'en',tailoredPayload});
 const compact=professionalTailoredHtml({content:'',layoutSource:layout,language:'en',tailoredPayload,compact:true});
 assert.doesNotMatch(html,/class="cv-columns?"|grid-template-columns/);assert.match(html,/header\{text-align:left/);
 assert.match(html,/youness@example\.com/);assert.match(html,/\(\+33\) 6 12 34 56 78/);assert.match(html,/size:A4/);assert.doesNotMatch(html,/size:960pt 540pt/);assert.match(html,/Chargeback and showback governance/);assert.match(html,/TECHNICAL SKILLS/);
 assert.match(compact,/<body class="compact">/);
});
test('a long role CV remains reviewable when compact A4 still needs multiple pages',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onward-long-role-cv-'));
 try{
  const layout={name:'Claire Martin',headline:'Data & Strategy Analyst',contact:['claire@example.com','+33 6 98 76 54 32','Paris'],sections:[
   {kind:'contact',blocks:[{kind:'text',text:'claire@example.com · +33 6 98 76 54 32 · Paris'}]},
   {kind:'profile',title:'Profile',blocks:[{kind:'text',text:'Analytical graduate with documented research and operational projects.'}]},
   {kind:'education',title:'Education',blocks:[{kind:'entry',text:'Université Paris 1 — Master 2026'},{kind:'text',text:'Finance and data analysis.'}]},
   {kind:'experience',title:'Experience',blocks:[{kind:'entry',text:'Original Employer — 2025'},{kind:'bullet',text:'Original evidence.'}]},
  ],footer:[]};
  const longSentence='Built a documented analysis from real project data, compared alternatives, communicated findings to stakeholders, and recorded the resulting decision.';
  const payload={summary:'Data and strategy analyst focused on evidence-based decisions.',experience:Array.from({length:11},(_,i)=>({company:`Employer ${i+1}`,role:'Analyst',location:'Paris',dates:`20${15+i}–20${16+i}`,bullets:Array.from({length:5},(__,j)=>`${longSentence} Evidence ${i+1}.${j+1}.`)})),education:[{title:'Master Finance & Data',org:'Université Paris 1',year:'2026',description:'Quantitative finance, statistics and applied analytics.'}],skills:[{category:'Tools',items:['Python','SQL','Excel','Power BI']}],projects:[]};
  const htmlPath=path.join(dir,'cv.html'),pdfPath=path.join(dir,'cv.pdf');
  const result=await renderTailoredCv(payload,{htmlPath,pdfPath,language:'en',template:'standard',maxPages:1,referenceContent:'source evidence',layoutSource:layout,tailoredPayload:payload});
  assert.ok(result.pages>1,'fixture must exercise the multi-page fallback');assert.equal(result.onePageTargetMet,false);assert.ok(result.warnings.length>0);
  assert.ok(fs.statSync(pdfPath).size>1000);const html=fs.readFileSync(htmlPath,'utf8');
  for(const expected of ['Claire Martin','claire@example.com','+33 6 98 76 54 32','Master Finance &amp; Data','Employer 11'])assert.match(html,new RegExp(expected.replace(/[+.*?^${}()|[\]\\]/g,'\\$&')));
  assert.equal((html.match(/claire@example\.com/g)||[]).length,1);assert.equal((html.match(/\+33 6 98 76 54 32/g)||[]).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('page overflow is explained instead of collapsing to the generic failure copy',()=>{
 const raw='Le CV occupe 2 pages pour une limite de 1. Réduisez le contenu du brouillon.';
 assert.match(publicError(new Error(raw),'zh'),/超过当前一页版式/);
 assert.match(publicError(new Error(raw),'fr'),/dépasse la mise en page/);
});
test('partial deep-match JSON falls back to anchored score evidence instead of rendering empty sections',()=>{
 const normalized=normalizeDeepMatch({
  scoring_version:'role-fit-2',scoring_method:'anchored-4x4-v1',
  ratings:{role:4,duties:2,tools_languages:2,level:2},
  score_rationale:{
   role:{reason:'Direct FinOps governance match.',job_evidence:'FinOps orienté gouvernance',cv_evidence:'Governance Specialist Cloud Cost Management',unknown:false},
   duties:{reason:'Delegated squad budgets and recurring review rituals are unclear.',job_evidence:'budgets délégués',cv_evidence:'Built chargeback and showback frameworks',unknown:true},
   tools_languages:{reason:'GCP and Excel/Sheets are unclear.',job_evidence:'GCP en priorité',cv_evidence:'AWS, Cloudability, SQL',unknown:true},
   level:{reason:'30–50 squad distributed FinOps scope is unclear.',job_evidence:'30 à 50 squads',cv_evidence:'Nine years implementing governance platforms',unknown:true},
  },
  responsibilities:['Design cloud budgets.],','requirements ['],requirements:[],tools:[],strengths:[],presentation_gaps:[],capability_gaps:[],
  cv_potential_score:65,capability_potential_score:65,
 },{score:60});
 assert.equal(normalized.currentScore,65);
 assert.equal(normalized.strengths.length,1);assert.match(normalized.strengths[0].evidence,/FinOps governance/);
 assert.equal(normalized.capabilityGaps.length,3);assert.ok(normalized.capabilityGaps.every(x=>x.why));
 assert.deepEqual(normalized.responsibilities,['Design cloud budgets.']);
});
