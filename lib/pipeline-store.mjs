// Shared canonical inbox/history writers. Importing this module never loads providers or runs a scan.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fingerprintText } from '../fingerprint-core.mjs';
import { normalizeCompanyName } from '../invite-match.mjs';
import { withPipelineLock } from '../pipeline-lock.mjs';
import { getCareerOpsRoot } from '../path-resolver.mjs';

function normalizeScanScalar(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeScanUrl(value) {
  return String(value ?? '').trim().split(/\s+/)[0] || '';
}

const MARKDOWN_ESCAPE_CHARS = {
  '\\': '\\\\',
  '[': '\\[',
  ']': '\\]',
};

export function sanitizeMarkdownField(value) {
  return normalizeScanScalar(value)
    .replace(/[\\[\]]/g, char => MARKDOWN_ESCAPE_CHARS[char])
    .replace(/\|/g, '/');
}

function sanitizePipelineUrl(value) {
  return normalizeScanUrl(value)
    .replace(/[\\[\]]/g, char => MARKDOWN_ESCAPE_CHARS[char])
    .replace(/\|/g, '%7C');
}

export function sanitizeTsvField(value) {
  const normalized = normalizeScanScalar(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

// Format an offer's parsed compensation (the annualized {min,max,currency} that
// providers like Ashby attach as `offer.salary`) into a compact, sanitized cell
// such as `120000-160000 USD`. Returns '' when there is no usable salary data.
// Non-positive bounds are dropped (a 0 min/max is meaningless comp data, not "$0").
export function formatCompensation(salary) {
  if (!salary || typeof salary !== 'object') return '';
  const num = (n) => (Number.isFinite(n) && n > 0 ? String(Math.round(n)) : null);
  const lo = num(salary.min);
  const hi = num(salary.max);
  const range = lo && hi && lo !== hi ? `${lo}-${hi}` : (lo || hi || '');
  if (!range) return '';
  const currency = typeof salary.currency === 'string' ? salary.currency.trim() : '';
  return sanitizeMarkdownField(currency ? `${range} ${currency}` : range);
}

// Trust/legitimacy signal (#1743): the scanner sets offer.trustScore (0-100) +
// offer.trustFlags on every job (see buildTrustValidator). Surface it only when
// it's meaningful — a score below 100 means the validator penalized the posting
// (e.g. missing_apply_url, invalid_url, suspicious_domain). A clean posting
// (score 100) or a scan without trust_filter configured stays byte-identical
// (empty), exactly like the posted:/note: segments.
export function trustIsFlagged(offer) {
  return typeof offer.trustScore === 'number' && Number.isFinite(offer.trustScore) && offer.trustScore < 100;
}

function trustFlagList(offer) {
  return Array.isArray(offer.trustFlags)
    ? offer.trustFlags.filter((f) => typeof f === 'string' && f.trim())
    : [];
}

// Labeled pipeline segment, e.g. `trust: 60 missing_apply_url,suspicious_domain`.
// '' when the posting isn't flagged, so an unflagged offer produces no segment.
export function formatTrustSegment(offer) {
  if (!trustIsFlagged(offer)) return '';
  const flags = trustFlagList(offer);
  const body = flags.length ? `${offer.trustScore} ${flags.join(',')}` : String(offer.trustScore);
  return sanitizeMarkdownField(`trust: ${body}`);
}

export function formatPipelineOffer(offer) {
  const url = sanitizePipelineUrl(offer.url);
  const company = sanitizeMarkdownField(offer.company);
  const title = sanitizeMarkdownField(offer.title);
  // Optional trailing columns, each sanitized like every other field:
  //   4th = location, 5th = compensation.
  // Gate location on an actual string so malformed provider data (a number or
  // object) degrades to the 3-column form instead of stringifying into a
  // spurious column. The columns are positional, so a present compensation
  // forces the (possibly empty) location cell to keep comp in column 5.
  // loadSeenUrls dedups on the URL and ignores trailing columns (backward-compatible).
  const location = typeof offer.location === 'string' ? sanitizeMarkdownField(offer.location) : '';
  const compensation = formatCompensation(offer.salary);
  const base = `- [ ] ${url} | ${company} | ${title}`;
  let line = base;
  if (compensation) line = `${base} | ${location} | ${compensation}`;
  else if (location) line = `${base} | ${location}`;
  // Optional labeled posting-date segment (like note:) — keeps the positional
  // 1/3/4/5-column contract in modes/pipeline.md intact.
  const posted = postedAtIsoDate(offer.postedAt);
  if (posted) line = `${line} | posted: ${posted}`;
  // Labeled trust/legitimacy segment (#1743) — rides like posted:/note:, emitted
  // only when the scanner flagged the posting (score < 100). Ordered after
  // posted:, before note:, for a stable serialization.
  const trust = formatTrustSegment(offer);
  if (trust) line = `${line} | ${trust}`;
  // Optional free-text ranking signal (e.g. a curated-list flag an importer
  // attaches). Labeled — not positional like location/compensation — so it can
  // ride on any row shape (bare URL, 3-, 4-, or 5-column) without a reader
  // confusing it for a positional cell, and it stays generic: nothing here is
  // source-specific, and an offer without `note` produces byte-identical output.
  const note = typeof offer.note === 'string' ? sanitizeMarkdownField(offer.note) : '';
  return note ? `${line} | note: ${note}` : line;
}

// postedAt arrives as epoch ms (or absent). Convert to 'YYYY-MM-DD', or '' when missing.
function postedAtIsoDate(postedAt) {
  if (typeof postedAt !== 'number' || !Number.isFinite(postedAt) || postedAt <= 0) return '';
  return new Date(postedAt).toISOString().slice(0, 10);
}
export function formatScanHistoryRow(offer, date, status = 'added') {
  return [
    normalizeScanUrl(offer.url),
    date,
    offer.source,
    offer.title,
    offer.company,
    status,
    offer.location || '',
    // JD-content fingerprint (#1597): 16 hex chars when the provider's list
    // API shipped a usable description, '' otherwise. Lets later scans flag
    // the same body re-posted under a different company (agency cross-listing)
    // without storing the body. All readers tolerate the extra column.
    offer.fingerprint ?? fingerprintText(offer.description),
    // New trailing column: posting date. Existing readers index by position up to
    // col 7, so appending col 8 is backward-compatible.
    postedAtIsoDate(offer.postedAt),
    // Trust/legitimacy signal (#1743): score (only when the scanner flagged the
    // posting, i.e. < 100) + comma-joined flags. Trailing cols 9-10, so existing
    // index-based readers (fingerprint@7, postedAt@8) are unaffected; a clean
    // posting or a scan without trust_filter leaves both empty.
    trustIsFlagged(offer) ? String(offer.trustScore) : '',
    trustIsFlagged(offer) ? trustFlagList(offer).join(',') : '',
    // Normalized company key (#2093): the canonical company form shared across
    // the tracker (normalizeCompanyName — lowercased, punctuation/whitespace
    // folded, trailing legal-entity suffixes stripped) so "Acme Inc.",
    // "Acme, Inc." and "ACME  Inc" all key to `acme`. Stored at write time so
    // repost/name-matching never has to route through executing a script, and
    // the raw display company in col 5 stays faithful to what the provider
    // returned. Trailing col 12 — purely additive: index-based readers
    // (fingerprint@7, postedAt@8, trust@9-10, and the web parser's first 7
    // cols) are unaffected, and older rows that lack it are tolerated by
    // consumers normalizing the raw name on the fly.
    normalizeCompanyName(offer.company || ''),
  ].map(sanitizeTsvField).join('\t');
}

// Standard skeleton created on fresh install — matches the format documented
// in modes/pipeline.md and expected by /career-ops pipeline.
const PIPELINE_SKELETON = `# Pipeline — Pending URLs

Paste job URLs below as \`- [ ] {url}\` then run \`/career-ops pipeline\`.

## Pending

## Processed
`;

// Current section names (English). Legacy Spanish names are checked as fallback
// so existing pipeline.md files created before this change keep working.
const PENDING_MARKERS = ['## Pending', '## Pendientes'];
const PROCESSED_MARKERS = ['## Processed', '## Procesadas'];

// Locked (pipeline-lock.mjs) so scan.mjs, scan-ats-full.mjs, and plugins.mjs
// (pipeline mode) — the three current callers — can never interleave their
// read-modify-write and silently drop each other's offers.
// Same seam as loadSeenUrls above: the default is the CAREER_OPS_ROOT-anchored
// module constant; a caller with its own lane (or a fixture) passes the path.
export async function appendToPipeline(offers, { pipelinePath = process.env.CAREER_OPS_PIPELINE || path.join(getCareerOpsRoot(), "data/pipeline.md") } = {}) {
  if (offers.length === 0) return;

  await withPipelineLock(pipelinePath, async () => {
    // Auto-create with standard skeleton if missing (fresh-install guard).
    if (!existsSync(pipelinePath)) {
      mkdirSync(path.dirname(pipelinePath), { recursive: true });
      writeFileSync(pipelinePath, PIPELINE_SKELETON, 'utf-8');
    }

    let text = readFileSync(pipelinePath, 'utf-8');

    const marker = PENDING_MARKERS.find(m => text.includes(m)) ?? null;
    const idx = marker !== null ? text.indexOf(marker) : -1;

    if (idx === -1) {
      // No Pending section found — insert one before Processed (or at end)
      const procIdx = PROCESSED_MARKERS.reduce((found, m) => {
        const i = text.indexOf(m);
        return (found === -1 || (i !== -1 && i < found)) ? i : found;
      }, -1);
      const insertAt = procIdx === -1 ? text.length : procIdx;
      const block = `\n## Pending\n\n` + offers.map(formatPipelineOffer).join('\n') + '\n\n';
      text = text.slice(0, insertAt) + block + text.slice(insertAt);
    } else {
      // Find the end of existing Pending content (next ## or end)
      const afterMarker = idx + marker.length;
      const nextSection = text.indexOf('\n## ', afterMarker);
      const insertAt = nextSection === -1 ? text.length : nextSection;

      const block = '\n' + offers.map(formatPipelineOffer).join('\n') + '\n';
      text = text.slice(0, insertAt) + block + text.slice(insertAt);
    }

    writeFileSync(pipelinePath, text, 'utf-8');
  });
}

// data/scan-history.tsv has exactly the same set of concurrent writers as
// data/pipeline.md — scan.mjs, scan-ats-full.mjs, scan-interamt.mjs and
// plugins.mjs — so it takes the same lock appendToPipeline does, on its own
// path. Unlocked, two writers race in two places: the create branch below is a
// check-then-write, and its writeFileSync truncates, so a scanner that loses
// the race erases rows the winner already appended; and a multi-row
// appendFileSync is not atomic, so a concurrent append can interleave mid-line.
// Both surface as rows that silently stop counting, because every reader skips
// a malformed line quietly.
export async function appendToScanHistory(offers, date, status = 'added') {
  if (!offers.length) return;
  const SCAN_HISTORY_PATH = process.env.CAREER_OPS_SCAN_HISTORY || path.join(getCareerOpsRoot(), 'data/scan-history.tsv');
  await withPipelineLock(SCAN_HISTORY_PATH, () => {
    // Ensure file + header exist. The header names every column the row writer
    // (formatScanHistoryRow) emits, in the same order: the original 7 positional
    // cols (url…location) plus the append-only trailing cols added since —
    // fingerprint (7), posted_at (8), trust_score (9), trust_flags (10),
    // normalized_company (11). Written ONLY on fresh-file creation; existing files
    // (including headerless legacy files and older 7-col-header files) are never
    // rewritten. All readers either skip line 0 unconditionally, detect the header
    // by its `url\t` prefix, or skip non-URL col-0 rows, so widening it stays
    // backward-compatible. `status` is parameterized so callers can record verify
    // outcomes (`skipped_expired`, etc.) without the legacy `(expired)` suffix.
    if (!existsSync(SCAN_HISTORY_PATH)) {
      mkdirSync(path.dirname(SCAN_HISTORY_PATH), { recursive: true });
      writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n', 'utf-8');
    }

    const lines = offers.map(o => formatScanHistoryRow(o, date, status)).join('\n') + '\n';

    appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
  });
}

