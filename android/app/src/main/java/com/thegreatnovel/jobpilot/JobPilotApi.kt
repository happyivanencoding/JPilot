package com.thegreatnovel.jobpilot

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

fun JSONObject.text(key: String, fallback: String = ""): String = if (!has(key) || isNull(key)) fallback else optString(key, fallback)
fun JSONObject.objects(key: String): List<JSONObject> = optJSONArray(key)?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
fun JSONObject.strings(key: String): List<String> = optJSONArray(key)?.let { a -> (0 until a.length()).map { a.optString(it) }.filter { it.isNotBlank() } } ?: emptyList()
fun JSONObject.child(key: String): JSONObject = optJSONObject(key) ?: JSONObject()
fun json(vararg values: Pair<String, Any?>) = JSONObject().apply { values.forEach { (k,v) -> put(k, v ?: JSONObject.NULL) } }
class ApiFailure(val status: Int, message: String) : Exception(message)

class JobPilotApi(private val context: Context) {
    private val prefs = context.getSharedPreferences("jobpilot", Context.MODE_PRIVATE)
    private val vault = SessionVault(context)
    var token: String? = vault.read(); private set
    var base: String = prefs.getString("server", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL; private set
    val uiLocale: String get() = prefs.getString("language", "en") ?: "en"
    fun saveToken(value: String?) { token = value; vault.save(value) }
    fun setBase(value: String) {
        val u = URI(value.trim().trimEnd('/'))
        val productionHost = URI(BuildConfig.API_BASE_URL).host
        require((u.scheme == "https" && u.host == productionHost) || (BuildConfig.DEBUG && u.scheme == "http" && u.host in listOf("127.0.0.1", "localhost"))) { "Utiliser le domaine JobPilot ou la connexion USB." }
        require(u.userInfo == null && u.query == null && u.fragment == null && u.path.isNullOrEmpty()) { "Adresse invalide." }
        base = u.toString(); prefs.edit().putString("server", base).apply()
    }
    private fun connection(route: String, profile: String, method: String): HttpURLConnection {
        require(route.startsWith("/") && !route.startsWith("//"))
        return (URL(base + route).openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 20_000; readTimeout = 60_000
            instanceFollowRedirects = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-JobPilot-Locale", uiLocale)
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (profile.isNotBlank()) setRequestProperty("X-JobPilot-Profile", profile)
        }
    }
    private fun checkedBytes(c: HttpURLConnection): ByteArray {
        val status = c.responseCode
        val bytes = (if (status in 200..299) c.inputStream else c.errorStream)?.use { it.readBytes() } ?: byteArrayOf()
        if (status !in 200..299) {
            val body = String(bytes, Charsets.UTF_8)
            val message = runCatching { JSONObject(body).text("error") }.getOrNull()?.takeIf { it.isNotBlank() }
                ?: if (status == 302) "Connexion expirée. Reconnectez JobPilot." else "HTTP $status : ${body.take(240)}"
            throw ApiFailure(status, ProductStrings.error(context,uiLocale,message))
        }
        return bytes
    }
    fun request(route: String, profile: String = "", body: JSONObject? = null): JSONObject {
        val c = connection(route, profile, if (body == null) "GET" else "POST")
        try {
            if (body != null) {
                c.doOutput = true; c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                c.setFixedLengthStreamingMode(bytes.size); c.outputStream.use { it.write(bytes) }
            }
            return JSONObject(String(checkedBytes(c), Charsets.UTF_8))
        } finally { c.disconnect() }
    }
    fun upload(uri: Uri, profile: String): JSONObject {
        val resolver = context.contentResolver
        val filename = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: "cv.pdf"
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val out = ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { val n = input.read(buffer); if (n < 0) break; if (out.size() + n > 12 * 1024 * 1024) throw IllegalArgumentException("12 Mo maximum."); out.write(buffer,0,n) }
            out.toByteArray()
        } ?: throw IllegalArgumentException("Document inaccessible.")
        val boundary = "JobPilot" + java.util.UUID.randomUUID().toString()
        val safeName = filename.replace(Regex("[\r\n\"\\\\]"), "_")
        val prefix = "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"$safeName\"\r\nContent-Type: application/octet-stream\r\n\r\n".toByteArray(Charsets.UTF_8)
        val preferences=context.getSharedPreferences("jobpilot",0)
        val fields=listOf("sourceLanguage" to (preferences.getString("cvLanguage","en") ?: "en"),"analysisLanguage" to (preferences.getString("analysisLanguage",uiLocale) ?: uiLocale))
        val suffix = (fields.joinToString("") { (name,value) -> "\r\n--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value" } + "\r\n--$boundary--\r\n").toByteArray()
        val c = connection("/api/mobile/upload?profileId=${Uri.encode(profile)}", profile, "POST")
        try {
            c.doOutput = true; c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            c.setFixedLengthStreamingMode(prefix.size + bytes.size + suffix.size)
            c.outputStream.use { it.write(prefix); it.write(bytes); it.write(suffix) }
            return JSONObject(String(checkedBytes(c), Charsets.UTF_8))
        } finally { c.disconnect() }
    }
    fun downloadDocument(url: String, profile: String): Pair<File, String> {
        val target = URI(url)
        val origin = URI(base)
        require(target.scheme == origin.scheme && target.host == origin.host && target.port == origin.port && target.path.startsWith("/api/")) { "Téléchargement hors du serveur JobPilot refusé." }
        val route = target.rawPath + (target.rawQuery?.let { "?$it" } ?: "")
        val c = connection(route, profile, "GET")
        return try {
            val bytes = checkedBytes(c)
            val mime = c.contentType?.substringBefore(';')?.trim() ?: "application/octet-stream"
            val extension = when (mime) {
                "application/pdf" -> "pdf"
                "application/json" -> "json"
                "text/csv" -> "csv"
                "text/plain", "text/markdown" -> "txt"
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> "docx"
                else -> if (bytes.take(4).toByteArray().contentEquals("%PDF".toByteArray())) "pdf" else throw IllegalArgumentException("Ce format de téléchargement n’est pas pris en charge.")
            }
            val folder = File(context.cacheDir, "cv/${profile.replace(Regex("[^a-zA-Z0-9_-]"), "_")}").apply { mkdirs() }
            val file = File(folder, "JobPilot-${System.currentTimeMillis()}.$extension").apply { writeBytes(bytes) }
            file to if (extension == "pdf") "application/pdf" else mime
        } finally { c.disconnect() }
    }
    fun downloadCv(job: JSONObject, profile: String, draftId: String? = null): File {
        val draft = draftId?.takeIf { it.isNotBlank() }?.let { "&draftId=${Uri.encode(it)}" } ?: ""
        val c = connection("/api/candidatures/cv?id=${Uri.encode(job.text("id"))}&profileId=${Uri.encode(profile)}$draft", profile, "GET")
        return try {
            val bytes = checkedBytes(c)
            require(bytes.take(4).toByteArray().contentEquals("%PDF".toByteArray())) { "Le serveur n’a pas renvoyé de PDF." }
            val folder = File(context.cacheDir,"cv/${profile.replace(Regex("[^a-zA-Z0-9_-]"), "_")}").apply { mkdirs() }
            val name = (job.text("company") + "-CV").replace(Regex("[^a-zA-Z0-9_-]"), "_")
            File(folder,"$name.pdf").apply { writeBytes(bytes) }
        } finally { c.disconnect() }
    }
}
