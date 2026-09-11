package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

@Composable
fun MatchBreakdown(match:JSONObject,busy:Boolean=false,onRefresh:(()->Unit)?=null) {
    val rows=match.objects("scoreBreakdown")
    GlassCard {
        Text(tr("分数是怎么算的","Comprendre le score","How the score is calculated"),fontSize=18.sp,fontWeight=FontWeight.SemiBold)
        if(rows.isEmpty()) {
            Hint(tr("这份旧评估没有保存逐项扣分记录，不能倒推编造。","Cette ancienne analyse ne conserve pas le détail des points ; nous ne le reconstituons pas artificiellement.","This older assessment did not retain itemized points; we do not invent them afterwards."))
            if(onRefresh!=null) OutlinedButton(onRefresh,enabled=!busy){Text(tr("更新评分并查看明细","Actualiser et voir le détail","Update score and view details"))}
        } else {
            rows.forEach {row->
                val title=when(row.text("key")) {
                    "role"->tr("岗位方向","Domaine du poste","Role and domain")
                    "duties"->tr("职责与相关经历","Missions et expérience","Duties and experience")
                    "tools_languages"->tr("工具与必需语言","Outils et langues requises","Tools and required languages")
                    else->tr("资历与明确要求","Niveau et exigences","Level and stated requirements")
                }
                Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                        Text(title,Modifier.weight(1f),fontWeight=FontWeight.Medium,fontSize=14.sp)
                        Text("${row.optInt("points")}/${row.optInt("max")}",fontWeight=FontWeight.SemiBold)
                    }
                    val lost=row.optInt("deducted")
                    Text(if(row.optBoolean("unknown"))tr("待确认 · 暂差 $lost 分","À confirmer · écart provisoire $lost","To clarify · provisional gap $lost")else if(lost>0)tr("少 $lost 分","Écart de $lost points","$lost points below full fit")else tr("本项满分","Critère entièrement rempli","Full points on this criterion"),fontSize=12.sp,color=MaterialTheme.colorScheme.primary)
                    Text(row.text("reason"),fontSize=14.sp,lineHeight=21.sp)
                    row.text("jobEvidence").takeIf {it.isNotBlank()}?.let {Hint(tr("岗位原文：","Offre : ","Posting: ")+it)}
                    row.text("candidateEvidence").takeIf {it.isNotBlank()}?.let {Hint(tr("简历原文：","CV : ","CV: ")+it)}
                }
                HorizontalDivider()
            }
            Text("100 − ${rows.sumOf {it.optInt("deducted")}} = ${rows.sumOf {it.optInt("points")}}/100",fontWeight=FontWeight.SemiBold)
            Hint(tr("依据具体职责和要求，不只看职称；待确认不等于不会。","Le contenu et les exigences priment sur l’intitulé. Une information inconnue n’est pas une incapacité.","Based on actual duties and requirements, not just the title. Unknown does not mean unable."))
        }
    }
}
