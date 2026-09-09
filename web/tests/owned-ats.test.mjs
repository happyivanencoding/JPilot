import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveTrackedBoard,
  fetchTrackedBoard,
  parseBoardHtml,
} from "../src/lib/job-search/providers/ats-board.mjs";
import { searchTrackedAts } from "../src/lib/job-search/providers/tracked-ats.mjs";
const response = (value) =>
  typeof value === "string"
    ? new Response(value, { headers: { "content-type": "text/html" } })
    : Response.json(value);
const posting = "https://example.test/jobs/1";
const fixtures = [
  {
    type: "greenhouse",
    entry: { api: "https://boards-api.greenhouse.io/v1/boards/demo/jobs" },
    data: {
      jobs: [
        {
          id: 1,
          title: "Analyst",
          absolute_url: posting,
          location: { name: "Paris" },
          content: "&lt;p&gt;Python &amp;amp; SQL&lt;/p&gt;",
          first_published: "2026-09-01T12:00:00Z",
          updated_at: "2026-09-09T12:00:00Z",
        },
      ],
    },
    url: /content=true/,
    description: "Python & SQL",
    stamp: Date.parse("2026-09-01T12:00:00Z"),
  },
  {
    type: "ashby",
    entry: { careers_url: "https://jobs.ashbyhq.com/demo" },
    data: {
      jobs: [
        {
          title: "Analyst",
          jobUrl: posting,
          location: "Paris",
          descriptionPlain: "Python",
          publishedAt: "2026-09-01T12:00:00Z",
          isListed: true,
        },
      ],
    },
    url: /posting-api\/job-board\/demo/,
    description: "Python",
  },
  {
    type: "lever",
    entry: { careers_url: "https://jobs.lever.co/demo" },
    data: [
      {
        text: "Analyst",
        hostedUrl: posting,
        categories: { location: "Paris" },
        descriptionPlain: "Python",
        createdAt: 1788264000000,
      },
    ],
    url: /v0\/postings\/demo\?mode=json/,
    description: "Python",
  },
  {
    type: "workable",
    entry: { careers_url: "https://apply.workable.com/demo/" },
    data: {
      jobs: [
        {
          title: "Analyst",
          shortlink: posting,
          location: { city: "Paris" },
          description: "<p>Python</p>",
          published_on: "2026-09-01",
        },
      ],
    },
    url: /widget\/accounts\/demo\?details=true/,
    description: "Python",
  },
];
for (const fixture of fixtures)
  test(`${fixture.type} keeps posting evidence and publication metadata`, async () => {
    const entry = { name: "Fictional board", ...fixture.entry };
    let calls = 0;
    assert.equal(resolveTrackedBoard(entry).provider, fixture.type);
    const rows = await fetchTrackedBoard(entry, {
      fetchImpl: async (url) => {
        calls++;
        assert.match(String(url), fixture.url);
        return response(fixture.data);
      },
    });
    assert.equal(calls, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Analyst");
    assert.equal(rows[0].location, "Paris");
    assert.equal(rows[0].description, fixture.description);
    if (fixture.stamp) assert.equal(rows[0].postedAt, fixture.stamp);
  });

test("Greenhouse office lookup enriches work-model-only location instead of losing geography", async () => {
  const rows = await fetchTrackedBoard(
    { name: "Demo", careers_url: "https://job-boards.greenhouse.io/demo" },
    {
      fetchImpl: async (url) =>
        String(url).includes("/offices")
          ? response({
              offices: [
                { name: "Paris", departments: [{ jobs: [{ id: 1 }] }] },
              ],
            })
          : response({
              jobs: [
                {
                  id: 1,
                  title: "Analyst",
                  absolute_url: posting,
                  location: { name: "Hybrid" },
                },
              ],
            }),
    },
  );
  assert.equal(rows[0].location, "Hybrid · Paris");
  assert.equal(rows[0].postedAt, undefined);
});

test("Gem batches detail retrieval and does not confuse seconds with milliseconds", async () => {
  let calls = 0;
  const rows = await fetchTrackedBoard(
    { name: "Demo", careers_url: "https://jobs.gem.com/demo", provider: "gem" },
    {
      fetchImpl: async (url, init) => {
        calls++;
        const body = JSON.parse(init.body);
        assert.ok(body[0].query);
        return response(
          calls === 1
            ? [
                {
                  data: {
                    oatsExternalJobPostings: {
                      jobPostings: [
                        {
                          extId: "one",
                          title: "Analyst",
                          locations: [{ name: "Paris" }],
                        },
                      ],
                    },
                  },
                },
              ]
            : [
                {
                  data: {
                    oatsExternalJobPosting: {
                      extId: "one",
                      firstPublishedTsSec: 1788264000,
                      descriptionHtml: "<p>SQL</p>",
                    },
                  },
                },
              ],
        );
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(rows[0].postedAt, 1788264000000);
  assert.match(rows[0].url, /\/demo\/one$/);
  assert.equal(rows[0].description, "SQL");
});

test("iCIMS parses themed HTML, keeps same-origin postings and terminates repeating pages", async () => {
  const html =
    '<li class="iCIMS_JobCardItem"><a href="/jobs/1/analyst/job"><h3 class="title">Analyst &amp; Risk</h3></a><span class="theme field-label">Location</span><span>Paris</span></li>';
  let calls = 0;
  const rows = await fetchTrackedBoard(
    {
      name: "Demo",
      careers_url: "https://careers-demo.icims.com/jobs/search?ss=1",
    },
    {
      fetchImpl: async () => {
        calls++;
        return response(html);
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Analyst & Risk");
  assert.equal(rows[0].location, "Paris");
  assert.equal(rows[0].postedAt, undefined);
  assert.equal(
    parseBoardHtml(
      "icims",
      html.replace(
        "/jobs/1/analyst/job",
        "https://other.test/jobs/1/analyst/job",
      ),
      "https://careers-demo.icims.com",
    ).length,
    0,
  );
});

test("Phenom reports the real page count and retains dates and locations", async () => {
  const rows = await fetchTrackedBoard(
    {
      name: "Demo",
      careers_url: "https://careers.example.test",
      provider: "phenom",
    },
    {
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://careers.example.test/widgets");
        assert.equal(JSON.parse(init.body).from, 0);
        return response({
          refineSearch: {
            totalHits: 1,
            data: {
              jobs: [
                {
                  jobId: "id1",
                  title: "Analyst",
                  city: "Paris",
                  country: "France",
                  postedDate: "2026-09-01T12:00:00Z",
                },
              ],
            },
          },
        });
      },
    },
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].url, /global\/en\/job\/id1\/Analyst$/);
  assert.equal(rows[0].location, "Paris · France");
  assert.ok(rows[0].postedAt);
});

test("SuccessFactors tiles and locale-specific CSB preserve their configured brand paths", async () => {
  const html =
    '<li class="job-tile job-id-1" data-url="/job/Paris-Analyst/1/"><a class="jobTitle-link">Analyst</a><div id="1-section-city-value">Paris</div></li>';
  assert.equal(
    parseBoardHtml("successfactors", html, "https://careers.example.test")[0]
      .location,
    "Paris",
  );
  const rows = await fetchTrackedBoard(
    {
      name: "Demo",
      api: "https://careers.example.test/brand",
      provider: "successfactors",
    },
    {
      fetchImpl: async (url, init) => {
        if (url.includes("tile-search-results")) return response("");
        if (url.endsWith("/search/")) return response("<option>fr_FR</option>");
        assert.equal(JSON.parse(init.body).locale, "fr_FR");
        return response({
          totalJobs: 1,
          jobSearchResult: [
            {
              response: {
                id: 10,
                unifiedStandardTitle: "Analyst",
                urlTitle: "Analyst",
                jobLocationShort: ["Paris<br>"],
                unifiedStandardStart: "01.09.26",
              },
            },
          ],
        });
      },
    },
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].url, /brand\/job\/Analyst\/10-fr_FR$/);
  assert.equal(rows[0].postedAt, Date.UTC(2026, 8, 1));
});

test("tracked search requires no runtime source in its data directory; cached reads bill no HTTP calls", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jobpilot-boards-"));
  try {
    fs.writeFileSync(
      path.join(root, "portals.yml"),
      "tracked_companies:\n  - name: Demo\n    careers_url: https://jobs.lever.co/demo\n",
    );
    const options = {
      enabled: true,
      dataRoot: root,
      fetchImpl: async () =>
        response([
          {
            text: "Analyst",
            hostedUrl: posting,
            categories: { location: "Paris" },
          },
        ]),
    };
    const first = await searchTrackedAts({}, options),
      second = await searchTrackedAts({}, options);
    assert.equal(first.offers.length, 1);
    assert.equal(first.apiCalls, 1);
    assert.equal(second.apiCalls, 0);
    assert.equal(second.cacheHit, true);
    assert.equal(fs.existsSync(path.join(root, "providers")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a failed employer endpoint is recorded as an error, not a successful empty search", async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "jobpilot-boards-failure-"),
  );
  try {
    fs.writeFileSync(
      path.join(root, "portals.yml"),
      "tracked_companies:\n  - name: Demo\n    careers_url: https://jobs.lever.co/demo\n",
    );
    const result = await searchTrackedAts(
      {},
      {
        enabled: true,
        dataRoot: root,
        fetchImpl: async () => new Response("Unavailable", { status: 403 }),
      },
    );
    assert.equal(result.status, "error");
    assert.equal(result.boardsFailed, 1);
    assert.match(result.failures[0].error, /403/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
