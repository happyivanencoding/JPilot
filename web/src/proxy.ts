import path from "node:path";
import {readPreviewSession,previewToken} from "@/lib/v1-session.mjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRequest, parseAllowedHosts } from "@/lib/request-origin.mjs";

// Single choke point over the API surface. Every /api request is gated on the
// same-origin + loopback guard before it can reach a route handler (which may
// spawn a child process or write the user's files). See request-origin.mjs for
// the two-layer rationale (F1 drive-by CSRF, F2 LAN reachability).
//
// Opt in to extra hosts (e.g. a trusted LAN box) with a comma/space separated
// CAREER_OPS_WEB_ALLOWED_HOSTS; unset means loopback only.
export function proxy(req: NextRequest) {
  const decision = checkRequest({
    secFetchSite: req.headers.get("sec-fetch-site"),
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    allowedHosts: parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }
  if (process.env.JOBPILOT_V1_PREVIEW === "1") {
    const forwarded=new Headers(req.headers);
    for(const name of ["x-jobpilot-role","x-jobpilot-profiles","x-jobpilot-email"]) forwarded.delete(name);
    const session=readPreviewSession(process.env.CAREER_OPS_ROOT || path.resolve(process.cwd(),".."),previewToken(req.headers));
    const publicRoute=req.nextUrl.pathname==="/api/v1/session" || req.nextUrl.pathname==="/";
    const internalPrewarm=req.nextUrl.pathname==="/api/internal/prewarm" && ["127.0.0.1","localhost"].includes(req.nextUrl.hostname);
    // This one server-to-server route has its own private bearer check in the
    // route handler. Let it reach that check without granting a V1 user session.
    const internalAnalytics=req.nextUrl.pathname==="/api/internal/analytics";
    if(!session && !publicRoute && !internalPrewarm && !internalAnalytics) return NextResponse.json({error:"Please sign in."},{status:401});
    const explicit=req.nextUrl.searchParams.get("profileId") || req.headers.get("x-jobpilot-profile");
    if(session && explicit && explicit!==session.profileId) return NextResponse.json({error:"This profile belongs to another session."},{status:403});
    if(session) {
      forwarded.set("x-jobpilot-role","user");
      forwarded.set("x-jobpilot-profiles",session.profileId);
    }
    return NextResponse.next({request:{headers:forwarded}});
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/"] };
