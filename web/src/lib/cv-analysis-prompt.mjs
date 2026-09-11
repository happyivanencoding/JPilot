import {cvBlocks,cvTextBudget,presentationLanguage} from './cv-global-plan.mjs';
import {explanationDirective,materialDirective} from './language-contract.mjs';
// The same evidence contract is used by the app and isolated model benchmarks.
/** @param {{candidate: any, previous?: any, resolutions?: any[], language?: string}} input */
export function cvAnalysisPrompt({ candidate, previous = null, resolutions = [], language = 'fr' }) {
  return `${explanationDirective(language)}\n${materialDirective(presentationLanguage(candidate))}\nAnalyse le CV, les capacités et le positionnement professionnel d'une seule personne. Réponds en ${language}.
Tu es un analyste de candidature, pas un agent de développement. Aucun outil ni fichier extérieur n'est nécessaire : toutes les sources autorisées sont ci-dessous. N'écris aucun fichier. Ne lance aucun sous-agent.

AUTORITÉ CANDIDAT — seules les données de sources.cv/config/notes peuvent établir un fait personnel :
${JSON.stringify(candidate)}

CONTINUITÉ — précédente version du CV et précédente analyse, lorsqu'elles existent :
${JSON.stringify(previous)}

AMÉLIORATIONS ACCEPTÉES ET RÉSOLUES (ne pas les présenter comme de nouveaux défauts) :
${JSON.stringify(resolutions)}

Décide ce que la personne doit faire ensuite. Sépare impérativement :
A. expressionIssues : une capacité EXISTE déjà et une reformulation suffit. Fournis un extrait before EXACT, présent une seule fois dans le CV, et une proposition after qui conserve son niveau réel. Pas de métrique, ownership, diplôme, outil ou expérience inventée. Si une information doit être demandée, ce n'est PAS une modification applicable.
B. actionIssues : manque d'expérience/compétence/preuve qui exige un vrai projet, un apprentissage ou une vérification humaine. Une simple absence dans le CV n'est pas preuve d'incompétence. Donne une action concrète et distingue «non démontré» de «absent confirmé».
Conserve les ids des problèmes déjà connus. Ne réouvre pas un problème résolu sans nouveau fait contradictoire, et explique alors ce fait dans changeSummary. Explique les progrès depuis la précédente version, les changements d'expression et les capacités réellement acquises séparément. Un fait absent du CV n'est pas nécessairement une compétence absente.
Donne un positionnement professionnel sobre et surtout 3–5 directions de métiers réalistes pour un étudiant / profil early-career. Si target_roles.primary contient déjà des rôles choisis par l'utilisateur, traite cette intention déclarée comme prioritaire et utilise l'inférence seulement pour proposer des variantes proches ; sinon infère les directions depuis les preuves du CV. Use broad, commonly advertised market job families as direction titles and searchQuery, not combinations of degree, sector and niche. Examples: Data analyst, Economist, ESG analyst, Software developer. A sustainability-data background can support Data analyst; explain sustainability in evidence, not as a mandatory search qualifier. Prefer 3–4 distinct broad families. Preserve explicitly chosen target roles. Do not add junior, internship, alternance or city to searchQuery: those come from saved filters.
Pour chaque direction, explique en une phrase pourquoi elle est plausible, cite 1–3 preuves documentées et fournis une requête de recherche courte utilisable telle quelle. Ajoute aussi 4–8 searchKeywords concrets (intitulés, familles de rôles ou outils réellement cohérents avec le profil), pas des adjectifs génériques. N'attribue pas de probabilité d'embauche et ne fabrique pas de match score.

LANGUE DU CV FINAL : ${presentationLanguage(candidate,language)}. Les explications sont en ${language}, mais chaque texte de globalPlan.targetBlocks reste dans la langue du CV final. Déclare globalPlan.cvLanguage="${presentationLanguage(candidate,language)}". Ne jamais traduire quelques puces en laissant des titres dans une autre langue. Les noms propres et établissements restent inchangés. Une puce réécrite conserve son préfixe «- ».

VUE GLOBALE — UNE PAGE EST UN BUDGET D'ATTENTION, PAS UNE COLLECTION DE PARAGRAPHES MAXIMISÉS
Commence par sélectionner les 2–3 signaux qui méritent le premier regard compte tenu du poste ET de la séniorité. Pour un étudiant/premier stage, la formation et la responsabilité associative peuvent être centraux ; un petit projet démontre de l'intérêt, pas une expérience professionnelle fictive. Pour un premier CDI après des stages, préserver leur niveau de contribution réel et la contrainte linguistique. Aucun niveau de langue ne peut être amélioré par réécriture.
Classe chaque section/expérience comme primaire, soutien, arrière-plan ou redondance. Dis quelles informations le recruteur manque actuellement et pourquoi. Toute expansion se finance par une suppression, une compression ou une fusion ailleurs. Supprimer les doublons plutôt que répéter «manque d'expérience» partout. Maximum 3 puces par expérience/projet et 12 puces au total pour junior, 470 mots ; 5/18/620 pour confirmé. Titres, dates, niveau académique et marqueur fictif restent exacts. Conserver un niveau typographique confortable : police 10pt, interligne 1.28, marges 14–16mm, jamais de réduction automatique.
Produis UN plan coordonné applicable en entier, pas une combinaison libre de boutons d'expansion. Le plan exprime une cible d'une page, pas une garantie : un rendu déterministe mesurera les pages, lignes, densité et débordements. Le master et son historique conservent les preuves retirées du CV de présentation.

BLOCS SOURCES (chaque id doit être utilisé exactement une fois, y compris les blocs retirés) :
${JSON.stringify(cvBlocks(candidate.sources.cv.text))}
Budget actuel : ${JSON.stringify(cvTextBudget(candidate.sources.cv.text))}
Dans globalPlan.targetBlocks, ordonne les blocs dans l'ordre du CV final. Chaque objet cite sourceIds, action keep/shorten/rewrite/merge/remove, text pour une modification, reason. Pour keep, omettre text ; pour remove, text="". Pour fusionner, citer tous les ids absorbés. Ne pas recopier un même id ailleurs. Ne jamais inventer un bloc ; les identités/coordonnées restent en keep. Chaque nombre de la proposition doit être présent dans les blocs source cités. Les intitulés des sections peuvent être reformulés sans changer leurs faits.

Retourne uniquement un objet JSON valide :
{"markdown":"synthèse courte et positionnement", "changeSummary":"première analyse ou changements, sans prétendre qu'un gain de mots est un gain de compétence", "careerDirections":[{"title":"famille de métier","why":"pourquoi elle est plausible","evidence":["preuve documentée"],"searchQuery":"requête courte pour offres"}], "searchKeywords":["mot-clé concret"], "globalPlan":{"audience":"junior ou experienced","headline":"la ligne directrice de la page","signals":[{"title":"signal fort","evidence":"preuve exacte","why":"pourquoi au premier plan"}],"overlooked":["signal noyé actuellement"],"allocations":[{"section":"nom de section ou expérience","priority":"primary|supporting|background|noise","action":"expand|keep|shorten|merge|remove|move","reason":"pourquoi cette place","spaceTradeoff":"où récupérer les lignes"}],"targetBlocks":[{"sourceIds":["b1"],"action":"keep","reason":"identité"}]}, "expressionIssues":[{"id":"identifiant stable","title":"modification coordonnée","detail":"bénéfice et espace récupéré ailleurs","before":"extrait exact","after":"reformulation fidèle","evidence":"preuve"}], "actionIssues":[{"id":"identifiant stable","title":"écart réel","detail":"niveau démontré","nextAction":"action concrète","evidence":"preuve ou absence de preuve"}], "tasks":[], "questions":[]}
2–4 expressionIssues et 2–4 actionIssues suffisent ; globalPlan est le résultat principal. Ne remplis pas artificiellement des listes. Aucun texte hors JSON. ${explanationDirective(language)} ${materialDirective(presentationLanguage(candidate))}
`;
}
