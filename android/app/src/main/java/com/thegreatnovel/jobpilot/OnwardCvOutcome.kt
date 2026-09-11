package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
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
    val score=when {draft.text("status")=="pending"->draft.child("assessment").optInt("draftScore",baseline);cv.text("file").isNotBlank()&&cv.has("presentationScore")->cv.optInt("presentationScore",baseline);else->deep.optInt("preparedCvScore",baseline)}.coerceIn(baseline,100)
    return json("baseline" to baseline,"score" to score,"gain" to score-baseline)
}

@Composable
fun OnwardCvOutcome(value:JSONObject,detail:Boolean=false) {
    val result=onwardCvOutcome(value);val baseline=result.optInt("baseline");val score=result.optInt("score");val gain=result.optInt("gain")
    if(gain>0)Column(Modifier.fillMaxWidth().testTag("cv-uplift"),verticalArrangement=Arrangement.spacedBy(4.dp)) {
        Text(tr("岗位版简历","CV ciblé","Tailored CV"),fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Text("$baseline → $score",fontSize=if(detail)28.sp else 16.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)
            Text("+$gain",fontSize=if(detail)22.sp else 16.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)
        }
    } else if(detail)Column(Modifier.testTag("cv-current-score"),verticalArrangement=Arrangement.spacedBy(6.dp)) {
        Hint(tr("当前匹配","Match actuel","Current match"))
        Text("$score/100",fontSize=28.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)
        Hint(tr("把相关经历放在更清晰的位置，让下一步更明确。","Mettez vos expériences pertinentes en valeur pour avancer.","Bring your relevant experience into focus for your next step."))
    } else Hint(tr("CV 优化空间：更清晰地呈现相关经历。","CV : mieux mettre en valeur les expériences pertinentes.","CV opportunity: bring relevant experience into focus."))
}
