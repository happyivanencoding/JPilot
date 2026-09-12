import {professionalReferenceHtml,professionalTailoredHtml} from "./reference-template.mjs";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { atomicWrite } from "./files.mjs";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const inline = (value) =>
  escape(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)");
const words = (text) =>
  new Set(
    String(text)
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]{2,}/gu) || [],
  );

async function browser() {
  const configured = process.env.JOBPILOT_CHROMIUM_PATH;
  const candidates = [
    configured,
    chromium.executablePath(),
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executablePath =
    configured || candidates.find((file) => fs.existsSync(file));
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

function shell(content, language, finance = false) {
  return `<!doctype html><html lang="${escape(language || "en")}"><head><meta charset="utf-8"><title>Curriculum vitae</title><style>
@page{size:A4;margin:14mm 15mm}*{box-sizing:border-box}body{font:10pt/1.28 ${finance ? '"Times New Roman",Georgia,serif' : 'Arial,"Microsoft YaHei",sans-serif'};color:#16212b;width:180mm;max-width:180mm;margin:0 auto;overflow-wrap:anywhere}
h1{font:700 17pt/1.12 Georgia,serif;margin:0 0 6pt}header{margin-bottom:9pt}h2{font-size:10.5pt;text-transform:uppercase;border-bottom:.6pt solid #334155;padding-bottom:3pt;margin:10pt 0 5pt;break-after:avoid}h3,h4{font-size:10pt;margin:7pt 0 3pt;break-after:avoid}p{margin:3pt 0;orphans:3;widows:3}ul{margin:3pt 0 5pt;padding-left:13pt}li{margin:2pt 0;break-inside:avoid}strong{font-weight:700}a{color:inherit;text-decoration:none}.contact{font-size:9pt}.entry-heading{display:flex;justify-content:space-between;gap:10pt}.entry-heading span:last-child{white-space:nowrap}.position{font-style:italic}.skills p{margin:3pt 0}
</style></head><body>${content}</body></html>`;
}

export function tailoredHtml(
  payload,
  { language = "en", template = "standard" } = {},
) {
  const labels =
    language === "fr"
      ? {
          summary: "Profil",
          experience: "Expérience professionnelle",
          projects: "Projets",
          education: "Formation",
          skills: "Compétences",
        }
      : {
          summary: "Profile",
          experience: "Professional Experience",
          projects: "Selected Projects",
          education: "Education",
          skills: "Skills",
        };
  const candidate = payload.candidate || {};
  const contacts = [candidate.location, candidate.phone, candidate.email]
    .filter(Boolean)
    .map(escape);
  const linkedin = candidate.linkedin?.url;
  if (linkedin && /^https?:\/\//i.test(linkedin))
    contacts.push(
      `<a href="${escape(linkedin)}">${escape(candidate.linkedin.display || linkedin)}</a>`,
    );
  let content = `<header><h1>${escape(candidate.name)}</h1><p class="contact">${contacts.join(" · ")}</p></header>`;
  const section = (name, body) =>
    body ? `<section><h2>${labels[name]}</h2>${body}</section>` : "";
  content += section(
    "summary",
    payload.summary ? `<p>${inline(payload.summary)}</p>` : "",
  );
  content += section(
    "experience",
    (payload.experience || [])
      .map(
        (item) =>
          `<div class="experience"><h3 class="entry-heading"><span>${escape(item.company)}</span><span>${escape(item.dates)}</span></h3><p class="position">${escape(item.role)}${item.location ? ` — ${escape(item.location)}` : ""}</p><ul>${(item.bullets || []).map((text) => `<li>${inline(text)}</li>`).join("")}</ul></div>`,
      )
      .join(""),
  );
  content += section(
    "projects",
    (payload.projects || [])
      .map(
        (item) =>
          `<h3>${escape(item.name)}</h3><p>${inline(item.description)}</p>${item.tech ? `<p>${inline(item.tech)}</p>` : ""}`,
      )
      .join(""),
  );
  content += section(
    "education",
    (payload.education || [])
      .map(
        (item) =>
          `<h3 class="entry-heading"><span>${escape(item.title)}</span><span>${escape(item.year)}</span></h3><p>${escape(item.org)}</p>${item.description ? `<p>${inline(item.description)}</p>` : ""}`,
      )
      .join(""),
  );
  content += section(
    "skills",
    (payload.skills || [])
      .map(
        (item) =>
          `<p><strong>${escape(item.category)}:</strong> ${(item.items || []).map(escape).join(", ")}</p>`,
      )
      .join(""),
  );
  return shell(content, language, /finance/i.test(template));
}

function referenceHtml(payload) {
  const blocks = [];
  let list = false;
  for (const line of String(payload.content).split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!list) {
        blocks.push("<ul>");
        list = true;
      }
      blocks.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (list) {
      blocks.push("</ul>");
      list = false;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading)
      blocks.push(
        `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`,
      );
    else if (/^\s*(---+|\|[\s:|\-]+\|)\s*$/.test(line)) continue;
    else if (line.trim())
      blocks.push(`<p>${inline(line.replace(/^>\s*/, ""))}</p>`);
  }
  if (list) blocks.push("</ul>");
  return shell(blocks.join("\n"), payload.language);
}

export async function inspectPdf(bytes) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const document = await task.promise;
  try {
    const text = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      text.push(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
    }
    return { pages: document.numPages, text: text.join("\n") };
  } finally {
    await task.destroy();
  }
}

async function render(html) {
  const instance = await browser();
  try {
    const page = await instance.newPage({
      viewport: { width: 794, height: 1123 },
    });
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);
    const measured = await page.evaluate(() => {
      const elements = [...document.querySelectorAll("h1,h2,h3,h4,p,li")];
      const bounds = document.body.getBoundingClientRect();
      const rows = elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const lines = new Set(
          [...range.getClientRects()]
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.round(rect.top)),
        ).size;
        return {
          tag: element.tagName,
          text: element.textContent.slice(0, 120),
          lines,
        };
      });
      const bulletLines = rows
        .filter((row) => row.tag === "LI")
        .map((row) => row.lines);
      return {
        text: document.body.innerText,
        headings: [...document.querySelectorAll("h2")].map(
          (h) => h.textContent,
        ),
        layout: {
          fontPt: 10,
          lineHeight: 1.28,
          marginMm: [14, 15],
          lines: rows.reduce((sum, row) => sum + row.lines, 0),
          maxBulletLines: Math.max(0, ...bulletLines),
          longBullets: bulletLines.filter((count) => count > 3).length,
          horizontalOverflow: elements.some(
            (element) =>
              element.scrollWidth > element.clientWidth + 2 ||
              element.getBoundingClientRect().right > bounds.right + 2,
          ),
          firstSignals: rows.slice(0, 7).map((row) => row.text),
          autoFontShrink: false,
        },
      };
    });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    const pdf = await inspectPdf(bytes);
    const sourceWords = words(measured.text),
      pdfWords = words(pdf.text);
    const retained = sourceWords.size
      ? [...sourceWords].filter((word) => pdfWords.has(word)).length /
        sourceWords.size
      : 1;
    if (!pdf.pages || (sourceWords.size > 20 && retained < 0.9))
      throw new Error(
        "Le PDF a perdu une partie du texte. Le document ne sera pas enregistré.",
      );
    return {
      bytes,
      pages: pdf.pages,
      text: pdf.text,
      headings: measured.headings,
      layout: measured.layout,
    };
  } finally {
    await instance.close();
  }
}

