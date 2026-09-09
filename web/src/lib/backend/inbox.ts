import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "@/lib/backend/workspace";
import { atomicWrite, readOptionalText } from "./files.mjs";
import { normalizeUrl } from "@/lib/posting-url.mjs";
import { withProfileLock } from "@/lib/mobile-state.mjs";
import { applicationBelongsToProfile } from "@/lib/profile-context";

export type PipelineOffer = {
  url: string;
  company?: string;
  title?: string;
  location?: string;
  source?: string;
  ats?: string;
  note?: string;
};
export type AddResult = { added: number; error?: string };
const cell = (value: unknown) =>
  String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
const markdown = (value: unknown) =>
  cell(value)
    .replace(/\|/g, "/")
    .replace(/[\[\]\\]/g, "\\$&");
const tsv = (value: unknown) => cell(value).replace(/^[=+@-]/, "'$&");

function appendPending(document: string, lines: string[]): string {
  const pending = /^## (?:Pending|Pendientes)\s*$/m.exec(document);
  if (!pending) {
    const processed =
      /^## (?:Processed|Procesadas)\s*$/m.exec(document)?.index ??
      document.length;
    return (
      document.slice(0, processed) +
      `\n## Pending\n\n${lines.join("\n")}\n\n` +
      document.slice(processed)
    );
  }
  const after = pending.index + pending[0].length;
  const section = /\n## /.exec(document.slice(after));
  const at = section ? after + section.index : document.length;
  return (
    document.slice(0, at).trimEnd() +
    "\n" +
    lines.join("\n") +
    "\n\n" +
    document.slice(at).trimStart()
  );
}

/** Save confirmed selections in this workspace; discovery itself never writes or scores jobs. */
export async function addOffersToPipeline(
  offers: PipelineOffer[],
  profileId: string,
): Promise<AddResult> {
  const root = workspaceRoot();
  const pipeline =
    process.env.CAREER_OPS_PIPELINE || path.join(root, "data", "pipeline.md");
  const history =
    process.env.CAREER_OPS_SCAN_HISTORY ||
    path.join(root, "data", "scan-history.tsv");
  try {
    return await withProfileLock(
      path.join(root, ".career-ops-web", "inbox"),
      () => {
        const original = readOptionalText(pipeline);
        const historyBefore = readOptionalText(history);
        const known = new Set<string>();
        for (const line of original.split(/\r?\n/)) {
          const match = line.match(/^\s*-\s*\[[ xX]\]\s+(https?:\/\/\S+)\s*\|/);
          const note = line.match(/\|\s*note:\s*(.*)$/)?.[1] || "";
          if (match && applicationBelongsToProfile(note, profileId))
            known.add(normalizeUrl(match[1]));
        }
        const selected = offers.filter((offer) => {
          const key = normalizeUrl(offer?.url);
          if (!key || known.has(key)) return false;
          known.add(key);
          return true;
        });
        if (!selected.length) return { added: 0 };
        const today = new Intl.DateTimeFormat("sv-SE", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const pending = selected.map(
          (offer) =>
            `- [ ] ${cell(offer.url).replace(/\|/g, "%7C")} | ${markdown(offer.company)} | ${markdown(offer.title)}${offer.location ? ` | ${markdown(offer.location)}` : ""} | note: profile: ${profileId}${offer.note ? `; ${markdown(offer.note)}` : ""}`,
        );
        const historyRows = selected.map((offer) =>
          [
            offer.url,
            today,
            offer.source || offer.ats || "explorer",
            offer.title,
            offer.company,
            "added",
            offer.location,
            "",
            "",
            "",
            "",
            "",
          ]
            .map(tsv)
            .join("\t"),
        );
        const header =
          "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n";
        const updated = appendPending(
          original || "# JobPilot — saved opportunities\n",
          pending,
        );
        atomicWrite(pipeline, updated);
        try {
          atomicWrite(
            history,
            (historyBefore || header) +
              (historyBefore && !historyBefore.endsWith("\n") ? "\n" : "") +
              historyRows.join("\n") +
              "\n",
          );
        } catch (error) {
          if (original) atomicWrite(pipeline, original);
          else fs.unlinkSync(pipeline);
          throw error;
        }
        return { added: selected.length };
      },
    );
  } catch (error) {
    return {
      added: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
