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
    var tab by remember(preview?.draftId,preview?.files) { mutableIntStateOf(if(preview?.draftId != null) 1 else 0) }
    Dialog(onDismissRequest = vm::closePreview,properties = DialogProperties(usePlatformDefaultWidth = false,decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(),color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                Row(Modifier.padding(horizontal = 16.dp,vertical = 6.dp),verticalAlignment = Alignment.CenterVertically) {
                    Text(if(preview?.draftId != null) tr("检查简历草稿","Vérifier le brouillon","Review draft") else tr("简历 PDF","Votre CV · PDF","Your CV · PDF"),Modifier.weight(1f),fontSize = 20.sp,fontWeight = FontWeight.SemiBold)
                    IconButton(vm::closePreview,Modifier.testTag("close-cv-preview")) { Icon(Icons.Rounded.Close,tr("关闭","Fermer","Close")) }
                }
                if(preview?.draftId != null) TabRow(tab) { Tab(tab == 0,{ tab = 0 },modifier=Modifier.testTag("cv-before"),text = { Text(tr("当前版本","Version actuelle","Current version")) }); Tab(tab == 1,{ tab = 1 },modifier=Modifier.testTag("cv-after"),text = { Text(tr("修改后的草稿","Brouillon proposé","Proposed draft")) }) }
                preview?.meta?.let { LocalizationNotice(it.child("localization"),vm::retryLocalization) }
                preview?.meta?.strings("warnings")?.forEach { Text(product(it),Modifier.padding(horizontal = 16.dp,vertical = 6.dp),fontSize = 12.sp,color = MaterialTheme.colorScheme.error) }
                if(state.previewLoading) Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally,verticalArrangement = Arrangement.spacedBy(12.dp)) { CircularProgressIndicator(Modifier.size(28.dp)); Hint(tr("正在读取实际 PDF","Chargement du PDF réel","Loading the actual PDF")) } }
                else preview?.files?.getOrNull(tab)?.let { file -> NativePdf(file,Modifier.weight(1f).fillMaxWidth()) }
                if(preview?.draftId != null) {
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

@Composable private fun NativePdf(file: File,modifier: Modifier) {
    val count by produceState(initialValue = 0,file) { value = withContext(Dispatchers.IO) { runCatching { PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount } }.getOrDefault(-1) } }
    LazyColumn(modifier,contentPadding = PaddingValues(12.dp),verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