/** Structural readability, not an ATS vendor's hiring score. Keywords stay advisory. */
export function auditCvDocument({ text, headings, layout }, keywords = []) {
  const issues = [];
  let score = 50; // Generated single-column HTML: safe fonts, UTF-8, no images or hidden text.
  if (text.replace(/\s/g, "").length >= 300) score += 15;
  else
    issues.push({
      severity: "warning",
      message: "Peu de texte sélectionnable dans le document.",
    });
  for (const pattern of [
    /exp[ée]rience/i,
    /education|formation/i,
    /skills|comp[ée]tences/i,
    /profile|profil|summary/i,
  ]) {
    if (headings.some((heading) => pattern.test(heading))) score += 5;
  }
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) score += 10;
  else
    issues.push({
      severity: "warning",
      message: "Adresse e-mail absente du texte du PDF.",
    });
  if (
    (text.match(/\+?\d[\d\s().-]{7,24}\d/g) || []).some(
      (phone) => phone.replace(/\D/g, "").length >= 9,
    )
  )
    score += 5;
  else
    issues.push({
      severity: "warning",
      message: "Numéro de téléphone non repéré dans le texte du PDF.",
    });
  if (layout.horizontalOverflow) {
    score -= 20;
    issues.push({
      severity: "critical",
      message: "Le contenu déborde horizontalement.",
    });
  }
  const supplied = [
    ...new Set(keywords.map((word) => String(word).trim()).filter(Boolean)),
  ];
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
  const missing = supplied.filter(
    (word) =>
      !new RegExp(
        `(^|[^\\p{L}\\p{N}])${word
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+")}($|[^\\p{L}\\p{N}])`,
        "u",
      ).test(normalized),
  );
  return {
    score,
    grade:
      score >= 90
        ? "A"
        : score >= 80
          ? "B"
          : score >= 70
            ? "C"
            : score >= 60
              ? "D"
              : "F",
    pass: score >= 70 && !issues.some((issue) => issue.severity === "critical"),
    issues,
    keywordCoverage: supplied.length
      ? {
          total: supplied.length,
          found: supplied.length - missing.length,
          percent: Math.round(
            (100 * (supplied.length - missing.length)) / supplied.length,
          ),
          missing,
        }
      : null,
  };
}

