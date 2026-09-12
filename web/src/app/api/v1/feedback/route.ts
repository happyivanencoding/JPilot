import {activeProfileId} from '@/lib/profile-request';
import {saveV1Feedback} from '@/lib/v1-feedback-store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const profileId=await activeProfileId(new URL(req.url).searchParams.get('profileId'));
  const raw=await req.text();if(raw.length>20000)return Response.json({error:'Request too large'},{status:413});
  const body=JSON.parse(raw||'{}');
  const saved=saveV1Feedback(profileId,body);
  return Response.json({ok:true,id:saved.id,createdAt:saved.createdAt},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});}
}
