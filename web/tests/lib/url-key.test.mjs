import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "../../src/lib/posting-url.mjs";

test("posting identity upgrades HTTP, normalizes the host and removes fragments and trailing slashes", () => {
  assert.equal(
    normalizeUrl("http://Jobs.Example.test/role/#apply"),
    "https://jobs.example.test/role",
  );
  assert.equal(
    normalizeUrl("https://jobs.example.test/"),
    "https://jobs.example.test/",
  );
});
test("click parameters are removed while the employer job ID is retained", () => {
  assert.equal(
    normalizeUrl(
      "https://jobs.example.test/apply?utm_source=x&gh_jid=12&gh_src=li&fbclid=x",
    ),
    "https://jobs.example.test/apply?gh_jid=12",
  );
});
test("parameter ordering is stable, including repeated values", () => {
  assert.equal(
    normalizeUrl("https://jobs.example.test/apply?region=z&gh_jid=12&region=a"),
    "https://jobs.example.test/apply?gh_jid=12&region=a&region=z",
  );
});
test("two employer job IDs on the same form remain two different openings", () => {
  assert.notEqual(
    normalizeUrl("https://jobs.example.test/apply?gh_jid=12"),
    normalizeUrl("https://jobs.example.test/apply?gh_jid=13"),
  );
});
test("retained locations and path case are not conflated", () => {
  assert.notEqual(
    normalizeUrl("https://jobs.example.test/Role?region=Paris"),
    normalizeUrl("https://jobs.example.test/role?region=Paris"),
  );
  assert.notEqual(
    normalizeUrl("https://jobs.example.test/role?region=Paris"),
    normalizeUrl("https://jobs.example.test/role?region=Lyon"),
  );
});
test("missing, malformed and non-web addresses never receive a posting identity", () => {
  for (const input of [
    null,
    undefined,
    "",
    "  ",
    "not a URL",
    "ftp://example.test/jobs",
    "mailto:qa@example.test",
  ])
    assert.equal(normalizeUrl(input), "");
});
