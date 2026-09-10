package com.thegreatnovel.jobpilot

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.view.KeyEvent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Opt-in physical-device acceptance. Supply two existing fictional profile IDs explicitly.
 * Generates one pending tailored CV and rejects it; never sends an application or edits a master CV.
 */
class OwnedCoreDeviceAcceptanceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val args = InstrumentationRegistry.getArguments()
    private val primary = requireNotNull(args.getString("primaryProfile")) { "An existing synthetic primaryProfile is required" }
    private val secondary = requireNotNull(args.getString("secondaryProfile")) { "An existing synthetic secondaryProfile is required" }
    private val prefs = instrumentation.targetContext.getSharedPreferences("jobpilot", 0)
    private val originalProfile = prefs.getString("profile", "") ?: ""
    private val originalLanguage = prefs.getString("language", "zh") ?: "zh"
    private val originalTheme = prefs.getString("theme", "system") ?: "system"
    init {
        require(args.getString("allowSyntheticAi") == "yes") { "Explicit synthetic AI acceptance consent is required" }
        prefs.edit().putString("profile", primary).putString("language", "zh").commit()
    }
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    private val vm get() = ViewModelProvider(rule.activity)[JobPilotViewModel::class.java]
    private fun state() = vm.state.value
    private val api get() = vm.api
    private fun folder() = File(rule.activity.getExternalFilesDir(null), "owned-core-device").apply { mkdirs() }
    private fun record(name: String, detail: JSONObject = JSONObject()) {
        File(folder(), "events.jsonl").appendText(json("check" to name, "at" to System.currentTimeMillis(), "version" to BuildConfig.VERSION_NAME, "profile" to state().profileId, "detail" to detail).toString() + "\n")
    }
    private fun await(timeout: Long = 60000, condition: () -> Boolean) = rule.waitUntil(timeout, condition)
    private fun shot(name: String) {
        rule.waitForIdle(); Thread.sleep(350)
        instrumentation.uiAutomation.takeScreenshot()?.let { image ->
            File(folder(), "$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
    private fun back() { instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK); rule.waitForIdle() }
    private fun snapshot(id: String = state().profileId) = api.request("/api/mobile?profileId=$id", id)
    private fun profile(id: String) {
        rule.onNodeWithTag("profile-switch").performClick()
        rule.onNodeWithTag("profile-$id").performClick()
        await { state().profileId == id && !state().loading && state().snapshot.child("profile").text("id") == id }
    }
    private fun locale(code: String) {
        rule.onNodeWithTag("nav-4").performClick()
        rule.onNodeWithTag("profile-content").performScrollToNode(hasTestTag("ui-language-$code"))
        rule.onNodeWithTag("ui-language-$code").performClick()
        await { state().language == code && !state().loading && state().snapshot.child("languageSettings").text("uiLocale") == code }
        rule.onNodeWithTag("ui-language-$code").assertIsSelected()
    }
    private fun currentJob(id: String) = state().snapshot.objects("jobs").first { it.text("id") == id }
    private fun preview(name: String) {
        await { !state().previewLoading && (state().cvPreview != null || state().error != null) }
        assertNull(state().error)
        val file = state().cvPreview!!.files.first()
        val pages = PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount }
        assertTrue(pages > 0)
        file.copyTo(File(folder(), "$name.pdf"), overwrite = true)
        await { rule.onAllNodesWithContentDescription("PDF 第 1 页").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithContentDescription("PDF 第 1 页").assertIsDisplayed()
        shot(name)
        record("native-pdf", json("name" to name, "pages" to pages, "bytes" to file.length(), "server" to api.base))
        rule.onNodeWithTag("close-cv-preview").performClick()
    }

    @Test fun renderedDocumentsAndKeyboardWithoutNewAi() {
        try {
            await { state().loggedIn && !state().loading && state().snapshot.child("profile").text("id") == primary }
            assertEquals("https://jobs.thegreatnovel.com", api.base)
            rule.runOnUiThread { vm.openCvPreview() }
            preview("master-cv-rendered")
            val jobId = requireNotNull(args.getString("previewJobId"))
            val job = currentJob(jobId)
            assertEquals("rejected", job.child("cvDraft").text("status"))
            rule.runOnUiThread { vm.openCvPreview(job = job, tailoredDraftId = job.child("cvDraft").text("id")) }
            preview("fixed-tailored-cv-rendered")
            profile(secondary)
            val planned = state().snapshot.objects("jobs").first { it.child("mobilePlan").text("markdown").isNotBlank() && it.child("interview").objects("questions").isNotEmpty() }
            rule.runOnUiThread { vm.selectJob(planned.text("id"), 2) }
            rule.onNodeWithTag("job-tab-2").performClick()
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("toggle-interview-plan"))
            rule.onNodeWithTag("toggle-interview-plan").performClick()
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("practice-this-question"))
            rule.onAllNodesWithTag("practice-this-question").onFirst().performClick()
            rule.onNodeWithText("针对性模拟").assertIsDisplayed()
            val answer = rule.onAllNodes(hasSetTextAction()).onLast()
            answer.performScrollTo().assertIsDisplayed().performClick()
            answer.performTextInput("QA_VISIBLE_ANSWER")
            Thread.sleep(1500)
            answer.assertIsDisplayed()
            shot("keyboard-real-click")
            record("keyboard-real-click", json("answer" to "QA_VISIBLE_ANSWER", "screenshotReviewRequired" to true))
            back(); back()
            File(folder(), "visual-summary.json").writeText(json("passed" to true, "newBusinessAiCalls" to 0, "pdfBitmapVisible" to true, "answerInputReceived" to true).toString(2))
        } catch (error: Throwable) {
            runCatching { shot("visual-failure") }
            record("visual-failed", json("error" to error.toString(), "appError" to state().error))
            throw error
        } finally {
            rule.runOnUiThread { vm.closePreview(); vm.selectJob(null); vm.showAnalysis(false); vm.clearTaskLaunch(); vm.appearance(language = originalLanguage, theme = originalTheme); if (originalProfile.isNotBlank()) vm.selectProfile(originalProfile) }
            prefs.edit().putString("profile", originalProfile).putString("language", originalLanguage).putString("theme", originalTheme).commit()
        }
    }

    @Test fun installedClientUsesRemoteOwnedBackend() {
        try {
            await { state().loggedIn && !state().loading && state().snapshot.child("profile").text("id") == primary }
            assertEquals("https://jobs.thegreatnovel.com", api.base)
            val profiles = state().snapshot.objects("profiles")
            for (id in listOf(primary, secondary)) {
                val entry = profiles.first { it.text("id") == id }
                assertTrue("Only explicitly fictional profiles are allowed", Regex("test|synthetic|fictif", RegexOption.IGNORE_CASE).containsMatchIn(entry.text("name")))
            }
            if (state().showWelcome || state().walkthroughTab != null) {
                shot("onboarding")
                rule.onNodeWithText("跳过引导").performClick()
            }
            for (tab in 0..4) {
                rule.onNodeWithTag("nav-$tab").performClick()
                rule.onNodeWithTag("nav-$tab").assertIsSelected()
                assertNull(state().walkthroughTab)
                shot("primary-tab-$tab")
            }
            record("five-tabs-and-skip-all", json("server" to api.base, "contract" to state().snapshot.text("version")))
            val before = snapshot()
            val originalCv = before.text("cv")
            val material = before.child("languageSettings").text("applicationLanguage")
            val taskIds = before.objects("tasks").map { it.text("id") }.toSet()
            locale("fr"); shot("french-settings")
            locale("zh"); shot("chinese-settings")
            assertEquals(originalCv, state().snapshot.text("cv"))
            assertEquals(material, state().snapshot.child("languageSettings").text("applicationLanguage"))
            assertEquals(taskIds, snapshot().objects("tasks").map { it.text("id") }.toSet())
            record("locale-roundtrip-no-business-task-or-document-change")
            rule.runOnUiThread { vm.openCvPreview() }
            preview("master-cv")
            rule.onNodeWithTag("profile-content").performScrollToNode(hasTestTag("view-analysis"))
            rule.onNodeWithTag("view-analysis").performClick()
            for (tab in 0..2) { rule.onNodeWithTag("analysis-tab-$tab").performClick(); shot("analysis-$tab") }
            back()
            val job = state().snapshot.objects("jobs").first { it.text("reportNum").isNotBlank() && it.child("cvDraft").text("status") != "pending" && it.child("cv").text("file").isBlank() }
            val id = job.text("id")
            val originalSavedCv = job.child("cv").text("file")
            rule.runOnUiThread { vm.selectJob(id) }
            rule.onNodeWithTag("job-tab-0").performClick()
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("view-report"))
            rule.onNodeWithTag("view-report").performClick()
            await { state().task?.text("kind") == "report" || state().error != null }
            assertNull(state().error); shot("full-saved-report"); back()
            val reused = api.request("/api/mobile", primary, json("action" to "task", "profileId" to primary, "input" to json("kind" to "evaluate", "url" to job.text("url"))))
            assertEquals("completed", reused.text("status")); assertTrue(reused.optBoolean("reused"))
            assertEquals(taskIds, snapshot().objects("tasks").map { it.text("id") }.toSet())
            record("formal-evaluation-reuses-report-without-new-task", json("report" to job.text("reportNum")))
            rule.runOnUiThread { vm.selectJob(id, 1) }
            rule.onNodeWithTag("job-tab-1").performClick()
            rule.onNodeWithText("生成定制 PDF 简历草稿").performClick()
            await { state().taskLaunch != null || state().error != null }
            assertNull(state().error)
            val taskId = state().taskLaunch!!.ids.single()
            shot("cv-background-feedback")
            rule.onNodeWithTag("confirm-background-task").performClick()
            await { state().taskLaunch == null }
            shot("cv-inline-progress")
            val began = System.currentTimeMillis()
            var task = JSONObject()
            while (System.currentTimeMillis() - began < 180000) {
                task = api.request("/api/mobile?profileId=$primary&taskId=$taskId", primary)
                if (task.text("status") !in listOf("queued", "running", "reconciling")) break
                Thread.sleep(1500)
            }
            assertEquals(task.text("error"), "completed", task.text("status"))
            rule.runOnUiThread { vm.refresh(silent = true) }
            await { currentJob(id).child("cvDraft").text("status") == "pending" }
            val draft = currentJob(id).child("cvDraft")
            assertEquals(originalSavedCv, currentJob(id).child("cv").text("file"))
            val assessment = draft.child("assessment")
            assertTrue(assessment.optInt("draftScore") >= assessment.optInt("baselineScore"))
            File(folder(), "cv-task.json").writeText(task.toString(2))
            record("new-cv-task-completed-with-pending-assessed-pdf", json("taskId" to taskId, "metrics" to task.child("metrics"), "baseline" to assessment.optInt("baselineScore"), "score" to assessment.optInt("draftScore")))
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("preview-tailored-draft"))
            shot("cv-assessment")
            rule.onNodeWithTag("preview-tailored-draft").performClick()
            preview("new-tailored-cv")
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("reject-tailored-draft"))
            rule.onNodeWithTag("reject-tailored-draft").performClick()
            await { !state().working && currentJob(id).child("cvDraft").text("status") == "rejected" }
            assertEquals(originalSavedCv, currentJob(id).child("cv").text("file"))
            assertEquals(originalCv, snapshot().text("cv"))
            record("reject-preserves-master-and-saved-cv")
            back()
            profile(secondary)
            assertFalse(state().snapshot.objects("jobs").any { it.text("id") == id })
            record("profile-switch-clears-foreign-job-and-task")
            rule.runOnUiThread { vm.openCvPreview() }
            preview("secondary-master-cv")
            val planned = state().snapshot.objects("jobs").first { it.child("mobilePlan").text("markdown").isNotBlank() && it.child("interview").objects("questions").isNotEmpty() }
            rule.runOnUiThread { vm.selectJob(planned.text("id"), 2) }
            rule.onNodeWithTag("job-tab-2").performClick()
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("toggle-interview-plan"))
            rule.onNodeWithTag("toggle-interview-plan").performClick()
            rule.onNodeWithText("展开").assertIsDisplayed(); shot("plan-collapsed")
            rule.onNodeWithTag("toggle-interview-plan").performClick()
            rule.onNodeWithText("收起").assertIsDisplayed()
            rule.onNodeWithTag("toggle-interview-plan").performClick()
            rule.onNodeWithTag("job-content").performScrollToNode(hasTestTag("practice-this-question"))
            rule.onAllNodesWithTag("practice-this-question").onFirst().performClick()
            rule.onNodeWithText("针对性模拟").assertIsDisplayed()
            rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("I contributed to the analysis and documented its limitations.")
            shot("practice-scroll-keyboard")
            back(); back()
            record("plan-collapse-expand-and-practice-scroll-keyboard")
            rule.runOnUiThread { vm.appearance(theme = "dark") }
            rule.onNodeWithTag("nav-0").performClick(); shot("dark-home")
            rule.runOnUiThread { vm.appearance(theme = "light") }
            shot("light-home")
            record("dark-and-light-native-rendering")
            File(folder(), "summary.json").writeText(json("passed" to true, "installedVersion" to BuildConfig.VERSION_NAME, "server" to api.base, "syntheticOnly" to true, "newCvTaskId" to taskId, "physicalDevice" to true).toString(2))
        } catch (error: Throwable) {
            runCatching { shot("failure") }
            record("failed", json("error" to error.toString(), "appError" to state().error))
            throw error
        } finally {
            rule.runOnUiThread { vm.closePreview(); vm.selectJob(null); vm.showAnalysis(false); vm.clearTaskLaunch(); vm.appearance(language = originalLanguage, theme = originalTheme); if (originalProfile.isNotBlank()) vm.selectProfile(originalProfile) }
            prefs.edit().putString("profile", originalProfile).putString("language", originalLanguage).putString("theme", originalTheme).commit()
        }
    }
}
