import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoleCvReview,roleCvReviewPrompt} from '../src/lib/v1-cv-review.mjs';
import {projectV1JobScores,matchScoreView,v1CvAssessment,deepMatchPrompt} from '../src/lib/v1-match.mjs';
import {buildProviderInput,rankSearchResults} from '../src/lib/job-search/index.mjs';
import {searchRequestFromConfig} from '../src/lib/job-search/mobile-context.mjs';
import {detectedDocumentLanguage} from '../src/lib/language-contract.mjs';
import {professionalReferenceHtml,professionalTailoredHtml} from '../src/lib/backend/reference-template.mjs';
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
 const layout={name:'Thomas Nguyen',headline:'Ingénieur énergie',sections:[
  {kind:'contact',blocks:[{kind:'text',text:'thomas@example.com · +33 6 12 34 56 78 · Lyon'}]},
  {kind:'profile',blocks:[{kind:'text',text:'Profil original.'}]},
  {kind:'experience',blocks:[{kind:'entry',text:'ENGIE — 2026'},{kind:'bullet',text:'Analyse énergétique.'}]},
  {kind:'languages',blocks:[{kind:'text',text:'Français C1, Anglais C1'}]},
 ],footer:[]};
 const source=professionalReferenceHtml({content:'',layoutSource:layout,language:'fr'});
 const tailored=professionalTailoredHtml({content:'',layoutSource:layout,language:'fr',tailoredPayload:{summary:'Profil ciblé.',experience:[{company:'ENGIE',dates:'2026',role:'Stagiaire',location:'Lyon',bullets:['Analyse de 14 bâtiments.']}],skills:[{category:'Outils',items:['Python','Excel']}]}});
 for(const expected of ['Thomas Nguyen','thomas@example.com','+33 6 12 34 56 78','Français C1, Anglais C1'])assert.match(tailored,new RegExp(expected.replace(/[+.*?^${}()|[\]\\]/g,'\\$&')));
 assert.match(tailored,/Profil ciblé/);assert.match(tailored,/Analyse de 14 bâtiments/);assert.doesNotMatch(tailored,/Profil original/);
 assert.equal(tailored.match(/font:10pt\/1\.24 Georgia/g)?.length,source.match(/font:10pt\/1\.24 Georgia/g)?.length);
});
