import { redirect } from "next/navigation";
import { legacyDestination } from "@/components/jobpilot/model.mjs";
export default async function Page({ params }: { params: Promise<{id:string}> }) { const {id}=await params; redirect(legacyDestination("/jobs/"+id)); }
