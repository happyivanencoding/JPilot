import test from 'node:test';
import assert from 'node:assert/strict';
import {cvBlocks,compileGlobalPlan} from '../src/lib/cv-global-plan.mjs';
import {rankSearchResults} from '../src/lib/job-search/index.mjs';
import {searchRequestFromConfig} from '../src/lib/job-search/mobile-context.mjs';
import {dashboardFor} from '../src/lib/mobile-domain.mjs';
const cv='# TEST — FICTIONAL\n\n## EXPERIENCE\n- Treasury reporting using Excel.\n- Reporting weekly.\n\n## EDUCATION\nBusiness school, 2027.\n';
const base=()=>({audience:'junior',signals:[{title:'Education'},{title:'Treasury'}],targetBlocks:cvBlocks(cv).map(b=>({sourceIds:[b.id],action:'keep'}))});
test('whole-page plan accounts for every source once, permits genuine compression, rejects invented numbers and missing blocks',()=>{
 const p=base();p.targetBlocks[2]={sourceIds:['b3','b4'],action:'merge',text:'- Weekly treasury reporting using Excel.'};p.targetBlocks.splice(3,1);
 assert(compileGlobalPlan(p,cv).applicable);assert.equal(compileGlobalPlan(p,cv).budget.bullets,1);
 const missing=base();missing.targetBlocks.pop();assert.throws(()=>compileGlobalPlan(missing,cv),/chaque bloc/);
 const fabricated=base();fabricated.targetBlocks[2]={sourceIds:['b3'],action:'rewrite',text:'- Improved reporting by 30%.'};assert.throws(()=>compileGlobalPlan(fabricated,cv),/chiffre/);
 const identity=base();identity.targetBlocks[0]={sourceIds:['b1'],action:'rewrite',text:'# REAL CANDIDATE'};assert.throws(()=>compileGlobalPlan(identity,cv),/identité/);
});
test('more complete paragraphs are rejected when they exceed the junior attention budget',()=>{
 const p=base();p.targetBlocks[2]={sourceIds:['b3'],action:'rewrite',text:'- '+('financial reporting '.repeat(480))};
 assert.equal(compileGlobalPlan(p,cv).applicable,false);
});
const request={query:'',targetRoles:['Junior Brand Manager','Junior CRM Analyst','International Marketing Coordinator'],city:'Paris',country:'France',contractTypes:['CDI'],strictContract:true,seniority:'junior',languages:{french:'B1',english:'C1'},relocation:false,remote:true};
const offer=(n,title,description,extras={})=>({url:`https://example.invalid/jobs/${n}`,company:`Fictional test company ${n}`,title,description,location:'Paris',contractType:'CDI',postedAt:'2026-09-07',direct:true,...extras});
test('Marketing first-CDI ranking keeps contract as the hard gate and soft-demotes language, seniority and location risks',()=>{
 const rows=[offer(1,'Junior Brand Manager','English is the working language of our international team.'),offer(2,'Junior Brand Manager','Fluent French required, local campaigns.'),offer(3,'Senior Brand Manager','5 years of experience required.'),offer(4,'Junior CRM Analyst','', {contractType:'Stage'}),offer(5,'Junior CRM Analyst','', {location:'Lyon, hybrid'}),offer(6,'Junior CRM Analyst','',{contractType:'unknown'})];
 const r=rankSearchResults(request,rows,[],{now:Date.parse('2026-09-08')});
 assert.equal(r.offers[0].url,rows[0].url);
 assert.deepEqual(new Set(r.offers.map(o=>o.url)),new Set([rows[0].url,rows[1].url,rows[4].url,rows[5].url]));
 assert.equal(r.offers.find(o=>o.url===rows[0].url).languageFit,'international-evidence');assert.equal(r.offers.find(o=>o.url===rows[1].url).languageFit,'french-development-needed');assert.equal(r.offers.find(o=>o.url===rows[1].url).relevanceTier,'adjacent');
 const unknown=r.offers.find(o=>o.url===rows[5].url);assert.equal(unknown.contractType,'unknown');assert.equal(unknown.relevanceTier,'adjacent');assert.match(unknown.why,/Type de contrat à confirmer/);
 assert.equal(r.metrics.seniorityRemoved,0);assert.equal(r.metrics.seniorityDemoted,1);assert.equal(r.metrics.locationDemoted,1);assert.equal(r.metrics.contractRemoved,1);assert.equal(r.metrics.contractUnknownRemoved,0);assert.equal(r.metrics.contractUnknownRetained,1);assert.equal(r.metrics.languageDemoted,1);
});
test('provider brief carries only targeting constraints, never nationality, name, CV or other profile data',()=>{
 const r=searchRequestFromConfig('Junior CRM',{candidate:{full_name:'SENSITIVE_NAME',nationality:'Chinese'},languages:{french:'B1'},target_roles:{primary:['Junior CRM'],seniority:'junior',contract_types:['CDI']},location:{city:'Paris',country:'France',relocation:false}});
 assert.equal(r.languages.french,'B1');assert.equal(r.seniority,'junior');assert(!JSON.stringify(r).includes('SENSITIVE_NAME'));assert(!JSON.stringify(r).includes('Chinese'));
});
test('homepage count and filter membership share the same exact projection including unknown and terminal cases',()=>{
 const jobs=[{id:'a',status:'À candidater',score:4.5,summary:'Evaluated'},{id:'b',status:'Entretien',score:3.5,followup:{dueDate:'2026-09-08'}},{id:'c',status:'Archivée',score:4.9,followup:{dueDate:'2026-09-07'}},{id:'d',status:'À candidater',score:null}];
 const d=dashboardFor(jobs,'2026-09-08');assert.deepEqual(d.actionSets.high,['a']);assert.deepEqual(d.actionSets.due,['b']);assert.deepEqual(d.actionSets.decide,['a']);assert.deepEqual(d.actionSets.interview,['b']);assert.equal(d.actionSets.all.length,d.total);
});
