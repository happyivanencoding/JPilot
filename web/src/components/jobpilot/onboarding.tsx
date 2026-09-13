"use client";
import {V1SignIn} from "./v1-sign-in";
import {OnwardBrand} from "./onward-brand";
import {CvOutcome} from "./cv-outcome";
import {SearchAreaFields} from "./search-area";
import {ensureCvConsent} from "./cv-consent";
import { useEffect, useRef, useState } from "react";
import {ArrowRight,FileText} from "lucide-react";
import {DirectionMedallion,MatchScorePending} from "./onward-visual";
import { Home as HomeIcon, PersonOutline as ProfileIcon, Search as OffersIcon } from "./native-icons";
import { rows, usePilot, type Json } from "./pilot-context";
import { AiProgressButton, Button, Hint } from "./ui";
import {CvAnalysisWater,useCvWaterProgress} from "./cv-water";

export type GuideTab = "home" | "offers" | "profile";
type GuideItem = { icon: typeof HomeIcon; title: [string, string, string]; summary: [string, string, string]; details: [string, string, string][] };

const GUIDE_ITEMS: Record<GuideTab, GuideItem> = {
  home: {
    icon: HomeIcon,
    title: ["首页", "Accueil", "Home"],
    summary: ["先看你适合什么，而不是先学会操作软件。", "Commencez par comprendre où votre profil peut aller.", "Start by seeing where your profile can go."],
    details: [["确认简历后，Onward 会自动理解你的经历并给出 3–5 个可探索方向。", "Après confirmation du CV, Onward comprend votre parcours et propose 3–5 directions à explorer.", "After you confirm your CV, Onward understands your experience and suggests 3–5 directions."], ["首页直接展示最值得先看的真实岗位和当前能力信号。", "L’accueil montre directement les offres les plus pertinentes et vos principaux signaux.", "Home shows the most useful real roles and your main profile signals."]]
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
        <OnwardBrand large/>

        <h1 id="jp-onboarding-title">{tr("欢迎使用 Onward", "Bienvenue dans Onward", "Welcome to Onward")}</h1>
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

export function V1FirstRunOverlay({onDone}:{onDone:()=>void|Promise<void>}) {
  const p=usePilot(),{data,tr,locale,busy,loading,profileId}=p;
  const picker=useRef<HTMLInputElement>(null);
  const [languageChosen,setLanguageChosen]=useState(true);
  const [applicationLanguage,setApplicationLanguage]=useState<"fr"|"en">(locale==="fr"?"fr":"en");
  const [contracts,setContracts]=useState<string[]>([]);
  const [searchArea,setSearchArea]=useState<Json>({scope:"city",city:"Paris"});
  const areaValid=searchArea.scope==="france"||!!searchArea.city.trim();
  const [chosenQuery,setChosenQuery]=useState(""),[customQuery,setCustomQuery]=useState(""),[chooseAgain,setChooseAgain]=useState(false),[uploading,setUploading]=useState(false);
  const v=data.v1||{},journey=v.journey||{},analysis=data.analysis||{},discovery=data.discovery||{};
  const directions=rows(v.careerDirections),offers=rows(discovery.offers).slice(0,4);
  const signedIn=!!profileId&&!p.expired;
  const importing=["queued","running","reconciling"].includes(String(v.importState));
  const targetStage=!signedIn?(languageChosen?1:0):(loading&&!data.profile?.id||uploading||importing&&!p.error)?3:(v.importState==="failed"||!data.cv)?2:!v.analysisReady?3:(chooseAgain||!journey.query)?4:!v.offersReady?5:6;
  const [stage,setStage]=useState(targetStage);
  useEffect(()=>{
    if(stage===3&&targetStage===4&&v.analysisReady || stage===5&&targetStage===6&&v.offersReady){const timer=setTimeout(()=>setStage(targetStage),650);return()=>clearTimeout(timer);}
    setStage(targetStage);
  },[targetStage,profileId]);
  const progress=(stage===5?v.searchProgress:v.cvProgress)||{},cvFailed=progress.status==="failed"||!v.analysisReady&&v.presentationFailed;
  const waveFailed=stage===5?progress.status==="failed"||v.presentationFailed:cvFailed;
  const waterPercent=useCvWaterProgress(progress,stage===3||stage===5,!!waveFailed||!!p.error);
  useEffect(()=>{const saved=data.languageSettings?.applicationLanguage;if(saved==="fr"||saved==="en")setApplicationLanguage(saved);},[data.languageSettings?.applicationLanguage]);
  const languages=(selected:string,onSelect:(value:"en"|"fr"|"zh")=>void)=><div className="jp-chips">{([["en","English"],["fr","Français"],["zh","中文"]] as const).map(([code,label])=><button type="button" key={code} aria-pressed={code===selected} className={`jp-chip ${code===selected?"selected":""}`} onClick={()=>onSelect(code)}>{label}</button>)}</div>;
  const applicationLanguages=<div className="jp-chips">{([["fr","Français"],["en","English"]] as const).map(([code,label])=><button type="button" key={code} aria-pressed={code===applicationLanguage} className={`jp-chip ${code===applicationLanguage?"selected":""}`} onClick={()=>setApplicationLanguage(code)}>{label}</button>)}</div>;
  const pick=async(file:File)=>{setUploading(true);try{return await p.upload(file,applicationLanguage,locale,contracts,searchArea);}finally{setUploading(false);}};
  const chooseCv=async()=>{await ensureCvConsent(p.request,locale);picker.current?.click();};
  const search=()=>{const query=customQuery.trim()||chosenQuery;if(query){setChooseAgain(false);void p.startTask({kind:"search",query,silent:true,source:"v1-onboarding"});}};
  const enterOffer=async(offer:Json)=>{await onDone();p.openOffer(String(offer.url));};
  const empty=stage===5&&v.searchState==="completed"&&discovery.availableCount===0;
  return <div className="jp-v1-first-run" data-testid="v1-first-run">
    {(stage===3||stage===5)&&<CvAnalysisWater percent={waterPercent} paused={!!waveFailed||!!p.error} complete={progress.status==="completed"}/>}
    <div className="jp-v1-first-run-head"><OnwardBrand large/></div>
    <div className="jp-v1-first-run-body" key={stage}>
      {stage===0&&<><h1>{tr("让你的下一步更清晰。","Votre prochaine étape, plus claire.","Make your next move clearer.")}</h1><Hint>{tr("你的优势，值得尝试的方向，还有下一份工作。","Vos forces, vos pistes et votre prochain poste.","Your strengths, your possibilities, your next role.")}</Hint><strong>{tr("选择语言","Choisissez votre langue","Choose your language")}</strong>{languages(locale,p.setLocale)}<Button onClick={()=>setLanguageChosen(true)}>{tr("开始","Commencer","Get started")}</Button></>}
      {stage===1&&<V1SignIn/>}
      {stage===2&&<><h1>{tr("你的下一章，从这里开始。","Votre prochain chapitre commence ici.","Your next chapter starts here.")}</h1><Hint>{tr("上传简历，让 Onward 从你的真实经历出发找到与你匹配的机会。","Importez votre CV et laissez Onward trouver des opportunités en accord avec votre profil et vos ambitions.","Upload your CV and let Onward find opportunities aligned with your experience and ambitions.")}</Hint><strong>{tr("你想找哪类机会？","Quel type d’opportunité ?","What are you looking for?")}</strong><div className="jp-contract-grid">{["Stage","Alternance","CDI","CDD"].map(type=><button key={type} type="button" data-testid={`onboarding-contract-${type}`} className={`jp-chip ${contracts.includes(type)?"selected":""}`} aria-pressed={contracts.includes(type)} onClick={()=>setContracts(old=>old.includes(type)?old.filter(x=>x!==type):[...old,type])}>{p.product(type)}</button>)}</div>{!contracts.length&&<Hint>{tr("至少选择一项，可以多选。","Choisissez au moins une option, plusieurs sont possibles.","Select at least one. You can choose several.")}</Hint>}<SearchAreaFields value={searchArea} onChange={setSearchArea}/><div data-analytics="language_options" className="jp-stack"><strong>{tr("求职简历","CV de candidature","Application CV")}</strong>{applicationLanguages}<Hint>{tr("只决定新生成简历的语言，不限制岗位搜索。上传其他语言的简历时，岗位版简历会翻译成这里选择的语言。","Ce choix détermine uniquement la langue des nouveaux CV et ne filtre pas les offres. Si votre CV importé est dans une autre langue, le CV ciblé sera traduit dans la langue choisie ici.","This only sets the language of newly generated CVs and does not filter job search. If the uploaded CV is in another language, the role-specific CV will be translated into the language chosen here.")}</Hint></div><input ref={picker} data-testid="onboarding-cv-input" type="file" hidden accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={e=>{const input=e.currentTarget;const file=input.files?.[0];if(file)void pick(file).finally(()=>{input.value="";});}}/>{v.importState==="failed"&&<p role="alert">{tr("这份文件暂时打不开，请换一份 PDF 或 Word。","Ce fichier ne s’ouvre pas. Essayez un autre PDF ou Word.","This file could not be opened. Try another PDF or Word file.")}</p>}<div className="jp-v1-upload-card onward-upload-drop"><span className="onward-upload-icon"><FileText size={23}/></span><strong>{tr("把 CV 放在这里","Déposez votre CV ici","Drop your CV here")}</strong><Hint>{tr("或从你的文件中选择","ou choisissez-le dans vos fichiers","or choose it from your files")}</Hint><Button data-testid="onboarding-upload" disabled={busy||!contracts.length||!areaValid} onClick={()=>void chooseCv()}>{tr("选择文件","Choisir un fichier","Choose a file")}</Button><Hint>PDF · Word · TXT · 12 MB</Hint></div><p className="onward-privacy-brief" data-testid="privacy-brief">{tr("测试阶段：你的 CV 只用于当前档案的匹配、分析和生成，不会用于其他用途。","Phase de test : votre CV sert uniquement aux correspondances, analyses et CV générés pour ce profil.","Testing phase: your CV is used only for matching, analysis and generated CVs for this profile.")}</p></>}
      {stage===3&&<><h1>{tr("你的下一步，可以有哪些可能？","Quelles possibilités pour la suite ?","What could your next step look like?")}</h1>{cvFailed?<><p className="jp-cv-failure" role="alert">{progress.failure?.message||tr("简历已保存，分析暂未完成。可以直接继续，无需重新上传。","Votre CV est enregistré. Reprenez l’analyse sans renvoyer le fichier.","Your CV is saved. Continue the analysis without uploading it again.")}</p><Button disabled={busy} onClick={()=>p.retryV1()}>{tr("继续分析","Reprendre l’analyse","Continue analysis")}</Button></>:<><Hint>{progress.label||tr("正在读取简历","Lecture de votre CV","Reading your CV")}</Hint><div className="jp-cv-progress" data-testid="cv-analysis-progress" role="progressbar" aria-label={tr("简历分析预计进度","Progression estimée de l’analyse","Estimated CV analysis progress")} aria-valuemin={0} aria-valuemax={96} aria-valuenow={waterPercent}><strong>{`${waterPercent}%`}</strong><Hint>{tr("你的优势与方向，即将浮现。","Vos atouts et vos pistes prennent forme.","Your strengths and directions are taking shape.")}</Hint></div></>}</>}
      {stage===4&&<><h1>{data.profile?.name?tr(`你好，${data.profile.name}。`,`Bonjour ${data.profile.name}.`,`Hi, ${data.profile.name}.`):tr("这是你会闪光的地方。","Voici vos atouts.","Here is where you stand out.")}</h1><p className="jp-v1-strength-lead">{tr("从你的简历里，Onward 看到这些已经可以拿来求职的优势：","À partir de votre CV, Onward voit déjà ces atouts que vous pouvez mettre en avant :","From your CV, Onward can already see these strengths you can use in your search:")}</p><div className="jp-stack">{rows(analysis.strengths).slice(0,3).map((s,i)=><section className="jp-card" key={i}><strong>{s.title}</strong><Hint>{s.evidence}</Hint></section>)}</div>{rows(analysis.growthAreas).slice(0,1).map((gap,i)=><p key={i}>{gap.nextAction}</p>)}<h2 className="jp-v1-direction-title">{tr("你想先看看哪个方向？","Quelle piste vous attire ?","Which direction interests you?")}</h2><div className="jp-v1-direction-choice">{directions.map((d,i)=><button type="button" key={i} className={chosenQuery===d.searchQuery&&!customQuery?"selected":""} onClick={()=>{setChosenQuery(d.searchQuery);setCustomQuery("");}}><DirectionMedallion label={String(d.title)}/><span>{d.title}</span><ArrowRight size={20}/></button>)}</div><label className="jp-field"><span>{tr("我有其他想法","J’ai une autre idée","I have something else in mind")}</span><input value={customQuery} onChange={e=>setCustomQuery(e.target.value)}/></label><Button data-testid="onboarding-search" disabled={busy||!(customQuery.trim()||chosenQuery)} onClick={search}>{tr("看看这些工作","Voir les offres","Show me the roles")}</Button></>}
      {stage===5&&<><h1>{tr("为你挑选值得一试的工作","Une sélection qui vous correspond","Finding roles worth your time")}</h1>{!empty&&!waveFailed&&<><Hint>{progress.label||tr("正在找岗位","Recherche des offres","Finding roles")}</Hint><div className="jp-cv-progress" data-testid="first-search-progress" role="progressbar" aria-label={tr("岗位准备进度","Préparation des offres","Role preparation progress")} aria-valuemin={0} aria-valuemax={96} aria-valuenow={waterPercent}><strong>{`${waterPercent}%`}</strong><Hint>{tr("先把找到的岗位给你，详细匹配会随后逐项补全。","Les offres apparaissent d’abord ; l’analyse détaillée se complète ensuite, offre par offre.","Roles appear first; detailed match insights fill in progressively afterward.")}</Hint></div></>}{(waveFailed||empty&&v.searchIncomplete)&&<Button disabled={busy} onClick={()=>p.retryV1()}>{tr("再试一次","Réessayer","Try again")}</Button>}{(empty||waveFailed)&&<Button kind="text" onClick={()=>setChooseAgain(true)}>{tr("返回方向","Retour aux pistes","Back to directions")}</Button>}{empty&&<Button kind="text" onClick={()=>void onDone()}>{tr("进入首页","Aller à l’accueil","Go to Home")}</Button>}</>}
      {stage===6&&<><h1>{tr("这几份工作，值得你看看。","Ces offres méritent votre attention.","These roles are worth a look.")}</h1><Hint>{tr("左右滑动，点开查看匹配与提升建议。","Faites défiler, puis ouvrez une offre pour voir le match.","Swipe, then open a role to explore your fit.")}</Hint><div className="jp-v1-swipe-deck">{offers.map(offer=><FirstRunOffer key={offer.url} offer={offer} onClick={()=>void enterOffer(offer)}/>)}</div></>}
      {p.error&&<p role="alert">{p.error}</p>}
    </div>
  </div>;
}

function FirstRunOffer({offer,onClick}:{offer:Json;onClick:()=>void}) {
  const {product}=usePilot();
  const deep=offer.deepMatch||{},state=String(offer.enrichment?.deepMatchState||''),score=offer.matchScore?.current ?? deep.currentScore,ready=state==='ready'&&score!=null&&Number.isFinite(Number(score));
  const contentReady=ready&&!offer.enrichment?.localization?.pending;
  const strengths=contentReady?rows(deep.strengths).map(x=>x.title):[];
  const gaps=contentReady?rows(deep.capabilityGaps).map(x=>x.title):[];
  return <button type="button" className="jp-v1-swipe-card" onClick={onClick}><div className="jp-row"><div className="jp-grow"><span className="jp-company">{offer.company}</span><h2>{offer.title}</h2></div>{ready?<div className="jp-match100">{Math.round(Number(score))}<span>/100</span></div>:<MatchScorePending compact estimate={offer.enrichment?.deepMatchEstimate} startedAt={offer.enrichment?.deepMatchStartedAt}/>}</div><Hint>{[offer.location,offer.contractType!=="unknown"?product(offer.contractType):""].filter(Boolean).join(" · ")}</Hint>{contentReady&&<><div className="jp-v1-signal-row">{strengths.slice(0,2).map((x,i)=><span className="jp-v1-plus" key={i}>+ {x}</span>)}</div><div className="jp-v1-signal-row">{gaps.slice(0,2).map((x,i)=><span className="jp-v1-minus" key={i}>− {x}</span>)}</div><CvOutcome value={offer}/></>}</button>;
}
