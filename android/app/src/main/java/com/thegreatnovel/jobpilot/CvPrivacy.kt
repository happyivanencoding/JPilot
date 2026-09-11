package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

@Composable
fun CvPrivacyDialog(vm:JobPilotViewModel,state:PilotState,onClose:()->Unit,onAccepted:(()->Unit)?=null) {
    var data by remember(state.profileId){mutableStateOf<JSONObject?>(null)}
    var error by remember{mutableStateOf("")}
    var acknowledged by remember{mutableStateOf(false)}
    var working by remember{mutableStateOf(false)}
    var confirmWithdrawal by remember{mutableStateOf(false)}
    val scope=rememberCoroutineScope()
    var locale by remember { mutableStateOf("en") }
    val bodyScroll=rememberScrollState()
    LaunchedEffect(locale) { bodyScroll.scrollTo(0) }
    fun noticeTr(zh:String,fr:String,en:String)=when(locale){"zh"->zh;"fr"->fr;else->en}
    val title=noticeTr("测试阶段简历信息使用说明","Notice relative aux CV — phase de test","CV information notice — testing phase")
    LaunchedEffect(state.profileId) {
        try {data=withContext(Dispatchers.IO){vm.api.request("/api/v1/privacy",state.profileId)}}
        catch(e:Exception){error=e.message ?: "Unable to load notice"}
    }
    fun submit(action:String) {
        scope.launch {
            working=true;error=""
            try {
                val result=withContext(Dispatchers.IO){vm.api.request("/api/v1/privacy",state.profileId,json("action" to action,"version" to data?.child("notice")?.text("version"),"acknowledged" to acknowledged,"noticeLocale" to locale))}
                data=data?.let {JSONObject(it.toString()).put("record",result.child("record"))}
                if(action=="accept"){onClose();onAccepted?.invoke()}
            } catch(e:Exception){error=e.message ?: "Request failed"}
            finally{working=false}
        }
    }
    Dialog(onDismissRequest={if(!working)onClose()},properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.fillMaxWidth().fillMaxHeight(.94f).testTag("cv-privacy-dialog"),color=MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Text(title,fontWeight=FontWeight.SemiBold,fontSize=22.sp)
                Text("Onward · V1 · ${data?.child("notice")?.text("version") ?: "…"}",style=MaterialTheme.typography.labelMedium)
                TabRow(listOf("en","fr","zh").indexOf(locale)) {
                    listOf("en" to "English","fr" to "Français","zh" to "中文").forEach { (code,label) ->
                        Tab(locale==code,{locale=code},enabled=!working,modifier=Modifier.testTag("privacy-language-$code"),text={Text(label)})
                    }
                }
                Column(Modifier.weight(1f).verticalScroll(bodyScroll),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                    data?.child("notice")?.objects("sections")?.forEachIndexed {index,section->
                        Text("${index+1}. ${section.child("title").text(locale)}",fontWeight=FontWeight.SemiBold)
                        Text(section.child("body").text(locale),fontSize=14.sp,lineHeight=21.sp)
                    }
                    data?.child("recipients")?.let {r->Hint(noticeTr("AI 分析接口：","Interface IA : ","AI analysis endpoint: ")+r.text("analysis")+"\n"+noticeTr("翻译接口：","Traduction : ","Translation endpoint: ")+r.text("translation"))}
                }
                if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
                val withdrawn=data?.child("record")?.text("withdrawnAt")?.isNotBlank()==true
                if(withdrawn) Hint(noticeTr("撤回及删除申请已登记，等待管理员处理；新上传和 AI 任务已停止。","Retrait et suppression enregistrés, en attente de traitement. Nouveaux envois et tâches IA bloqués.","Withdrawal and deletion request recorded, pending administrator action. New uploads and AI tasks are blocked."))
                else if(onAccepted!=null) {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Checkbox(acknowledged,{acknowledged=it},enabled=data!=null&&!working,modifier=Modifier.testTag("privacy-ack"))
                        Text(data?.child("notice")?.child("ack")?.text(locale) ?: "",modifier=Modifier.weight(1f),fontSize=13.sp,lineHeight=18.sp)
                    }
                    PrimaryButton(noticeTr("同意并选择简历","Accepter et choisir le CV","Accept and choose CV"),acknowledged&&data!=null&&!working){submit("accept")}
                } else if(data!=null && (data?.child("record")?.text("acceptedAt")?.isNotBlank()==true || state.snapshot.text("cv").isNotBlank())) {
                    TextButton({confirmWithdrawal=true},enabled=!working){Text(if(data?.child("record")?.text("acceptedAt")?.isNotBlank()==true)noticeTr("撤回同意并请求删除资料","Retirer l’accord et demander la suppression","Withdraw consent and request deletion")else noticeTr("请求删除我的资料","Demander la suppression de mes données","Request deletion of my data"))}
                }
                TextButton(onClose,enabled=!working,modifier=Modifier.fillMaxWidth()){Text(noticeTr("关闭","Fermer","Close"))}
            }
        }
    }
    if(confirmWithdrawal) AlertDialog(onDismissRequest={confirmWithdrawal=false},title={Text(noticeTr("撤回同意？","Retirer votre accord ?","Withdraw consent?"))},text={Text(noticeTr("新上传和 AI 任务将停止。删除请求将由管理员处理，不会立即删除。","Les nouveaux envois et tâches IA seront bloqués. La suppression nécessite un traitement par l’administrateur.","New uploads and AI tasks will stop. Deletion requires administrator action and is not immediate."))},confirmButton={TextButton({confirmWithdrawal=false;submit("withdraw")}){Text(noticeTr("确认撤回","Confirmer","Confirm withdrawal"))}},dismissButton={TextButton({confirmWithdrawal=false}){Text(noticeTr("取消","Annuler","Cancel"))}})
}
