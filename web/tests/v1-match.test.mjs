import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateConstraints} from '../src/lib/job-search/candidate-constraints.mjs';
import {enrichOffersWithFastMatch,fastMatchOffer,normalizeDeepMatch,searchQueryFromAnalysis,V1_DEEP_MATCH_PREFETCH_LIMIT} from '../src/lib/v1-match.mjs';

const candidate={sources:{cv:{text:'Master Marketing. Internship: analysed customer campaigns in Excel and Salesforce CRM. Built weekly dashboards.'},config:{text:'target_roles:\n  primary:\n    - CRM Analyst\n'},notes:{text:''}}};
const offer={title:'Junior CRM Analyst',description:'Analyse customer segmentation and campaign performance. Strong Excel, Salesforce CRM and Power BI are useful.',location:'Paris',contractType:'CDI',searchRelevance:88,seniorityFit:'on-target',roleFit:'primary',locationFit:'target'};

test('V1 fast match is immediate 0-100 guidance grounded in candidate evidence',()=>{
  const match=fastMatchOffer(candidate,{},offer);
  assert.ok(match.score>=18&&match.score<=96);
  assert.equal(typeof match.bridgeability,'number');
  assert.deepEqual(Object.keys(match.components),['role','duties','tools_languages','level']);
  assert.ok(match.strengths.some(item=>/excel|salesforce|crm/i.test(item.title)));
  assert.ok(match.gaps.some(item=>/power bi/i.test(item.title)));
  assert.match(match.disclaimer,/录用概率/);
});

test('Fast Fit is independent from search relevance and cannot replace an explicit career-switch intent',()=>{
  const low=fastMatchOffer(candidate,{}, {...offer,searchRelevance:15});
  const high=fastMatchOffer(candidate,{}, {...offer,searchRelevance:95});
  assert.equal(low.score,high.score,'search relevance is not part of candidate fit');
  const ranked=enrichOffersWithFastMatch(candidate,{},[
    {title:'Investment Analyst',description:'Analyse investments, valuations and portfolio opportunities.',searchRelevance:92,rankScore:86,relevanceTier:'strong',ageDays:2,seniorityFit:'target-or-unknown'},
    {title:'CRM Analyst',description:'Analyse CRM campaigns with Excel, Salesforce and dashboards.',searchRelevance:68,rankScore:75,relevanceTier:'adjacent',ageDays:1,seniorityFit:'target-or-unknown'},
  ]);
  assert.equal(ranked[0].title,'Investment Analyst','direct search intent stays above a better current-fit adjacent role');
  assert.ok(ranked[1].fastMatch.score>ranked[0].fastMatch.score,'fixture actually represents the career-switch trade-off');
});

test('explicit occupation search keeps seniority and language shortfalls as fit gaps instead of search penalties',()=>{
  const senior={title:'Senior Investment Manager',description:'7 years experience. Fluent French required.'};
  const explicit=candidateConstraints(senior,{hasExplicitIntent:true,seniority:'junior',targetRoles:['Investment Manager'],languages:{french:'B1'}});
  assert.equal(explicit.seniorityFit,'above-target');
  assert.equal(explicit.languageFit,'french-development-needed');
  assert.equal(explicit.penalty,0);assert.equal(explicit.forceClosest,false);
  const recommendation=candidateConstraints(senior,{hasExplicitIntent:false,seniority:'junior',targetRoles:['Investment Manager'],languages:{french:'B1'}});
  assert.ok(recommendation.penalty>0);assert.equal(recommendation.forceClosest,true);
});

test('V1 potential scores preserve the current score and cap presentation/capability upside',()=>{
  const deep=normalizeDeepMatch({
    current_score:10,cv_potential_score:99,capability_potential_score:99,
    role_summary:'Analyse CRM data.',responsibilities:[],requirements:[],tools:[],strengths:[],presentation_gaps:[],capability_gaps:[],
    quick_boosts:[{kind:'confirm_existing',title:'Campaign reporting',why:'The internship may include it.',next_action:'Confirm one example',potential:4},{kind:'quick_build',title:'Power BI mini-project',why:'The role uses dashboards.',next_action:'Build one small dashboard',potential:5}],confidence:'high'
  },{score:64});
  assert.equal(deep.currentScore,64);
  assert.equal(deep.cvPotentialScore,82);
  assert.equal(deep.capabilityPotentialScore,99);
  assert.deepEqual(deep.quickBoosts.map(item=>[item.kind,item.title,item.potential]),[['confirm_existing','Campaign reporting',4],['quick_build','Power BI mini-project',5]]);
});

test('explicit user target roles take priority over inferred career directions',()=>{
  const query=searchQueryFromAnalysis({careerDirections:[{title:'Growth Analyst',searchQuery:'growth analytics'}]},{target_roles:{primary:['CRM Analyst','Marketing Analyst']}});
  assert.equal(query,'CRM Analyst Marketing Analyst');
});

test('deep AI prefetch is deliberately limited to five offers',()=>{
  assert.equal(V1_DEEP_MATCH_PREFETCH_LIMIT,5);
});
