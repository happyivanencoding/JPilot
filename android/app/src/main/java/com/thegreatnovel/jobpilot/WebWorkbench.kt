package com.thegreatnovel.jobpilot

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.*
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** Advanced Web-only controls stay available; primary workflows are native Compose. */
@Composable fun WebWorkbench(vm: JobPilotViewModel,state: PilotState,route: String,onClose: () -> Unit) {
    val context = LocalContext.current
    var web by remember { mutableStateOf<WebView?>(null) }
    var chooser by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var progress by remember { mutableFloatStateOf(0f) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode,result.data)); chooser = null
    }
    val origin = Uri.parse(vm.api.base)
    Dialog(onDismissRequest = onClose,properties = DialogProperties(usePlatformDefaultWidth = false,decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp),verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    IconButton({ if(web?.canGoBack() == true) web?.goBack() else onClose() }) { Icon(Icons.AutoMirrored.Rounded.ArrowBack,tr("返回","Retour","Back")) }
                    Text(tr("完整工作台","Poste de pilotage complet","Full workbench"),Modifier.weight(1f))
                    IconButton(onClose) { Icon(Icons.Rounded.Close,tr("关闭","Fermer","Close")) }
                }
                if(progress < 1f) LinearProgressIndicator(progress = { progress },modifier = Modifier.fillMaxWidth())
                AndroidView(modifier = Modifier.fillMaxWidth().weight(1f),factory = { ctx ->
                    WebView(ctx).apply {
                        web = this
                        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                        settings.setSupportMultipleWindows(false)
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView,request: WebResourceRequest): Boolean {
                                val uri = request.url
                                if(uri.scheme == origin.scheme && uri.host == origin.host && uri.port == origin.port) {
                                    if (uri.path in listOf("/api/cv-pdf", "/api/candidatures/cv")) { vm.shareDocument(uri.toString()); return true }
                                    return false
                                }
                                if(uri.scheme in listOf("https","http","mailto")) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW,uri)) }
                                return true
                            }
                        }
                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView,newProgress: Int) { progress = newProgress / 100f }
                            override fun onShowFileChooser(view: WebView,callback: ValueCallback<Array<Uri>>,params: FileChooserParams): Boolean {
                                chooser?.onReceiveValue(null); chooser = callback
                                return try { picker.launch(params.createIntent()); true } catch (_: Exception) { chooser?.onReceiveValue(null); chooser = null; false }
                            }
                        }
                        setDownloadListener { url,_,_,_,_ -> vm.shareDocument(url) }
                        val cookies = CookieManager.getInstance()
                        cookies.setAcceptCookie(true); cookies.setAcceptThirdPartyCookies(this,false)
                        val secure = if(origin.scheme == "https") "; Secure" else ""
                        cookies.setCookie(vm.api.base,"jobpilot_session=${vm.api.token}; Path=/; HttpOnly; SameSite=Lax$secure") {
                            cookies.setCookie(vm.api.base,"career-ops-profile=${state.profileId}; Path=/; SameSite=Lax$secure") { loadUrl(vm.api.base + route) }
                        }
                    }
                },onRelease = { it.stopLoading(); it.destroy(); web = null })
            }
        }
        BackHandler { if(web?.canGoBack() == true) web?.goBack() else onClose() }
    }
}
