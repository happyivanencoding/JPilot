// Extract one model object without inventing the unfinished value of a cut-off field.
export function extractJsonObject(text) {
  const source = String(text ?? "");
  const start = source.indexOf("{");
  if (start < 0) return { obj: null, truncated: false };
  const closing = [];
  let quoted = false,
    escaped = false,
    completePrefix = null;
  for (let position = start; position < source.length; position++) {
    const char = source[position];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{" || char === "[") {
      closing.push(char === "{" ? "}" : "]");
      continue;
    }
    if (char === "," && closing.length === 1) {
      try {
        completePrefix = JSON.parse(source.slice(start, position) + "}");
      } catch {}
    }
    if (char !== "}" && char !== "]") continue;
    if (closing.pop() !== char) return { obj: null, truncated: false };
    if (!closing.length) {
      try {
        return {
          obj: JSON.parse(source.slice(start, position + 1)),
          truncated: false,
        };
      } catch {
        return { obj: null, truncated: false };
      }
    }
  }
  return { obj: completePrefix, truncated: true };
}
