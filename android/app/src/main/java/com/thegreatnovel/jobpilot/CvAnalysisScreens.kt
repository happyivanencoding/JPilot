package com.thegreatnovel.jobpilot

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

@Composable fun AnalysisEntry(state: PilotState,vm: JobPilotViewModel) {
    val analysis=state.snapshot.child("analysis")
    val exists=analysis.text("markdown").isNotBlank()
    val background=state.snapshot.child("v1").optBoolean("backgroundActive")
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
        Text(tr("Onward 对你的理解","Ce que Onward comprend de votre profil","How Onward understands your profile"),fontWeight=FontWeight.SemiBold,fontSize=18.sp)
        Hint(tr("上传或修改主简历后会自动更新，不需要再手动点击 AI 分析。","L’analyse se met à jour automatiquement après une modification du CV de référence.","This updates automatically when your master CV changes; no separate AI button is needed."))
        if(background) { LinearProgressIndicator(Modifier.fillMaxWidth());Hint(tr("正在后台更新职业方向和首批岗位…","Mise à jour des directions et des premières offres…","Updating directions and initial roles in the background…")) }
        if(exists) OutlinedButton({vm.showAnalysis()},Modifier.fillMaxWidth().testTag("view-analysis")) {Text(tr("查看完整优势与真实行动","Voir les atouts et actions réelles","See strengths and real actions"))}
    }
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AnalysisSheet(state: PilotState,vm: JobPilotViewModel) {
    val a=state.snapshot.child("analysis");val plan=a.child("globalLayout");val global=plan.length()>0
    var tab by rememberSaveable(a.text("taskId")) {mutableIntStateOf(if(global) 0 else 1)}
    var historical by remember {mutableStateOf(false)}
    var selected by remember(a.text("taskId")) {mutableStateOf(emptySet<String>())}
    ModalBottomSheet(onDismissRequest={vm.showAnalysis(false)},sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true)) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.94f).blockSheetEdgeMotion().testTag("analysis-sheet")) {
            Column(Modifier.padding(horizontal=20.dp,vertical=8.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                LocalizationNotice(state.snapshot.child("localization"),vm::retryLocalization)
                SectionTitle(tr("一页，清楚的主线","Une page. Un fil conducteur.","One page. A clear story."),state.snapshot.child("profile").text("name"))
                Hint("CV ${state.snapshot.child("cvState").optInt("cvVersion")} · ${a.text("createdAt").take(10)}")
                if(a.optInt("resolvedCount")>0) Hint(tr("${a.optInt("resolvedCount")} 项改进已保留","${a.optInt("resolvedCount")} améliorations conservées","${a.optInt("resolvedCount")} improvements retained"))
            }
            TabRow(tab) { listOf(tr("整页重点","Vue d’ensemble","Whole page"),tr("直接改善","Présentation","Presentation"),tr("真实行动","À acquérir","Real actions")).forEachIndexed { i,label -> Tab(tab==i,{tab=i},modifier=Modifier.testTag("analysis-tab-$i"),text={Text(label,fontSize=12.sp)}) } }
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("analysis-content"),contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp),overscrollEffect=null) {
                if(a.text("changeSummary").isNotBlank())item {Hint(a.text("changeSummary"))}
                when(tab) {
                    0 -> {
                        if(!global)item {Hint(tr("这份已保存的旧分析没有整页计划。不会仅因界面升级再次调用 AI；真实修改 CV 后可更新。","Cette analyse historique ne contient pas encore de plan global. Aucun nouvel appel IA tant que les données ne changent pas.","This saved analysis has no global plan. UI updates do not trigger another AI call."))}
                        else {
                            item {Text(plan.text("headline"),fontSize=20.sp,lineHeight=27.sp,fontWeight=FontWeight.SemiBold);if(plan.text("languageNote").isNotBlank())Hint(plan.text("languageNote"))}
                            items(plan.objects("signals")) {s-> Column(Modifier.fillMaxWidth().border(width=.5.dp,color=MaterialTheme.colorScheme.outlineVariant).padding(12.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {Text(s.text("title"),fontWeight=FontWeight.SemiBold);Text(s.text("why"),fontSize=14.sp,lineHeight=21.sp);Hint(s.text("evidence"))} }
                            if(plan.strings("overlooked").isNotEmpty())item {Text(tr("第一眼可能漏掉","Ce qui risque de passer inaperçu","What may be missed"),fontWeight=FontWeight.SemiBold);plan.strings("overlooked").forEach {Text(it,Modifier.padding(top=6.dp),fontSize=14.sp,lineHeight=21.sp)}}
                            item {val before=plan.child("beforeBudget");val after=plan.child("budget");if(after.length()>0)Hint(tr("注意力预算：","Budget de lecture : ","Reading budget: ")+tr("${before.optInt("words")} → ${after.optInt("words")} 词 · ${before.optInt("bullets")} → ${after.optInt("bullets")} 条描述","${before.optInt("words")} → ${after.optInt("words")} mots · ${before.optInt("bullets")} → ${after.optInt("bullets")} puces","${before.optInt("words")} → ${after.optInt("words")} words · ${before.optInt("bullets")} → ${after.optInt("bullets")} bullets"))}
                            items(plan.objects("allocations")) {allocation->Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {Row {Text(allocation.text("section"),Modifier.weight(1f),fontWeight=FontWeight.SemiBold);Text(priorityLabel(allocation.text("priority")),fontSize=11.sp,color=MaterialTheme.colorScheme.primary)};Text(allocation.text("reason"),fontSize=14.sp,lineHeight=21.sp);Hint(allocation.text("spaceTradeoff"));HorizontalDivider()} }
                            if(plan.strings("issues").isNotEmpty())item {plan.strings("issues").forEach {Text(it,color=MaterialTheme.colorScheme.error,fontSize=13.sp)}}
                        }
                    }
                    1 -> {
                        item {Hint(if(global)tr("这些变化属于同一个整页方案，会一起压缩、合并与重排，不会逐项调用 AI。","Ces changements appartiennent à un plan unique : raccourcir, fusionner, réordonner. Aucun appel IA par suggestion.","One coordinated plan shortens, merges and reorders; no AI call per suggestion.")else tr("旧建议保留可用。请只选必要的变化；新分析会改用整页预算。","Suggestions historiques conservées. Sélectionnez seulement les changements utiles.","Historical suggestions remain available. Select only useful edits."))}
                        items(a.objects("expressionIssues"),key={it.text("id")}) {issue->Column(verticalArrangement=Arrangement.spacedBy(7.dp)) {
                            Row(verticalAlignment=Alignment.Top) {if(!global&&issue.optBoolean("applicable"))Checkbox(issue.text("id") in selected,{checked->selected=if(checked)selected+issue.text("id")else selected-issue.text("id")},Modifier.testTag("edit-${issue.text("id")}"));Text(issue.text("title"),Modifier.weight(1f),fontWeight=FontWeight.SemiBold)}
                            Text(issue.text("detail"),fontSize=14.sp,lineHeight=21.sp)
                            if(!global){Hint(tr("当前","Avant","Before"));Text(issue.text("before"),fontSize=13.sp);Hint(tr("建议","Après","After"));Text(issue.text("after"),fontSize=14.sp,lineHeight=21.sp)}
                            Hint(issue.text("evidence"));HorizontalDivider()
                        }}
                    }
                    2 -> {
                        item {Hint(tr("表达不能替代经验或语言能力。以下需要实际行动。","Une reformulation ne remplace ni l’expérience ni la maîtrise d’une langue.","Wording cannot replace experience or language proficiency."))}
                        items(a.objects("actionIssues"),key={it.text("id")}) {issue->Column(verticalArrangement=Arrangement.spacedBy(7.dp)){Text(issue.text("title"),fontWeight=FontWeight.SemiBold,fontSize=17.sp);Text(issue.text("detail"),fontSize=14.sp,lineHeight=21.sp);Text(issue.text("nextAction"),fontSize=14.sp,color=MaterialTheme.colorScheme.primary);Hint(issue.text("evidence"));HorizontalDivider()}}
                        if(a.objects("actionIssues").isEmpty())item {Markdown(a.text("actionMarkdown"))}
                    }
                }
                item {TextButton({historical=!historical}){Text(tr("查看完整分析与历史","Compte rendu & historique","Full analysis & history"))};if(historical){Hint(tr("原始历史记录，不代表已解决的问题仍未解决。","Compte rendu d’origine ; les points résolus sont conservés comme historique.","Original record; resolved points are retained as history."));Markdown(a.text("markdown"))}}
            }
            if(global||selected.isNotEmpty())PilotChrome {
                Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal=20.dp,vertical=10.dp)) {
                    Button({vm.showAnalysis(false);vm.startTask(json("kind" to "rewrite","analysisId" to a.text("taskId"),"suggestionIds" to JSONArray(if(global)listOf("global-plan")else selected.toList())))},Modifier.fillMaxWidth().testTag("apply-cv-plan"),enabled=!state.working&&!a.optBoolean("stale")&&(!global||plan.optBoolean("applicable"))){Text(if(global)tr("预览整页改写方案","Prévisualiser le plan complet","Preview the whole-page plan")else tr("预览所选修改","Prévisualiser les modifications","Preview selected edits"))}
                    Hint(tr("先看真实 PDF，再接受；不会自动覆盖。","Un vrai PDF avant toute décision. Votre CV reste inchangé jusque-là.","Review the actual PDF before accepting; no automatic overwrite."))
                }
            }
        }
    }
}
@Composable private fun priorityLabel(value:String)=when(value){"primary"->tr("核心","Prioritaire","Primary");"supporting"->tr("支撑","En appui","Supporting");"background"->tr("背景","En bref","Background");else->tr("可压缩","À alléger","Reduce")}
