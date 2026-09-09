import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "@/lib/backend/workspace";
import { atomicWrite, readOptionalText } from "./files.mjs";
import { appendApplication, parseApplications } from "./tracker-document.mjs";
import { withProfileLock } from "@/lib/mobile-state.mjs";

/** Allocate and persist together after inference; no subprocess, staging TSV or reservation cleanup. */
export async function persistEvaluation(args: {
  profileId: string;
  url: string;
  company: string;
  role: string;
  score: number;
  summary: string;
  postedAt?: string;
  render: (number: string, date: string) => string;
}): Promise<{ reportNum: string; reportFile: string }> {
  const root = workspaceRoot();
  return withProfileLock(
    path.join(root, ".career-ops-web", "evaluation-ledger"),
    () => {
      const ledger = path.join(root, "data", "applications.md");
      const previous = readOptionalText(ledger);
      const reports = path.join(root, "reports");
      fs.mkdirSync(reports, { recursive: true });
      const numbers = [
        0,
        ...parseApplications(previous).map((row) => Number(row.n)),
        ...fs
          .readdirSync(reports)
          .map((file) => Number(file.match(/^(\d+)-/)?.[1]) || 0),
      ];
      const num = String(Math.max(...numbers) + 1).padStart(3, "0");
      const date = new Date().toISOString().slice(0, 10);
      const slug =
        args.company
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 72) || "company";
      const filename = `${num}-${slug}-${date}.md`;
      const target = path.join(reports, filename);
      const note = `${args.summary}; profile: ${args.profileId}${args.postedAt && /^\d{4}-\d{2}-\d{2}/.test(args.postedAt) ? `; posted: ${args.postedAt.slice(0, 10)}` : ""}`;
      const updated = appendApplication(previous, {
        n: num,
        date,
        company: args.company,
        role: args.role,
        score: `${args.score.toFixed(1)}/5`,
        status: "Evaluated",
        pdf: "❌",
        report: `[${num}](../reports/${filename})`,
        notes: note,
        url: args.url,
      });
      atomicWrite(target, args.render(num, date));
      try {
        atomicWrite(ledger, updated);
      } catch (error) {
        fs.unlinkSync(target);
        throw error;
      }
      return { reportNum: num, reportFile: filename };
    },
  );
}
