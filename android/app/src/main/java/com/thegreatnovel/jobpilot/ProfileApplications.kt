package com.thegreatnovel.jobpilot

import androidx.compose.foundation.BorderStroke
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

/** A read-only summary of the canonical candidature; opening goes straight to Tracking. */
@Composable
fun ProfileApplicationCard(job:JSONObject,vm:JobPilotViewModel) {
    Surface(onClick={vm.selectJob(job.text("id"),2)},modifier=Modifier.fillMaxWidth().testTag("application-${job.text("id")}"),
        shape=RoundedCornerShape(10.dp),color=MaterialTheme.colorScheme.surface,
        border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Text(job.text("company"),fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)
            Text(job.text("role"),fontSize=18.sp,lineHeight=24.sp,fontWeight=FontWeight.SemiBold)
            Pill(product(job.text("status","À candidater")))
            Hint(listOf(job.text("location"),product(job.text("contract"))).filter {it.isNotBlank() && it!="unknown"}.joinToString(" · "))
            val followup=job.child("followup")
            val changed=job.objects("statusHistory").lastOrNull()?.text("at")?.take(10).orEmpty()
            if(changed.isNotBlank()) Hint(tr("状态更新：","Statut modifié : ","Status updated: ")+changed)
            if(followup.text("dueDate").isNotBlank()) Hint(tr("跟进日期：","Relance : ","Follow-up: ")+followup.text("dueDate"))
            if(followup.text("nextActionSource")=="user" && followup.text("nextAction").isNotBlank()) Text(followup.text("nextAction"),fontSize=14.sp,lineHeight=21.sp)
            if(followup.text("note").isNotBlank()) Text(followup.text("note"),maxLines=3,fontSize=13.sp,lineHeight=19.sp)
            val cv=job.child("cv")
            val draft=job.child("cvDraft")
            val documents=buildList {
                if(cv.text("file").isNotBlank()) add(tr("岗位 CV 已保留","CV ciblé conservé","Tailored CV saved"))
                if(draft.text("status")=="pending") add(tr("新草稿待确认","Nouveau brouillon à confirmer","New draft awaiting review"))
                if(isEmpty()) add(tr("尚无岗位版 CV","Pas encore de CV ciblé","No tailored CV yet"))
            }
            Hint(documents.joinToString(" · "))
            job.objects("replies").lastOrNull()?.let { reply ->
                Text(tr("最近回复：","Dernière réponse : ","Latest reply: ")+reply.text("text"),maxLines=3,fontSize=13.sp,lineHeight=19.sp)
            }
        }
    }
}
