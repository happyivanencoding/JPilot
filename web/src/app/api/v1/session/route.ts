import {NextResponse} from 'next/server';
import {workspaceRoot} from '@/lib/backend/workspace';
import {createPreviewSession, readPreviewSession, revokePreviewSession, previewToken, PREVIEW_COOKIE} from '@/lib/v1-session.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const enabled=()=>process.env.JOBPILOT_V1_PREVIEW==='1';
export async function GET(req:Request) {
  if(!enabled()) return NextResponse.json({error:'Not found'},{status:404});
  const session=readPreviewSession(workspaceRoot(),previewToken(req.headers));
  return NextResponse.json({authenticated:!!session,profileId:session?.profileId || ''},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
  if(!enabled()) return NextResponse.json({error:'Not found'},{status:404});
  const body=await req.json();
  const token=previewToken(req.headers);
  if(body.action==='logout') {
    revokePreviewSession(workspaceRoot(),token);
    const response=NextResponse.json({ok:true});
    response.cookies.set(PREVIEW_COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
    response.cookies.set('career-ops-profile','',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
    return response;
  }
  if(body.action!=='login' || String(body.invite || '').trim().toUpperCase()!=='V1TEST') return NextResponse.json({error:'Use the preview invitation V1TEST.'},{status:400});
  revokePreviewSession(workspaceRoot(),token);
  const session=await createPreviewSession(workspaceRoot());
  const response=NextResponse.json(session,{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(PREVIEW_COOKIE,session.token,{httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:30*86400});
  response.cookies.set('career-ops-profile',session.profileId,{httpOnly:true,sameSite:'lax',path:'/',maxAge:30*86400});
  return response;
}
