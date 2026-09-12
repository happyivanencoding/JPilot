package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

fun onwardCvOutcome(value:JSONObject):JSONObject {
    if(value.child("cvOutcome").has("baseline"))return value.child("cvOutcome")
    val draft=value.child("cvDraft");val cv=value.child("cv")
    val match=when {draft.text("status")=="pending"&&draft.child("matchBasis").has("currentScore")->draft.child("matchBasis");cv.child("matchBasis").has("currentScore")->cv.child("matchBasis");value.child("v1Match").has("currentScore")->value.child("v1Match");else->value.child("deepMatch")}
    val baseline=match.optInt("currentScore",value.child("fastMatch").optInt("score",0)).coerceIn(0,100)
    val deep=if(value.child("v1Match").has("deepMatch"))value.child("v1Match").child("deepMatch")else value.child("deepMatch")
    val ready=when {draft.text("status")=="pending"&&draft.child("assessment").has("draftScore")->true;cv.text("file").isNotBlank()&&cv.has("presentationScore")->true;deep.has("preparedCvScore")->true;else->false}
    val score=when {draft.text("status")=="pending"&&draft.child("assessment").has("draftScore")->draft.child("assessment").optInt("draftScore",baseline);cv.text("file").isNotBlank()&&cv.has("presentationScore")->cv.optInt("presentationScore",baseline);deep.has("preparedCvScore")->deep.optInt("preparedCvScore",baseline);else->baseline}.coerceIn(baseline,100)
    return json("baseline" to baseline,"score" to score,"gain" to score-baseline,"ready" to ready)
}

@Composable
fun OnwardCvOutcome(value:JSONObject,detail:Boolean=false) {
    val result=onwardCvOutcome(value);val baseline=result.optInt("baseline");val score=result.optInt("score");val gain=result.optInt("gain");val ready=result.optBoolean("ready")
    if((detail&&ready)||gain>0)Column(Modifier.fillMaxWidth().testTag("cv-uplift"),verticalArrangement=Arrangement.spacedBy(if(detail)10.dp else 4.dp)) {
        if(detail&&ready) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                Surface(Modifier.weight(1f),shape=RoundedCornerShape(8.dp),color=MaterialTheme.colorScheme.surfaceVariant.copy(alpha=.48f)) {
                    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                        Hint(tr("原始匹配","CV initial","Initial CV"))
                        Text("$baseline%",style=MaterialTheme.typography.headlineMedium,color=MaterialTheme.colorScheme.onSurface)
                        Hint(tr("当前呈现","Présentation actuelle","Current presentation"))
                        LinearProgressIndicator(progress={baseline/100f},modifier=Modifier.fillMaxWidth().height(5.dp),color=MaterialTheme.colorScheme.onSurfaceVariant,trackColor=MaterialTheme.colorScheme.outlineVariant)
                    }
                }
                Text("→",style=MaterialTheme.typography.headlineSmall,color=MaterialTheme.colorScheme.primary)
                Surface(Modifier.weight(1f),shape=RoundedCornerShape(8.dp),color=MaterialTheme.colorScheme.primaryContainer.copy(alpha=.72f)) {
                    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                        Hint(if(gain>0)tr("优化后匹配","CV optimisé","Optimised CV")else tr("岗位版匹配","CV ciblé","Role CV match"))
                        Text("$score%",style=MaterialTheme.typography.headlineMedium,color=MaterialTheme.colorScheme.primary)
                        Hint(tr("岗位呈现","Présentation ciblée","Targeted presentation"))
                        LinearProgressIndicator(progress={score/100f},modifier=Modifier.fillMaxWidth().height(5.dp),color=MaterialTheme.colorScheme.primary,trackColor=MaterialTheme.colorScheme.surfaceVariant)
                    }
                }
            }
            Text(if(gain>0)tr("提升 +$gain 分","Gain +$gain points","+$gain point uplift")else tr("匹配分没有变化：当前限制主要来自实际经历或技能差距，而不是简历措辞。","Score inchangé : les limites actuelles viennent surtout de l’expérience ou des compétences, pas de la formulation du CV.","Score unchanged: the current limits come mainly from experience or skill gaps, not CV wording."),style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.primary)
        } else {
            Text(tr("岗位版简历","CV ciblé","Tailored CV"),style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement=Arrangement.spacedBy(9.dp),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically) {
                Text("$baseline → $score",style=MaterialTheme.typography.titleMedium,color=MaterialTheme.colorScheme.primary)
                Pill("+$gain")
            }
        }
    } else if(detail)Column(Modifier.testTag("cv-current-score"),verticalArrangement=Arrangement.spacedBy(6.dp)) {
        Hint(tr("当前匹配","Match actuel","Current match"))
        Text("$score/100",style=MaterialTheme.typography.headlineMedium,color=MaterialTheme.colorScheme.primary)
        Hint(tr("把相关经历放在更清晰的位置，让下一步更明确。","Mettez vos expériences pertinentes en valeur pour avancer.","Bring your relevant experience into focus for your next step."))
    } else Hint(tr("CV 优化空间：更清晰地呈现相关经历。","CV : mieux mettre en valeur les expériences pertinentes.","CV opportunity: bring relevant experience into focus."))
}
