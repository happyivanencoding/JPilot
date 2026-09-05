import fs from "node:fs";
import { openAgentDockCodex, runAgentDockCodex, type AgentDockCodexRun } from "@/lib/agentdock-acp";
import { careerOpsRoot, readMemory } from "@/lib/career-ops";
import { assembleDedupContext } from "@/lib/core/discover";
import { getProfile, profileFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";

// Explorer AI Search is intentionally bound to AgentDock ACP → Codex.
// Codex runs in AgentDock's read-only mode: it may research the public web, but
// the search turn cannot mutate career-ops. Persistence still happens only when
// the user explicitly adds a discovered offer to the pipeline.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const SEARCH_CONTRACT = `
Tu es l'agent de recherche d'offres de career-ops. Tu fonctionnes via AgentDock ACP avec Codex, en mode lecture seule.

OBJECTIF
- Chercher sur le web public des offres d'emploi ACTUELLEMENT ouvertes qui correspondent à l'intention de l'utilisateur.
- Privilégier les pages carrière officielles et les ATS directs (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, etc.).
- La recherche est une phase de découverte, pas une évaluation de compatibilité : ne donne pas de score et n'invente aucune compétence du candidat.
- Une offre peut être proposée même si un détail secondaire reste incertain ; indique alors clairement l'incertitude dans "why".
- Évite les offres manifestement fermées, expirées ou sans page de poste exploitable.
- Fais environ 3 à 6 recherches ciblées et arrête-toi dès que tu as un ensemble utile ; ne transforme pas cela en recherche exhaustive.

FORMAT DE SORTIE — OBLIGATOIRE
- Tu peux écrire de courtes lignes de progression en français entre les résultats.
- Pour CHAQUE offre retenue, émets exactement une ligne de la forme suivante, hors bloc de code :
  <<offer:{"url":"…","title":"…","company":"…","location":"…","source":"ai-search","why":"…","postedHint":"…","ats":"…","verification":"unconfirmed"}>>
- Le JSON doit être valide sur une seule ligne.
- "url" doit être l'URL concrète du poste, pas une page générique de recherche si une URL de poste existe.
- "why" explique brièvement pourquoi l'offre mérite d'être examinée, en restant factuel.
- "postedHint" contient la date ou l'indication de fraîcheur seulement si elle est visible/fiable ; sinon chaîne vide.
- "ats" peut être greenhouse, lever, ashby, smartrecruiters, workday, other, etc.
- Chaque offre reste "unconfirmed" jusqu'à l'évaluation career-ops.
- DÉDUPLICATION : ne repropose pas les URL/entreprises déjà connues ci-dessous.
`;

export async function POST(req: Request) {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide." }, { status: 400 });
  }

  const query = (body.query || "").trim();
  if (!query) return Response.json({ error: "La recherche est vide." }, { status: 400 });

  const root = careerOpsRoot();
  const profileId = await activeProfileId();
  const profile = getProfile(profileId);
  const { lines } = assembleDedupContext(profileId);
  const memory = readMemory(profileId);
  const memoryLine = memory.trim()
    ? `\n\nMÉMOIRE UTILE SUR LE CANDIDAT ${profile.name} :\n${memory.trim()}`
    : "";
  const profileParts: string[] = [];
  try {
    profileParts.push(`--- profil ${profile.name} ---\n${fs.readFileSync(profileFile(profileId, "config"), "utf8")}`);
  } catch {
    /* The user's natural-language intent remains sufficient for discovery. */
  }
  try {
    profileParts.push(`--- CV ${profile.name} ---\n${fs.readFileSync(profileFile(profileId, "cv"), "utf8")}`);
  } catch {
    /* The user's natural-language intent remains sufficient for discovery. */
  }
  const profileBlock = profileParts.length ? `\n\nPROFIL DU CANDIDAT (contexte, pas une invitation à noter les offres) :\n${profileParts.join("\n\n")}` : "";
  const knownBlock = lines.length
    ? `\n\n--- DÉJÀ CONNU (déduplication — NE PAS reproposer) ---\n${lines.join("\n")}`
    : "";
  const prompt = `${SEARCH_CONTRACT}${profileBlock}${memoryLine}${knownBlock}\n\n--- INTENTION UTILISATEUR ---\n${query}\n`;

  // Preflight before opening the streaming response so an unavailable AgentDock
  // is shown as a normal actionable API error rather than a mysterious empty hunt.
  let connection: Awaited<ReturnType<typeof openAgentDockCodex>>;
  try {
    connection = await openAgentDockCodex();
  } catch (error) {
    return Response.json(
      {
        code: "AGENTDOCK_UNAVAILABLE",
        error: `AgentDock ACP / Codex indisponible : ${error instanceof Error ? error.message : "connexion impossible"}`,
      },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  let closed = false;
  let cancelled = false;
  let activeRun: AgentDockCodexRun | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (text: string) => {
        if (closed || !text) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already settled */
        }
      };

      enqueue(
        `AgentDock ACP connecté · ${connection.agent.title} ${connection.agent.version} · GPT-5.6 Luna · lecture seule. Recherche du web public…\n`,
      );

      void runAgentDockCodex({
        client: connection.client,
        prompt,
        cwd: careerOpsRoot(),
        model: "gpt-5.6-luna",
        reasoning: "low",
        mode: "read-only",
        timeoutMs: 300_000,
        onText: enqueue,
        onRun: (run) => {
          activeRun = run;
        },
        isCancelled: () => cancelled,
      })
        .then(({ textEmitted }) => {
          if (!textEmitted && !cancelled) enqueue("\nAucun résultat final n'a été renvoyé par Codex.\n");
          finish();
        })
        .catch((error) => {
          if (cancelled) {
            finish();
            return;
          }
          console.error("[Explorer AgentDock ACP search failed]", error instanceof Error ? error.message : error);
          // Error the transport so the client enters its existing failed-state UI
          // instead of treating an ACP failure as a legitimate zero-result search.
          closed = true;
          try {
            controller.error(error);
          } catch {
            /* already settled */
          }
        });
    },
    cancel() {
      cancelled = true;
      closed = true;
      if (activeRun) void activeRun.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Career-Ops-AI": "agentdock-acp-codex",
    },
  });
}
