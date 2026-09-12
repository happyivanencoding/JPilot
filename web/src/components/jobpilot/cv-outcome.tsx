"use client";
import {roleCvOutcome} from '@/lib/onward-cv.mjs';
import {usePilot,type Json} from './pilot-context';
import {Hint} from './ui';

/** A numerical gain appears only once an actual, reusable document supports it. */
export function CvOutcome({value,detail=false}:{value:Json;detail?:boolean}) {
 const {tr}=usePilot(),outcome=value.cvOutcome||roleCvOutcome(value);
 if(outcome.ready && detail)return <div className="onward-cv-impact" data-testid="cv-uplift">
  <div className="onward-score-pair">
   <div className="onward-score-card baseline"><span>{tr('原始匹配','CV initial','Initial CV')}</span><strong>{outcome.baseline}%</strong><small>{tr('当前呈现','Présentation actuelle','Current presentation')}</small><i aria-hidden="true"><b style={{width:`${outcome.baseline}%`}}/></i></div>
   <b aria-hidden="true">→</b>
   <div className="onward-score-card optimised"><span>{outcome.gain>0?tr('优化后匹配','CV optimisé','Optimised CV'):tr('岗位版匹配','CV ciblé','Role CV match')}</span><strong>{outcome.score}%</strong><small>{tr('岗位呈现','Présentation ciblée','Targeted presentation')}</small><i aria-hidden="true"><b style={{width:`${outcome.score}%`}}/></i></div>
  </div>
  <small>{outcome.gain>0?tr(`提升 +${outcome.gain} 分`,`Gain +${outcome.gain} points`,`+${outcome.gain} point uplift`):tr('匹配分没有变化：当前限制主要来自实际经历或技能差距，而不是简历措辞。','Score inchangé : les limites actuelles viennent surtout de l’expérience ou des compétences, pas de la formulation du CV.','Score unchanged: the current limits come mainly from experience or skill gaps, not CV wording.')}</small>
 </div>;
 if(outcome.gain>0)return <div className="onward-uplift-inline" data-testid="cv-uplift">
  <span>{tr('岗位版简历','CV ciblé','Tailored CV')}</span>
  <strong>{outcome.baseline} → {outcome.score}<span className="onward-gain"> +{outcome.gain}</span></strong>
 </div>;
 if(!detail)return <Hint>{tr('CV 优化空间：突出相关经历','CV : mettre en valeur les expériences pertinentes','CV focus: bring relevant experience forward')}</Hint>;
 return <div data-testid="cv-current-score"><div className="onward-uplift"><span>{tr('当前匹配','Match actuel','Current match')}</span><strong>{outcome.score}<small>/100</small></strong></div>
  <Hint>{tr('把相关经历放在更清晰的位置，让下一步更明确。','Mettez vos expériences pertinentes en valeur pour avancer.','Bring your relevant experience into focus for your next step.')}</Hint></div>;
}
