/** Read-only adapter: opening a discovery offer must not create a candidature or AI task. */
export function roleDetailForOffer(offer,jobs=[]) {
 const saved=jobs.find(job=>job.url===offer.url);
 if(saved)return saved;
 const deep=offer.deepMatch || {},fast=offer.fastMatch || {},scores=offer.matchScore || {};
 const current=scores.baseline ?? deep.currentScore ?? fast.score ?? -1;
 return {id:'',url:offer.url,role:offer.title,company:offer.company,location:offer.location,
   contract:offer.contractType,status:'À candidater',matchScore:scores,
   v1Match:{currentScore:current,displayScore:scores.current ?? current,cvPotentialScore:scores.forecast ?? deep.cvPotentialScore ?? current,deepMatch:deep}};
}
export function roleCvIsReady(job) {return job.cvDraft?.status==='pending' || !!job.cv?.file;}
