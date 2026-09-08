import { redirect } from "next/navigation";
import { legacyDestination } from "@/components/jobpilot/model.mjs";
// The old workbench is retired; bookmarks resolve into the single JobPilot product.
export default function Page() { redirect(legacyDestination("/explore")); }
