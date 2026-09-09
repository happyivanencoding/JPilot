import { activeProfileId } from "@/lib/profile-request";
import { readCandidatureStore, reconcileCandidatures, updateMobileJob } from "@/lib/candidatures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const explicit = new URL(req.url).searchParams.get("profileId");
  const profileId = await activeProfileId(explicit);
  try {
    return Response.json(reconcileCandidatures(profileId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Impossible de lire les candidatures." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    profileId?: string;
    id?: string;
    status?: string;
    nextAction?: string;
    dueDate?: string;
    note?: string;
    taskId?: string;
    taskDone?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body.id) return Response.json({ error: "Identifiant de candidature manquant" }, { status: 400 });
  const profileId = await activeProfileId(body.profileId);

  try {
    const store = readCandidatureStore(profileId);
    const job = store.jobs.find((item) => item.id === body.id);
    if (!job) return Response.json({ error: "Candidature introuvable" }, { status: 404 });

    const { id, profileId: _profileId, ...change } = body;
    const updated = updateMobileJob(profileId, id, change);
    return Response.json({ ok: true, job: updated, updatedAt: updated.updatedAt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer la candidature." },
      { status: 500 },
    );
  }
}
