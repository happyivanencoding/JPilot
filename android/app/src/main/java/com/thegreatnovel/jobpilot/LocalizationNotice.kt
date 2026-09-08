package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

@Composable fun LocalizationNotice(localization: JSONObject, onRetry: () -> Unit) {
    if (!localization.optBoolean("pending")) return
    Column(Modifier.fillMaxWidth().testTag("localization-status").padding(horizontal=16.dp,vertical=8.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
        Text(localization.text("message",tr("正在翻译已有结果，不会重新分析。","Traduction du résultat enregistré, sans nouvelle analyse.","Translating the saved result, without reanalysis.")),fontSize=12.sp)
        if(localization.optBoolean("failed")) TextButton(onRetry,Modifier.testTag("retry-localization")) { Text(tr("重试显示翻译","Réessayer la traduction","Retry translation")) }
        else LinearProgressIndicator(Modifier.fillMaxWidth())
    }
}
