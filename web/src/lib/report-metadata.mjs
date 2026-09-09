// The stored Markdown remains readable evidence; this projection extracts its product metadata.
const labels = {
  date: "Date",
  fecha: "Date",
  url: "URL",
  archetype: "Archetype",
  arquetipo: "Archetype",
  score: "Score",
  legitimacy: "Legitimacy",
  legitimidad: "Legitimacy",
  pdf: "PDF",
};

export function scoreNum(value) {
  const number = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : NaN;
}

export function parseReport(document) {
  const lines = String(document).split(/\r?\n/);
  let end = lines.findIndex(
    (line, index) => index > 0 && /^(?:\s*-{3,}\s*$|##\s)/.test(line),
  );
  if (end < 0) end = Math.min(10, lines.length);
  const fields = [];
  let title = null;
  for (const line of lines.slice(0, end)) {
    if (line.startsWith("# "))
      title = line
        .slice(2)
        .replace(/^Evaluat?i[oó]n:?\s*/i, "")
        .trim();
    const pair = line.match(/^\s*\*\*([^*]+):\*\*\s*(.*?)\s*$/);
    if (pair && pair[2] && labels[pair[1].toLowerCase().trim()])
      fields.push({
        label: labels[pair[1].toLowerCase().trim()],
        value: pair[2],
      });
  }
  const body = lines
    .slice(end + (/^\s*-{3,}\s*$/.test(lines[end] || "") ? 1 : 0))
    .join("\n")
    .trim();
  return {
    title,
    fields,
    legitimacy:
      fields.find((field) => field.label === "Legitimacy")?.value || null,
    body: body || document,
  };
}
