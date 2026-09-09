// Deterministic PDF acceptance: fictional data only, no model requests or production writes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  renderTailoredCv,
  renderReferenceCv,
  inspectPdf,
} from "../src/lib/backend/cv-document.mjs";
import { fixtureCv } from "./jobpilot-benchmark-fixture.mjs";
const output = path.resolve(
  import.meta.dirname,
  "../../.career-ops-web/independence",
  `cv-${Date.now()}`,
);
fs.mkdirSync(output, { recursive: true });
const payload = {
  candidate: {
    name: "Camille EXEMPLE",
    location: "Paris, France",
    email: "qa@example.invalid",
    phone: "+33 6 00 00 00 00",
    linkedin: {
      url: "https://example.invalid/camille",
      display: "Profil professionnel",
    },
  },
  summary:
    "Analyste junior en finance, avec une expérience en contrôle des données et en recherche obligataire. Utilisation de Python et SQL pour préparer des analyses reproductibles, documenter les limites et présenter les résultats aux équipes de gestion.",
  experience: [
    {
      company: "Gestion Démo",
      role: "Analyste junior",
      location: "Paris",
      dates: "2024–2026",
      bullets: [
        "Nettoyage de séries financières sous Python et préparation de tableaux de risque sous Excel.",
        "Contribution à des études de facteurs obligataires ; restitution des résultats et des limites au gérant.",
        "Documentation des contrôles de qualité des données, sans revendiquer de responsabilité de gestion discrétionnaire.",
      ],
    },
  ],
  projects: [
    {
      name: "Projet de données financières",
      description:
        "Prototype personnel pour organiser les observations et comparer des résultats de recherche.",
      tech: "Python, SQL, Git",
    },
  ],
  education: [
    { title: "Master Finance", org: "Université Démo", year: "2022–2024" },
  ],
  skills: [
    { category: "Outils", items: ["Python", "SQL", "Excel"] },
    {
      category: "Langues",
      items: ["Français : langue maternelle", "Anglais : B2"],
    },
  ],
};
const checks = [];
for (const language of ["fr", "en"]) {
  const htmlPath = path.join(output, `tailored-${language}.html`),
    pdfPath = path.join(output, `tailored-${language}.pdf`);
  const result = await renderTailoredCv(payload, {
    htmlPath,
    pdfPath,
    language,
    template: language === "fr" ? "finance" : "standard",
    maxPages: 1,
    keywords: ["Python", "SQL", "Rust"],
  });
  assert.equal(result.pages, 1);
  assert.equal(result.keywordCoverage, 67);
  assert.ok(result.atsScore >= 80);
  const text = (await inspectPdf(fs.readFileSync(pdfPath))).text;
  assert.match(text, /Camille EXEMPLE/);
  assert.match(text, /Gestion Démo/);
  assert.match(text, /2024/);
  checks.push({
    name: `${language} one-page PDF, selectable evidence and advisory keywords`,
    ...result,
  });
}
const plain = await renderReferenceCv(
  { content: fixtureCv, language: "fr" },
  path.join(output, "reference"),
);
assert.equal(plain.pages, 1);
assert.equal(plain.atsCertified, false);
assert.equal(plain.layout.autoFontShrink, false);
checks.push({
  name: "Canonical reference preserves its content and layout metadata",
  pages: plain.pages,
});
const long = {
  ...payload,
  experience: Array.from({ length: 12 }, (_, i) => ({
    ...payload.experience[0],
    company: `Synthetic employer ${i + 1}`,
  })),
};
await assert.rejects(
  renderTailoredCv(long, {
    htmlPath: path.join(output, "too-long.html"),
    pdfPath: path.join(output, "too-long.pdf"),
    language: "en",
    template: "standard",
    maxPages: 1,
  }),
  /pages/,
);
assert.equal(fs.existsSync(path.join(output, "too-long.pdf")), false);
checks.push({
  name: "An oversized tailored CV is rejected, not shrunk or truncated",
});
fs.writeFileSync(
  path.join(output, "summary.json"),
  JSON.stringify({ passed: true, syntheticOnly: true, checks }, null, 2),
);
console.log(JSON.stringify({ passed: true, output, checks }));
