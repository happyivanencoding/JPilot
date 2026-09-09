// The public gateway authenticates users; the backend still rejects unrelated browser origins.
export function normalizeHost(value) {
  const host = String(value || "")
    .trim()
    .toLowerCase();
  if (host[0] === "[")
    return host.slice(1, host.indexOf("]") < 0 ? undefined : host.indexOf("]"));
  return host.split(":").length === 2 ? host.split(":")[0] : host;
}
export function isLoopbackHost(value) {
  const host = normalizeHost(value);
  return (
    host === "localhost" ||
    host === "::1" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}
export function parseAllowedHosts(value) {
  return new Set(
    String(value || "")
      .split(/[\s,]+/)
      .map(normalizeHost)
      .filter(Boolean),
  );
}
/** @returns {{ok:true}|{ok:false,status:number,reason:string}} */
export function checkRequest({ secFetchSite, origin, host, allowedHosts }) {
  const deny = (reason) => ({ ok: false, status: 403, reason });
  const hostname = normalizeHost(host);
  if (!hostname) return deny("missing Host header");
  if (!isLoopbackHost(hostname) && !allowedHosts?.has(hostname))
    return deny(
      "this host is not allowed; configure CAREER_OPS_WEB_ALLOWED_HOSTS for the trusted gateway",
    );
  if (secFetchSite)
    return ["same-origin", "none"].includes(secFetchSite)
      ? { ok: true }
      : deny(`cross-origin request refused (Sec-Fetch-Site: ${secFetchSite})`);
  if (origin === null || origin === undefined) return { ok: true };
  try {
    return new URL(origin).host.toLowerCase() ===
      String(host).trim().toLowerCase()
      ? { ok: true }
      : deny("cross-origin request refused (Origin does not match Host)");
  } catch {
    return deny("invalid Origin header");
  }
}
