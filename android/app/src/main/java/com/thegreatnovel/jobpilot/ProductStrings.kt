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
