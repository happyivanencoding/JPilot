import "../scripts/register-source-loader.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  parseApplications,
  appendApplication,
  TRACKER_HEADER,
} from "../src/lib/backend/tracker-document.mjs";
import { parseReport } from "../src/lib/report-metadata.mjs";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "jobpilot-owned-"));
const previous = Object.fromEntries(
  ["CAREER_OPS_ROOT", "CAREER_OPS_PIPELINE", "CAREER_OPS_SCAN_HISTORY"].map(
    (key) => [key, process.env[key]],
  ),
);
process.env.CAREER_OPS_ROOT = root;
process.env.CAREER_OPS_PIPELINE = path.join(root, "data/pipeline.md");
process.env.CAREER_OPS_SCAN_HISTORY = path.join(root, "data/scan-history.tsv");
after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(root, { recursive: true, force: true });
});
const write = (name, value) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};
write("data/profiles.json", {
  version: 1,
  defaultProfileId: "test",
  profiles: [
    {
      id: "test",
      name: "Fictional QA",
      shortName: "QA",
      cvMarkdown: "data/cv.md",
      config: "data/config.yml",
      notes: "data/notes.md",
      candidatures: "data/candidatures.json",
    },
  ],
});
write(
  "data/cv.md",
  "# Fictional candidate\n\n## Experience\n- Python financial data checks.\n",
);
write("data/notes.md", "No invented claims.");
write(
  "data/config.yml",
  "candidate:\n  name: Fictional QA\n  email: qa@example.invalid\ncv:\n  language: fr\n  preferred_pages: 1\ncustom_evidence:\n  proof: verified\n",
);
write("data/candidatures.json", {
  candidate: "Fictional QA",
  jobs: [],
  updatedAt: "2026-09-09",
});
write(
  "data/applications.md",
  `${TRACKER_HEADER}\n|---|---|---|---|---|---|---|---|---|\n`,
);
const { persistEvaluation } = await import(
  "../src/lib/backend/evaluation-ledger.ts"
);
const { readApplications, readReport } = await import(
  "../src/lib/backend/workspace.ts"
);
const { addOffersToPipeline } = await import("../src/lib/backend/inbox.ts");
const { POST: savePreferences } = await import(
  "../src/app/api/profile/route.ts"
);
const { load: loadYaml } = await import("js-yaml");
const evaluate = (company, score = 0) =>
  persistEvaluation({
    profileId: "test",
    url: `https://example.test/${company}`,
    company,
    role: "Analyst",
    score,
    summary: "Synthetic finding",
    render: (num, date) =>
      `# Evaluation: ${company}\n**Date:** ${date}\n**URL:** https://example.test/${company}\n**Score:** ${score}/5\n\n## Evidence\nSynthetic report ${num}.\n`,
  });

test("concurrent evaluations allocate distinct report numbers and preserve existing reservation numbers", async () => {
  write(
    "reports/004-RESERVED.md",
    "Existing reservation, do not treat as a report.",
  );
  const reports = await Promise.all([evaluate("One"), evaluate("Two", 4.5)]);
  assert.deepEqual(reports.map((row) => row.reportNum).sort(), ["005", "006"]);
  assert.equal(readApplications("test").length, 2);
  for (const result of reports) {
    const report = readReport(result.reportNum);
    assert.equal(report.file, result.reportFile);
    assert.match(report.content, /Synthetic report/);
  }
  assert.equal(readReport("004"), null);
  const zero = readApplications("test").find((row) => row.company === "One");
  assert.equal(zero.score, "0.0/5");
  assert.equal(
    parseReport(readReport(zero.n).content).fields.find(
      (field) => field.label === "URL",
    ).value,
    "https://example.test/One",
  );
});

