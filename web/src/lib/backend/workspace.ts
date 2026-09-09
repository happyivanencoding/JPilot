import fs from "node:fs";
import path from "node:path";
import { applicationBelongsToProfile } from "@/lib/profile-context";
import { parseApplications } from "./tracker-document.mjs";
import { readOptionalText } from "./files.mjs";

/** The existing environment name identifies private data, not a code dependency. */
export function workspaceRoot(): string {
  return (
    process.env.CAREER_OPS_ROOT?.trim() || path.resolve(process.cwd(), "..")
  );
}

export type Application = {
  n: string;
  date: string;
  company: string;
  via: string;
  role: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
};

export function readApplications(profileId?: string): Application[] {
  const rows = parseApplications(
    readOptionalText(path.join(workspaceRoot(), "data", "applications.md")),
  ) as Application[];
  return profileId
    ? rows.filter((row) => applicationBelongsToProfile(row.notes, profileId))
    : rows;
}

export function readReport(
  number: string,
): { content: string; file: string } | null {
  if (!/^\d+$/.test(String(number))) return null;
  const root = workspaceRoot();
  const row = readApplications().find(
    (item) => Number(item.n) === Number(number),
  );
  const link = row?.report.match(/\]\(([^)]+)\)/)?.[1];
  const candidates: string[] = link ? [path.resolve(root, "data", link)] : [];
  const directory = path.join(root, "reports");
  if (fs.existsSync(directory)) {
    candidates.push(
      ...fs
        .readdirSync(directory)
        .filter((name) => Number(name.match(/^(\d+)-/)?.[1]) === Number(number))
        .sort()
        .map((name) => path.join(directory, name)),
    );
  }
  for (const file of candidates) {
    if (
      !file.endsWith(".md") ||
      /^\d+-RESERVED\.md$/.test(path.basename(file)) ||
      !fs.existsSync(file)
    )
      continue;
    const relative = path.relative(
      fs.realpathSync(root),
      fs.realpathSync(file),
    );
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    return {
      content: fs.readFileSync(file, "utf8"),
      file: path.basename(file),
    };
  }
  return null;
}
