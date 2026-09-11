package com.thegreatnovel.jobpilot

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@Composable fun CvPreviewDialog(state: PilotState,vm: JobPilotViewModel) {
    val preview = state.cvPreview
    val tailored=preview?.tailoredJobId!=null
    var compareMode by remember(preview?.tailoredJobId,preview?.draftId) { mutableIntStateOf(0) }
    var tab by remember(preview?.draftId,preview?.files,tailored) { mutableIntStateOf(if(preview?.draftId != null && !tailored) 1 else 0) }
    Dialog(onDismissRequest = vm::closePreview,properties = DialogProperties(usePlatformDefaultWidth = false,decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(),color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                Row(Modifier.padding(horizontal = 16.dp,vertical = 6.dp),verticalAlignment = Alignment.CenterVertically) {
                    Text(if(tailored) tr("检查岗位专属简历草稿","Vérifier le brouillon adapté au poste","Review tailored CV draft") else if(preview?.draftId != null) tr("检查简历草稿","Vérifier le brouillon","Review draft") else tr("简历 PDF","Votre CV · PDF","Your CV · PDF"),Modifier.weight(1f),fontSize = 20.sp,fontWeight = FontWeight.SemiBold)
                    IconButton(vm::closePreview,Modifier.testTag("close-cv-preview")) { Icon(Icons.Rounded.Close,tr("关闭","Fermer","Close")) }
                }
                if(preview?.draftId != null && !tailored) TabRow(tab) { Tab(tab == 0,{ tab = 0 },modifier=Modifier.testTag("cv-before"),text = { Text(tr("当前版本","Version actuelle","Current version")) }); Tab(tab == 1,{ tab = 1 },modifier=Modifier.testTag("cv-after"),text = { Text(tr("修改后的草稿","Brouillon proposé","Proposed draft")) }) }
                preview?.meta?.let { LocalizationNotice(it.child("localization"),vm::retryLocalization) }
                preview?.meta?.strings("warnings")?.forEach { Text(product(it),Modifier.padding(horizontal = 16.dp,vertical = 6.dp),fontSize = 12.sp,color = MaterialTheme.colorScheme.error) }
                if(state.previewLoading) Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally,verticalArrangement = Arrangement.spacedBy(12.dp)) { CircularProgressIndicator(Modifier.size(28.dp)); Hint(tr("正在打开简历","Ouverture du CV","Opening your CV")) } }
                else (if(compareMode>0) preview?.comparisonFiles?.getOrNull(compareMode-1) ?: preview?.files?.getOrNull(tab) else preview?.files?.getOrNull(tab))?.let { file -> NativePdf(file,Modifier.weight(1f).fillMaxWidth(),vm) }
                if(tailored) Column(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=6.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                    OutlinedButton({vm.analytics.click("compare_cv");if(compareMode==0){compareMode=1;vm.loadCvComparison()}else compareMode=0},Modifier.fillMaxWidth().testTag("compare-role-cv"),enabled=!state.previewLoading) {Text(if(compareMode==0)tr("对比原简历","Comparer au CV original","Compare original CV")else tr("关闭对比","Fermer la comparaison","Close comparison"))}
                    if(compareMode>0) {
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            FilterChip(compareMode==1,{compareMode=1},label={Text(tr("岗位版简历","CV ciblé","Tailored CV"))})
                            FilterChip(compareMode==2,{compareMode=2;vm.loadCvComparison()},label={Text(tr("原简历","CV original","Original CV"))})
                        }

                    }
                }
                if(tailored && preview?.draftId != null) {
                    val assessment=preview.meta.child("assessment")
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        if(!BuildConfig.APPLICATION_ID.endsWith(".v1")&&assessment.has("draftScore")) Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) { Column(Modifier.weight(1f)) { Hint(tr("当前主简历","CV actuel","Current master CV"));Text(assessment.text("baselineScore"),fontSize=28.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary) };Text("→",fontSize=20.sp);Column(Modifier.weight(1f)){Hint(tr("这个草稿","Ce brouillon","This draft"));Text(assessment.text("draftScore"),fontSize=28.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)};Pill((if(assessment.optInt("delta")>=0)"+" else "")+assessment.optInt("delta"),warm=assessment.optInt("delta")<0) }
                        if(!BuildConfig.APPLICATION_ID.endsWith(".v1")) Hint("ATS ${preview.meta.optInt("atsScore")}/100 · "+if(preview.meta.optBoolean("atsPass"))tr("通过","validé","pass")else tr("有风险待检查","alertes à vérifier","risks to review"))
                        if(!BuildConfig.APPLICATION_ID.endsWith(".v1")) Hint(tr("呈现匹配度不是录用概率，也不会改变正式岗位评分。","Le score de présentation n’est pas une probabilité d’embauche et ne modifie pas le score officiel du poste.","Presentation score is not hiring probability and does not change the formal job score."))
                        if(preview.meta.text("status")=="pending") { Button({vm.decideTailoredDraft(preview.draftId,"accept")},Modifier.fillMaxWidth().testTag("accept-tailored-draft-preview"),enabled=!state.working){Text(tr("保留这个版本","Conserver cette version","Keep this version"))};OutlinedButton({vm.decideTailoredDraft(preview.draftId,"reject")},Modifier.fillMaxWidth(),enabled=!state.working){Text(tr("不要这个版本","Refuser cette version","Reject this version"))} }
                    }
                } else if(preview?.draftId != null) {
                    val pending = preview.meta.child("draft").text("status") == "pending"
                    val layout=preview.meta.child("layout")
                    val layoutAllowed=!preview.meta.child("draft").optBoolean("globalPlan")||layout.optBoolean("acceptable")
                    Column(Modifier.padding(16.dp),verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        if(layout.length()>0)Hint(tr("${preview.meta.optInt("pages")} 页 · ${layout.optInt("lines")} 行 · ${layout.optInt("bullets")} 条描述 · ${layout.optInt("fontPt")} 磅","${preview.meta.optInt("pages")} page(s) · ${layout.optInt("lines")} lignes · ${layout.optInt("bullets")} puces · ${layout.optInt("fontPt")} pt","${preview.meta.optInt("pages")} page(s) · ${layout.optInt("lines")} lines · ${layout.optInt("bullets")} bullets · ${layout.optInt("fontPt")} pt"))
                        if(!layoutAllowed)Text(layout.strings("issues").joinToString(" "),fontSize=12.sp,color=MaterialTheme.colorScheme.error)
                        Hint(tr("请检查真实经历、页数、换行和内容。","Vérifiez les faits, les sauts de page et la lisibilité.","Check facts, page breaks and readability."))
                        if(pending) {
                            Button({vm.decideDraft(preview.draftId,"accept")},Modifier.fillMaxWidth().testTag("accept-draft"),enabled=!state.working&&layoutAllowed){Text(tr("接受并保存","Accepter et enregistrer","Accept and save"))}
                            OutlinedButton({ vm.decideDraft(preview.draftId,"reject") },Modifier.fillMaxWidth().testTag("reject-draft"),enabled = !state.working) { Text(tr("拒绝，保留原版","Refuser · garder l’original","Reject · keep original")) }
                        } else Hint(tr("已处理的历史草稿","Brouillon historique déjà traité","Historical draft already reviewed"))
                    }
                } else preview?.meta?.text("layoutNote")?.takeIf { it.isNotBlank() }?.let { Text(product(it),Modifier.padding(12.dp),fontSize = 11.sp,color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable private fun NativePdf(file: File,modifier: Modifier,vm:JobPilotViewModel) {
    val count by produceState(initialValue = 0,file) { value = withContext(Dispatchers.IO) { runCatching { PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount } }.getOrDefault(-1) } }
    LazyColumn(modifier,state=analyticsListState(vm),contentPadding = PaddingValues(12.dp),verticalArrangement = Arrangement.spacedBy(12.dp),overscrollEffect=null) {
        item { Hint(if(count < 0) tr("无法读取 PDF","Impossible de lire ce PDF","Unable to read this PDF") else tr("共 $count 页 · 双指缩放","$count pages · pincez pour zoomer","$count pages · pinch to zoom")) }
        items(maxOf(0,count),key = { "${file.absolutePath}:$it" }) { index ->
            val image by produceState<Bitmap?>(initialValue = null,file,index) {
                value = withContext(Dispatchers.IO) { runCatching {
                    PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY)).use { renderer -> renderer.openPage(index).use { page ->
                        Bitmap.createBitmap(1200,(1200f*page.height/page.width).toInt(),Bitmap.Config.ARGB_8888).also { bitmap -> bitmap.eraseColor(android.graphics.Color.WHITE); page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY) }
                    } }
                }.getOrNull() }
            }
            var scale by remember(file,index) { mutableFloatStateOf(1f) }; var x by remember(file,index) { mutableFloatStateOf(0f) }; var y by remember(file,index) { mutableFloatStateOf(0f) }
            Surface(shape = RoundedCornerShape(2.dp),shadowElevation = 1.dp) {
                val bmp = image
                if(bmp == null) Box(Modifier.fillMaxWidth().aspectRatio(210f/297f),contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(24.dp)) }
                else Image(bmp.asImageBitmap(),tr("PDF 第 ${index+1} 页","PDF · page ${index+1}","PDF · page ${index+1}"),Modifier.fillMaxWidth().aspectRatio(bmp.width.toFloat()/bmp.height).pointerInput(file,index) {
                    awaitEachGesture {
                        awaitFirstDown(requireUnconsumed = false)
                        do {
                            val event = awaitPointerEvent()
                            if(event.changes.count { it.pressed } >= 2 || scale > 1f) {
                                scale = (scale * event.calculateZoom()).coerceIn(1f,3f)
                                val pan = event.calculatePan()
                                if(scale == 1f) { x=0f;y=0f } else { x=(x+pan.x).coerceIn(-900f,900f);y=(y+pan.y).coerceIn(-1300f,1300f) }
                                event.changes.forEach { it.consume() }
                            }
                        } while(event.changes.any { it.pressed })
                    }
                }.graphicsLayer { scaleX=scale;scaleY=scale;translationX=x;translationY=y })
            }
        }
    }
}
