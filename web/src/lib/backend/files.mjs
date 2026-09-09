import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Replace a private data file without ever truncating the version being read. */
export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pending = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(pending, text, { encoding: "utf8", flag: "wx" });
    fs.renameSync(pending, file);
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
  }
}

/** Canonical CV/config edits keep the previous document alongside the new one. */
export function atomicWriteWithBackup(file, text) {
  let saved = null;
  if (fs.existsSync(file) && fs.statSync(file).size) {
    saved = `${file}.bak-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${randomUUID().slice(0, 8)}`;
    fs.copyFileSync(file, saved, fs.constants.COPYFILE_EXCL);
  }
  atomicWrite(file, text);
  return saved;
}

export function readOptionalText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
