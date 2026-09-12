import {load} from 'cheerio';
const clean=(v,n=500)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,n);

export async function searchAdzuna(input,options={}) {
  const base={id:'adzuna',label:'Adzuna',status:'unconfigured',latencyMs:0,rawCount:0,apiCalls:0,estimatedCostUsd:0,offers:[]};
  const appId=options.appId||process.env.JOBPILOT_ADZUNA_APP_ID,appKey=options.appKey||process.env.JOBPILOT_ADZUNA_APP_KEY;
  if(!appId||!appKey)return base;
  if(options.enabled!==true && process.env.JOBPILOT_ADZUNA_ENABLED!=='1')return {...base,status:'disabled'};
  const country=input.countryCode||'fr';
  if(country!=='fr')return {...base,status:'disabled'}; // This integration uses the France entitlement.
  const queries=(input.franceTravailQueries?.length?input.franceTravailQueries:input.queries).slice(0,2);
  const fetchImpl=options.fetchImpl||fetch,started=Date.now();
  const results=await Promise.allSettled(queries.map(async query=>{
    const url=new URL('https://api.adzuna.com/v1/api/jobs/fr/search/1');
    for(const [k,v] of Object.entries({app_id:appId,app_key:appKey,what:query,where:input.city||'France',results_per_page:'30','content-type':'application/json'}))url.searchParams.set(k,v);
    // Never propagate a URL-bearing fetch error: Adzuna puts credentials in the URL.
    let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(12_000)});}catch{throw new Error('Adzuna request failed');}
    if(!response.ok)throw new Error(`Adzuna HTTP ${response.status}`);
    let data;try{data=await response.json();}catch{throw new Error('Invalid Adzuna response');}
    if(!Array.isArray(data.results))throw new Error('Invalid Adzuna response');
    return data.results;
  }));
  const successful=results.filter(r=>r.status==='fulfilled'),failures=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);
  if(!successful.length)throw new Error(failures[0]||'Adzuna request failed');
  const offers=successful.flatMap(r=>r.value).flatMap(job=>{
    const url=clean(job.redirect_url,2000),title=clean(job.title,300),company=clean(job.company?.display_name,300);
    if(!/^https?:\/\//i.test(url)||!title||!company)return [];
    return [{url,title,company,location:clean(job.location?.display_name,300),country:'France',
      description:clean(load(String(job.description||'')).text(),12000),
      contractType:job.contract_type==='permanent'?'CDI':'unknown',
      postedAt:job.created&&Number.isFinite(Date.parse(job.created))?new Date(job.created).toISOString():null,
      source:'adzuna',sourceLabel:'Adzuna',requiresAttribution:true,direct:false,providerJobId:clean(job.id,100),verification:'unconfirmed'}];
  });
  return {...base,status:failures.length?'partial':'ok',offers,rawCount:offers.length,apiCalls:queries.length,latencyMs:Date.now()-started,failures};
}
