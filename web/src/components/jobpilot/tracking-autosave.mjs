/** Coalesce text edits, serialize writes, and keep failed changes available to retry. */
/** @param {(patch:Record<string,any>)=>Promise<any>} write
 * @param {(state:string,error?:any)=>void} changed */
export function trackingAutosave(write,changed=(_state,_error)=>{},delay=450) {
 let pending={},timer=null,running=null,failed=false;
 const flush=()=>{
  clearTimeout(timer);timer=null;
  if(running)return running;
  if(!Object.keys(pending).length)return Promise.resolve();
  failed=false;
  running=(async()=>{
   while(Object.keys(pending).length) {
    const patch=pending;pending={};changed('saving');
    try {await write(patch);}
    catch(error){pending={...patch,...pending};failed=true;changed('failed',error);return;}
   }
   changed('saved');
  })().finally(()=>{running=null;if(!failed&&Object.keys(pending).length)void flush();});
  return running;
 };
 return {
  edit(patch,immediate=false){pending={...pending,...patch};changed('saving');clearTimeout(timer);if(immediate)void flush();else timer=setTimeout(flush,delay);},
  flush,
  get dirty(){return !!Object.keys(pending).length||!!running;},
 };
}
