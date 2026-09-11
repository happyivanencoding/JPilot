package com.thegreatnovel.jobpilot

import android.os.SystemClock
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.distinctUntilChanged
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Only fixed semantic identifiers leave the client; never text, URLs or document content. */
class ProductAnalytics(private val api: JobPilotApi, private val scope: CoroutineScope) {
    private var session = UUID.randomUUID().toString()
    private var profile = ""
    private var page = ""
    private var entered = SystemClock.elapsedRealtime()
    private var foreground = true
    private var depth = 0
    private val queue = mutableListOf<JSONObject>()
    private val waits = mutableMapOf<String, Long>()
    private val observedTasks = mutableSetOf<String>()
    private val steps = mutableSetOf<String>()
    private var sending = false
    init {scope.launch {while(isActive){delay(15000);if(foreground && page.isNotBlank()){val now=SystemClock.elapsedRealtime();event("page_heartbeat","durationMs" to (now-entered),"scrollDepth" to depth);entered=now}}}}
    private fun event(type: String, vararg fields: Pair<String, Any?>) {
        queue.add(json("id" to UUID.randomUUID().toString(), "sessionId" to session, "event" to type, "page" to page.ifBlank {"login"}, "timestamp" to System.currentTimeMillis(), *fields))
        if(queue.size > 150) queue.removeAt(0)
        flush()
    }
    fun identify(value: String) {
        if(value.isBlank()) return
        if(profile.isNotBlank() && profile != value) { queue.clear(); waits.clear(); steps.clear(); observedTasks.clear();session=UUID.randomUUID().toString() }
        profile=value
        flush()
    }
    fun navigate(value: String, step: String? = null) {
        if(value != page) {
            if(foreground && page.isNotBlank()) event("page_exit", "durationMs" to (SystemClock.elapsedRealtime()-entered), "scrollDepth" to depth)
            page=value;depth=0;entered=SystemClock.elapsedRealtime()
            if(foreground) event("page_enter")
        }
        step?.let(::funnel)
    }
    fun click(action: String) { if(Regex("^[a-z][a-z0-9_]{0,63}$").matches(action)) event("click", "action" to action) }
    fun funnel(step: String) { event("funnel", "step" to step) }
    fun scroll(value: Int) {
        val bucket=(value.coerceIn(0,100)/25)*25
        if(bucket>depth && foreground) {depth=bucket;event("scroll","scrollDepth" to depth)}
    }
    private fun waitKind(kind:String)=when(kind){"deep_match"->"evaluate";"cv_review"->"cv";else->kind}
    fun startWait(kind: String) {val normalized=waitKind(kind);if(normalized in setOf("analysis","search","evaluate","cv")) waits.putIfAbsent(normalized,SystemClock.elapsedRealtime())}
    fun finishWait(kind:String,status:String) { waits.remove(waitKind(kind))?.let {event("ai_wait","kind" to waitKind(kind),"status" to status,"durationMs" to (SystemClock.elapsedRealtime()-it))} }
    fun failWaits() {waits.keys.toList().forEach {finishWait(it,"failed")}}
    fun returnedTask(task:JSONObject) {val kind=waitKind(task.text("kind"));val status=task.text("status");if(status in setOf("completed","failed") && kind !in setOf("analysis","search"))finishWait(kind,status) else {observedTasks.add(task.text("id"));startWait(kind)}}
    fun observe(snapshot:JSONObject) {
        if(!foreground)return
        snapshot.objects("tasks").forEach { task ->
            val kind=waitKind(task.text("kind"));val status=task.text("status");val id=task.text("id")
            if(status in setOf("queued","running","reconciling")) { observedTasks.add(id);startWait(kind) }
            else if(observedTasks.remove(id) && kind !in setOf("analysis","search") && snapshot.objects("tasks").none {waitKind(it.text("kind"))==kind && it.text("status") in setOf("queued","running","reconciling")}) finishWait(kind,if(status=="completed")"completed" else "failed")
        }
        val v1=snapshot.child("v1")
        listOf("analysis" to "cvProgress","search" to "searchProgress").forEach {(kind,key)->
            val status=v1.child(key).text("status")
            if(status in setOf("queued","running","reconciling"))startWait(kind)
            if(status in setOf("completed","failed"))finishWait(kind,status)
        }
    }
    fun foreground(value:Boolean) {
        if(value==foreground)return
        if(!value) {
            event("page_exit","durationMs" to (SystemClock.elapsedRealtime()-entered),"scrollDepth" to depth)
            waits.keys.toList().forEach {finishWait(it,"abandoned")}
        } else {entered=SystemClock.elapsedRealtime();event("page_enter")}
        foreground=value
    }
    fun reset() { foreground(false);profile="";queue.clear();waits.clear();steps.clear();observedTasks.clear();session=UUID.randomUUID().toString();page="";foreground=true;entered=SystemClock.elapsedRealtime() }
    private fun flush() {
        if(sending || profile.isBlank() || api.token==null || queue.isEmpty())return
        val batch=queue.take(40);queue.subList(0,batch.size).clear();val target=profile;sending=true
        scope.launch {
            var succeeded=false
            try {withContext(Dispatchers.IO){api.request("/api/analytics",target,json("events" to JSONArray(batch)))};succeeded=true}
            catch(_:Exception) { if(target==profile){queue.addAll(0,batch);while(queue.size>150)queue.removeAt(0)} }
            finally {sending=false;if(succeeded && queue.isNotEmpty())flush()}
        }
    }
}

@Composable fun analyticsListState(vm:JobPilotViewModel):LazyListState {
    val state=rememberLazyListState()
    LaunchedEffect(state) {
        snapshotFlow {
            val info=state.layoutInfo
            val last=info.visibleItemsInfo.lastOrNull()
            analyticsScrollPercent(info.totalItemsCount,last?.index?:0,last?.offset?:0,last?.size?:0,info.viewportEndOffset)
        }.distinctUntilChanged().collect {vm.analytics.scroll(it)}
    }
    return state
}
