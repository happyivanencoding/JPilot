import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchScoreView,projectV1JobScores} from '../src/lib/v1-match.mjs';
import {normalizeRoleCvReview} from '../src/lib/v1-cv-review.mjs';
import {applicationRows} from '../src/components/jobpilot/model.mjs';
import {applyJobUpdate,APPLICATION_STATUSES} from '../src/lib/mobile-domain.mjs';
import {cvPrivacyNotice} from '../src/lib/cv-privacy.mjs';

const basis={currentScore:65,cvPotentialScore:80,capabilityPotentialScore:90,displayScore:65,deepMatch:{currentScore:65,cvPotentialScore:80,capabilityPotentialScore:90,quickBoosts:[],scoringVersion:'role-fit-2'}};
const role={id:'synthetic-role',url:'https://example.com/recruitment',v1Match:basis,status:'À candidater'};

test('initial 65→80 stays fixed across no-gain review, edits, acceptance and reopening',()=>{
 const initial=matchScoreView(role);assert.equal(initial.forecast,80);assert.equal(initial.potential,80);assert.equal(initial.reviewedScore,null);
 const review=normalizeRoleCvReview(basis,{raw_draft_score:65});
 const pending={...role,cvDraft:{id:'draft',status:'pending',baseVersionId:'cv1',matchBasis:structuredClone(basis),assessment:review}};
 const other=[{kind:'deep_match',status:'completed',inputVersionId:'cv1',input:{url:role.url},result:{deepMatch:{currentScore:90,cvPotentialScore:100,scoringVersion:'role-fit-2'}}}];
 let shown=projectV1JobScores(pending,other,'cv1');
 assert.deepEqual(shown.matchScore,{current:65,baseline:65,potential:80,forecast:80,reviewed:true,reviewedScore:65});
 const edited={...pending,cvDraft:{...pending.cvDraft,assessment:normalizeRoleCvReview(basis,{raw_draft_score:72})}};
 shown=projectV1JobScores(JSON.parse(JSON.stringify(edited)),other,'cv1');
 assert.equal(shown.matchScore.reviewedScore,72);assert.equal(shown.matchScore.forecast,80);
 const accepted={...edited,v1Match:{...basis,displayScore:72},cvDraft:{...edited.cvDraft,status:'accepted'},cv:{file:'synthetic.pdf',matchBasis:structuredClone(basis),presentationDelta:7}};
 shown=projectV1JobScores(JSON.parse(JSON.stringify(accepted)),other,'cv1');
 assert.equal(shown.matchScore.current,80);assert.equal(shown.matchScore.reviewedScore,72);assert.equal(shown.matchScore.potential,80);assert.equal(shown.matchScore.baseline,65);
 assert.deepEqual(role.v1Match,basis);assert.equal(pending.cvDraft.assessment.draftScore,65);
});

test('stale Deep Match stays hidden while the current three-score contract is recalculating',()=>{
 const stale={id:'stale-role',url:'https://example.com/stale',status:'À candidater',v1Match:{currentScore:26,cvPotentialScore:34,capabilityPotentialScore:36,deepMatch:{currentScore:26,cvPotentialScore:34,capabilityPotentialScore:36,scoringVersion:'role-fit-2'}}};
 const adoptedLegacy={kind:'deep_match',status:'completed',operationKey:'["deep_match","role-fit-5-quick-boosts-v1","cv1","https://example.com/stale"]',inputVersionId:'cv1',input:{url:stale.url},result:{deepMatch:stale.v1Match.deepMatch}};
 let shown=projectV1JobScores(structuredClone(stale),[adoptedLegacy],'cv1');
 assert.equal(shown.enrichment.deepMatchState,'pending');assert.equal(shown.matchScore.current,null,'an operation-key-only legacy result is still not a current three-score result');
 const running={...adoptedLegacy,status:'running',result:undefined,estimate:{targetSeconds:12}};
 shown=projectV1JobScores(structuredClone(stale),[running],'cv1');
 assert.equal(shown.enrichment.deepMatchState,'loading');assert.equal(shown.matchScore.current,null);
 const fresh={...running,status:'completed',result:{deepMatch:{currentScore:31,cvPotentialScore:43,capabilityPotentialScore:47,quickBoosts:[],scoringVersion:'role-fit-2'}}};
 shown=projectV1JobScores(structuredClone(stale),[fresh],'cv1');
 assert.equal(shown.enrichment.deepMatchState,'ready');assert.equal(shown.matchScore.current,31);assert.equal(shown.matchScore.forecast,43);
});

