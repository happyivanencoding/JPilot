package com.thegreatnovel.jobpilot

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.collectLatest
import org.json.JSONObject
import org.json.JSONArray
import java.io.File

private val activeStates = setOf("queued", "running", "reconciling")
private val aiTaskKinds = setOf("evaluate", "cv", "cv_review", "analysis", "plan", "practice", "compare", "coach")
data class CvPreview(val files: List<File>, val meta: JSONObject = JSONObject(), val draftId: String? = null, val tailoredJobId: String? = null)
data class TaskLaunchFeedback(val ids: List<String>, val title: String, val estimate: JSONObject, val createdAt: String)
data class PilotState(
    val loggedIn: Boolean = false, val loading: Boolean = false, val working: Boolean = false,
    val profileId: String = "", val snapshot: JSONObject = JSONObject(),
    val task: JSONObject? = null, val selectedJob: String? = null, val selectedOffer: String? = null,
    val error: String? = null, val notice: String? = null,
    val language: String = "fr", val theme: String = "system", val server: String = BuildConfig.API_BASE_URL,
    val loginPending: Boolean = false,
    val destination: JSONObject? = null, val analysisVisible: Boolean = false,
    val cvPreview: CvPreview? = null, val previewLoading: Boolean = false,
    val noticeTaskId: String? = null, val selectedJobTab: Int = 0,
    val taskLaunch: TaskLaunchFeedback? = null,
    val showWelcome: Boolean = false, val walkthroughTab: Int? = null,
)
class JobPilotViewModel(app: Application) : AndroidViewModel(app) {
    val api = JobPilotApi(app)
    private val prefs = app.getSharedPreferences("jobpilot", 0)
    private val previewProfile = BuildConfig.PREVIEW_PROFILE.trim()
    private val previewMode = previewProfile.isNotBlank()
    private val mutable = MutableStateFlow(PilotState(loggedIn = previewMode || api.token != null, profileId = if (previewMode) previewProfile else (prefs.getString("profile", "") ?: ""), language = prefs.getString("language", "fr") ?: "fr", theme = prefs.getString("theme", "system") ?: "system", server = if (previewMode) BuildConfig.API_BASE_URL else api.base, showWelcome = (previewMode || api.token != null) && !prefs.getBoolean("onboarding_welcome_v1", false)))
    val state = mutable.asStateFlow()
    private var foreground = true
    private var generation = 0
    private var previewGeneration = 0
    private var refreshJob: Job? = null
    private var loginJob: Job? = null
    private var detailJob: Job? = null
    private var reportJob: Job? = null
    private var previewMetaJob: Job? = null
    private var displayJobIds: Set<String> = emptySet()
    fun watchJobDisplays(ids: Set<String>) {
        if(displayJobIds==ids)return
        displayJobIds=ids
        if(ids.isNotEmpty())refresh(silent=true)
    }
    init {
        if (previewMode) {
            api.setBase(BuildConfig.API_BASE_URL)
            prefs.edit().putString("profile", previewProfile).apply()
            mutable.update { it.copy(loggedIn = true, profileId = previewProfile, server = api.base) }
            refresh()
        } else if (api.token != null) refresh()
        // Feedback lifetime belongs to the operation, not to the composable that
        // happens to be visible while a PDF dialog or destination changes.
        viewModelScope.launch {
            state.map { Triple(it.profileId,it.notice,it.noticeTaskId) }.distinctUntilChanged().collectLatest { (_,notice,_) ->
                if(notice!=null){delay(3500);clearNotice()}
            }
        }
        viewModelScope.launch {
            while (isActive) {
                delay(if (mutable.value.snapshot.objects("tasks").any { it.text("status") in activeStates } || mutable.value.snapshot.child("v1").optBoolean("backgroundActive") || displayPending()) 2500 else 15000)
                if (foreground && mutable.value.loggedIn) refresh(silent = true)
            }
        }
    }
    fun setForeground(value: Boolean) { foreground = value; if (value && mutable.value.loggedIn) refresh(silent = true) }
    fun clearMessage() { mutable.update { it.copy(error = null, notice = null) } }
    fun clearNotice() { mutable.update { it.copy(notice = null, noticeTaskId = null) } }
    fun clearTaskLaunch() { mutable.update { it.copy(taskLaunch = null) } }
    fun dismissWelcome() { prefs.edit().putBoolean("onboarding_welcome_v1", true).apply(); mutable.update { it.copy(showWelcome = false) } }
    fun skipOnboarding() {
        val editor=prefs.edit().putBoolean("onboarding_welcome_v1", true)
        (0..2).forEach { editor.putBoolean("onboarding_tab_${it}_v1", true) }
        editor.apply()
        mutable.update { it.copy(showWelcome = false, walkthroughTab = null) }
    }
    fun showTabGuide(tab: Int) {
        if (tab !in 0..2 || prefs.getBoolean("onboarding_tab_${tab}_v1", false)) return
        prefs.edit().putBoolean("onboarding_tab_${tab}_v1", true).apply()
        mutable.update { it.copy(showWelcome = false, walkthroughTab = tab) }
    }
    fun dismissTabGuide() { mutable.update { it.copy(walkthroughTab = null) } }
    fun consumeDestination() { mutable.update { it.copy(destination = null) } }
    fun showAnalysis(show: Boolean = true) { mutable.update { it.copy(analysisVisible = show) } }
    fun closePreview() { previewGeneration++; previewMetaJob?.cancel(); previewMetaJob=null; mutable.update { it.copy(cvPreview = null, previewLoading = false) } }
    private fun failure(e: Throwable) {
        if (e is CancellationException) return
        if (e is ApiFailure && e.status == 401) { api.saveToken(null); mutable.update { it.copy(loggedIn = false, snapshot = JSONObject(), task = null) } }
        mutable.update { it.copy(error = ProductStrings.error(getApplication(),it.language,e.message ?: "Erreur de connexion"), loading = false, working = false) }
    }
    private fun displayPending(): Boolean {
        val s=mutable.value
        return s.snapshot.child("localization").optBoolean("pending") && !s.snapshot.child("localization").optBoolean("failed") ||
            s.snapshot.objects("jobs").any { (it.text("id")==s.selectedJob || it.text("id") in displayJobIds) && it.child("localization").optBoolean("pending") && !it.child("localization").optBoolean("failed") } ||
            s.task?.child("result")?.child("localization")?.let { it.optBoolean("pending") && !it.optBoolean("failed") } == true ||
            s.cvPreview?.meta?.child("localization")?.let { it.optBoolean("pending") && !it.optBoolean("failed") } == true
    }
    fun retryLocalization() {
        val s=mutable.value
        when {
            s.cvPreview!=null -> refreshPreviewMetadata(true)
            s.task?.text("kind")=="report" -> s.snapshot.objects("jobs").find { it.text("id")==s.task.text("reportJobId") }?.let { openReport(it,true) }
            s.task!=null -> loadTask(s.task.text("id"),true)
            s.selectedJob!=null -> loadJobDetail(s.selectedJob,true)
            else -> refresh(retryLocalization=true)
        }
    }
    fun refresh(silent: Boolean = false, retryLocalization: Boolean = false) {
        if (refreshJob?.isActive == true) return
        val epoch = generation; val profile = mutable.value.profileId
        refreshJob = viewModelScope.launch {
            if (!silent) mutable.update { it.copy(loading = true) }
            try {
                val detailQuery=if(displayJobIds.isEmpty()) "" else "&displayJobIds=${Uri.encode(displayJobIds.joinToString(","))}"
                val data = withContext(Dispatchers.IO) { api.request("/api/mobile?profileId=${Uri.encode(profile)}$detailQuery" + if(retryLocalization) "&retryLocalization=1" else "", profile) }
                if (epoch != generation) return@launch
                val actual = data.child("profile").text("id")
                prefs.edit().putString("profile", actual).apply()
                val prior = mutable.value.snapshot.objects("tasks").associateBy { it.text("id") }
                val completed = data.objects("tasks").firstOrNull { it.text("status") == "completed" && (prior[it.text("id")]?.text("status") in activeStates || (prior[it.text("id")] == null && mutable.value.noticeTaskId == it.text("id"))) }
                val failed = data.objects("tasks").firstOrNull { it.text("status") in setOf("failed","interrupted") && prior[it.text("id")]?.text("status") in activeStates }
                val failedMessage = failed?.let { task ->
                    val title = task.text("title").ifBlank { when(mutable.value.language) { "zh" -> "AI 处理失败"; "en" -> "AI processing failed"; else -> "Échec du traitement IA" } }
                    val reason = ProductStrings.error(getApplication(),mutable.value.language,task.text("error",task.text("phase")))
                    "$title · $reason"
                }
                mutable.update { it.copy(snapshot = data, profileId = actual, loading = false, loggedIn = true,
                    notice = if(failed!=null) null else completed?.text("title") ?: it.notice,
                    noticeTaskId = if(failed!=null) null else completed?.text("id") ?: it.noticeTaskId,
                    error = failedMessage ?: it.error,
                    task = failed ?: it.task,
                    taskLaunch = if(failed!=null) null else it.taskLaunch) }
                val open = mutable.value.task
                if (open != null && open.text("status") in activeStates) loadTask(open.text("id"))
                else if(open?.child("result")?.child("localization")?.optBoolean("pending")==true && !open.child("result").child("localization").optBoolean("failed")) {
                    if(open.text("kind")=="report") data.objects("jobs").find { it.text("id")==open.text("reportJobId") }?.let { openReport(it) }
                    else loadTask(open.text("id"))
                }
                mutable.value.selectedJob?.let { id -> if(data.objects("jobs").find { it.text("id")==id }?.child("localization")?.optBoolean("pending")==true) loadJobDetail(id) }
                if(mutable.value.cvPreview?.meta?.child("localization")?.let { it.optBoolean("pending") && !it.optBoolean("failed") }==true) refreshPreviewMetadata()
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun selectProfile(id: String) {
        displayJobIds=emptySet()
        detailJob?.cancel();detailJob=null;reportJob?.cancel();reportJob=null
        generation++; refreshJob?.cancel(); refreshJob = null
        prefs.edit().putString("profile", id).apply()
        mutable.update { it.copy(profileId = id, snapshot = JSONObject(), task = null, selectedJob = null, selectedOffer = null, error = null, working = false, notice = null, noticeTaskId = null, taskLaunch = null, destination = null, analysisVisible = false, cvPreview = null, previewLoading = false) }
        refresh()
    }
    fun appearance(language: String = mutable.value.language, theme: String = mutable.value.theme) {
        val previous=mutable.value
        val changed=language!=previous.language
        prefs.edit().putString("language", language).putString("theme", theme).apply()
        if(!changed) { mutable.update { it.copy(theme=theme) };return }
        generation++;refreshJob?.cancel();refreshJob=null;detailJob?.cancel();detailJob=null;reportJob?.cancel();reportJob=null
        previewMetaJob?.cancel();previewMetaJob=null
        // Keep source material and navigation, not prose in the old locale. No POST,
        // business operation or CV version is created by this transition.
        val loading=json("profile" to previous.snapshot.child("profile"),"profiles" to previous.snapshot.optJSONArray("profiles"),"cv" to previous.snapshot.text("cv"),"cvState" to previous.snapshot.child("cvState"),"config" to previous.snapshot.child("config"),"languageSettings" to previous.snapshot.child("languageSettings"))
        mutable.update { it.copy(language=language,theme=theme,snapshot=loading,error=null,notice=null,noticeTaskId=null,task=null,working=false,loading=previous.loggedIn) }
        if(previous.loggedIn) {
            refresh(silent=true)
            if(previous.cvPreview!=null) refreshPreviewMetadata()
            val oldTask=previous.task
            if(oldTask?.text("kind")=="report") previous.snapshot.objects("jobs").find { it.text("id")==oldTask.text("reportJobId") }?.let { openReport(it) }
            else if(oldTask!=null) loadTask(oldTask.text("id"))
        }
    }
    fun selectJob(id: String?, tab: Int = 0) {
        detailJob?.cancel();detailJob=null
        mutable.update { it.copy(selectedJob = id, selectedOffer = null, selectedJobTab = tab) }
        if(id!=null) loadJobDetail(id)
    }
    fun selectOffer(url: String?) { mutable.update { it.copy(selectedOffer = url, selectedJob = null, task = null) } }
    private fun loadJobDetail(id:String,retryLocalization:Boolean=false) {
        if(detailJob?.isActive==true)return
        val epoch=generation;val profile=mutable.value.profileId
        detailJob=viewModelScope.launch {
            try {
                val detail=withContext(Dispatchers.IO) {api.request("/api/mobile?profileId=${Uri.encode(profile)}&jobId=${Uri.encode(id)}" + if(retryLocalization) "&retryLocalization=1" else "",profile)}
                if(epoch==generation && mutable.value.selectedJob==id) mutable.update { s ->
                    val data=JSONObject(s.snapshot.toString())
                    data.put("jobs",JSONArray(s.snapshot.objects("jobs").map { if(it.text("id")==id) detail else it }))
                    s.copy(snapshot=data)
                }
            } catch(e:Exception) {if(epoch==generation)failure(e)}
        }
    }
    fun dismissTask() { mutable.update { it.copy(task = null) } }
    fun loadTask(id: String, retryLocalization:Boolean=false) {
        val epoch = generation; val profile = mutable.value.profileId
        viewModelScope.launch {
            try {
                val task = withContext(Dispatchers.IO) { api.request("/api/mobile?profileId=${Uri.encode(profile)}&taskId=${Uri.encode(id)}" + if(retryLocalization) "&retryLocalization=1" else "",profile) }
                if (epoch == generation) openTaskResult(task)
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun startTask(input: JSONObject) {
        val profile = mutable.value.profileId; val epoch = generation
        input.put("language", mutable.value.language)
        input.put("uiLocale", mutable.value.language)
        val silent=input.optBoolean("silent")
        viewModelScope.launch {
            val estimate = mutable.value.snapshot.child("flowEstimates").child(input.text("kind"))
            val estimateLabel = estimate.text("label", "Habituellement quelques minutes")
            if(!silent) mutable.update { it.copy(working = true, error = null, notice = "Traitement demandé · $estimateLabel", noticeTaskId = null) }
            else mutable.update { it.copy(error=null) }
            try {
                val task = withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "task", "profileId" to profile, "input" to input)) }
                if (epoch == generation) {
                    if(silent) {
                        refresh(silent=true)
                    } else {
                        mutable.update { it.copy(working = false) }
                        if (task.text("status") == "completed" || task.text("status") == "failed") openTaskResult(task)
                        else if(input.text("kind") in aiTaskKinds) mutable.update { it.copy(notice = null, noticeTaskId = task.text("id"), taskLaunch = TaskLaunchFeedback(listOf(task.text("id")),task.text("title",input.text("kind")),task.child("estimate").takeIf { value -> value.length()>0 } ?: estimate,task.text("createdAt",java.time.Instant.now().toString()))) }
                        else mutable.update { it.copy(notice = task.text("title") + " · " + task.child("estimate").text("label", estimateLabel), noticeTaskId = task.text("id")) }
                        refresh(silent = true)
                    }
                }
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun startTasks(inputs: List<JSONObject>, title: String) {
        if(inputs.isEmpty()) return
        val profile=mutable.value.profileId;val epoch=generation;val language=mutable.value.language
        viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null,notice=null) }
            try {
                val prepared=JSONArray(inputs.map { JSONObject(it.toString()).put("language",language).put("uiLocale",language) })
                val response=withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "batchTasks","profileId" to profile,"uiLocale" to language,"inputs" to prepared)) }
                if(epoch==generation) {
                    val tasks=response.objects("tasks")
                    val active=tasks.filter { it.text("status") in activeStates }
                    val slowest=active.maxByOrNull { task -> task.child("estimate").optDouble("targetSeconds",task.child("estimate").optDouble("maxSeconds",0.0)) }
                    mutable.update { state -> state.copy(working=false,taskLaunch=slowest?.let { task -> TaskLaunchFeedback(active.map { it.text("id") },title,task.child("estimate"),task.text("createdAt",java.time.Instant.now().toString())) },notice=if(active.isEmpty()) title else null,noticeTaskId=active.firstOrNull()?.text("id")) }
                    refresh(silent=true)
                }
            } catch(e:Exception) { if(epoch==generation) failure(e) }
        }
    }
    fun saveOffers(offers: List<JSONObject>) {
        if(offers.isEmpty()) return
        val profile=mutable.value.profileId;val epoch=generation
        viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null) }
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "saveOffers","profileId" to profile,"offers" to JSONArray(offers))) }
                if(epoch==generation) { mutable.update { it.copy(working=false,notice=when(it.language){"zh"->"已收藏 ${offers.size} 个岗位";"en"->"Saved ${offers.size} roles";else->"${offers.size} offres enregistrées"},noticeTaskId=null) };refresh(silent=true) }
            } catch(e:Exception) { if(epoch==generation) failure(e) }
        }
    }
    fun upload(uri: Uri) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true, notice = "Import du CV…", error = null) }
            try {
                val task = withContext(Dispatchers.IO) { api.upload(uri, profile) }
                if (epoch == generation) {
                    mutable.update { it.copy(working = false, notice = "Import en cours · retrouvez-le dans les traitements", noticeTaskId = task.text("id")) }
                    if(task.text("status") == "completed") openTaskResult(task)
                    refresh(silent = true)
                }
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun updateJob(id: String, change: JSONObject) = writeAction(json("action" to "updateJob", "id" to id, "change" to change))
    fun saveOffer(offer: JSONObject) = writeAction(json("action" to "saveOffer", "offer" to offer))
    fun tailorOffer(offer: JSONObject) {
        val profile=mutable.value.profileId;val epoch=generation;val language=mutable.value.language
        viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null) }
            try {
                val response=withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "tailorOffer","profileId" to profile,"uiLocale" to language,"offer" to JSONObject(offer.toString()))) }
                if(epoch==generation) {
                    val task=response.child("task");val jobId=response.text("jobId")
                    mutable.update { state -> state.copy(working=false,notice=when(state.language){"zh"->"正在准备这份岗位版简历，你可以继续浏览。";"en"->"Your role-specific CV is being prepared. You can keep browsing.";else->"Votre CV ciblé se prépare. Vous pouvez continuer à naviguer."},noticeTaskId=task.text("id").takeIf(String::isNotBlank)) }
                    selectOffer(null)
                    if(task.text("status")=="completed") { mutable.update { it.copy(destination=json("tab" to 2)) };selectJob(jobId.takeIf(String::isNotBlank),1) }
                    refresh(silent=true)
                }
            } catch(e:Exception) { if(epoch==generation) failure(e) }
        }
    }
    private fun writeAction(body: JSONObject) {
        val profile = mutable.value.profileId; val epoch = generation
        body.put("profileId",profile)
        viewModelScope.launch {
            mutable.update { it.copy(working = true, error = null) }
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,body) }
                if (epoch == generation) { mutable.update { it.copy(working = false, notice = "Enregistré", noticeTaskId = null) }; refresh(silent = true) }
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun confirmCv(taskId: String, content: String) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true, error = null) }
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile", profile, json("action" to "confirmCv", "profileId" to profile, "taskId" to taskId, "confirmed" to true, "content" to content, "expectedVersionId" to mutable.value.snapshot.child("cvState").text("versionId"))) }
                if (epoch == generation) {
                    mutable.update { state -> state.copy(working = false, task = null, notice = when(state.language){"zh"->"主简历已保存。职业方向和首批岗位会在后台自动更新。";"en"->"Master CV saved. Career directions and initial roles will update automatically in the background.";else->"CV de référence enregistré. Les directions et premières offres se mettent à jour automatiquement."}, noticeTaskId = null) }
                    refresh(silent = true)
                }
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    fun saveCv(content: String) = saveSettings("/api/cv", json("content" to content, "expectedVersionId" to mutable.value.snapshot.child("cvState").text("versionId")))
    fun saveProfile(body: JSONObject) = saveSettings("/api/profile", body)
    private fun saveSettings(route: String, body: JSONObject) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true) }
            try {
                withContext(Dispatchers.IO) { api.request(route,profile,body) }
                if (epoch == generation) { mutable.update { it.copy(working = false, notice = "Enregistré", noticeTaskId = null) }; refresh(silent = true) }
            } catch (e: Exception) { if (epoch == generation) failure(e) }
        }
    }
    private fun openTaskResult(task: JSONObject) {
        if (task.text("status") in activeStates) {
            mutable.update { it.copy(notice = task.text("title") + " · " + task.child("estimate").text("label", "Traitement en cours"), noticeTaskId = null) }
            return
        }
        if (task.text("status") != "completed") { mutable.update { it.copy(task = task) }; return }
        val destination = task.child("destination")
        when (task.text("kind")) {
            "analysis" -> mutable.update { it.copy(analysisVisible = true, task = null) }
            "rewrite" -> openCvPreview(draftId = task.child("result").text("draftId"))
            "search" -> mutable.update { it.copy(destination = json("tab" to 1), task = null, selectedJob = null) }
            "evaluate" -> {
                mutable.update { it.copy(destination = json("tab" to 2), task = null) }
                selectJob(destination.text("jobId").takeIf(String::isNotBlank))
            }
            "cv","cv_review" -> {
                val id = destination.text("jobId", task.child("result").text("jobId"))
                mutable.update { it.copy(destination = json("tab" to 2), task = null) }
                selectJob(id.takeIf(String::isNotBlank),1)
            }
            "plan" -> mutable.update { it.copy(destination = json("tab" to 2), task = task) }
            else -> mutable.update { it.copy(task = task) }
        }
    }
    fun openReport(job: JSONObject, retryLocalization:Boolean=false) {
        if(reportJob?.isActive==true)return
        val profile = mutable.value.profileId; val epoch = generation
        reportJob=viewModelScope.launch {
            try {
                val report = withContext(Dispatchers.IO) { api.request("/api/mobile?profileId=${Uri.encode(profile)}&reportJobId=${Uri.encode(job.text("id"))}" + if(retryLocalization) "&retryLocalization=1" else "",profile) }
                if(epoch == generation) mutable.update { it.copy(task = json("id" to "report-${job.text("id")}","kind" to "report","reportJobId" to job.text("id"),"status" to "completed","phase" to job.text("company"),"result" to report)) }
            } catch(e: Exception) { if(epoch == generation) failure(e) }
        }
    }
    fun openCvPreview(draftId: String? = null, job: JSONObject? = null, tailoredDraftId: String? = null) {
        val profile = mutable.value.profileId; val epoch = generation
        val previewEpoch = ++previewGeneration
        viewModelScope.launch {
            mutable.update { it.copy(previewLoading = true, cvPreview = null, task = null, error = null) }
            try {
                val preview = withContext(Dispatchers.IO) {
                    if (job != null) {
                        val draft=tailoredDraftId?.takeIf { it.isNotBlank() }?.let { job.child("cvDraft") }
                        CvPreview(listOf(api.downloadCv(job, profile, tailoredDraftId)), if(draft!=null) JSONObject(draft.toString()) else json("title" to job.text("company"), "pages" to job.child("cv").optInt("pages")), tailoredDraftId, if(draft!=null)job.text("id") else null)
                    }
                    else {
                        val suffix = "?profileId=${Uri.encode(profile)}" + (draftId?.takeIf(String::isNotBlank)?.let { "&draftId=${Uri.encode(it)}" } ?: "")
                        val meta = api.request("/api/mobile/cv$suffix&format=meta", profile)
                        val proposed = api.downloadDocument(api.base + "/api/mobile/cv$suffix",profile).first
                        val files = if (draftId != null) {
                            val baseId = meta.child("draft").text("baseVersionId")
                            listOf(api.downloadDocument(api.base + "/api/mobile/cv?profileId=${Uri.encode(profile)}&versionId=${Uri.encode(baseId)}",profile).first, proposed)
                        } else listOf(proposed)
                        CvPreview(files,meta,draftId)
                    }
                }
                if (epoch == generation && previewEpoch == previewGeneration && mutable.value.previewLoading) mutable.update { it.copy(cvPreview = preview, previewLoading = false) }
            } catch (e: Exception) { if (epoch == generation) { mutable.update { it.copy(previewLoading = false) }; failure(e) } }
        }
    }
    private fun refreshPreviewMetadata(retry:Boolean=false) {
        if(previewMetaJob?.isActive==true)return
        val preview=mutable.value.cvPreview ?: return
        // Tailored job PDFs have no preview-layout metadata endpoint to poll.
        if(preview.tailoredJobId!=null || (!preview.meta.has("layoutNote") && !preview.meta.has("draft")))return
        val epoch=generation;val previewEpoch=previewGeneration;val profile=mutable.value.profileId
        previewMetaJob=viewModelScope.launch {
            try {
                val suffix="?profileId=${Uri.encode(profile)}&format=meta"+(preview.draftId?.let { "&draftId=${Uri.encode(it)}" } ?: "")+if(retry) "&retryLocalization=1" else ""
                val meta=withContext(Dispatchers.IO) { api.request("/api/mobile/cv$suffix",profile) }
                if(epoch==generation && previewEpoch==previewGeneration) mutable.update { it.copy(cvPreview=it.cvPreview?.copy(meta=meta)) }
            } catch(e:Exception) { if(epoch==generation)failure(e) }
        }
    }
    fun decideDraft(id: String, decision: String) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true, error = null) }
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "decideCvDraft","profileId" to profile,"draftId" to id,"decision" to decision)) }
                if (epoch == generation) {
                    mutable.update { it.copy(working = false, cvPreview = null, notice = if(decision == "accept") "CV enregistré · suggestions résolues" else "Brouillon refusé · CV inchangé", noticeTaskId = null) }
                    refresh(silent = true)
                }
            } catch (e: Exception) { if(epoch == generation) failure(e) }
        }
    }
    fun updateTailoredDraft(id:String,payload:JSONObject) {
        val profile=mutable.value.profileId;val epoch=generation
        viewModelScope.launch { mutable.update { it.copy(working=true,error=null) };try {
            withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "updateTailoredCvDraft","profileId" to profile,"draftId" to id,"payload" to payload)) }
            if(epoch==generation){mutable.update { state -> state.copy(working=false,notice=when(state.language){"zh"->"草稿已保存，呈现分正在后台自动更新。";"en"->"Draft saved. The presentation score is updating automatically in the background.";else->"Brouillon enregistré. Le score de présentation se met à jour automatiquement."},noticeTaskId=null) };refresh(silent=true)}
        } catch(e:Exception){if(epoch==generation)failure(e)} }
    }
    fun decideTailoredDraft(id:String,decision:String) {
        val profile=mutable.value.profileId;val epoch=generation
        viewModelScope.launch { mutable.update { it.copy(working=true,error=null) };try {
            withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "decideTailoredCvDraft","profileId" to profile,"draftId" to id,"decision" to decision)) }
            if(epoch==generation){mutable.update { it.copy(working=false,cvPreview=null,notice=if(decision=="accept")"Version de CV conservée" else "Brouillon refusé",noticeTaskId=null) };refresh(silent=true)}
        } catch(e:Exception){if(epoch==generation)failure(e)} }
    }

    fun useServer(value: String) {
        try { api.setBase(value); mutable.update { it.copy(server = api.base, error = null) }; refresh() } catch (e: Exception) { failure(e) }
    }
    fun usbLogin() {
        if (!BuildConfig.DEBUG) return
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            mutable.update { it.copy(working = true, error = null) }
            try {
                api.setBase("http://127.0.0.1:3002")
                val result = withContext(Dispatchers.IO) { api.request("/api/mobile-auth/dev", body = json()) }
                acceptLogin(result)
            } catch (e: Exception) { failure(e) }
        }
    }
    private fun acceptLogin(result: JSONObject) {
        val token = result.text("token"); require(token.isNotBlank())
        api.saveToken(token)
        val profile = result.strings("profiles").firstOrNull() ?: ""
        generation++; refreshJob?.cancel(); refreshJob = null
        mutable.update { it.copy(loggedIn = true, loginPending = false, working = false, server = api.base, profileId = profile, error = null, showWelcome = !prefs.getBoolean("onboarding_welcome_v1", false), walkthroughTab = null) }
        refresh()
    }
    fun beginLogin(openBrowser: (String) -> Unit) {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            mutable.update { it.copy(working = true, error = null) }
            try {
                api.setBase(BuildConfig.API_BASE_URL)
                val pair = withContext(Dispatchers.IO) { api.request("/api/mobile-auth/start",body = json()) }
                mutable.update { it.copy(loginPending = true, working = false, server = api.base) }
                openBrowser(pair.text("url"))
                repeat(180) {
                    delay(2500)
                    val result = withContext(Dispatchers.IO) { api.request("/api/mobile-auth/exchange",body = json("requestId" to pair.text("requestId"), "verifier" to pair.text("verifier"))) }
                    if (result.has("token")) { acceptLogin(result); return@launch }
                }
                mutable.update { it.copy(loginPending = false, error = "Connexion expirée. Réessayez.") }
            } catch (e: Exception) { mutable.update { it.copy(loginPending = false) }; failure(e) }
        }
    }
    fun logout() {
        loginJob?.cancel(); generation++; refreshJob?.cancel(); refreshJob = null
        if (previewMode) {
            api.saveToken(null)
            api.setBase(BuildConfig.API_BASE_URL)
            prefs.edit().putString("profile", previewProfile).apply()
            mutable.update { it.copy(loggedIn = true, profileId = previewProfile, server = api.base, snapshot = JSONObject(), task = null, selectedJob = null, working = false, showWelcome = false, walkthroughTab = null) }
            refresh()
            return
        }
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { api.request("/api/mobile-auth/logout",body = json()) } }
            api.saveToken(null)
            android.webkit.CookieManager.getInstance().removeAllCookies(null)
            mutable.update { it.copy(loggedIn = false, snapshot = JSONObject(), task = null, selectedJob = null, working = false, showWelcome = false, walkthroughTab = null) }
        }
    }
    fun shareDocument(url: String) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true) }
            try {
                val (file, mime) = withContext(Dispatchers.IO) { api.downloadDocument(url, profile) }
                if (epoch != generation) return@launch
                val context = getApplication<Application>()
                val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
                val intent = Intent(Intent.ACTION_SEND).apply { type = mime; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                context.startActivity(Intent.createChooser(intent, "JobPilot").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                mutable.update { it.copy(working = false) }
            } catch (e: Exception) { failure(e) }
        }
    }
    fun shareCv(job: JSONObject) {
        val profile = mutable.value.profileId; val epoch = generation
        viewModelScope.launch {
            mutable.update { it.copy(working = true) }
            try {
                val file = withContext(Dispatchers.IO) { api.downloadCv(job,profile) }
                if (epoch != generation) return@launch
                val context = getApplication<Application>()
                val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
                val intent = Intent(Intent.ACTION_SEND).apply { type = "application/pdf"; putExtra(Intent.EXTRA_STREAM,uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                context.startActivity(Intent.createChooser(intent,"CV adapté").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                mutable.update { it.copy(working = false) }
            } catch (e: Exception) { failure(e) }
        }
    }
}
