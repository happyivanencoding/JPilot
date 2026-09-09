import fs from "node:fs";
import path from "node:path";
import { activeProfileId } from "@/lib/profile-request";
import { mobileDirectory, startMobileTask } from "@/lib/mobile-engine";
import { readCandidatureStore } from "@/lib/candidatures";
import { taskView } from "@/lib/mobile-view";
import { UPLOAD_EXTENSIONS, UPLOAD_LIMIT } from "@/lib/mobile-domain.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let directory: string | undefined;
  try {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > UPLOAD_LIMIT + 65536) return Response.json({ error: "12 Mo maximum." }, { status: 413 });
    const profileId = await activeProfileId(new URL(req.url).searchParams.get("profileId"));
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Sélectionnez un document.");
    const extension = path.extname(file.name).toLowerCase();
    if (!UPLOAD_EXTENSIONS.has(extension)) throw new Error("Formats acceptés : PDF, DOCX, TXT, MD.");
    if (file.size > UPLOAD_LIMIT || !file.size) throw new Error("Document vide ou supérieur à 12 Mo.");
    const uploadRoot = path.join(mobileDirectory(profileId), "uploads");
    fs.mkdirSync(uploadRoot, { recursive: true });
    directory = fs.mkdtempSync(path.join(uploadRoot, "cv-"));
    const destination = path.join(directory, "source" + extension);
    fs.writeFileSync(destination, Buffer.from(await file.arrayBuffer()));
    const task = await startMobileTask(profileId, { kind: "ingest", filename: path.basename(file.name) }, destination);
    if(task.reused && directory) fs.rmSync(directory,{recursive:true,force:true});
    return Response.json(taskView(task,readCandidatureStore(profileId).jobs,true), { status: task.status === "completed" ? 200 : 202 });
  } catch (error) {
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
    return Response.json({ error: error instanceof Error ? error.message : "Import impossible." }, { status: 400 });
  }
}
