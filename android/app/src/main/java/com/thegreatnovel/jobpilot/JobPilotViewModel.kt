package com.thegreatnovel.jobpilot

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.Locale
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
data class CvPreview(val files: List<File>, val meta: JSONObject = JSONObject(), val draftId: String? = null, val tailoredJobId: String? = null, val comparisonFiles: List<File> = emptyList())
data class TaskLaunchFeedback(val ids: List<String>, val title: String, val estimate: JSONObject, val createdAt: String)
data class PilotState(
    val loggedIn: Boolean = false, val loading: Boolean = false, val working: Boolean = false,
    val profileId: String = "", val snapshot: JSONObject = JSONObject(),
    val task: JSONObject? = null, val selectedJob: String? = null, val selectedOffer: String? = null,
    val error: String? = null, val notice: String? = null,
    val analysisLanguage: String = "en", val cvLanguage: String = "en",
    val language: String = "en", val theme: String = "system", val server: String = BuildConfig.API_BASE_URL,
    val loginPending: Boolean = false,
    val destination: JSONObject? = null, val analysisVisible: Boolean = false,
    val cvPreview: CvPreview? = null, val previewLoading: Boolean = false,
    val noticeTaskId: String? = null, val selectedJobTab: Int = 0,
    val taskLaunch: TaskLaunchFeedback? = null,
    val showWelcome: Boolean = false, val walkthroughTab: Int? = null,
    val showV1FirstRun: Boolean = false,
    val trackingStates: Map<String,String> = emptyMap(),
)
class JobPilotViewModel(app: Application) : AndroidViewModel(app) {
    val api = JobPilotApi(app)
    val analytics = ProductAnalytics(api, viewModelScope)
    private val prefs = app.getSharedPreferences("jobpilot", 0)
    private val previewMode = BuildConfig.APPLICATION_ID.endsWith(".v1")
    private fun deviceLanguage()=onwardSystemLanguage(getApplication<Application>().resources.configuration.locales[0].language)
    private val initialLanguage=if(prefs.getBoolean("languageExplicit",false))prefs.getString("language","en")?:"en" else deviceLanguage()
    private val mutable = MutableStateFlow(PilotState(loggedIn = api.token != null, profileId = prefs.getString("profile", "") ?: "", language = initialLanguage, analysisLanguage=initialLanguage, cvLanguage=prefs.getString("cvLanguage","en") ?: "en", theme = prefs.getString("theme", "system") ?: "system", server = if (previewMode) BuildConfig.API_BASE_URL else api.base, showV1FirstRun=previewMode))
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
    private var v1BootstrapVersion: String? = null
    fun watchJobDisplays(ids: Set<String>) {
        if(displayJobIds==ids)return
        displayJobIds=ids
        if(ids.isNotEmpty())refresh(silent=true)
    }
    init {
        prefs.edit().putString("language",initialLanguage).apply()
        if (previewMode) api.setBase(BuildConfig.API_BASE_URL)
        if (api.token != null) refresh()
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
    fun setForeground(value: Boolean) {
        foreground=value
        analytics.foreground(value)
        if(value) {if(!prefs.getBoolean("languageExplicit",false))appearance(language=deviceLanguage(),automatic=true);if(mutable.value.loggedIn)refresh(silent=true)}
        else trackingPending.keys.toList().forEach {flushTracking(it)}
    }
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
        if(previewMode) return
        if (tab !in 0..2 || prefs.getBoolean("onboarding_tab_${tab}_v1", false)) return
        prefs.edit().putBoolean("onboarding_tab_${tab}_v1", true).apply()
        mutable.update { it.copy(showWelcome = false, walkthroughTab = tab) }
    }
    fun dismissTabGuide() { mutable.update { it.copy(walkthroughTab = null) } }
    fun completeV1FirstRun() {
        val profile=mutable.value.profileId; val epoch=generation
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "finishOnboarding","profileId" to profile)) }
                if(epoch==generation) { generation++;refreshJob?.cancel();refreshJob=null;mutable.update { it.copy(showV1FirstRun=false,showWelcome=false,walkthroughTab=null,task=null) }; refresh(silent=true) }
            } catch(e:Exception) { if(epoch==generation) failure(e) }
        }
    }
    fun journeyLanguages(cvLanguage:String=mutable.value.cvLanguage) {
        val language=mutable.value.language
        prefs.edit().putString("cvLanguage",cvLanguage).putString("analysisLanguage",language).apply()
        mutable.update { it.copy(cvLanguage=cvLanguage,analysisLanguage=language) }
    }
    fun experienceLanguage(language:String) {
        appearance(language=language)
    }
    fun retryV1() {
        val profile=mutable.value.profileId; val epoch=generation
        viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null) }
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "retryV1","profileId" to profile)) }
                if(epoch==generation) { mutable.update { it.copy(working=false) };refresh(silent=true,retryLocalization=true) }
            } catch(e:Exception) { if(epoch==generation) failure(e) }
        }
    }
    fun previewLogin(email:String) {
        analytics.click("login_continue")
        loginJob?.cancel()
        loginJob=viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null) }
            try { val result=withContext(Dispatchers.IO) { api.request("/api/v1/session",body=json("action" to "login","email" to email)) }; acceptLogin(result) }
            catch(e:Exception) { failure(e) }
        }
    }
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
    private fun ensureV1Bootstrap(data: JSONObject, profile: String, epoch: Int) {
        val versionId=data.child("cvState").text("versionId")
        if(!data.child("v1").optBoolean("needsBootstrap") || versionId.isBlank() || v1BootstrapVersion==versionId) return
        v1BootstrapVersion=versionId
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "bootstrapV1","profileId" to profile,"uiLocale" to mutable.value.language)) }
                if(epoch==generation) { delay(250); refresh(silent=true) }
            } catch(e:Exception) {
                if(epoch==generation) { v1BootstrapVersion=null; failure(e) }
            }
        }
    }
    fun refresh(silent: Boolean = false, retryLocalization: Boolean = false) {
        if (!mutable.value.loggedIn || refreshJob?.isActive == true) return
        val epoch = generation; val profile = mutable.value.profileId
        refreshJob = viewModelScope.launch {
            if (!silent) mutable.update { it.copy(loading = true) }
            try {
                val detailQuery=if(displayJobIds.isEmpty()) "" else "&displayJobIds=${Uri.encode(displayJobIds.joinToString(","))}"
                val data = withContext(Dispatchers.IO) { api.request("/api/mobile?profileId=${Uri.encode(profile)}$detailQuery" + if(retryLocalization) "&retryLocalization=1" else "", profile) }
                if (epoch != generation) return@launch
                val actual = data.child("profile").text("id")
                prefs.edit().putString("profile", actual).apply()
                if(data.text("cv").isNotBlank()) {
                    val settings=data.child("languageSettings")
                    val insights=mutable.value.language
                    val cvLanguage=settings.text("documentLanguage",mutable.value.cvLanguage)
                    prefs.edit().putString("analysisLanguage",insights).putString("cvLanguage",cvLanguage).apply()
                    mutable.update {it.copy(analysisLanguage=insights,cvLanguage=cvLanguage)}
                }
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
                    error = failedMessage,
                    task = failed ?: it.task,
                    showV1FirstRun = if(previewMode) !data.child("v1").child("journey").optBoolean("completed") else it.showV1FirstRun,
                    taskLaunch = if(failed!=null) null else it.taskLaunch) }
                ensureV1Bootstrap(data,actual,epoch)
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
        displayJobIds=emptySet();v1BootstrapVersion=null
        detailJob?.cancel();detailJob=null;reportJob?.cancel();reportJob=null
        generation++; refreshJob?.cancel(); refreshJob = null
        prefs.edit().putString("profile", id).apply()
        mutable.update { it.copy(profileId = id, snapshot = JSONObject(), task = null, selectedJob = null, selectedOffer = null, error = null, working = false, notice = null, noticeTaskId = null, taskLaunch = null, destination = null, analysisVisible = false, cvPreview = null, previewLoading = false) }
        refresh()
    }
    fun appearance(language: String = mutable.value.language, theme: String = mutable.value.theme,automatic:Boolean=false) {
        val previous=mutable.value
        val changed=language!=previous.language
        if(!automatic && (changed||theme==previous.theme))prefs.edit().putBoolean("languageExplicit",true).apply()
        prefs.edit().putString("language", language).putString("analysisLanguage",language).putString("theme", theme).apply()
        if(!changed) { mutable.update { it.copy(theme=theme,analysisLanguage=language) };return }
        generation++;refreshJob?.cancel();refreshJob=null;detailJob?.cancel();detailJob=null;reportJob?.cancel();reportJob=null
        previewMetaJob?.cancel();previewMetaJob=null
        // Keep source material and navigation, not prose in the old locale. No POST,
        // business operation or CV version is created by this transition.
        val loading=json("profile" to previous.snapshot.child("profile"),"profiles" to previous.snapshot.optJSONArray("profiles"),"cv" to previous.snapshot.text("cv"),"cvState" to previous.snapshot.child("cvState"),"config" to previous.snapshot.child("config"),"languageSettings" to previous.snapshot.child("languageSettings"))
        mutable.update { it.copy(language=language,analysisLanguage=language,theme=theme,snapshot=loading,error=null,notice=null,noticeTaskId=null,task=null,working=false,loading=previous.loggedIn) }
        if(previous.loggedIn) {
            refresh(silent=true)
            if(previous.cvPreview!=null) refreshPreviewMetadata()
            val oldTask=previous.task
            if(oldTask?.text("kind")=="report") previous.snapshot.objects("jobs").find { it.text("id")==oldTask.text("reportJobId") }?.let { openReport(it) }
            else if(oldTask!=null) loadTask(oldTask.text("id"))
        }
    }
    fun selectJob(id: String?, tab: Int = 0) {
        if(id!=null){analytics.click("open_job");analytics.funnel("open_job")}
        detailJob?.cancel();detailJob=null
        mutable.update { it.copy(selectedJob = id, selectedOffer = null, selectedJobTab = tab) }
        if(id!=null) loadJobDetail(id)
    }
    fun selectOffer(url: String?) { if(url!=null){analytics.click("open_job");analytics.funnel("open_job")}; mutable.update { it.copy(selectedOffer = url, selectedJob = null, selectedJobTab=0, task = null) } }
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
        analytics.click("start_"+input.text("kind"));analytics.startWait(input.text("kind"))
        if(input.text("kind")=="search")analytics.funnel("choose_direction")
        if(input.text("kind")=="cv")analytics.funnel("generate_cv_started")
        val profile = mutable.value.profileId; val epoch = generation
        input.put("language", mutable.value.language)
        input.put("uiLocale", mutable.value.language)
        val silent=input.optBoolean("silent")
        viewModelScope.launch {
            val estimate = mutable.value.snapshot.child("flowEstimates").child(input.text("kind"))
            val estimateLabel = estimate.text("label", "Habituellement quelques minutes")
            if(!silent) mutable.update { it.copy(working = true, error = null, notice = "Traitement demandé · $estimateLabel", noticeTaskId = null) }
            else mutable.update { it.copy(working=true,error=null) }
            try {
                val task = withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "task", "profileId" to profile, "input" to input)) }
                analytics.returnedTask(task)
                if (epoch == generation) { refreshJob?.cancel();refreshJob=null;
                    if(silent) {
                        mutable.update {it.copy(working=false)}
                        refresh(silent=true)
                    } else {
                        mutable.update { it.copy(working = false) }
                        if (task.text("status") == "completed" || task.text("status") == "failed") openTaskResult(task)
                        else if(previewMode) mutable.update {it.copy(notice=null,noticeTaskId=task.text("id"))}
                        else if(input.text("kind") in aiTaskKinds) mutable.update { it.copy(notice = null, noticeTaskId = task.text("id"), taskLaunch = TaskLaunchFeedback(listOf(task.text("id")),task.text("title",input.text("kind")),task.child("estimate").takeIf { value -> value.length()>0 } ?: estimate,task.text("createdAt",java.time.Instant.now().toString()))) }
                        else mutable.update { it.copy(notice = task.text("title") + " · " + task.child("estimate").text("label", estimateLabel), noticeTaskId = task.text("id")) }
                        refresh(silent = true)
                    }
                }
            } catch (e: Exception) { if (epoch == generation) {analytics.finishWait(input.text("kind"),"failed");failure(e)} }
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
    fun upload(uri: Uri, contractTypes: List<String>? = null, searchArea:JSONObject?=null) {
        analytics.click("upload_cv");analytics.startWait("analysis")
        val prior=mutable.value
        generation++; refreshJob?.cancel(); refreshJob=null; detailJob?.cancel(); reportJob?.cancel()
        val profile=prior.profileId;val epoch=generation
        mutable.update { it.copy(working=true,error=null,notice=null,task=null,selectedJob=null,selectedOffer=null,showV1FirstRun=previewMode,snapshot=json("profile" to prior.snapshot.child("profile"))) }
        viewModelScope.launch {
            try {
                val task=withContext(Dispatchers.IO) { api.upload(uri,profile,contractTypes,searchArea) }
                analytics.funnel("upload_cv")
                if(epoch==generation) {
                    refreshJob?.cancel();refreshJob=null
                    mutable.update { it.copy(working=false,loading=previewMode,task=if(previewMode)null else task) }
                    refresh(silent=true)
                }
            } catch(e:Exception) { if(epoch==generation) {analytics.finishWait("analysis","failed");failure(e)} }
        }
    }
    private val trackingPending=mutableMapOf<String,JSONObject>()
    private val trackingTimers=mutableMapOf<String,Job>()
    private val trackingLocks=mutableMapOf<String,Mutex>()
    private val trackingTargets=mutableMapOf<String,JSONObject>()
    fun trackingKey(job:JSONObject,offer:JSONObject?=null)=mutable.value.profileId+":"+(offer?.text("url")?.takeIf {it.isNotBlank()}?:job.text("url").ifBlank {job.text("id")})
    fun queueTracking(job:JSONObject,offer:JSONObject?,change:JSONObject,immediate:Boolean=false) {
        val key=trackingKey(job,offer)
        if(!trackingTargets.containsKey(key))trackingTargets[key]=json("profileId" to mutable.value.profileId,"id" to job.text("id"),"offer" to (offer?:JSONObject()))
        val pending=trackingPending.getOrPut(key){JSONObject()}
        change.keys().forEach {pending.put(it,change.get(it))}
        mutable.update {it.copy(trackingStates=it.trackingStates+(key to "saving"))}
        trackingTimers.remove(key)?.cancel()
        if(immediate)flushTracking(key)else trackingTimers[key]=viewModelScope.launch {delay(450);trackingTimers.remove(key);persistTracking(key)}
    }
    fun flushTracking(key:String) {trackingTimers.remove(key)?.cancel();viewModelScope.launch {persistTracking(key)}}
    private suspend fun persistTracking(key:String) {
        trackingLocks.getOrPut(key){Mutex()}.withLock {
            val target=trackingTargets[key]?:return@withLock
            val patch=trackingPending.remove(key)?:return@withLock
            val profile=target.text("profileId")
            try {
                val result=withContext(Dispatchers.IO){api.request("/api/mobile",profile,json("action" to if(target.text("id").isBlank())"trackOffer" else "updateJob","profileId" to profile,"id" to target.text("id"),"offer" to target.child("offer"),"change" to patch))}
                result.child("job").text("id").takeIf {it.isNotBlank()}?.let {target.put("id",it)}
                val pending=trackingPending[key]?.length()?:0
                mutable.update {it.copy(trackingStates=it.trackingStates+(key to if(pending>0)"saving" else "saved"))}
                if(mutable.value.profileId==profile)refresh(silent=true)
            } catch(error:Exception) {
                val newer=trackingPending[key]
                newer?.keys()?.forEach {patch.put(it,newer.get(it))}
                trackingPending[key]=patch
                mutable.update {it.copy(trackingStates=it.trackingStates+(key to "failed"),error=when(it.language){"zh"->"自动保存失败，改动仍保留，请重试。";"fr"->"Échec de la sauvegarde. Vos modifications sont conservées.";else->"Autosave failed. Your edits are retained. Please retry."})}
            }
        }
    }
    fun updateJob(id: String, change: JSONObject) = writeAction(json("action" to "updateJob", "id" to id, "change" to change))
    fun saveOffer(offer: JSONObject) = writeAction(json("action" to "saveOffer", "offer" to offer))
    fun trackOffer(offer:JSONObject,change:JSONObject)=writeAction(json("action" to "trackOffer","offer" to offer,"change" to change))
    fun tailorOffer(offer: JSONObject) {
        analytics.click("generate_cv");analytics.funnel("generate_cv_started");analytics.startWait("cv")
        val profile=mutable.value.profileId;val epoch=generation;val language=mutable.value.language
        viewModelScope.launch {
            mutable.update { it.copy(working=true,error=null) }
            try {
                val response=withContext(Dispatchers.IO) { api.request("/api/mobile",profile,json("action" to "tailorOffer","profileId" to profile,"uiLocale" to language,"offer" to JSONObject(offer.toString()))) }
                if(epoch==generation) {
                    val task=response.child("task");analytics.returnedTask(task);val jobId=response.text("jobId")
                    mutable.update { state -> state.copy(working=false,notice=when(state.language){"zh"->"正在准备这份岗位版简历，你可以继续浏览。";"en"->"Your role-specific CV is being prepared. You can keep browsing.";else->"Votre CV ciblé se prépare. Vous pouvez continuer à naviguer."},noticeTaskId=task.text("id").takeIf(String::isNotBlank)) }
                    // Stay on the current role and tab; the next snapshot contains its CV.
                    refreshJob?.cancel();refreshJob=null;refresh(silent=true)
                }
            } catch(e:Exception) { if(epoch==generation) {analytics.finishWait("cv","failed");failure(e)} }
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
        analytics.click("preview_cv");analytics.funnel("view_cv")
        val profile = mutable.value.profileId; val epoch = generation
        val previewEpoch = ++previewGeneration
        viewModelScope.launch {
            mutable.update { it.copy(previewLoading = true, cvPreview = null, task = null, error = null) }
            try {
                val preview = withContext(Dispatchers.IO) {
                    if (job != null) {
                        val draft=tailoredDraftId?.takeIf { it.isNotBlank() }?.let { job.child("cvDraft") }
                        CvPreview(listOf(api.downloadCv(job, profile, tailoredDraftId)), if(draft!=null) JSONObject(draft.toString()) else json("title" to job.text("company"), "pages" to job.child("cv").optInt("pages")), tailoredDraftId, job.text("id"))
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
    fun loadCvComparison() {
        val preview=mutable.value.cvPreview ?: return
        val jobId=preview.tailoredJobId ?: return
        if(mutable.value.previewLoading)return
        val profile=mutable.value.profileId;val epoch=generation;val previewEpoch=previewGeneration
        viewModelScope.launch {
            mutable.update {it.copy(previewLoading=true,error=null)}
            try {
                val files=withContext(Dispatchers.IO) {
                    val source=api.base+"/api/candidatures/cv?id=${Uri.encode(jobId)}&profileId=${Uri.encode(profile)}"+(preview.draftId?.let {"&draftId=${Uri.encode(it)}"} ?: "")
                    listOf(preview.files.first(),api.downloadDocument(source+"&compare=baseline",profile).first)
                }
                if(epoch==generation && previewEpoch==previewGeneration)mutable.update {it.copy(previewLoading=false,cvPreview=it.cvPreview?.copy(comparisonFiles=files))}
            } catch(e:Exception) {if(epoch==generation && previewEpoch==previewGeneration){mutable.update {it.copy(previewLoading=false)};failure(e)}}
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
        prefs.edit().putString("profile",profile).apply()
        generation++; refreshJob?.cancel(); refreshJob = null
        mutable.update { it.copy(snapshot=JSONObject(), task=null, selectedJob=null, selectedOffer=null, showV1FirstRun=previewMode&&result.optBoolean("needsOnboarding",true), loggedIn = true, loginPending = false, working = false, server = api.base, profileId = profile, error = null, showWelcome = !previewMode && !prefs.getBoolean("onboarding_welcome_v1", false), walkthroughTab = null) }
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
        analytics.reset()
        loginJob?.cancel(); generation++; refreshJob?.cancel();refreshJob=null
        detailJob?.cancel();reportJob?.cancel();previewMetaJob?.cancel();previewGeneration++
        displayJobIds=emptySet();v1BootstrapVersion=null
        val prior=mutable.value
        mutable.value=PilotState(language=prior.language,analysisLanguage=prior.analysisLanguage,cvLanguage=prior.cvLanguage,theme=prior.theme,showV1FirstRun=previewMode,working=true)
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { api.request(if(previewMode)"/api/v1/session" else "/api/mobile-auth/logout",body=json("action" to "logout")) } }
            api.saveToken(null);prefs.edit().remove("profile").apply()
            mutable.update { it.copy(working=false) }
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
                context.startActivity(Intent.createChooser(intent, "Onward").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
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
