import * as yaml from 'js-yaml';

export const UI_LOCALES = ['zh', 'fr', 'en'];
export const APPLICATION_LANGUAGES = ['fr', 'en'];
export const LANGUAGE_NAMES = {zh:'Simplified Chinese',fr:'French',en:'English'};
// UI locale is a client preference. Never read it from Candidate/CV/market config.
export function uiLocale(value) {
  const code=String(value || '').toLowerCase().split(/[-_,;]/)[0];
  return UI_LOCALES.includes(code) ? code : 'en';
}
export function requestUiLocale(request, explicit) {
  return uiLocale(request.headers.get('x-jobpilot-locale') || explicit);
}
export function choose(locale, zh, fr, en=fr) { return uiLocale(locale)==='zh'?zh:uiLocale(locale)==='en'?en:fr; }
export function detectedDocumentLanguage(text) {
  const s=String(text || '');
  const fr=(s.match(/\b(?:formation|expérience|compétences|étudiant|trésorerie|suivi|français|préparation|recherche|développement|aucune|documentée|bâtiments|résidentiels|avec|dans|pour|des|les|une|sur|du|aux)\b/giu)||[]).length;
  const en=(s.match(/\b(?:education|experience|skills|student|supported|prepared|coordinated|internships|seeking|reporting|research|documented|residential|building|audit|exposure|with|the|and|for|from|under|to|of|no)\b/giu)||[]).length;
  if(fr>=2 && fr>en) return 'fr';
  if(en>=2 && en>fr) return 'en';
  return null;
}
export function applicationLanguage(config={}, cv='') {
  // cv.language is the single profile default. language.output is legacy CLI-only.
  return APPLICATION_LANGUAGES.includes(config?.cv?.language) ? config.cv.language : detectedDocumentLanguage(cv) || 'fr';
}
export function documentLanguage(candidate) {
  const config=yaml.load(candidate?.sources?.config?.text || '{}') || {};
  return APPLICATION_LANGUAGES.includes(config?.cv?.source_language) ? config.cv.source_language : detectedDocumentLanguage(candidate?.sources?.cv?.text) || applicationLanguage(config);
}
export function explanationDirective(locale) {
  return `USER-FACING EXPLANATION LANGUAGE: ${LANGUAGE_NAMES[uiLocale(locale)]}. This includes headings, analysis, strengths, gaps, recommendations, interview preparation and completion notes. Ignore language.output, source CV/JD language, nationality and any old report's language when choosing explanation language. Preserve original source quotations, proper nouns, URLs and machine-readable keys/enums. This instruction does NOT change the CV/application document language.`;
}
export function materialDirective(language) {
  if(!APPLICATION_LANGUAGES.includes(language)) throw new Error('Invalid application language');
  return `APPLICATION DOCUMENT LANGUAGE: ${LANGUAGE_NAMES[language]}. All rewritten CV text (including expressionIssues.after and globalPlan.targetBlocks.text) must remain in this language, never in the UI language. Preserve exact source in before fields. Do not mix French, English or Chinese paragraphs. Declaring the language is not a substitute for writing it correctly.`;
}
export function contradictsDocumentLanguage(text, expected, before='') {
  // A narrow guard against the actually observed partial EN→FR and UI→CV failures.
  if(/[\p{Script=Han}]/u.test(String(text)) && !/[\p{Script=Han}]/u.test(String(before))) return true;
  const detected=detectedDocumentLanguage(text);
  return !!detected && detected!==expected;
}
// Presentation-only profile preferences must not stale existing Candidate analysis.
export function evidenceConfig(text) {
  try {
    const value=yaml.load(text || '') || {};
    delete value.display;
    if(value.cv) { delete value.cv.language; if(!Object.keys(value.cv).length) delete value.cv; }
    return JSON.stringify(value);
  } catch { return String(text); }
}
export function publicError(error, locale) {
  const raw=error instanceof Error?error.message:String(error || '');
  if(/Formats acceptés|supported formats|PDF, DOCX, TXT, MD/i.test(raw)) return choose(locale,'支持 PDF、DOCX、TXT 或 MD。','Formats acceptés : PDF, DOCX, TXT ou MD.','Supported formats: PDF, DOCX, TXT or MD.');
  if(/Document vide|supérieur à 12|12 Mo maximum|12 MB|empty document/i.test(raw)) return choose(locale,'文件不能为空，且最大为 12 MB。','Le fichier ne peut pas être vide et doit faire 12 Mo maximum.','The file cannot be empty and must be 12 MB or smaller.');
  if(/Sélectionnez un document|select a document/i.test(raw)) return choose(locale,'请选择一份简历文件。','Sélectionnez un fichier de CV.','Choose a CV file.');
  if(/type de contrat|contract type/i.test(raw)) return choose(locale,'请至少选择一种合同类型。','Choisissez au moins un type de contrat.','Choose at least one contract type.');
  if(/CV vide|empty CV/i.test(raw)) return choose(locale,'简历内容不能为空。','Le CV ne peut pas être vide.','The CV cannot be empty.');
  if(/CV occupe .*pages|pages pour une limite|occupies .*pages|page limit/i.test(raw)) return choose(locale,'岗位版简历超过当前一页版式。原简历已保留，请重试或精简内容。','Le CV ciblé dépasse la mise en page d’une page. Le CV original est conservé ; réessayez ou réduisez le contenu.','The role-specific CV exceeds the one-page layout. Your original CV is preserved; retry or shorten the content.');
  if(/changed|changé|version|brouillon.*décision/i.test(raw)) return choose(locale,'内容已发生变化，请刷新后再操作。原有简历未被覆盖。','Le contenu a changé. Actualisez avant de continuer ; le CV original est conservé.','Content changed. Refresh before continuing; the original CV is preserved.');
  if(/language|langue/i.test(raw)) return choose(locale,'岗位版简历的目标语言转换未完成。原文已保留，请重试。','La traduction du CV ciblé vers la langue choisie n’a pas abouti. Le texte original est conservé ; réessayez.','The role-specific CV could not be fully converted to the selected language. The original is preserved; try again.');
  if(/not found|introuvable|inconnu|unknown/i.test(raw)) return choose(locale,'找不到当前档案中的这项内容，请刷新重试。','Ce contenu est introuvable dans le profil sélectionné.','This content was not found in the selected profile.');
  if(/timeout|timed out|délai|connexion|network|fetch/i.test(raw)) return choose(locale,'连接或处理超时。请检查电脑与服务是否在线；已有结果不会重新生成。','Connexion ou traitement expiré. Vérifiez le PC et les services ; les résultats enregistrés sont conservés.','Connection or processing timed out. Check your PC and services; saved results are preserved.');
  return choose(locale,'操作未完成。原有数据已保留，请刷新后检查任务状态。','L’action n’a pas abouti. Les données existantes sont conservées ; actualisez pour vérifier son état.','The action did not complete. Existing data is preserved; refresh to check its status.');
}
