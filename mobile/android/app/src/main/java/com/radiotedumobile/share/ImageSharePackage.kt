package com.radiotedumobile.share

import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.UUID

class ImageSharePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext) = listOf(ImageShareModule(context))
    override fun createViewManagers(context: ReactApplicationContext) = emptyList<ViewManager<*, *>>()
}

class ImageShareModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private var pendingSave: Pair<File, Promise>? = null
    init {
        context.addActivityEventListener(object : BaseActivityEventListener() {
            override fun onActivityResult(activity: android.app.Activity, requestCode: Int, resultCode: Int, data: Intent?) {
                if (requestCode != 13901) return
                val pending = pendingSave ?: return
                pendingSave = null
                if (resultCode != android.app.Activity.RESULT_OK || data?.data == null) {
                    pending.second.resolve(false); return
                }
                try {
                    context.contentResolver.openOutputStream(data.data!!)?.use { out ->
                        pending.first.inputStream().use { it.copyTo(out) }
                    } ?: throw IllegalStateException("Cannot save image")
                    pending.second.resolve(true)
                } catch (error: Exception) { pending.second.reject("E_SAVE", error.message, error) }
            }
        })
    }
    override fun getName() = "RadioTeduImageShare"

    @ReactMethod
    fun share(viewTag: Int, title: String, save: Boolean, promise: Promise) {
        if (pendingSave != null) {promise.reject("E_BUSY", "A save is already open"); return}
        val manager = context.getNativeModule(UIManagerModule::class.java)
        if (manager == null) { promise.reject("E_CAPTURE", "Image capture is unavailable"); return }
        manager.addUIBlock { hierarchy ->
            var bitmap: Bitmap? = null
            try {
                val activity = currentActivity ?: throw IllegalStateException("App is not foreground")
                val view = hierarchy.resolveView(viewTag)
                require(view.width > 0 && view.height > 0) { "Image is not ready" }
                val ratio = view.height.toFloat() / view.width
                val height = when {
                    kotlin.math.abs(ratio - 1f) < 0.01f -> 1080
                    kotlin.math.abs(ratio - 16f / 9f) < 0.01f -> 1920
                    else -> throw IllegalArgumentException("Invalid image dimensions")
                }
                val image = Bitmap.createBitmap(1080, height, Bitmap.Config.ARGB_8888)
                bitmap = image
                val canvas = Canvas(image)
                canvas.drawColor(android.graphics.Color.rgb(18, 20, 26))
                canvas.scale(1080f / view.width, height.toFloat() / view.height)
                view.draw(canvas)
                val folder = File(context.cacheDir, "share-cards").apply { mkdirs() }
                val file = File(folder, "RadioTEDU-${UUID.randomUUID()}.png")
                file.outputStream().use { require(image.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                if (save) {
                    pendingSave = Pair(file, promise)
                    try {
                        activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                            type = "image/png"
                            addCategory(Intent.CATEGORY_OPENABLE)
                            putExtra(Intent.EXTRA_TITLE, file.name)
                        }, 13901)
                    } catch (error: Exception) {pendingSave = null; throw error}
                    return@addUIBlock
                }
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.sharecards", file)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TITLE, title.take(200))
                    clipData = ClipData.newRawUri("RadioTEDU PNG", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(Intent.createChooser(intent, title.take(200)))
                promise.resolve(uri.toString())
            } catch (error: Exception) {
                promise.reject("E_CAPTURE", error.message, error)
            } finally { bitmap?.recycle() }
        }
    }
}
