import {activeProfileId} from '@/lib/profile-request';
import {mobileDirectory} from '@/lib/mobile-engine';
import {cvPrivacyNotice,privacyRecord,recordCvChoice,privacyRecipients} from '@/lib/cv-privacy.mjs';
import {requestUiLocale} from '@/lib/language-contract.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request) {
 if(process.env.JOBPILOT_V1_PREVIEW!=='1')return Response.json({error:'Not found'},{status:404});
 const profileId=await activeProfileId(new URL(req.url).searchParams.get('profileId'));
 return Response.json({notice:cvPrivacyNotice,recipients:privacyRecipients(),record:privacyRecord(mobileDirectory(profileId))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
 if(process.env.JOBPILOT_V1_PREVIEW!=='1')return Response.json({error:'Not found'},{status:404});
 try {
  const profileId=await activeProfileId(new URL(req.url).searchParams.get('profileId'));
  const body=await req.json();
  const record=await recordCvChoice(mobileDirectory(profileId),{...body,locale:["en","fr","zh"].includes(body.noticeLocale)?body.noticeLocale:requestUiLocale(req)});
  return Response.json({ok:true,record},{headers:{'Cache-Control':'no-store'}});
 } catch(e) {return Response.json({error:e instanceof Error?e.message:String(e)},{status:400});}
}
