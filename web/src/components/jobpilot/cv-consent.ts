import type {Json} from "./pilot-context";

export async function ensureCvConsent(request:(path:string,init?:RequestInit)=>Promise<Json>,locale:string){
  const state=await request("/api/v1/privacy");
  const notice=state.notice||{},record=state.record||{};
  if(record.acceptedAt&&record.version===notice.version&&!record.withdrawnAt)return;
  await request("/api/v1/privacy",{method:"POST",body:JSON.stringify({action:"accept",version:notice.version,acknowledged:true,noticeLocale:["zh","fr","en"].includes(locale)?locale:"en"})});
}
