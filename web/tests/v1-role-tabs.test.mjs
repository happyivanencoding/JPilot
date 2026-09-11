import test from 'node:test';
import assert from 'node:assert/strict';
import {broadCareerDirections} from '../src/lib/career-directions.mjs';
import {roleDetailForOffer,roleCvIsReady} from '../src/components/jobpilot/role-detail.mjs';
const direction=title=>({title,searchQuery:title,why:'Relevant sector knowledge',evidence:['Econometrics course']});
test('inferred niche labels become usable broad market queries, with background preserved',()=>{
 const raw=['Sustainability Data Analyst','Environmental Economist','ESG Consulting Analyst','Public Policy Evaluation Analyst'].map(direction);
 const broad=broadCareerDirections(raw,'zh');
 assert.deepEqual(broad.map(d=>d.title),['数据分析师','经济学家','ESG 分析师','政策分析师']);
 assert.deepEqual(broad.map(d=>d.searchQuery),['data analyst','economiste','analyste ESG','analyste politiques publiques']);
 assert.equal(broad[0].why,raw[0].why);assert.deepEqual(broad[0].evidence,raw[0].evidence);
 assert.equal(raw[0].title,'Sustainability Data Analyst');
});
test('French suggestions deduplicate at the broad-role level while explicit targets stay intact',()=>{
 const list=[direction('Analyste de données de mobilité'),direction('Sustainability Data Analyst'),direction('Économiste de l’environnement')];
 assert.equal(broadCareerDirections(list,'fr').length,2);
 assert.equal(broadCareerDirections(list,'en',['Sustainability Data Analyst'])[1].searchQuery,'Sustainability Data Analyst');
 assert.deepEqual(broadCareerDirections([], 'zh'),[]);
});
test('discovery offers have read-only detail data, a locked CV and no artificial saved identity',()=>{
 const offer={url:'https://example.com/role',title:'Data analyst',company:'Example',contractType:'Stage',deepMatch:{currentScore:79,cvPotentialScore:82,roleSummary:'Analyse data'},matchScore:{baseline:79,current:79,potential:82}};
 const raw=structuredClone(offer),detail=roleDetailForOffer(offer);
 assert.equal(detail.id,'');assert.equal(detail.role,'Data analyst');assert.equal(detail.v1Match.currentScore,79);
 assert.equal(detail.v1Match.deepMatch.roleSummary,offer.deepMatch.roleSummary);assert.equal(roleCvIsReady(detail),false);assert.deepEqual(offer,raw);
 const saved={...detail,id:'saved',cvDraft:{id:'cv1',status:'pending'},matchScore:{baseline:79,current:79,potential:81}};
 assert.equal(roleDetailForOffer(offer,[saved]),saved);assert.equal(roleCvIsReady(saved),true);assert.equal(roleDetailForOffer(offer,[saved]).matchScore.potential,81);
 assert.equal(roleCvIsReady({...saved,cvDraft:{status:'rejected'}}),false);
 assert.equal(roleCvIsReady({...saved,cv:{file:'role.pdf'},cvDraft:{status:'rejected'}}),true);
});
