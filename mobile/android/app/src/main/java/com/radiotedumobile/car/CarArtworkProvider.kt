package com.radiotedumobile.car

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.util.AtomicFile
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileNotFoundException
import java.security.MessageDigest
import java.net.HttpURLConnection
import java.net.URL

private const val CAR_ARTWORK_AUTHORITY = "com.radiotedumobile.carartwork"
private val SAFE_ARTWORK_NAME = Regex("^[a-f0-9]{64}\\.jpg$")
private val artworkWriteLock = Any()

internal fun artworkName(source: String): String =
    MessageDigest.getInstance("SHA-256")
        .digest(source.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) } + ".jpg"

private fun artworkDirectory(context: Context): File = File(context.cacheDir, "car-artwork")

internal fun catalogArtworkSource(name: String, candidates: Iterable<String>): String? {
    if (!SAFE_ARTWORK_NAME.matches(name)) return null
    return candidates.firstOrNull { it.startsWith("https://") && artworkName(it) == name }
}

internal fun carArtworkUri(source: String): Uri = Uri.Builder()
    .scheme("content")
    .authority(CAR_ARTWORK_AUTHORITY)
    .appendPath(artworkName(source))
    .build()

internal fun cacheCarArtwork(context: Context, source: String, bytes: ByteArray): Uri? = runCatching {
    val directory = artworkDirectory(context)
    if (!directory.exists() && !directory.mkdirs()) return@runCatching null
    val file = File(directory, artworkName(source))
    synchronized(artworkWriteLock) {
        val atomic = AtomicFile(file)
        val stream = atomic.startWrite()
        try {
            stream.write(bytes)
            atomic.finishWrite(stream)
        } catch (error: Exception) {
            atomic.failWrite(stream)
            throw error
        }
    }
    carArtworkUri(source)
}.getOrNull()

internal fun cachedCarArtworkUri(context: Context, source: String): Uri? {
    val file = File(artworkDirectory(context), artworkName(source))
    if (!file.isFile || file.length() <= 0L) return null
    return carArtworkUri(source)
}

internal fun downloadCarArtwork(source: String): ByteArray? = runCatching {
    val url = URL(source)
    if (url.protocol != "https") return@runCatching null
    val connection = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 2_500
        readTimeout = 2_500
        instanceFollowRedirects = true
        setRequestProperty("Accept", "image/*")
    }
    try {
        if (connection.responseCode !in 200..299 ||
            !connection.contentType.orEmpty().startsWith("image/")) return@runCatching null
        connection.inputStream.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                if (output.size() + count > 512 * 1024) return@runCatching null
                output.write(buffer, 0, count)
            }
            normalizeCarArtwork(output.toByteArray())
        }
    } finally {
        connection.disconnect()
    }
}.getOrNull()

internal fun normalizeCarArtwork(source: ByteArray): ByteArray? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(source, 0, source.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / sample > 256 || bounds.outHeight / sample > 256) sample *= 2
    val decoded = BitmapFactory.decodeByteArray(
        source, 0, source.size, BitmapFactory.Options().apply { inSampleSize = sample },
    ) ?: return null
    val scaled = Bitmap.createScaledBitmap(decoded, 128, 128, true)
    if (scaled !== decoded) decoded.recycle()
    val bytes = ByteArrayOutputStream().use { output ->
        scaled.compress(Bitmap.CompressFormat.JPEG, 88, output)
        output.toByteArray()
    }
    scaled.recycle()
    return bytes.takeIf { it.size <= 64 * 1024 }
}

/** Read-only provider for public podcast thumbnails consumed by car hosts. */
class CarArtworkProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String? = resolve(uri)?.let { "image/jpeg" }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Read-only artwork")
        val file = resolve(uri, fetch = true) ?: throw FileNotFoundException("Unknown artwork")
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? {
        val file = resolve(uri) ?: return null
        val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        return MatrixCursor(columns, 1).apply {
            addRow(columns.map { column ->
                when (column) {
                    OpenableColumns.DISPLAY_NAME -> file.name
                    OpenableColumns.SIZE -> file.takeIf { it.isFile }?.length()
                    else -> null
                }
            })
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    private fun resolve(uri: Uri, fetch: Boolean = false): File? {
        if (uri.authority != CAR_ARTWORK_AUTHORITY || uri.pathSegments.size != 1) return null
        val name = uri.lastPathSegment ?: return null
        if (!SAFE_ARTWORK_NAME.matches(name)) return null
        val context = context ?: return null
        val file = File(artworkDirectory(context), name)
        if (file.isFile && file.length() > 0L) return file
        // The provider cannot fetch arbitrary URLs supplied by another app.
        // Only hashes of HTTPS images in our persisted browse catalog qualify.
        val candidates = mutableSetOf<String>()
        fun collect(item: JSONObject) {
            item.optString("artwork").takeIf { it.isNotBlank() }?.let(candidates::add)
            item.optJSONArray("items")?.let { items ->
                for (index in 0 until items.length()) items.optJSONObject(index)?.let(::collect)
            }
        }
        runCatching {
            val raw = context.getSharedPreferences(RadioTeduCarService.PREFS, Context.MODE_PRIVATE)
                .getString(RadioTeduCarService.KEY_CATALOG, null) ?: return null
            JSONObject(raw).optJSONArray("categories")?.let { categories ->
                for (index in 0 until categories.length()) categories.optJSONObject(index)?.let(::collect)
            }
        }.getOrElse { return null }
        val source = catalogArtworkSource(name, candidates) ?: return null
        if (!fetch) return file
        val bytes = downloadCarArtwork(source) ?: return null
        cacheCarArtwork(context, source, bytes) ?: return null
        return file.takeIf { it.isFile && it.length() > 0L }
    }
}
