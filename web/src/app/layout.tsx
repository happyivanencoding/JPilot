import type { Metadata, Viewport } from "next";
import "@/components/jobpilot/jobpilot.css";
import "@/components/jobpilot/feature-surfaces.css";
import "@/components/jobpilot/layout-adjustments.css";
export const metadata: Metadata = {
  title: "JobPilot", description: "Votre recherche d’emploi. Vos preuves. Votre prochain pas.",
  applicationName: "JobPilot", manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/jobpilot.svg", type: "image/svg+xml" }], apple: "/jobpilot-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JobPilot" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F3F5F3", interactiveWidget: "resizes-content" };
const appearance = `try { var t=localStorage.getItem('jobpilot:theme')||localStorage.getItem('career-ops:theme')||'system'; document.documentElement.dataset.theme=(t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; } catch {}`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: appearance }} /></head><body>{children}</body></html>;
}
