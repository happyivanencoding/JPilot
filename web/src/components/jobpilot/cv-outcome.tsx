"use client";
import {roleCvOutcome} from '@/lib/onward-cv.mjs';
import {usePilot,type Json} from './pilot-context';
import {Hint} from './ui';

/** A numerical gain appears only once an actual, reusable document supports it. */
export function CvOutcome({value,detail=false}:{value:Json;detail?:boolean}) {
 const {tr}=usePilot(),outcome=value.cvOutcome||roleCvOutcome(value);
 if(outcome.gain>0)return <div className={detail?'onward-uplift':'onward-uplift-inline'} data-testid="cv-uplift">
  <span>{tr('岗位版简历','CV ciblé','Tailored CV')}</span>
  <strong>{outcome.baseline} → {outcome.score}<span className="onward-gain"> +{outcome.gain}</span></strong>
 </div>;
 if(!detail)return <Hint>{tr('CV 优化空间：突出相关经历','CV : mettre en valeur les expériences pertinentes','CV focus: bring relevant experience forward')}</Hint>;
 return <div data-testid="cv-current-score"><div className="onward-uplift"><span>{tr('当前匹配','Match actuel','Current match')}</span><strong>{outcome.score}<small>/100</small></strong></div>
  <Hint>{tr('把相关经历放在更清晰的位置，让下一步更明确。','Mettez vos expériences pertinentes en valeur pour avancer.','Bring your relevant experience into focus for your next step.')}</Hint></div>;
}
