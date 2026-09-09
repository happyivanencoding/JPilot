"use client";
import { Home as HomeIcon, PersonOutline as ProfileIcon, School as PrepareIcon, Search as OffersIcon, WorkOutline as ApplicationsIcon } from "./native-icons";
import { usePilot } from "./pilot-context";
import { Button, Hint } from "./ui";

export type GuideTab = "home" | "offers" | "applications" | "prepare" | "profile";
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
  applications: {
    icon: ApplicationsIcon,
    title: ["投递", "Candidatures", "Applications"],
    summary: ["集中管理求职进展。", "Suivez toute votre recherche au même endroit.", "Keep your job search in one place."],
    details: [["查看已保存、已申请、面试和 Offer 中的岗位。", "Voir les offres enregistrées, postulées, en entretien ou avec offre.", "Track saved roles, applications, interviews and offers."], ["筛选待决定和待跟进事项，明确下一步。", "Filtrer les décisions et relances pour savoir quoi faire ensuite.", "Filter decisions and follow-ups to know what to do next."]]
  },
  prepare: {
    icon: PrepareIcon,
    title: ["准备", "Préparer", "Prepare"],
    summary: ["围绕真实岗位练习和准备。", "Préparez-vous autour d’un poste réel.", "Prepare around a real target role."],
    details: [["为具体岗位生成面试准备计划。", "Créer un plan de préparation pour une offre précise.", "Create a preparation plan for a specific role."], ["练习回答，获得逐项反馈，并查看你的优势。", "Pratiquer vos réponses, recevoir un retour précis et revoir vos forces.", "Practice answers, get detailed feedback and review your strengths."]]
  },
  profile: {
    icon: ProfileIcon,
    title: ["档案", "Dossier", "Profile"],
    summary: ["维护简历和求职偏好。", "Gérez votre CV et vos critères.", "Maintain your CV and job preferences."],
    details: [["导入、编辑和预览你的主简历。", "Importer, modifier et prévisualiser votre CV de référence.", "Import, edit and preview your master CV."], ["设置目标岗位、地点、合同类型和界面语言。", "Définir vos rôles, lieux, contrats et langue d’interface.", "Set target roles, locations, contract types and interface language."]]
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
