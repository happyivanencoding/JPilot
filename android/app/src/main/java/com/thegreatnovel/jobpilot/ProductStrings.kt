package com.thegreatnovel.jobpilot

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import org.json.JSONObject

/** Shared with backend projections: labels map internal values; never mutate them. */
object ProductStrings {
    @Volatile private var catalog: JSONObject? = null
    fun text(context: Context, locale: String, source: String): String {
        val dictionary = catalog ?: synchronized(this) {
            catalog ?: JSONObject(context.assets.open("jobpilot-i18n.json").bufferedReader().use { it.readText() }).also { catalog = it }
        }
        val exact = dictionary.optJSONObject(source)?.optString(locale)?.takeIf { it.isNotBlank() }
        if (exact != null) return exact
        if (source.contains(" · ")) return source.split(" · ").joinToString(" · ") { part -> dictionary.optJSONObject(part)?.optString(locale)?.takeIf { it.isNotBlank() } ?: part }
        return source
    }
    fun error(context: Context, locale: String, raw: String): String {
        if(raw.startsWith("今天已探索") || raw.startsWith("You have explored") || raw.startsWith("Vous avez exploré"))return raw
        if(Regex("CV occupe .*pages|pages pour une limite|occupies .*pages|page limit",RegexOption.IGNORE_CASE).containsMatchIn(raw)) {
            return when(locale) {
                "zh" -> "岗位版简历超过当前一页版式。原简历已保留，请重试或精简内容。"
                "en" -> "The role-specific CV exceeds the one-page layout. Your original CV is preserved; retry or shorten the content."
                else -> "Le CV ciblé dépasse la mise en page d’une page. Le CV original est conservé ; réessayez ou réduisez le contenu."
            }
        }
        val known = text(context, locale, raw)
        if (known != raw || (locale == "zh" && raw.any { it.code in 0x4E00..0x9FFF })) return known
        return when(locale) {
            "zh" -> "操作未完成，请检查连接并刷新。已有结果仍会保留。"
            "en" -> "The action did not complete. Check the connection and refresh. Saved results are preserved."
            else -> "L’action n’a pas abouti. Vérifiez la connexion et actualisez. Les résultats enregistrés sont conservés."
        }
    }
}
@Composable fun product(source: String): String = ProductStrings.text(LocalContext.current, LocalPilotLanguage.current, source)
