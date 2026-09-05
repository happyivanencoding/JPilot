import { LayoutDashboard, Compass, ListChecks, Send, Radar, BarChart3, FileText, Settings, BriefcaseBusiness } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/candidatures", label: "Candidatures", icon: BriefcaseBusiness },
  { href: "/", label: "Aujourd'hui", icon: LayoutDashboard },
  { href: "/explore", label: "Explorer", icon: Compass, chip: "Nouveau" },
  { href: "/pipeline", label: "Pipeline", icon: ListChecks },
  { href: "/followups", label: "Relances", icon: Send },
  { href: "/portals", label: "Portails", icon: Radar },
  { href: "/analytics", label: "Analyses", icon: BarChart3 },
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/config", label: "Réglages", icon: Settings },
];

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
