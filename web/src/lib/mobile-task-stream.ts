import { readMobileTask, readCandidatureStore, type MobileTask } from "@/lib/mobile-engine";
/** Subscribers never own the agent lifetime. Multiple web/phone requests observe the same task. */
export function taskEventResponse(profileId: string, initial: MobileTask) {
  let cancelled=false;
  const encoder=new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      const emit=(type:string,value:Record<string,unknown>)=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify({type,t:type,...value})+"\n"));};
      let task=initial,offset=0;
      const deadline=Date.now()+900000;
      try {
        while(!cancelled && Date.now()<deadline) {
          if(task.text.length>offset){emit("text",{text:task.text.slice(offset)});offset=task.text.length;}
          if(task.status==="completed"){
            const job=task.result?.jobId?readCandidatureStore(profileId).jobs.find(j=>j.id===task.result!.jobId):undefined;
            emit("done",{...task.result,job,reused:initial.reused===true,taskId:task.id,metrics:task.metrics,tokens:task.metrics?.totalTokens ?? undefined});
            break;
          }
          if(["failed","interrupted"].includes(task.status)) {emit("error",{message:task.error || task.phase,msg:task.error || task.phase});break;}
          emit("progress",{label:task.phase,taskId:task.id});
          await new Promise(r=>setTimeout(r,1000));
          if(!cancelled)task=readMobileTask(profileId,task.id);
        }
        if(!cancelled)controller.close();
      }catch(error){emit("error",{message:String(error),msg:String(error)});if(!cancelled)controller.close();}
    },
    cancel(){cancelled=true;},
  }),{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store, no-transform","X-Accel-Buffering":"no"}});
}