/** @param {any} payload @param {{htmlPath:string,pdfPath:string,language:string,template:string,maxPages?:number,keywords?:string[],referenceContent?:string,layoutSource?:any,tailoredPayload?:any}} options */
export async function renderTailoredCv(
  payload,
  { htmlPath, pdfPath, language, template, maxPages = 1, keywords = [], referenceContent="", layoutSource=null, tailoredPayload=null },
) {
  let html = referenceContent ? professionalTailoredHtml({content:referenceContent,layoutSource,tailoredPayload:tailoredPayload || payload,language}) : tailoredHtml(payload, { language, template });
  let result = await render(html);
  if (referenceContent && result.pages > maxPages) {
    const compactHtml = professionalTailoredHtml({content:referenceContent,layoutSource,tailoredPayload:tailoredPayload || payload,language,compact:true});
    const compactResult = await render(compactHtml);
    if (compactResult.pages <= result.pages && !compactResult.layout.horizontalOverflow) {
      html = compactHtml;
      result = compactResult;
    }
  }
  if (result.layout.horizontalOverflow)
    throw new Error(
      "Le CV déborde horizontalement. Corrigez le contenu du brouillon.",
    );
  const ats = auditCvDocument(result, keywords);
  atomicWrite(htmlPath, html);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, result.bytes);
  return {
    pages: result.pages,
    onePageTargetMet: result.pages <= maxPages,
    warnings: result.pages > maxPages ? [
      `Le CV occupe ${result.pages} pages. Le contenu factuel a été conservé ; révisez la longueur avant envoi si vous souhaitez rester sur une page.`,
    ] : [],
    atsScore: ats.score,
    atsPass: ats.pass,
    atsGrade: ats.grade,
    atsIssues: ats.issues,
    keywordCoverage: ats.keywordCoverage?.percent ?? null,
  };
}

export async function renderReferenceCv(payload, directory) {
  const html = payload.professional ? professionalReferenceHtml(payload) : referenceHtml(payload),
    result = await render(html);
  const { layout, pages } = result;
  layout.acceptable =
    pages === 1 &&
    !layout.horizontalOverflow &&
    layout.lines <= 56 &&
    layout.longBullets <= 1;
  layout.issues = [
    ...(pages > 1
      ? [
          "Le contenu dépasse une page. Réduire ou sélectionner les informations.",
        ]
      : []),
    ...(layout.horizontalOverflow ? ["Débordement horizontal détecté."] : []),
    ...(layout.lines > 56
      ? ["Trop de lignes : la hiérarchie visuelle est trop dense."]
      : []),
    ...(layout.longBullets > 1
      ? ["Plusieurs puces dépassent trois lignes."]
      : []),
  ];
  const meta = {
    pages,
    format: "A4",
    renderer: "Chromium",
    layout,
    renderedAt: new Date().toISOString(),
    warnings:
      !payload.professional && pages > 1
        ? [
            `Le CV maître contient ${pages} pages. Cette prévisualisation conserve les preuves ; elle n’atteste pas un CV de candidature d’une page.`,
          ]
        : [],
    template:payload.professional?"professional":"reference",
    layoutNote: payload.professional ? "" :
      "Rendu du contenu canonique. La mise en page originale d’un fichier Word/PDF importé n’est pas reconstruite.",
    atsCertified: false,
  };
  fs.mkdirSync(directory, { recursive: true });
  atomicWrite(path.join(directory, "cv.html"), html);
  fs.writeFileSync(path.join(directory, "cv.pdf"), result.bytes);
  atomicWrite(
    path.join(directory, "render.json"),
    JSON.stringify(meta, null, 2),
  );
  return meta;
}
