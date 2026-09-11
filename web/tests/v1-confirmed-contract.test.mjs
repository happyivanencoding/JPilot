import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProviderInput,rankSearchResults} from '../src/lib/job-search/index.mjs';
import {searchRequestFromConfig} from '../src/lib/job-search/mobile-context.mjs';
test('first-run confirmed contract choice excludes unknown source types rather than just demoting them',()=>{
 const request=searchRequestFromConfig('backend developer',{target_roles:{contract_types:['Stage','Alternance'],contract_policy:'confirmed_only'}},[],'France');
 const offer=(id,type)=>({title:'Backend developer',company:id,url:'https://example.com/'+id,location:'Paris',country:'France',contractType:type,description:'Java API development'});
 const result=rankSearchResults(request,[offer('unknown','unknown'),offer('permanent','CDI'),offer('intern','Stage'),offer('apprentice','Alternance')]);
 assert.deepEqual(new Set(result.offers.map(o=>o.company)),new Set(['intern','apprentice']));
 const input=buildProviderInput(request);
 assert.ok(input.queries.some(q=>/internship/.test(q)));assert.ok(input.queries.some(q=>/alternance/.test(q)));
 assert.ok(input.franceTravailQueries.some(q=>/stage/.test(q)));assert.ok(input.franceTravailQueries.some(q=>/alternance/.test(q)));
 assert.ok(input.queries.length<=3);assert.ok(input.franceTravailQueries.length<=3);
});
test('unrestricted profiles retain unknown contracts without incorrectly labelling them',()=>{
 const result=rankSearchResults({query:'backend developer',contractTypes:[],strictContract:false},[{title:'Backend developer',company:'Unknown',url:'https://example.com/u',location:'Paris',country:'France',contractType:'unknown'}]);
 assert.equal(result.offers.length,1);assert.equal(result.offers[0].contractType,'unknown');
});
