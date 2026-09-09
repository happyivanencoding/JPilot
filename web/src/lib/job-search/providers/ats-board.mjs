// Public, read-only ATS connectors used by JobPilot's configured employer boards.
// API protocol references and retained scope are documented in docs/OWNED_CORE.md.
import { load } from "cheerio";
import { normalizeUrl } from "../../posting-url.mjs";

const supported = new Set([
  "greenhouse",
  "ashby",
  "lever",
  "workable",
  "gem",
  "phenom",
  "icims",
  "successfactors",
]);
const text = (value) => {
  const source = String(value ?? "");
  const first = load(source).root().text();
  return (/&lt;\/?[a-z]/i.test(source) ? load(first).root().text() : first)
    .replace(/\s+/g, " ")
    .trim();
};
const date = (value) => {
  const stamp = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(stamp) && stamp > 0 ? stamp : undefined;
};
const location = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map(location).filter(Boolean))].join(" · ")
    : value && typeof value === "object"
      ? text(
          value.name ||
            [
              value.city,
              value.region || value.state,
              value.country || value.isoCountry,
            ]
              .filter(Boolean)
              .join(", "),
        )
      : text(value);
const slug = (value) =>
  text(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || "job";

export function resolveTrackedBoard(entry) {
  let url;
  try {
    url = new URL(entry.api || entry.careers_url);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  let provider = entry.provider;
  if (!provider) {
    const host = url.hostname;
    if (host.endsWith(".greenhouse.io")) provider = "greenhouse";
    else if (host.endsWith(".ashbyhq.com")) provider = "ashby";
    else if (host.endsWith(".lever.co")) provider = "lever";
    else if (host === "apply.workable.com") provider = "workable";
    else if (host === "jobs.gem.com") provider = "gem";
    else if (host.endsWith(".icims.com")) provider = "icims";
    else if (/\.(successfactors\.(com|eu)|jobs2web\.com)$/.test(host))
      provider = "successfactors";
  }
  return supported.has(provider) ? { provider, url } : null;
}

export function parseBoardHtml(provider, html, origin) {
  const $ = load(html),
    rows = [];
  if (provider === "icims") {
    $(".iCIMS_JobCardItem").each((_, node) => {
      const card = $(node),
        anchor = card
          .find('a[href*="/jobs/"]')
          .filter((_, a) =>
            /\/jobs\/\d+\/[^/]+\/job/.test($(a).attr("href") || ""),
          )
          .first();
      const href = anchor.attr("href");
      if (!href) return;
      const url = new URL(href, origin);
      if (url.origin !== origin) return;
      const title = text(
        anchor.find("h3").text() || card.find("h3").first().text(),
      );
      const label = card
        .find(".field-label")
        .filter((_, node) => /^Location$/i.test($(node).text().trim()))
        .first();
      if (title)
        rows.push({
          title,
          url: url.origin + url.pathname,
          location: text(label.next("span").text()),
        });
    });
  } else {
    $("li.job-tile").each((_, node) => {
      const card = $(node),
        href =
          card.attr("data-url") ||
          card.find("[data-url]").first().attr("data-url") ||
          card.find("a.jobTitle-link").first().attr("href");
      const title = text(card.find("a.jobTitle-link").first().text());
      if (!href || !title) return;
      const url = new URL(href, origin).href;
      let city = text(card.find('[id$="-section-city-value"]').first().text());
      if (!city) {
        const segment =
          decodeURIComponent(new URL(url).pathname)
            .split("/job/")[1]
            ?.split("/")[0] || "";
        const needle = slug(title)
          .split("-")
          .slice(0, 2)
          .join("-")
          .toLowerCase();
        const at = segment.toLowerCase().indexOf(needle);
        if (at > 0) city = segment.slice(0, at).replace(/-/g, " ").trim();
      }
      rows.push({ title, url, location: city });
    });
  }
  return rows;
}

export async function fetchTrackedBoard(
  entry,
  {
    fetchImpl = fetch,
    onWarning = () => {},
    onRequest = () => {},
    maxPages,
  } = {},
) {
  const resolved = resolveTrackedBoard(entry);
  if (!resolved)
    throw new Error(`Unsupported or invalid employer board: ${entry.name}`);
  const { provider, url } = resolved;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function request(target, { json = true, ...options } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      onRequest();
      const response = await fetchImpl(target, {
        ...options,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; JobPilot)",
          "accept-language": "en-US,en;q=0.9",
          accept: json ? "application/json" : "text/html",
          ...options.headers,
        },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) return json ? response.json() : response.text();
      if (
        attempt === 0 &&
        (response.status === 429 || response.status >= 500)
      ) {
        await response.body?.cancel();
        await sleep(600);
        continue;
      }
      throw new Error(`${provider}: HTTP ${response.status}`);
    }
  }
  const post = (target, body, headers = {}) =>
    request(target, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const finish = (rows) => [
    ...new Map(
      rows
        .filter((row) => row.title && normalizeUrl(row.url))
        .map((row) => [normalizeUrl(row.url), { ...row, company: entry.name }]),
    ).values(),
  ];
  async function paginate(read, limit) {
    const rows = [],
      seen = new Set();
    const cap = maxPages || entry.max_pages || limit;
    for (let page = 0; page < cap; page++) {
      let batch;
      try {
        batch = await read(page, rows.length);
      } catch (error) {
        if (!rows.length) throw error;
        onWarning(String(error));
        break;
      }
      let added = 0;
      for (const row of batch.rows) {
        const key = row.id || normalizeUrl(row.url);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        added++;
      }
      if (!added || batch.done) return rows;
      if (page === cap - 1)
        onWarning(
          `${provider}: stopped at the configured page limit; results are partial.`,
        );
      else await sleep(150);
    }
    return rows;
  }
  if (provider === "greenhouse") {
    const token =
      url.pathname.match(/\/boards\/([^/]+)/)?.[1] ||
      url.pathname.split("/").filter(Boolean)[0];
    const endpoint = new URL(
      url.hostname.startsWith("boards-api.")
        ? url.href
        : `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`,
    );
    endpoint.searchParams.set("content", "true");
    const jobs = (await request(endpoint.href)).jobs || [];
    const modelOnly = (value) =>
      /^(remote|hybrid|on.?site|in.?office)$/i.test(text(value));
    const offices = new Map();
    if (jobs.some((job) => modelOnly(job.location?.name))) {
      try {
        const data = await request(
          endpoint.origin + endpoint.pathname.replace(/\/jobs\/?$/, "/offices"),
        );
        const visit = (list) => {
          for (const office of list || []) {
            for (const department of office.departments || [])
              for (const job of department.jobs || []) {
                const names = offices.get(job.id) || [];
                names.push(office.name);
                offices.set(job.id, names);
              }
            visit(office.children);
          }
        };
        visit(data.offices);
      } catch (error) {
        onWarning(`Office locations unavailable: ${error.message}`);
      }
    }
    return finish(
      jobs.map((job) => ({
        title: text(job.title),
        url: job.absolute_url,
        location: [
          job.location?.name,
          ...(modelOnly(job.location?.name) ? offices.get(job.id) || [] : []),
        ]
          .filter(Boolean)
          .join(" · "),
        description: text(job.content),
        postedAt: date(job.first_published),
      })),
    );
  }
  if (provider === "ashby") {
    const token =
      url.pathname.match(/\/job-board\/([^/]+)/)?.[1] ||
      url.pathname.split("/").filter(Boolean)[0];
    const data = await request(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
    );
    return finish(
      (data.jobs || [])
        .filter((job) => job.isListed !== false)
        .map((job) => ({
          title: text(job.title),
          url: job.jobUrl,
          location: location([
            job.location,
            ...(job.secondaryLocations || []).map((row) => row.location),
          ]),
          description: job.descriptionPlain || text(job.descriptionHtml),
          postedAt: date(job.publishedAt),
        })),
    );
  }
  if (provider === "lever") {
    const token =
      url.pathname.match(/\/postings\/([^/]+)/)?.[1] ||
      url.pathname.split("/").filter(Boolean)[0];
    const data = await request(
      `https://api.${url.hostname.includes(".eu.") ? "eu." : ""}lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
    );
    return finish(
      (Array.isArray(data) ? data : []).map((job) => ({
        title: text(job.text),
        url: job.hostedUrl || job.applyUrl,
        location: location(
          job.categories?.allLocations || job.categories?.location,
        ),
        description: [
          job.descriptionPlain || text(job.description),
          ...(job.lists || []).map((item) => text(item.content)),
          job.additionalPlain,
        ]
          .filter(Boolean)
          .join("\n"),
        postedAt: date(job.createdAt),
      })),
    );
  }
  if (provider === "workable") {
    const token =
      url.pathname.match(/\/accounts\/([^/]+)/)?.[1] ||
      url.pathname.split("/").filter(Boolean)[0];
    let data;
    try {
      data = await request(
        `https://apply.workable.com/api/v1/widget/accounts/${token}?details=true`,
        {
          headers: {
            referer: `https://apply.workable.com/${token}/`,
            origin: "https://apply.workable.com",
          },
        },
      );
    } catch (error) {
      const markdown = await request(
        `https://apply.workable.com/${token}/jobs.md`,
        { json: false },
      );
      const rows = [];
      for (const line of markdown.split("\n")) {
        const cells = line.split("|").map((value) => value.trim());
        const link = line.match(
          /\[([^\]]+)\]\((https:\/\/apply\.workable\.com\/[^)]+)\)/,
        );
        if (link)
          rows.push({
            title: text(cells[1] || link[1]),
            url: link[2],
            location: text(cells[2]),
          });
      }
      if (!rows.length) throw error;
      onWarning(
        "Workable widget unavailable; using its less detailed public feed.",
      );
      return finish(rows);
    }
    return finish(
      (data.jobs || []).map((job) => ({
        title: text(job.title),
        url: job.shortlink || job.url,
        location: location(
          job.locations ||
            job.location ||
            [job.city, job.country].filter(Boolean),
        ),
        description: text(job.description),
        postedAt: date(job.published_on || job.created_at),
      })),
    );
  }
  if (provider === "gem") {
    const board = url.pathname.split("/").filter(Boolean)[0],
      endpoint = "https://jobs.gem.com/api/public/graphql/batch";
    const query =
      "query Board($board: String!) { oatsExternalJobPostings(boardId:$board) { jobPostings { extId title locations { name city isoCountry isRemote } } } }";
    const data = await post(
      endpoint,
      [{ operationName: "Board", variables: { board }, query }],
      { batch: "true" },
    );
    if (data?.[0]?.errors?.length) throw new Error(data[0].errors[0].message);
    const jobs = data?.[0]?.data?.oatsExternalJobPostings?.jobPostings || [];
    const details = new Map();
    if (jobs.length)
      try {
        const query =
          "query Detail($board: String!, $id: String!) { oatsExternalJobPosting(boardId:$board,extId:$id) { extId firstPublishedTsSec descriptionHtml jobPostSectionHtml { introHtml outroHtml } compensationHtml } }";
        const response = await post(
          endpoint,
          jobs.map((job) => ({
            operationName: "Detail",
            variables: { board, id: job.extId },
            query,
          })),
          { batch: "true" },
        );
        for (const item of response || []) {
          const detail = item?.data?.oatsExternalJobPosting;
          if (detail?.extId) details.set(detail.extId, detail);
        }
      } catch (error) {
        onWarning(`Gem detail enrichment failed: ${error.message}`);
      }
    return finish(
      jobs.map((job) => {
        const detail = details.get(job.extId) || {};
        return {
          title: text(job.title),
          url: `${url.origin}/${board}/${job.extId}`,
          location: location(job.locations),
          description: [
            detail.jobPostSectionHtml?.introHtml,
            detail.descriptionHtml,
            detail.jobPostSectionHtml?.outroHtml,
            detail.compensationHtml,
          ]
            .filter(Boolean)
            .map(text)
            .join("\n"),
          postedAt: date(Number(detail.firstPublishedTsSec) * 1000),
        };
      }),
    );
  }
  if (provider === "icims")
    return finish(
      await paginate(
        async (page) => ({
          rows: parseBoardHtml(
            "icims",
            await request(
              `${url.origin}/jobs/search?ss=1&pr=${page}&in_iframe=1`,
              { json: false },
            ),
            url.origin,
          ),
        }),
        30,
      ),
    );
  if (provider === "phenom") {
    const options = entry.phenom || {},
      prefix = String(options.urlPrefix || "global/en").replace(
        /^\/+|\/+$/g,
        "",
      );
    return finish(
      await paginate(async (page) => {
        const data = await post(url.origin + "/widgets", {
          lang: options.lang || "en_global",
          deviceType: "desktop",
          country: options.country || "global",
          pageName: "search-results",
          ddoKey: "refineSearch",
          sortBy: "",
          subsearch: "",
          from: page * 100,
          jobs: true,
          counts: true,
          all_fields: ["category", "country", "city"],
          size: 100,
          clearAll: false,
          jdsource: "facets",
          isSliderEnable: false,
          pageId: "page10",
          siteType: "external",
          keywords: "",
          global: (options.country || "global") === "global",
          selected_fields: options.selectedFields || {},
          locationData: {},
        });
        const jobs = data.refineSearch?.data?.jobs || [];
        return {
          rows: jobs
            .filter((job) => job.jobId && job.title)
            .map((job) => ({
              id: String(job.jobId),
              title: text(job.title),
              url: `${url.origin}/${prefix}/job/${encodeURIComponent(job.jobId)}/${slug(job.title)}`,
              location: location(
                job.location ||
                  job.cityStateCountry ||
                  job.cityState ||
                  [job.city, job.state, job.country].filter(Boolean),
              ),
              postedAt: date(job.postedDate || job.dateCreated),
            })),
          done:
            jobs.length < 100 ||
            (page + 1) * 100 >= data.refineSearch?.totalHits,
        };
      }, 20),
    );
  }
  // SuccessFactors exposes either HTML tiles or its newer locale-specific CSB API.
  const base =
    url.origin +
    url.pathname
      .replace(
        /\/(search|tile-search-results|services\/recruiting\/v1\/jobs)\/?$/i,
        "",
      )
      .replace(/\/+$/, "");
  let tileError;
  try {
    const rows = await paginate(
      async (_, offset) => ({
        rows: parseBoardHtml(
          "successfactors",
          await request(`${base}/tile-search-results/?startrow=${offset}`, {
            json: false,
          }),
          url.origin,
        ),
      }),
      100,
    );
    if (rows.length) return finish(rows.slice(0, 1000));
  } catch (error) {
    tileError = error;
  }
  let locales = ["en_US", "en_GB", "de_DE", "fr_FR"];
  try {
    const html = await request(base + "/search/", { json: false });
    const discovered = [...new Set(html.match(/\b[a-z]{2}_[A-Z]{2}\b/g) || [])];
    if (discovered.length) locales = discovered.slice(0, 8);
  } catch {}
  const all = [],
    known = new Set();
  let answered = false;
  for (const locale of locales) {
    try {
      const rows = await paginate(async (page) => {
        const data = await post(base + "/services/recruiting/v1/jobs", {
          keywords: "",
          locale,
          location: "",
          pageNumber: page,
          sortBy: "recent",
        });
        answered = true;
        const raw = data.jobSearchResult || [];
        return {
          rows: raw
            .map((item) => item.response)
            .filter(
              (job) => job?.id && (job.unifiedStandardTitle || job.jobTitle),
            )
            .map((job) => {
              const rawDate = String(job.unifiedStandardStart || ""),
                parts = rawDate.match(
                  /^(\d{1,2})([./])(\d{1,2})[./](\d{2,4})$/,
                );
              const stamp = parts
                ? Date.UTC(
                    Number(parts[4]) + (parts[4].length === 2 ? 2000 : 0),
                    Number(parts[2] === "." ? parts[3] : parts[1]) - 1,
                    Number(parts[2] === "." ? parts[1] : parts[3]),
                  )
                : undefined;
              return {
                id: String(job.id),
                title: text(job.unifiedStandardTitle || job.jobTitle),
                url: `${base}/job/${text(job.unifiedUrlTitle || job.urlTitle || "job").replace(/[?#&]+/g, "-")}/${job.id}-${locale}`,
                location: location(job.jobLocationShort),
                postedAt: date(stamp),
              };
            }),
          done: raw.length < 10 || (page + 1) * 10 >= data.totalJobs,
        };
      }, 100);
      for (const row of rows)
        if (!known.has(row.id)) {
          known.add(row.id);
          all.push(row);
        }
      if (all.length >= 1000) break;
    } catch (error) {
      onWarning(`SuccessFactors ${locale}: ${error.message}`);
      tileError ||= error;
    }
  }
  if (!answered && !all.length && tileError) throw tileError;
  return finish(all.slice(0, 1000));
}
