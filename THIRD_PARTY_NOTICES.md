# Third-party and inherited notices

JobPilot is distributed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`) for material that this project has the right to license. See [`LICENSE`](LICENSE).

That license does not replace licenses or copyright notices that already apply to inherited or third-party material. In particular:

## Career-Ops provenance

This repository is derived in part from the open-source **career-ops** project by Santiago Fernández de Valderrama. Those pre-existing portions were provided under the MIT License.

The original MIT copyright and permission notice is preserved verbatim in [`LICENSES/career-ops-MIT.txt`](LICENSES/career-ops-MIT.txt). JobPilot's AGPL license applies to JobPilot-authored modifications and additions; it does not remove the MIT rights or notice attached to the upstream material.

Historical source: `https://github.com/career-ops-hq/career-ops` (formerly `santifer/career-ops`).

The 0.5.0 backend replaces the inherited CLI, provider catalogue, prompts and rendering engine. This engineering change is not a declaration of clean-room development or a cancellation of historical and remaining inherited rights; the original notice is retained.

## Google Material Icons

The Web client includes a small set of unmodified Material Icons Rounded SVG paths so its navigation matches the native Android client. Material Icons are licensed under the Apache License 2.0. The license text is kept with the source at [`web/src/components/jobpilot/material-icons.LICENSE`](web/src/components/jobpilot/material-icons.LICENSE).

Source project: `https://github.com/google/material-design-icons`

## PDF.js

The Web CV preview uses Mozilla PDF.js through the pinned `pdfjs-dist` dependency. PDF.js and the font/WASM resources copied from that package at build time remain subject to their own licenses and notices. The build helper copies those notices together with the assets into the generated `web/public/jobpilot-pdf/` directory.

Source project: `https://github.com/mozilla/pdf.js`

## Other dependencies

Other npm, Android/Gradle, model-provider and service dependencies remain subject to their respective licenses and terms. Dependency license metadata is not relicensed by JobPilot.
