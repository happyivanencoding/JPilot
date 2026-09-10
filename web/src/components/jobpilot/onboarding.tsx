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
    summary: ["先看今天最值得推进的事。", "Commencez par l’action la plus utile aujourd’hui.", "Start with the most useful next action today."],
    details: [["查看待决定岗位、待跟进事项和最近回复。", "Voir les postes à décider, les relances et les réponses récentes.", "Review roles waiting for a decision, follow-ups and recent replies."], ["从首页快捷进入机会、投递和面试准备。", "Accéder rapidement aux offres, candidatures et préparations.", "Jump quickly to opportunities, applications and interview preparation."]]
  },
  offers: {
    icon: OffersIcon,
    title: ["机会", "Offres", "Offers"],
    summary: ["发现更适合你的岗位。", "Trouvez les opportunités qui vous correspondent.", "Find opportunities that fit you."],
    details: [["根据你的简历、目标和地点搜索岗位。", "Rechercher selon votre CV, vos objectifs et votre localisation.", "Search using your CV, goals and location."], ["保存岗位，或打开职位链接进行评估。", "Enregistrer une offre ou évaluer son annonce.", "Save a role or evaluate its job posting."]]
  },
  profile: {
    icon: ProfileIcon,
    title: ["档案", "Dossier", "Profile"],
    summary: ["在一个空间管理简历、投递和准备。", "Gérez votre CV, vos candidatures et votre préparation.", "Manage your CV, applications and preparation in one space."],
    details: [["查看我的投递，掌握每个岗位的状态与下一步。", "Suivre vos candidatures, leur statut et la prochaine action.", "Track each application, its status and next action."], ["进入面试准备或设置，管理求职材料和连接。", "Ouvrir la préparation ou les réglages pour gérer vos outils.", "Open preparation or settings to manage your tools."]]
  }
};

const text = (value: [string, string, string], tr: (zh: string, fr: string, en?: string) => string) => tr(...value);

export function OnboardingOverlay({ mode, tab, onClose }: { mode: "welcome" | "tab"; tab?: GuideTab; onClose: () => void }) {
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
        <button type="button" className="jp-onboarding-skip" onClick={onClose}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : selected ? <>
        <div className="jp-onboarding-tab-icon"><SelectedIcon size={30} /></div>
        <p className="jp-onboarding-kicker">{tr("第一次查看这个 Tab", "Première découverte de cet onglet", "First look at this tab")}</p>
        <h1 id="jp-onboarding-title">{text(selected.title, tr)}</h1>
        <p className="jp-onboarding-lead">{text(selected.summary, tr)}</p>
        <div className="jp-onboarding-details">{selected.details.map((detail, index) => <div className="jp-onboarding-detail" key={index}><span>✓</span><p>{text(detail, tr)}</p></div>)}</div>
        <Button onClick={onClose}>{tr("知道了，开始使用", "Compris, commencer", "Got it, start exploring")}</Button>
        <button type="button" className="jp-onboarding-skip" onClick={onClose}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : null}
    </section>
  </div>;
}
