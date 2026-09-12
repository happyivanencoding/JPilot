import type { Metadata, Viewport } from "next";
import "@/components/jobpilot/jobpilot.css";
import "@/components/jobpilot/onward.css";
import "@/components/jobpilot/mobile-web.css";
export const metadata: Metadata = {
  title: "Onward", description: "Votre recherche d’emploi. Vos preuves. Votre prochain pas.",
  applicationName: "Onward", manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/onward-symbol.svg", type: "image/svg+xml" }], apple: "/onward-180.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Onward" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FAF8F1", interactiveWidget: "resizes-content" };
const appearance = `try { var t=localStorage.getItem('jobpilot:theme')||localStorage.getItem('career-ops:theme')||'system'; document.documentElement.dataset.theme=(t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; } catch {}`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: appearance }} /></head><body>{children}</body></html>;
}