test('rejection does not replace the initial potential with the unsuccessful draft',()=>{
 const rejected={...role,cvDraft:{status:'rejected',matchBasis:basis,assessment:normalizeRoleCvReview(basis,{raw_draft_score:50})}};
 const view=matchScoreView(rejected);assert.equal(view.forecast,80);assert.equal(view.potential,80);assert.equal(view.reviewed,false);assert.equal(view.reviewedScore,null);
});

test('all application states and more than twelve roles are available, sorted by actual activity',()=>{
 const jobs=Array.from({length:23},(_,i)=>({id:String(i),company:i===22?'Latest Company':'Company '+i,role:'Recruiter',status:APPLICATION_STATUSES[i%APPLICATION_STATUSES.length],updatedAt:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00.000Z`}));
 const snapshot=structuredClone(jobs);
 assert.equal(applicationRows(jobs).length,23);assert.equal(applicationRows(jobs)[0].id,'22');
 for(const status of APPLICATION_STATUSES)assert.deepEqual(applicationRows(jobs,status).map(j=>j.status),jobs.filter(j=>j.status===status).map(()=>status));
 assert.deepEqual(applicationRows(jobs,'','latest company').map(j=>j.id),['22']);
 assert.deepEqual(jobs,snapshot);
 const updated=applyJobUpdate(jobs[0],{status:'Entretien',note:'Bring the portfolio',dueDate:'2026-10-01'},'2026-09-30T10:00:00.000Z');
 const changed=applicationRows([updated,...jobs.slice(1)],'Entretien');assert.equal(changed[0].id,'0');assert.equal(changed[0].followup.note,'Bring the portfolio');
 const cvOnly={...jobs[1],status:'CV prêt',cv:{file:'saved-not-submitted.pdf'}};
 assert.equal(applicationRows([cvOnly],'Candidature envoyée').length,0);
});

test('all three notice translations use the inviter contact, without the former personal identity',()=>{
 assert.equal(cvPrivacyNotice.version,'2026-09-12.1');
 const raw=JSON.stringify(cvPrivacyNotice);assert.doesNotMatch(raw,/Jingxuan|Jing Xuan|Li Jingxuan/i);
 assert.match(cvPrivacyNotice.sections[0].body.en,/person who gave you your invitation code/);
 assert.match(cvPrivacyNotice.sections[0].body.fr,/personne qui vous a transmis votre code d’invitation/);
 assert.match(cvPrivacyNotice.sections[0].body.zh,/给你邀请码的那个人/);
 for(const s of cvPrivacyNotice.sections)for(const lang of ['en','fr','zh'])assert.ok(s.title[lang]&&s.body[lang]);
});

test('both Match surfaces retain the useful explanations but do not mount scoring breakdowns',()=>{
 const web=fs.readFileSync(new URL('../src/components/jobpilot/sheets.tsx',import.meta.url),'utf8');
 const native=fs.readFileSync(new URL('../../android/app/src/main/java/com/thegreatnovel/jobpilot/V1Screens.kt',import.meta.url),'utf8');
 for(const source of [web,native]){assert.doesNotMatch(source,/MatchBreakdown[<(]/);assert.match(source,/presentationGaps/);assert.match(source,/capabilityGaps/);assert.match(source,/strengths/);}
 assert.match(web,/RoleCvJourney/);assert.doesNotMatch(web,/reviewedScore/,'V1 Web no longer exposes draft-review score as a competing user-visible score');
});
