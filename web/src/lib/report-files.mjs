import path from "node:path";

/** Numbered reservation placeholders are not finished evaluation reports.
 * Accept a path or basename; non-numbered notes remain ordinary documents.
 */
export function isReservedReportFile(file) {
  return /^\d+-RESERVED\.md$/.test(path.basename(file));
}