test("report render failure changes neither ledger nor completed reports", async () => {
  const file = path.join(root, "data/applications.md"),
    before = fs.readFileSync(file, "utf8");
  const names = fs.readdirSync(path.join(root, "reports"));
  await assert.rejects(
    persistEvaluation({
      profileId: "test",
      url: "https://example.test/bad",
      company: "Bad",
      role: "Analyst",
      score: 1,
      summary: "Failure fixture",
      render: () => {
        throw new Error("Render failed");
      },
    }),
    /Render failed/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.deepEqual(fs.readdirSync(path.join(root, "reports")), names);
});

test("header-aware appending preserves extra columns, hand-written rows and CRLF", () => {
  const original =
    "Notes before table\r\n| Role | # | Company | Custom | Date | Score | Status | PDF | Report | Notes |\r\n|---|---|---|---|---|---|---|---|---|---|\r\n| Old role | 001 | Old employer | retain me | 2026-01-01 | 3.0/5 | Applied | yes | old.md | user note |\r\n\r\nAfter table\r\n";
  const updated = appendApplication(original, {
    n: "002",
    company: "New",
    role: "Analyst",
    date: "2026-09-09",
    score: "0.0/5",
    status: "Evaluated",
    pdf: "",
    report: "new.md",
    notes: "profile: test",
  });
  assert.ok(
    updated.includes(
      "| Old role | 001 | Old employer | retain me | 2026-01-01 | 3.0/5 | Applied | yes | old.md | user note |\r\n",
    ),
  );
  assert.deepEqual(
    parseApplications(updated).map((row) => row.n),
    ["001", "002"],
  );
  assert.ok(updated.endsWith("After table\r\n"));
  assert.equal(updated.replaceAll("\r\n", "").includes("\n"), false);
});

test("direct inbox writes deduplicate normalized URLs while preserving existing history bytes", async () => {
  const history =
    "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\t\t\t\t\t\n";
  write("data/scan-history.tsv", history);
  const offer = {
    url: "https://example.test/role/?utm_source=qa",
    company: "Demo",
    title: "Analyst",
  };
  assert.equal((await addOffersToPipeline([offer], "test")).added, 1);
  const before = fs.readFileSync(
    path.join(root, "data/scan-history.tsv"),
    "utf8",
  );
  assert.ok(before.startsWith(history));
  assert.equal(
    (
      await addOffersToPipeline(
        [{ ...offer, url: "https://example.test/role" }],
        "test",
      )
    ).added,
    0,
  );
  assert.equal(
    fs.readFileSync(path.join(root, "data/scan-history.tsv"), "utf8"),
    before,
  );
});

test("an actual history write failure rolls back the preceding inbox write", async () => {
  const file = path.join(root, "data/pipeline.md"),
    before = fs.readFileSync(file, "utf8");
  const blocker = path.join(root, "history-parent");
  fs.writeFileSync(blocker, "A file cannot hold another file.");
  process.env.CAREER_OPS_SCAN_HISTORY = path.join(blocker, "history.tsv");
  try {
    const result = await addOffersToPipeline(
      [
        {
          url: "https://example.test/not-saved",
          company: "Bad",
          title: "Role",
        },
      ],
      "test",
    );
    assert.ok(result.error);
    assert.equal(fs.readFileSync(file, "utf8"), before);
  } finally {
    process.env.CAREER_OPS_SCAN_HISTORY = path.join(
      root,
      "data/scan-history.tsv",
    );
  }
});

test("preference edits preserve unedited evidence and keep material language separate", async () => {
  const response = await savePreferences(
    new Request("http://localhost/api/profile?profileId=test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationLanguage: "en",
        contractTypes: ["CDI"],
        remote: "Europe remote",
      }),
    }),
  );
  assert.equal(response.status, 200);
  const config = loadYaml(
    fs.readFileSync(path.join(root, "data/config.yml"), "utf8"),
  );
  assert.equal(config.custom_evidence.proof, "verified");
  assert.equal(config.candidate.email, "qa@example.invalid");
  assert.equal(config.cv.preferred_pages, 1);
  assert.equal(config.cv.language, "en");
  assert.deepEqual(config.target_roles.contract_types, ["CDI"]);
  assert.ok(
    fs
      .readdirSync(path.join(root, "data"))
      .some((name) => name.startsWith("config.yml.bak-")),
  );
});

test("malformed existing preferences are rejected rather than seeded or overwritten", async () => {
  const file = path.join(root, "data/config.yml");
  fs.writeFileSync(file, "candidate: [broken");
  const response = await savePreferences(
    new Request("http://localhost/api/profile?profileId=test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationLanguage: "fr" }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(fs.readFileSync(file, "utf8"), "candidate: [broken");
});
