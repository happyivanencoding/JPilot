import {operationKey,reusableTask} from '../../src/lib/mobile-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {searchJobicy} from '../../src/lib/job-search/providers/jobicy.mjs';
import {searchAdzuna} from '../../src/lib/job-search/providers/adzuna.mjs';
import {searchJooble} from '../../src/lib/job-search/providers/jooble.mjs';
import {searchStructuredOffers} from '../../src/lib/job-search/index.mjs';
const response=data=>({ok:true,status:200,json:async()=>data});
const input={queries:['Credit analyst'],franceTravailQueries:['Analyste crédit','Analyste risques crédit'],city:'Paris',countryCode:'fr'};

test('Jobicy coalesces and caches public-feed requests for an hour, preserving attribution and geography',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return response({jobs:[{id:1,url:'https://jobicy.com/jobs/one',jobTitle:'Analyst',companyName:'Example',jobGeo:'USA',jobType:['full-time'],jobDescription:'<p>Analysis</p>',pubDate:'2026-09-12T00:00:00Z'}]});};
  const [a,b]=await Promise.all([searchJobicy(input,{enabled:true,fetchImpl,now:1000}),searchJobicy(input,{enabled:true,fetchImpl,now:1000})]);
  assert.equal(calls,1);assert.equal(a.apiCalls+b.apiCalls,1);
  assert.equal(a.offers[0].contractType,'unknown');assert.equal(a.offers[0].country,'');assert.equal(a.offers[0].location,'USA');
  assert.equal(a.offers[0].sourceLabel,'Jobicy');assert.equal(a.offers[0].description,'Analysis');
  await searchJobicy(input,{enabled:true,fetchImpl,now:3601001});assert.equal(calls,2);
});

test('Jobicy outage is cached instead of repeatedly hitting the failed source',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return {ok:false,status:503};};
  await assert.rejects(searchJobicy(input,{enabled:true,fetchImpl,now:1000}),/503/);
  await assert.rejects(searchJobicy(input,{enabled:true,fetchImpl,now:2000}),/503/);
  assert.equal(calls,1);
});

test('Adzuna uses AI French terms and preserves redirect provenance without inventing fixed-term contracts',async()=>{
  const urls=[];const fetchImpl=async url=>{urls.push(new URL(url));return response({results:[{id:'1',title:'Credit analyst',company:{display_name:'Bank'},location:{display_name:'Paris'},redirect_url:'https://www.adzuna.fr/jobs/land/ad/1',contract_type:'contract',contract_time:'full_time',description:'<b>Credit analysis</b>'}]});};
  const r=await searchAdzuna(input,{enabled:true,appId:'test-id',appKey:'test-key',fetchImpl});
  assert.equal(r.status,'ok');assert.equal(urls[0].searchParams.get('what'),'Analyste crédit');
  assert.equal(r.offers[0].contractType,'unknown');assert.equal(r.offers[0].source,'adzuna');
  assert.equal(r.offers[0].url,'https://www.adzuna.fr/jobs/land/ad/1');
});

test('credential-bearing fetch errors cannot leak into provider diagnostics',async()=>{
  const fetchImpl=async url=>{throw new Error('network '+url);};
  await assert.rejects(searchAdzuna(input,{enabled:true,appId:'private-id',appKey:'private-key',fetchImpl}),e=>e.message==='Adzuna request failed');
  await assert.rejects(searchJooble(input,{apiKey:'private-key',fetchImpl}),e=>e.message==='Jooble request failed');
});

test('Jooble uses the French market endpoint and keeps successful queries on partial failure',async()=>{
  let calls=0;const fetchImpl=async(url,options)=>{
    assert.match(url,/^https:\/\/fr\.jooble\.org\/api\//);assert.equal(options.method,'POST');
    assert.equal(JSON.parse(options.body).location,'Paris');
    if(calls++)return {ok:false,status:429};
    return response({jobs:[{id:2,title:'Credit Risk Analyst (Internship)',link:'https://fr.jooble.org/jdp/2',location:'Paris',company:'Bank',type:'Full-time',snippet:'<p>Stage analyse crédit</p>',updated:'2026-09-12T00:00:00Z'}]});
  };
  const r=await searchJooble(input,{apiKey:'test-key',fetchImpl});
  assert.equal(r.status,'partial');assert.equal(r.offers.length,1);assert.equal(r.offers[0].contractType,'unknown');
  assert.equal(r.offers[0].description,'Stage analyse crédit');
});

test('new sources survive primary-provider outage and deterministic area filters run before AI',async()=>{
  let seen=[];
  const r=await searchStructuredOffers({query:'analyste crédit',country:'France',city:'Paris',contractTypes:['Stage'],strictContract:true,searchArea:{scope:'city',city:'Paris'},aiPlan:{queries:['Credit analyst'],franceTravailQueries:['Analyste crédit']}},{
    jsearch:{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})},
    franceTravail:{clientId:'test',clientSecret:'test',fetchImpl:async()=>({ok:false,status:503})},
    jooble:{apiKey:'test',fetchImpl:async()=>response({jobs:[
      {id:1,title:'Credit internship',company:'Bank',location:'Paris',link:'https://fr.jooble.org/jdp/1',type:'internship'},
      {id:2,title:'Credit internship',company:'Bank',location:'Lyon',link:'https://fr.jooble.org/jdp/2',type:'internship'},
    ]})},
    classifyOffers:async offers=>{seen=offers;return new Map(offers.map(o=>[o.url,{tier:'strong',reason:'Credit analysis responsibilities'}]));},
  });
  assert.equal(seen.length,1);assert.equal(seen[0].location,'Paris');
  assert.equal(r.productionProviderSucceeded,true);assert.equal(r.offers.length,1);assert.equal(r.offers[0].source,'jooble');
});

test('search version invalidates the lower task cache as well as the direction cache',()=>{
 const base={experience:'v1',query:'analyste crédit'},version={id:'test-cv'};
 const old=operationKey('search',{...base,searchRevision:'v13-ai-market-search'},version,[],'2026-09-12');
 const next=operationKey('search',{...base,searchRevision:'v14-multi-source-ai-search'},version,[],'2026-09-12');
 assert.notEqual(old,next);assert.equal(reusableTask([{kind:'search',status:'completed',operationKey:old}],next),null);
});
