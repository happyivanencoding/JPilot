import * as yaml from 'js-yaml';

export const UI_LOCALES = ['zh', 'fr', 'en'];
export const APPLICATION_LANGUAGES = ['fr', 'en'];
export const LANGUAGE_NAMES = {zh:'Simplified Chinese',fr:'French',en:'English'};
// UI locale is a client preference. Never read it from Candidate/CV/market config.
export function uiLocale(value) {
  const code=String(value || '').toLowerCase().split(/[-_,;]/)[0];
  return UI_LOCALES.includes(code) ? code : 'fr';
}
export function requestUiLocale(request, explicit) {
  return uiLocale(request.headers.get('x-jobpilot-locale') || explicit);
}
export function choose(locale, zh, fr, en=fr) { return uiLocale(locale)==='zh'?zh:uiLocale(locale)==='en'?en:fr; }
export function detectedDocumentLanguage(text) {
  const s=String(text || '');
  const fr=(s.match(/\b(?:formation|expérience|compétences|étudiant|trésorerie|suivi|français|préparation|recherche|développement|avec|dans|pour|des|les|une|sur|du|aux)\b/giu)||[]).length;
  const en=(s.match(/\b(?:education|experience|skills|student|supported|prepared|coordinated|internships|seeking|reporting|research|with|the|and|for|from|under|to|of)\b/giu)||[]).length;
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
  if(/CV vide|empty CV/i.test(raw)) return choose(locale,'简历内容不能为空。','Le CV ne peut pas être vide.','The CV cannot be empty.');
  if(/changed|changé|version|brouillon.*décision/i.test(raw)) return choose(locale,'内容已发生变化，请刷新后再操作。原有简历未被覆盖。','Le contenu a changé. Actualisez avant de continuer ; le CV original est conservé.','Content changed. Refresh before continuing; the original CV is preserved.');
  if(/language|langue/i.test(raw)) return choose(locale,'简历语言不一致。原文已保留，请检查材料语言后重试。','La langue du CV ne correspond pas. Le texte original est conservé.','CV language mismatch. The original text is preserved.');
  if(/not found|introuvable|inconnu|unknown/i.test(raw)) return choose(locale,'找不到当前档案中的这项内容，请刷新重试。','Ce contenu est introuvable dans le profil sélectionné.','This content was not found in the selected profile.');
  if(/timeout|timed out|délai|connexion|network|fetch/i.test(raw)) return choose(locale,'连接或处理超时。请检查电脑与服务是否在线；已有结果不会重新生成。','Connexion ou traitement expiré. Vérifiez le PC et les services ; les résultats enregistrés sont conservés.','Connection or processing timed out. Check your PC and services; saved results are preserved.');
  return choose(locale,'操作未完成。原有数据已保留，请刷新后检查任务状态。','L’action n’a pas abouti. Les données existantes sont conservées ; actualisez pour vérifier son état.','The action did not complete. Existing data is preserved; refresh to check its status.');
}
