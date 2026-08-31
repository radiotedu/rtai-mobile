package com.radiotedumobile.cast

import android.net.Uri
import androidx.mediarouter.app.MediaRouteChooserDialog
import androidx.mediarouter.media.MediaRouteSelector
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.common.images.WebImage

class CastBridgeModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), SessionManagerListener<CastSession> {

    private data class PendingMedia(
        val url: String,
        val title: String,
        val artist: String,
        val artwork: String,
        val live: Boolean,
    )

    private var pendingMedia: PendingMedia? = null
    private val castContext: CastContext? = runCatching {
        CastContext.getSharedInstance(context).also {
            it.sessionManager.addSessionManagerListener(this, CastSession::class.java)
        }
    }.getOrNull()

    override fun getName(): String = "RadioTeduCastBridge"

    @ReactMethod
    fun updateMedia(url: String, title: String, artist: String, artwork: String, live: Boolean) {
        if (!Uri.parse(url).scheme.orEmpty().startsWith("http")) return
        pendingMedia = PendingMedia(url, title, artist, artwork, live)
    }

    @ReactMethod
    fun showRoutePicker() {
        val activity = currentActivity ?: return
        activity.runOnUiThread {
            val selector = MediaRouteSelector.Builder()
                .addControlCategory(
                    CastMediaControlIntent.categoryForCast(
                        CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID,
                    ),
                )
                .build()
            MediaRouteChooserDialog(activity).apply {
                routeSelector = selector
                show()
            }
        }
    }

    @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit
    @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) = Unit

    private fun load(session: CastSession) {
        val media = pendingMedia ?: return
        val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK).apply {
            putString(MediaMetadata.KEY_TITLE, media.title.ifBlank { "RadioTEDU" })
            putString(MediaMetadata.KEY_ARTIST, media.artist.ifBlank { "RadioTEDU" })
            if (media.artwork.startsWith("https://")) addImage(WebImage(Uri.parse(media.artwork)))
        }
        val info = MediaInfo.Builder(media.url)
            .setStreamType(if (media.live) MediaInfo.STREAM_TYPE_LIVE else MediaInfo.STREAM_TYPE_BUFFERED)
            .setContentType(if (media.url.contains(".mp3", true)) "audio/mpeg" else "audio/aac")
            .setMetadata(metadata)
            .build()
        session.remoteMediaClient?.load(
            MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build(),
        )
        emit("RadioTeduCastSessionStarted")
    }

    private fun emit(name: String) {
        if (context.hasActiveReactInstance()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, null)
        }
    }

    override fun onSessionStarted(session: CastSession, sessionId: String) = load(session)
    override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) = load(session)
    override fun onSessionStarting(session: CastSession) = Unit
    override fun onSessionStartFailed(session: CastSession, error: Int) = Unit
    override fun onSessionEnding(session: CastSession) = Unit
    override fun onSessionEnded(session: CastSession, error: Int) = Unit
    override fun onSessionResuming(session: CastSession, sessionId: String) = Unit
    override fun onSessionResumeFailed(session: CastSession, error: Int) = Unit
    override fun onSessionSuspended(session: CastSession, reason: Int) = Unit

    override fun invalidate() {
        castContext?.sessionManager?.removeSessionManagerListener(this, CastSession::class.java)
        super.invalidate()
    }
}
