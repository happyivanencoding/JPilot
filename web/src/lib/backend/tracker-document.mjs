// JobPilot's file ledger format. Existing documents are read in place, not migrated.
const columns = {
  "#": "n",
  num: "n",
  date: "date",
  company: "company",
  empresa: "company",
  role: "role",
  puesto: "role",
  via: "via",
  score: "score",
  status: "status",
  pdf: "pdf",
  materials: "pdf",
  report: "report",
  notes: "notes",
  url: "url",
  location: "location",
  "apply link": "applylink",
  apply: "applylink",
  "follow-up": "followup",
  "follow up": "followup",
  followup: "followup",
};
const legacyFields = [
  "n",
  "date",
  "company",
  "role",
  "score",
  "status",
  "pdf",
  "report",
  "notes",
];
const recordFields = [
  "n",
  "date",
  "company",
  "via",
  "role",
  "score",
  "status",
  "pdf",
  "report",
  "notes",
];
export const TRACKER_HEADER =
  "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |";

export function tableCells(line) {
  const text = line.trim();
  return text
    .slice(text.startsWith("|") ? 1 : 0, text.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((cell) => cell.trim());
}

function ledgerTable(text) {
  const lines = text.split(/\r?\n/);
  for (let at = 0; at < lines.length; at++) {
    if (!lines[at].trim().startsWith("|")) continue;
    const headers = tableCells(lines[at]).map(
      (name) => columns[name.toLowerCase()] || null,
    );
    if (
      headers.includes("n") &&
      headers.includes("company") &&
      headers.includes("role")
    )
      return { lines, at, headers };
  }
  return { lines, at: -1, headers: legacyFields };
}

export function parseApplications(text) {
  const { lines, at, headers } = ledgerTable(text);
  const records = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = tableCells(line);
    if (cells.length < (at < 0 ? 8 : headers.length)) continue;
    const values = Object.fromEntries(
      headers.map((field, index) => [field, cells[index] || ""]),
    );
    if (!/^\d+$/.test(values.n || "")) continue;
    if (at < 0) values.notes = cells.slice(8).join(" | ");
    records.push(
      Object.fromEntries(
        recordFields.map((field) => [field, values[field] || ""]),
      ),
    );
  }
  return records;
}

/** Add one record without normalizing, sorting or rewriting any existing row. */
export function appendApplication(text, record) {
  let table = ledgerTable(text);
  if (table.at < 0) {
    if (parseApplications(text).length)
      throw new Error(
        "The application ledger has rows but no recognizable header. Restore its header before adding a report.",
      );
    text =
      text.trimEnd() +
      `\n\n${TRACKER_HEADER}\n|---|---|---|---|---|---|---|---|---|\n`;
    table = ledgerTable(text);
  }
  const clean = (value) =>
    String(value ?? "")
      .replace(/[\r\n\t|]+/g, " ")
      .trim();
  const line =
    "| " +
    table.headers.map((field) => clean(record[field])).join(" | ") +
    " |";
  let insertion = table.at + 1;
  while (
    insertion < table.lines.length &&
    table.lines[insertion].trim().startsWith("|")
  )
    insertion++;
  table.lines.splice(insertion, 0, line);
  return table.lines.join(text.includes("\r\n") ? "\r\n" : "\n");
}
