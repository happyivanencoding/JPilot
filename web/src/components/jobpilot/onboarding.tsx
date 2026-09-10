"use client";
import { Home as HomeIcon, PersonOutline as ProfileIcon, Search as OffersIcon } from "./native-icons";
import { usePilot } from "./pilot-context";
import { Button, Hint } from "./ui";

export type GuideTab = "home" | "offers" | "profile";
type GuideItem = { icon: typeof HomeIcon; title: [string, string, string]; summary: [string, string, string]; details: [string, string, string][] };

const GUIDE_ITEMS: Record<GuideTab, GuideItem> = {
  home: {
    icon: HomeIcon,
    title: ["首页", "Accueil", "Home"],
    summary: ["先看你适合什么，而不是先学会操作软件。", "Commencez par comprendre où votre profil peut aller.", "Start by seeing where your profile can go."],
    details: [["确认简历后，JobPilot 会自动理解你的经历并给出 3–5 个可探索方向。", "Après confirmation du CV, JobPilot comprend votre parcours et propose 3–5 directions à explorer.", "After you confirm your CV, JobPilot understands your experience and suggests 3–5 directions."], ["首页直接展示最值得先看的真实岗位和当前能力信号。", "L’accueil montre directement les offres les plus pertinentes et vos principaux signaux.", "Home shows the most useful real roles and your main profile signals."]]
  },
  offers: {
    icon: OffersIcon,
    title: ["机会", "Offres", "Offers"],
    summary: ["先看即时匹配分，再决定要不要深入。", "Voyez d’abord le score de match, puis choisissez quoi approfondir.", "See the match score first, then decide what deserves a closer look."],
    details: [["所有结果先用快速 0–100 匹配排序，不需要逐个等待 AI。", "Toutes les offres reçoivent d’abord un score rapide sur 100, sans attente IA offre par offre.", "Every result gets an immediate 0–100 match before any deep AI work."], ["前几条岗位会在后台补充职责、要求、加分点、真实缺口和 CV 提升空间。", "Les premières offres sont enrichies en arrière-plan avec missions, exigences, forces, écarts réels et potentiel du CV.", "Top roles are enriched in the background with responsibilities, requirements, strengths, real gaps and CV upside."]]
  },
  profile: {
    icon: ProfileIcon,
    title: ["我的", "Moi", "My"],
    summary: ["管理你的事实来源和每个岗位的独立简历版本。", "Gérez votre source de vérité et vos versions de CV par offre.", "Manage your source of truth and independent role-specific CVs."],
    details: [["Master Profile 是所有匹配与新简历的共同事实来源。", "Le Master Profile est la source commune de tous les matchs et nouveaux CV.", "The Master Profile is the shared fact source for every match and new CV."], ["每个岗位版本都独立从 Master 分叉，不会把上一份定制 CV 当作下一份输入。", "Chaque CV ciblé repart du Master ; une version d’offre ne devient jamais la source de la suivante.", "Every tailored CV branches from Master; one role CV never becomes the next role's input."]]
  }
};

const text = (value: [string, string, string], tr: (zh: string, fr: string, en?: string) => string) => tr(...value);

export function OnboardingOverlay({ mode, tab, onClose, onSkip }: { mode: "welcome" | "tab"; tab?: GuideTab; onClose: () => void; onSkip: () => void }) {
  const { tr } = usePilot();
  const items = Object.entries(GUIDE_ITEMS) as [GuideTab, GuideItem][];
  const selected = tab ? GUIDE_ITEMS[tab] : null;
  const SelectedIcon = selected?.icon || HomeIcon;
  return <div className="jp-onboarding-overlay" role="presentation">
    <section className="jp-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="jp-onboarding-title" data-testid={mode === "welcome" ? "onboarding-welcome" : `onboarding-${tab}`}>
      {mode === "welcome" ? <>
        <div className="jp-onboarding-mark"><span>J</span></div>
        <p className="jp-onboarding-kicker">JobPilot</p>
        <h1 id="jp-onboarding-title">{tr("欢迎使用 JobPilot", "Bienvenue dans JobPilot", "Welcome to JobPilot")}</h1>
        <p className="jp-onboarding-lead">{tr("用几步了解你的求职工作台。", "Découvrez votre espace de recherche en quelques étapes.", "Learn your job-search workspace in a few steps.")}</p>
        <div className="jp-onboarding-list">{items.map(([key, item]) => { const Icon = item.icon; return <div className="jp-onboarding-list-item" key={key}><span className="jp-onboarding-icon"><Icon size={22} /></span><div><strong>{text(item.title, tr)}</strong><Hint>{text(item.summary, tr)}</Hint></div></div>; })}</div>
        <Button onClick={onClose}>{tr("开始使用", "Commencer", "Get started")}</Button>
        <button type="button" className="jp-onboarding-skip" onClick={onSkip}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : selected ? <>
        <div className="jp-onboarding-tab-icon"><SelectedIcon size={30} /></div>
        <p className="jp-onboarding-kicker">{tr("第一次查看这个 Tab", "Première découverte de cet onglet", "First look at this tab")}</p>
        <h1 id="jp-onboarding-title">{text(selected.title, tr)}</h1>
        <p className="jp-onboarding-lead">{text(selected.summary, tr)}</p>
        <div className="jp-onboarding-details">{selected.details.map((detail, index) => <div className="jp-onboarding-detail" key={index}><span>✓</span><p>{text(detail, tr)}</p></div>)}</div>
        <Button onClick={onClose}>{tr("知道了，开始使用", "Compris, commencer", "Got it, start exploring")}</Button>
        <button type="button" className="jp-onboarding-skip" onClick={onSkip}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : null}
    </section>
  </div>;
}
