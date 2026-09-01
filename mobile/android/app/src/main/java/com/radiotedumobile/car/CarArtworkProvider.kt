package com.radiotedumobile.car

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException
import java.security.MessageDigest

private const val CAR_ARTWORK_AUTHORITY = "com.radiotedumobile.carartwork"
private val SAFE_ARTWORK_NAME = Regex("^[a-f0-9]{64}\\.jpg$")

private fun artworkName(source: String): String =
    MessageDigest.getInstance("SHA-256")
        .digest(source.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) } + ".jpg"

private fun artworkDirectory(context: Context): File = File(context.cacheDir, "car-artwork")

internal fun cacheCarArtwork(context: Context, source: String, bytes: ByteArray): Uri? = runCatching {
    val directory = artworkDirectory(context)
    if (!directory.exists() && !directory.mkdirs()) return@runCatching null
    val file = File(directory, artworkName(source))
    file.outputStream().use { it.write(bytes) }
    Uri.Builder()
        .scheme("content")
        .authority(CAR_ARTWORK_AUTHORITY)
        .appendPath(file.name)
        .build()
}.getOrNull()

internal fun cachedCarArtworkUri(context: Context, source: String): Uri? {
    val file = File(artworkDirectory(context), artworkName(source))
    if (!file.isFile || file.length() <= 0L) return null
    return Uri.Builder()
        .scheme("content")
        .authority(CAR_ARTWORK_AUTHORITY)
        .appendPath(file.name)
        .build()
}

/** Read-only provider for public podcast thumbnails consumed by car hosts. */
class CarArtworkProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String? = resolve(uri)?.let { "image/jpeg" }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Read-only artwork")
        val file = resolve(uri) ?: throw FileNotFoundException("Unknown artwork")
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
                    OpenableColumns.SIZE -> file.length()
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

    private fun resolve(uri: Uri): File? {
        if (uri.authority != CAR_ARTWORK_AUTHORITY || uri.pathSegments.size != 1) return null
        val name = uri.lastPathSegment ?: return null
        if (!SAFE_ARTWORK_NAME.matches(name)) return null
        val context = context ?: return null
        return File(artworkDirectory(context), name).takeIf { it.isFile }
    }
}
