import test from 'node:test';
import assert from 'node:assert/strict';
import {fastMatchOffer,normalizeDeepMatch,searchQueryFromAnalysis,V1_DEEP_MATCH_PREFETCH_LIMIT} from '../src/lib/v1-match.mjs';

const candidate={sources:{cv:{text:'Master Marketing. Internship: analysed customer campaigns in Excel and Salesforce CRM. Built weekly dashboards.'},config:{text:'target_roles:\n  primary:\n    - CRM Analyst\n'},notes:{text:''}}};
const offer={title:'Junior CRM Analyst',description:'Analyse customer segmentation and campaign performance. Strong Excel, Salesforce CRM and Power BI are useful.',location:'Paris',contractType:'CDI',searchRelevance:88,seniorityFit:'on-target',roleFit:'primary',locationFit:'target'};

test('V1 fast match is immediate 0-100 guidance grounded in candidate evidence',()=>{
  const match=fastMatchOffer(candidate,{},offer);
  assert.ok(match.score>=18&&match.score<=96);
  assert.ok(match.strengths.some(item=>/excel|salesforce|crm/i.test(item.title)));
  assert.ok(match.gaps.some(item=>/power bi/i.test(item.title)));
  assert.match(match.disclaimer,/录用概率/);
});

test('V1 potential scores preserve the current score and cap presentation/capability upside',()=>{
  const deep=normalizeDeepMatch({
    current_score:10,cv_potential_score:99,capability_potential_score:99,
    role_summary:'Analyse CRM data.',responsibilities:[],requirements:[],tools:[],strengths:[],presentation_gaps:[],capability_gaps:[],confidence:'high'
  },{score:64});
  assert.equal(deep.currentScore,64);
  assert.equal(deep.cvPotentialScore,82);
  assert.equal(deep.capabilityPotentialScore,99);
});

test('explicit user target roles take priority over inferred career directions',()=>{
  const query=searchQueryFromAnalysis({careerDirections:[{title:'Growth Analyst',searchQuery:'growth analytics'}]},{target_roles:{primary:['CRM Analyst','Marketing Analyst']}});
  assert.equal(query,'CRM Analyst Marketing Analyst');
});

test('deep AI prefetch is deliberately limited to five offers',()=>{
  assert.equal(V1_DEEP_MATCH_PREFETCH_LIMIT,5);
});
