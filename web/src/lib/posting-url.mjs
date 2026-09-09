// One posting identity for discovery, tasks and reports. Job-ID parameters are never discarded.
const clickParameters = new Set([
  "gh_src",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "_hsenc",
  "_hsmi",
  "trk",
  "trackingid",
]);

export function normalizeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.protocol = "https:";
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (
        name.toLowerCase().startsWith("utm_") ||
        clickParameters.has(name.toLowerCase())
      )
        url.searchParams.delete(name);
    }
    const query = [...url.searchParams].sort((a, b) => {
      for (const index of [0, 1]) {
        if (a[index] < b[index]) return -1;
        if (a[index] > b[index]) return 1;
      }
      return 0;
    });
    url.search = new URLSearchParams(query).toString();
    if (url.pathname !== "/" && url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1);
    return url.href;
  } catch {
    return "";
  }
}
export default normalizeUrl;
