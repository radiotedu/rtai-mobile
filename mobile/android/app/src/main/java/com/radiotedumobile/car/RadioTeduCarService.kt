package com.radiotedumobile.car

import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.media.utils.MediaConstants
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Metadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.extractor.metadata.icy.IcyInfo
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.firebase.analytics.FirebaseAnalytics
import com.radiotedumobile.MainActivity
import com.radiotedumobile.R
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.Normalizer
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

private const val CAT_RADIO = "cat_radio"
private const val CAT_PODCASTS = "cat_podcasts"
private const val PODCAST_SERIES_PREFIX = "podcast-series:"
private const val HIFI_MEDIA_ID_SUFFIX = ":hifi"
private val ROOT_CATEGORY_IDS = listOf(CAT_RADIO, CAT_PODCASTS)

/**
 * RadioTEDU's single Android media library and native playback service.
 *
 * Media3 exposes one driver-safe Live Radio + Podcasts tree to Android Auto,
 * Automotive OS, Assistant/Gemini, system media controls, and Wear controllers.
 * ExoPlayer remains fully native and headless: a cold car launch never depends
 * on the React Native runtime. The JS bridge only refreshes the cached catalog.
 */
@OptIn(UnstableApi::class)
class RadioTeduCarService : MediaLibraryService() {

    companion object {
        const val PREFS = "radiotedu_car"
        const val KEY_CATALOG = "catalog"
        const val KEY_LANGUAGE_PREFERENCE = "language_preference"

        private const val ROOT_ID = "__ROOT__"
        private const val SESSION_ID = "RadioTeduMediaLibrary"
        private const val TAG = "RadioTeduCarService"
        private const val SYSTEM_LANGUAGE_PREFERENCE = "system"
        private val SUPPORTED_LANGUAGE_CODES = setOf("en", "tr", "ar", "ru", "de", "fr")

        private const val CONTENT_STYLE_SUPPORTED =
            "android.media.browse.CONTENT_STYLE_SUPPORTED"
        private const val CONTENT_STYLE_BROWSABLE_HINT =
            "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT"
        private const val CONTENT_STYLE_PLAYABLE_HINT =
            "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT"
        private const val CONTENT_STYLE_GRID = 2
        private const val CONTENT_STYLE_LIST = 1

        private const val EXTRA_AUDIO_FORMAT = "com.radiotedu.media.AUDIO_FORMAT"
        private const val ACTION_TOGGLE_HIFI = "com.radiotedumobile.car.action.TOGGLE_HIFI"
        private const val HIFI_CONFIRMATION_WINDOW_MS = 30_000L
        private const val FORMAT_ICON_LARGE =
            "androidx.car.app.mediaextensions.KEY_CONTENT_FORMAT_TINTABLE_LARGE_ICON_URI"
        private const val FORMAT_ICON_SMALL =
            "androidx.car.app.mediaextensions.KEY_CONTENT_FORMAT_TINTABLE_SMALL_ICON_URI"
        private const val HIFI_FORMAT_ICON =
            "android.resource://com.radiotedumobile/drawable/car_format_hifi"
        private const val KEY_LAST_MEDIA_ID = "last_media_id"
        private const val KEY_PROGRESS_PREFIX = "podcast_progress:"
        private const val KEY_POSITION_PREFIX = "podcast_position_ms:"
        private const val KEY_DURATION_PREFIX = "podcast_duration_ms:"
        private const val KEY_PROGRESS_SCHEMA_PREFIX = "podcast_progress_schema:"
        private const val PODCAST_PROGRESS_SCHEMA = 2
        private const val PODCAST_COMPLETION_THRESHOLD = 0.95

        private const val HTTP_CONNECT_TIMEOUT_MS = 15_000
        private const val HTTP_READ_TIMEOUT_MS = 15_000
        private const val BUFFERING_WATCHDOG_MS = 20_000L
        private const val MIN_BUFFER_MS = 5_000
        private const val MAX_BUFFER_MS = 30_000
        private const val PLAY_BUFFER_MS = 4_000
        private const val REBUFFER_MS = 5_000
        private const val PROGRESS_SAVE_INTERVAL_MS = 15_000L
        private const val CAR_TILE_SIZE_PX = 128
        private const val CAR_TILE_MAX_BYTES = 64 * 1024
        private const val TRACK_ARTWORK_MAX_BYTES = 512 * 1024
        private const val ARTWORK_LOOKUP_TIMEOUT_MS = 2_500

        // A deliberately small cold-start fallback. Availability-filtered JS
        // catalog data replaces it after the first app launch. Shipping extra
        // unverified stations here would make offline mounts visible in cars.
        private const val FALLBACK_RADIO_ID = "radiotedu-main"
        private const val FALLBACK_RADIO_URL = "https://stream.radiotedu.com/radio"
        private const val FALLBACK_RADIO_ARTWORK =
            "android.resource://com.radiotedumobile/drawable/car_station_radiotedu"
        private const val RADIO_CATEGORY_ARTWORK =
            "android.resource://com.radiotedumobile/drawable/car_tile_radio"
        private const val PODCAST_CATEGORY_ARTWORK =
            "android.resource://com.radiotedumobile/drawable/car_tile_podcasts"
    }

    private lateinit var player: ExoPlayer
    private lateinit var librarySession: MediaLibrarySession
    private val mainHandler = Handler(Looper.getMainLooper())
    private var bufferingWatchdog: Runnable? = null
    private var progressTicker: Runnable? = null
    private var activeCatalogItem: CatalogItem? = null
    private var analyticsItemId: String? = null
    private var analyticsStartedAtMs = 0L
    private var publishingNormalizedMetadata = false
    private val tileArtworkCache = mutableMapOf<Int, ByteArray>()
    private val artworkExecutor = Executors.newSingleThreadExecutor()
    private val trackArtworkCache = ConcurrentHashMap<String, TrackArtwork>()
    private var activeArtworkLookupKey: String? = null
    private var pendingHiFiMediaId: String? = null
    private var pendingHiFiUntilMs = 0L
    private val hiFiCommand = SessionCommand(ACTION_TOGGLE_HIFI, Bundle.EMPTY)

    override fun onCreate() {
        super.onCreate()

        val httpFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(HTTP_CONNECT_TIMEOUT_MS)
            .setReadTimeoutMs(HTTP_READ_TIMEOUT_MS)
            .setDefaultRequestProperties(mapOf("Icy-MetaData" to "1"))
            .setAllowCrossProtocolRedirects(true)

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                MIN_BUFFER_MS,
                MAX_BUFFER_MS,
                PLAY_BUFFER_MS,
                REBUFFER_MS,
            )
            .build()

        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
            .setLoadControl(loadControl)
            .build()
            .apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build(),
                    /* handleAudioFocus = */ true,
                )
                repeatMode = Player.REPEAT_MODE_ALL
                addListener(playerListener)
            }

        librarySession = MediaLibrarySession.Builder(this, player, LibraryCallback())
            .setId(SESSION_ID)
            .setSessionActivity(appPendingIntent())
            .setLibraryErrorReplicationMode(
                MediaLibrarySession.LIBRARY_ERROR_REPLICATION_MODE_NON_FATAL,
            )
            .build()

        // MediaSessionService owns the compliant media foreground notification.
        // It reads current Media3 metadata, so ICY title/artist changes are also
        // reflected on notification, lock screen, Auto, AAOS, and Wear surfaces.
        setShowNotificationForIdlePlayer(SHOW_NOTIFICATION_FOR_IDLE_PLAYER_AFTER_STOP_OR_ERROR)

        CarBridge.onCatalogChanged = {
            mainHandler.post { notifyCatalogChanged() }
        }
        CarBridge.onNowPlaying = { _, _, _, _ ->
            // Native Media3 player/session are the only playback state source.
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession =
        librarySession

    override fun onDestroy() {
        CarBridge.onCatalogChanged = null
        CarBridge.onNowPlaying = null
        cancelBufferingWatchdog()
        cancelProgressTicker(save = true)
        logCarListenComplete()
        player.removeListener(playerListener)
        librarySession.release()
        player.release()
        artworkExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun appPendingIntent(): PendingIntent {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        return PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
            flags,
        )
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_BUFFERING -> armBufferingWatchdog()
                Player.STATE_READY, Player.STATE_IDLE -> cancelBufferingWatchdog()
                Player.STATE_ENDED -> {
                    cancelBufferingWatchdog()
                    savePodcastProgress(completed = true)
                }
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
                cancelBufferingWatchdog()
                startProgressTicker()
                logCarPlaybackStart()
            } else {
                cancelProgressTicker(save = true)
                logCarListenComplete()
            }
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            logCarListenComplete()
            val previous = activeCatalogItem
            if (previous?.seriesId != null && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
                markPodcastCompleted(previous.id)
            }
            activeCatalogItem = mediaItem?.mediaId?.let(::findItem)
            analyticsItemId = null
            activeArtworkLookupKey = null
            pendingHiFiMediaId = null
            pendingHiFiUntilMs = 0L
            updateHiFiButton()
            activeCatalogItem?.id?.let {
                prefs().edit().putString(KEY_LAST_MEDIA_ID, it).apply()
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            cancelBufferingWatchdog()
            cancelProgressTicker(save = true)
            Log.w(TAG, "Playback failed", error)
            sendSessionError(
                SessionError.ERROR_IO,
                localizedString(R.string.car_playback_error),
            )
        }

        override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
            normalizeIcyMetadata(mediaMetadata)
        }

        override fun onMetadata(metadata: Metadata) {
            for (index in 0 until metadata.length()) {
                val title = (metadata[index] as? IcyInfo)?.title?.trim().orEmpty()
                if (title.isNotEmpty()) {
                    // Raw ICY is the authoritative timed source. Some Auto hosts
                    // do not surface Media3's synthesized metadata callback.
                    normalizeIcyMetadata(MediaMetadata.Builder().setTitle(title).build())
                    return
                }
            }
        }
    }

    /** Split common ICY "Artist - Title" blocks into structured fields. */
    private fun normalizeIcyMetadata(mediaMetadata: MediaMetadata) {
        if (publishingNormalizedMetadata) return
        val current = player.currentMediaItem ?: return
        val fallback = findItem(current.mediaId) ?: activeCatalogItem ?: return
        val index = player.currentMediaItemIndex
        if (index == C.INDEX_UNSET) return

        val incoming = CarMetadataText(
            title = mediaMetadata.title?.toString()?.trim().orEmpty(),
            artist = mediaMetadata.artist?.toString()?.trim().orEmpty().ifEmpty { null },
        )
        val stationSafe = CarMetadataPolicy.sanitizeIcy(
            mediaId = fallback.id,
            quality = fallback.quality,
            stationTitle = fallback.title,
            incoming = incoming,
        )
        if (stationSafe != incoming) {
            val alreadySafe = mediaMetadata.title?.toString() == stationSafe.title &&
                mediaMetadata.displayTitle?.toString() == stationSafe.title &&
                mediaMetadata.artist.isNullOrEmpty() &&
                mediaMetadata.station?.toString() == fallback.title
            if (!alreadySafe) {
                replaceCurrentMetadata(
                    index,
                    current,
                    current.mediaMetadata.buildUpon()
                        .setTitle(stationSafe.title)
                        .setDisplayTitle(stationSafe.title)
                        .setArtist(null)
                        .setStation(fallback.title)
                        .build(),
                )
            }
            return
        }

        val rawTitle = mediaMetadata.title?.toString()?.trim().orEmpty()
        if (rawTitle.isEmpty()) return

        var title = rawTitle
        var artist = mediaMetadata.artist?.toString()?.trim().orEmpty()
        if (artist.isEmpty()) {
            val separator = rawTitle.indexOf(" - ")
            if (separator > 0 && separator < rawTitle.length - 3) {
                artist = rawTitle.substring(0, separator).trim()
                title = rawTitle.substring(separator + 3).trim()
            }
        }
        if (artist.isEmpty()) artist = fallback.artist

        val artworkKey = "${fallback.id}\u0000$artist\u0000$title"

        val normalized = current.mediaMetadata.buildUpon()
            .setTitle(title)
            .setDisplayTitle(title)
            .setArtist(artist)
            .setStation(if (fallback.seriesId == null) fallback.title else null)
            .build()
        if (mediaMetadata.title?.toString() != title ||
            mediaMetadata.artist?.toString().orEmpty() != artist ||
            mediaMetadata.station?.toString() != fallback.title
        ) {
            replaceCurrentMetadata(index, current, normalized)
        }
        if (fallback.seriesId == null) {
            enrichCurrentTrackArtwork(artworkKey, fallback.id, artist, title)
        }
    }

    /** Add song cover art without delaying or restarting the live stream. */
    private fun enrichCurrentTrackArtwork(
        lookupKey: String,
        mediaId: String,
        artist: String,
        title: String,
    ) {
        if (activeArtworkLookupKey == lookupKey) return
        activeArtworkLookupKey = lookupKey
        trackArtworkCache[lookupKey]?.let { artwork ->
            publishTrackArtwork(lookupKey, mediaId, artwork)
            return
        }
        artworkExecutor.execute {
            val artwork = fetchTrackArtwork("$artist $title") ?: return@execute
            trackArtworkCache[lookupKey] = artwork
            mainHandler.post { publishTrackArtwork(lookupKey, mediaId, artwork) }
        }
    }

    private fun publishTrackArtwork(
        lookupKey: String,
        mediaId: String,
        artwork: TrackArtwork,
    ) {
        if (activeArtworkLookupKey != lookupKey) return
        val current = player.currentMediaItem ?: return
        if (current.mediaId != mediaId) return
        val index = player.currentMediaItemIndex
        if (index == C.INDEX_UNSET) return
        val metadata = current.mediaMetadata.buildUpon()
            .setArtworkUri(Uri.parse(artwork.uri))
            .setArtworkData(artwork.data, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
            .build()
        replaceCurrentMetadata(index, current, metadata)
    }

    private fun fetchTrackArtwork(query: String): TrackArtwork? = runCatching {
        val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
        val searchUrl = URL(
            "https://itunes.apple.com/search?term=$encoded&media=music&entity=song&limit=1",
        )
        val search = openArtworkConnection(searchUrl)
        val response = try {
            if (search.responseCode !in 200..299) return@runCatching null
            search.inputStream.bufferedReader().use { it.readText() }
        } finally {
            search.disconnect()
        }
        val result = JSONObject(response).optJSONArray("results")?.optJSONObject(0)
            ?: return@runCatching null
        val artworkUri = result.optString("artworkUrl100")
            .replace("100x100bb", "600x600bb")
            .takeIf { it.startsWith("https://") }
            ?: return@runCatching null
        val image = openArtworkConnection(URL(artworkUri))
        val bytes = try {
            if (image.responseCode !in 200..299) return@runCatching null
            image.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > TRACK_ARTWORK_MAX_BYTES) return@runCatching null
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
        } finally {
            image.disconnect()
        }
        TrackArtwork(artworkUri, bytes)
    }.getOrNull()

    private fun openArtworkConnection(url: URL): HttpURLConnection =
        (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = ARTWORK_LOOKUP_TIMEOUT_MS
            readTimeout = ARTWORK_LOOKUP_TIMEOUT_MS
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json,image/*")
        }

    private data class TrackArtwork(val uri: String, val data: ByteArray)

    private fun replaceCurrentMetadata(
        index: Int,
        current: MediaItem,
        metadata: MediaMetadata,
    ) {
        publishingNormalizedMetadata = true
        try {
            // Same local configuration: ExoPlayer keeps the live socket and only
            // updates timeline metadata, avoiding a stream restart.
            player.replaceMediaItem(
                index,
                current.buildUpon().setMediaMetadata(metadata).build(),
            )
            triggerNotificationUpdate()
        } finally {
            publishingNormalizedMetadata = false
        }
    }

    private fun armBufferingWatchdog() {
        cancelBufferingWatchdog()
        val runnable = Runnable {
            bufferingWatchdog = null
            if (player.playbackState == Player.STATE_BUFFERING) {
                player.stop()
                sendSessionError(
                    SessionError.ERROR_IO,
                    localizedString(R.string.car_stream_connect_error),
                )
            }
        }
        bufferingWatchdog = runnable
        mainHandler.postDelayed(runnable, BUFFERING_WATCHDOG_MS)
    }

    private fun cancelBufferingWatchdog() {
        bufferingWatchdog?.let(mainHandler::removeCallbacks)
        bufferingWatchdog = null
    }

    private fun startProgressTicker() {
        cancelProgressTicker(save = false)
        if (activeCatalogItem?.seriesId == null) return
        val runnable = object : Runnable {
            override fun run() {
                savePodcastProgress(completed = false)
                if (player.isPlaying && activeCatalogItem?.seriesId != null) {
                    mainHandler.postDelayed(this, PROGRESS_SAVE_INTERVAL_MS)
                }
            }
        }
        progressTicker = runnable
        mainHandler.postDelayed(runnable, PROGRESS_SAVE_INTERVAL_MS)
    }

    private fun cancelProgressTicker(save: Boolean) {
        progressTicker?.let(mainHandler::removeCallbacks)
        progressTicker = null
        if (save) savePodcastProgress(completed = false)
    }

    private fun savePodcastProgress(completed: Boolean) {
        val item = activeCatalogItem ?: return
        if (item.seriesId == null) return
        val duration = player.duration
        if (completed) {
            markPodcastCompleted(item.id)
            return
        }
        if (duration <= 0 || duration == C.TIME_UNSET) return

        val position = player.currentPosition.coerceIn(0L, duration)
        val percent = (position.toDouble() / duration.toDouble()).coerceIn(0.0, 1.0)
        if (percent >= PODCAST_COMPLETION_THRESHOLD) {
            markPodcastCompleted(item.id)
            return
        }
        prefs().edit()
            .putInt(KEY_PROGRESS_SCHEMA_PREFIX + item.id, PODCAST_PROGRESS_SCHEMA)
            .putLong(KEY_POSITION_PREFIX + item.id, position)
            .putLong(KEY_DURATION_PREFIX + item.id, duration)
            .putFloat(KEY_PROGRESS_PREFIX + item.id, percent.toFloat())
            .apply()
    }

    private fun markPodcastCompleted(mediaId: String) {
        prefs().edit()
            .putInt(KEY_PROGRESS_SCHEMA_PREFIX + mediaId, PODCAST_PROGRESS_SCHEMA)
            .remove(KEY_POSITION_PREFIX + mediaId)
            .remove(KEY_DURATION_PREFIX + mediaId)
            .putFloat(KEY_PROGRESS_PREFIX + mediaId, 1f)
            .apply()
    }

    private fun podcastProgress(mediaId: String): Double =
        runCatching { prefs().getFloat(KEY_PROGRESS_PREFIX + mediaId, 0f) }
            .getOrDefault(0f)
            .toDouble()
            .coerceIn(0.0, 1.0)

    private fun savedPodcastPositionMs(mediaId: String): Long {
        val preferences = prefs()
        if (
            preferences.getInt(KEY_PROGRESS_SCHEMA_PREFIX + mediaId, 0) !=
            PODCAST_PROGRESS_SCHEMA
        ) {
            return C.TIME_UNSET
        }
        val position = preferences.getLong(KEY_POSITION_PREFIX + mediaId, C.TIME_UNSET)
        val duration = preferences.getLong(KEY_DURATION_PREFIX + mediaId, C.TIME_UNSET)
        if (position < 0 || duration <= 0 || duration == C.TIME_UNSET) return C.TIME_UNSET

        val clamped = position.coerceAtMost(duration)
        if (clamped.toDouble() / duration.toDouble() >= PODCAST_COMPLETION_THRESHOLD) {
            markPodcastCompleted(mediaId)
            return C.TIME_UNSET
        }
        return clamped
    }

    private fun sendSessionError(code: Int, message: String) {
        Log.w(TAG, message)
        librarySession.sendError(SessionError(code, message))
    }

    private fun notifyCatalogChanged() {
        if (!::librarySession.isInitialized) return
        val catalog = readCatalog()
        val categories = catalog.optJSONArray("categories")
        librarySession.notifyChildrenChanged(ROOT_ID, ROOT_CATEGORY_IDS.size, null)
        categories ?: return
        for (category in allowedCatalogCategories(categories)) {
            val id = category.optString("id")
            val items = category.optJSONArray("items")
            val count = if (items == null) {
                0
            } else {
                (0 until items.length()).count { index ->
                    items.optJSONObject(index)?.let { item ->
                        isAllowedCatalogItem(id, item)
                    } == true
                }
            }
            if (id.isNotEmpty()) librarySession.notifyChildrenChanged(id, count, null)
        }
    }

    // --- Media3 library/session callbacks ---

    private inner class LibraryCallback : MediaLibrarySession.Callback {
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): MediaSession.ConnectionResult {
            val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS
                .buildUpon()
                .add(hiFiCommand)
                .build()
            return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(commands)
                .setMediaButtonPreferences(hiFiButtonPreferences())
                .build()
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle,
        ): ListenableFuture<SessionResult> {
            if (customCommand.customAction != ACTION_TOGGLE_HIFI) {
                return Futures.immediateFuture(
                    SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED),
                )
            }
            val active = activeCatalogItem ?: player.currentMediaItem?.mediaId?.let(::findItem)
            if (active == null || (active.hiFiUrl == null && active.quality != "flac")) {
                return Futures.immediateFuture(
                    SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED),
                )
            }

            if (active.quality == "flac") {
                val normal = findItem(active.id.removeSuffix(HIFI_MEDIA_ID_SUFFIX))
                if (normal != null) switchCarQuality(normal)
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }

            val now = android.os.SystemClock.elapsedRealtime()
            if (
                isMeteredNetwork() &&
                (pendingHiFiMediaId != active.id || now > pendingHiFiUntilMs)
            ) {
                pendingHiFiMediaId = active.id
                pendingHiFiUntilMs = now + HIFI_CONFIRMATION_WINDOW_MS
                librarySession.sendError(
                    controller,
                    SessionError(
                        SessionError.ERROR_NOT_SUPPORTED,
                        localizedString(R.string.car_hifi_confirmation_warning),
                    ),
                )
                updateHiFiButton()
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }

            val hiFi = active.toHiFiVariant()
                ?: return Futures.immediateFuture(
                    SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED),
                )
            pendingHiFiMediaId = null
            pendingHiFiUntilMs = 0L
            switchCarQuality(hiFi)
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }

        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(
                LibraryResult.ofItem(rootMediaItem(), responseLibraryParams(params)),
            )

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val children = when {
                params?.isOffline == true -> emptyList()
                parentId == ROOT_ID && params?.isSuggested == true -> suggestedItems()
                else -> childrenFor(parentId)
            }
            val pageItems = paginate(children, page, pageSize)
                ?: return Futures.immediateFuture(
                    LibraryResult.ofError(SessionError.ERROR_BAD_VALUE),
                )
            return Futures.immediateFuture(
                LibraryResult.ofItemList(pageItems, responseLibraryParams(params)),
            )
        }

        override fun onGetItem(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> {
            val item = when {
                mediaId == ROOT_ID -> rootMediaItem()
                else -> findCategory(mediaId)?.let(::browsableFromJson)
                    ?: fallbackRootCategory(mediaId)
                    ?: findItem(mediaId)?.toMediaItem(playable = false)
            }
            return if (item != null) {
                Futures.immediateFuture(LibraryResult.ofItem(item, null))
            } else {
                Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE))
            }
        }

        override fun onSearch(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<Void>> {
            val count = searchItems(query).size
            val responseParams = responseLibraryParams(params)
            session.notifySearchResultChanged(browser, query, count, responseParams)
            return Futures.immediateFuture(LibraryResult.ofVoid(responseParams))
        }

        override fun onGetSearchResult(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val results = searchItems(query).map { it.toMediaItem(playable = false) }
            val pageItems = paginate(results, page, pageSize)
                ?: return Futures.immediateFuture(
                    LibraryResult.ofError(SessionError.ERROR_BAD_VALUE),
                )
            return Futures.immediateFuture(
                LibraryResult.ofItemList(pageItems, responseLibraryParams(params)),
            )
        }

        /** Resolve taps plus legacy prepare/playFromMediaId/search requests. */
        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            val requested = mediaItems.getOrNull(startIndex.coerceAtLeast(0))
                ?: mediaItems.firstOrNull()
                ?: return Futures.immediateFailedFuture(
                    IllegalArgumentException(localizedString(R.string.car_no_media_item_requested)),
                )
            val resolved = resolveRequestedItem(requested)
                ?: return Futures.immediateFailedFuture(
                    IllegalArgumentException(localizedString(R.string.car_unknown_media_item)),
                )

            if (resolved.quality == "flac" && isMeteredNetwork()) {
                val warning = localizedString(R.string.car_flac_metered_warning)
                librarySession.sendError(
                    controller,
                    SessionError(SessionError.ERROR_NOT_SUPPORTED, warning),
                )
                return Futures.immediateFailedFuture(IllegalStateException(warning))
            }

            // A later Next command must not enter a FLAC item that was merely
            // adjacent to the allowed request while the network is metered.
            val queue = meteredSafeQueueFor(resolved)
            val queueIndex = queue.indexOfFirst { it.id == resolved.id }.coerceAtLeast(0)
            return Futures.immediateFuture(
                MediaSession.MediaItemsWithStartPosition(
                    queue.map { it.toMediaItem(playable = true) },
                    queueIndex,
                    startPositionMs,
                ),
            )
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
        ): ListenableFuture<List<MediaItem>> {
            val resolved = mediaItems.mapNotNull(::resolveRequestedItem)
            if (resolved.any { it.quality == "flac" } && isMeteredNetwork()) {
                val warning = localizedString(R.string.car_flac_metered_warning)
                librarySession.sendError(
                    controller,
                    SessionError(SessionError.ERROR_NOT_SUPPORTED, warning),
                )
                return Futures.immediateFailedFuture(IllegalStateException(warning))
            }
            return Futures.immediateFuture(resolved.map { it.toMediaItem(playable = true) })
        }

        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            val lastId = prefs().getString(KEY_LAST_MEDIA_ID, null)
            val remembered = lastId?.let(::findItem) ?: fallbackRadioItem()
            val resolved = if (isMeteredNetwork() && remembered.quality == "flac") {
                radioItems().firstOrNull { it.quality != "flac" } ?: fallbackRadioItem()
            } else {
                remembered
            }
            val queue = meteredSafeQueueFor(resolved)
            val index = queue.indexOfFirst { it.id == resolved.id }.coerceAtLeast(0)
            val startPositionMs = if (resolved.seriesId != null) {
                savedPodcastPositionMs(resolved.id)
            } else {
                C.TIME_UNSET
            }
            return Futures.immediateFuture(
                MediaSession.MediaItemsWithStartPosition(
                    queue.map { it.toMediaItem(playable = true) },
                    index,
                    startPositionMs,
                ),
            )
        }
    }

    // --- Browse tree and catalog ---

    private fun responseLibraryParams(params: LibraryParams?): LibraryParams {
        val extras = Bundle(params?.extras ?: Bundle.EMPTY).apply {
            putBoolean(CONTENT_STYLE_SUPPORTED, true)
            putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_GRID)
            putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_LIST)
            putBoolean(MediaConstants.BROWSER_SERVICE_EXTRAS_KEY_SEARCH_SUPPORTED, true)
        }
        return LibraryParams.Builder()
            .setRecent(params?.isRecent == true)
            .setOffline(params?.isOffline == true)
            .setSuggested(params?.isSuggested == true)
            .setExtras(extras)
            .build()
    }

    private fun <T> paginate(items: List<T>, page: Int, pageSize: Int): List<T>? {
        if (page < 0 || pageSize <= 0) return null
        val fromIndex = page.toLong() * pageSize.toLong()
        if (fromIndex >= items.size) return emptyList()
        val toIndex = minOf(fromIndex + pageSize.toLong(), items.size.toLong())
        return items.subList(fromIndex.toInt(), toIndex.toInt())
    }

    private fun rootMediaItem(): MediaItem {
        val extras = Bundle().apply {
            putBoolean(CONTENT_STYLE_SUPPORTED, true)
            putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_GRID)
            putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_LIST)
            putBoolean(MediaConstants.BROWSER_SERVICE_EXTRAS_KEY_SEARCH_SUPPORTED, true)
        }
        return MediaItem.Builder()
            .setMediaId(ROOT_ID)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                    .setTitle(localizedString(R.string.app_name))
                    .setIsBrowsable(true)
                    .setIsPlayable(false)
                    .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
                    .setExtras(extras)
                    .build(),
            )
            .build()
    }

    private fun childrenFor(parentId: String): List<MediaItem> {
        val categories = readCatalog().optJSONArray("categories")
        if (parentId == ROOT_ID) {
            return ROOT_CATEGORY_IDS.map { id ->
                categories?.let { allowedCategoryById(it, id) }
                    ?.let(::browsableFromJson)
                    ?: requireNotNull(fallbackRootCategory(id))
            }
        }

        if (categories == null) {
            return if (parentId == CAT_RADIO) {
                listOf(fallbackRadioItem().toMediaItem(playable = false))
            } else {
                emptyList()
            }
        }

        val category = allowedCategoryById(categories, parentId)
            ?: return if (parentId == CAT_RADIO) {
                listOf(fallbackRadioItem().toMediaItem(playable = false))
            } else {
                emptyList()
            }
        val items = category.optJSONArray("items") ?: return emptyList()
        return buildList {
            for (i in 0 until items.length()) {
                val item = items.optJSONObject(i) ?: continue
                if (!isAllowedCatalogItem(parentId, item)) continue
                add(
                    if (item.optBoolean("playable", true)) {
                        itemFromJson(item).toMediaItem(playable = false)
                    } else {
                        browsableFromJson(item)
                    },
                )
            }
        }
    }

    private fun suggestedItems(): List<MediaItem> {
        val radios = radioItems()
        val firstEpisodePerSeries = allPlayableItems()
            .filter { it.seriesId != null }
            .distinctBy { it.seriesId }
        return (radios + firstEpisodePerSeries)
            .distinctBy { it.id }
            .take(10)
            .map { it.toMediaItem(playable = false) }
    }

    private fun searchItems(query: String): List<CatalogItem> {
        val normalized = normalize(query)
        if (isLatestPodcastQuery(normalized)) {
            return allPlayableItems().firstOrNull { it.seriesId != null }?.let(::listOf)
                ?: emptyList()
        }

        val all = allPlayableItems().ifEmpty { listOf(fallbackRadioItem()) }
        if (normalized.isEmpty()) return emptyList()

        val direct = all.map { item ->
            val textMatch = normalize(item.title).contains(normalized) ||
                normalize(item.artist).contains(normalized) ||
                normalize(item.id).contains(normalized)
            val aliasScore = CarVoiceQueryPolicy.stationAliasScore(item.id, normalized)
            item to maxOf(aliasScore, if (textMatch) 1 else 0)
        }
            .filter { (_, score) -> score > 0 }
            .sortedByDescending { (_, score) -> score }
            .map { (item, _) -> item }
        if (direct.isNotEmpty()) return direct

        return if (normalized in setOf("radio", "radiotedu", "radio tedu", "live", "canli")) {
            radioItems().take(1)
        } else {
            emptyList()
        }
    }

    private fun resolveRequestedItem(requested: MediaItem): CatalogItem? {
        val query = requested.requestMetadata.searchQuery
        if (!query.isNullOrBlank()) return searchItems(query).firstOrNull()
        if (requested.mediaId.isNotEmpty()) return findItem(requested.mediaId)
        return requested.requestMetadata.mediaUri?.toString()?.let { uri ->
            allPlayableItems().firstOrNull { it.url == uri }
        }
    }

    private fun queueFor(item: CatalogItem): List<CatalogItem> = when {
        item.seriesId != null -> allPlayableItems().filter { it.seriesId == item.seriesId }
            .ifEmpty { listOf(item) }
        radioItems().any { it.id == item.id } -> radioItems()
        else -> listOf(item)
    }

    private fun meteredSafeQueueFor(item: CatalogItem): List<CatalogItem> {
        val queue = queueFor(item)
        if (!isMeteredNetwork()) return queue
        return queue.filterNot { it.quality == "flac" }
            .ifEmpty { listOf(fallbackRadioItem()) }
    }

    private fun findCategory(mediaId: String): JSONObject? {
        val categories = readCatalog().optJSONArray("categories") ?: return null
        return allowedCategoryById(categories, mediaId)
    }

    private fun categoryById(categories: JSONArray, mediaId: String): JSONObject? {
        for (i in 0 until categories.length()) {
            val category = categories.optJSONObject(i) ?: continue
            if (category.optString("id") == mediaId) return category
        }
        return null
    }

    private fun allowedCatalogCategories(categories: JSONArray): List<JSONObject> = buildList {
        for (i in 0 until categories.length()) {
            val category = categories.optJSONObject(i) ?: continue
            if (isAllowedCatalogCategory(category)) add(category)
        }
    }

    private fun allowedCategoryById(categories: JSONArray, mediaId: String): JSONObject? =
        categoryById(categories, mediaId)?.takeIf(::isAllowedCatalogCategory)

    private fun isAllowedCatalogCategory(category: JSONObject): Boolean {
        return CarCatalogPolicy.isAllowedCategory(
            id = category.optString("id"),
            parentId = category.optString("parentId", ""),
            hasParentId = category.has("parentId"),
        )
    }

    private fun isAllowedCatalogItem(parentId: String, json: JSONObject): Boolean {
        return CarCatalogPolicy.isAllowedItem(
            parentId = parentId,
            itemId = json.optString("id"),
            seriesId = json.optString("seriesId", ""),
            playable = json.optBoolean("playable", true),
        )
    }

    private fun fallbackRootCategory(mediaId: String): MediaItem? = when (mediaId) {
        CAT_RADIO -> browsable(
            CAT_RADIO,
            localizedString(R.string.car_live_radio),
            localizedString(R.string.app_name),
            RADIO_CATEGORY_ARTWORK,
            MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS,
        )
        CAT_PODCASTS -> browsable(
            CAT_PODCASTS,
            localizedString(R.string.car_podcasts),
            localizedString(R.string.app_name),
            PODCAST_CATEGORY_ARTWORK,
            MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS,
        )
        else -> null
    }

    private fun browsableFromJson(json: JSONObject): MediaItem {
        val id = json.optString("id")
        val mediaType = when {
            id == CAT_RADIO -> MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS
            id == CAT_PODCASTS || id.startsWith("podcast-series:") ->
                MediaMetadata.MEDIA_TYPE_FOLDER_PODCASTS
            else -> MediaMetadata.MEDIA_TYPE_FOLDER_MIXED
        }
        return browsable(
            id,
            json.optString("title", localizedString(R.string.app_name)),
            json.optString("subtitle", ""),
            json.optString("artwork", ""),
            mediaType,
        )
    }

    private fun browsable(
        id: String,
        title: String,
        subtitle: String,
        artwork: String,
        mediaType: Int,
    ): MediaItem {
        val extras = Bundle().apply {
            putInt(
                MediaConstants.DESCRIPTION_EXTRAS_KEY_CONTENT_STYLE_BROWSABLE,
                MediaConstants.DESCRIPTION_EXTRAS_VALUE_CONTENT_STYLE_GRID_ITEM,
            )
            putInt(
                MediaConstants.DESCRIPTION_EXTRAS_KEY_CONTENT_STYLE_PLAYABLE,
                MediaConstants.DESCRIPTION_EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM,
            )
        }
        val metadata = MediaMetadata.Builder()
            .setTitle(title)
            .setSubtitle(subtitle.ifEmpty { null })
            .setIsBrowsable(true)
            .setIsPlayable(false)
            .setMediaType(mediaType)
            .setExtras(extras)
            .applyArtwork(artwork)
            .build()
        return MediaItem.Builder().setMediaId(id).setMediaMetadata(metadata).build()
    }

    private data class CatalogItem(
        val id: String,
        val url: String,
        val title: String,
        val artist: String,
        val artwork: String,
        val seriesId: String? = null,
        val quality: String? = null,
        val audioFormat: String? = null,
        val hiFiUrl: String? = null,
    )

    private fun CatalogItem.toMediaItem(playable: Boolean): MediaItem {
        val progress = if (seriesId != null) podcastProgress(id) else 0.0
        val extras = Bundle().apply {
            putString(MediaConstants.METADATA_KEY_CONTENT_ID, id)
            audioFormat?.let { putString(EXTRA_AUDIO_FORMAT, it) }
            if (quality == "flac") {
                putString(FORMAT_ICON_LARGE, HIFI_FORMAT_ICON)
                putString(FORMAT_ICON_SMALL, HIFI_FORMAT_ICON)
            }
            if (seriesId != null) {
                putString(MediaConstants.METADATA_KEY_SERIES_CONTENT_ID, seriesId)
                putDouble(
                    MediaConstants.DESCRIPTION_EXTRAS_KEY_COMPLETION_PERCENTAGE,
                    progress,
                )
                putInt(
                    MediaConstants.DESCRIPTION_EXTRAS_KEY_COMPLETION_STATUS,
                    when {
                        progress >= 0.95 ->
                            MediaConstants.DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_FULLY_PLAYED
                        progress > 0.0 ->
                            MediaConstants.DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED
                        else ->
                            MediaConstants.DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_NOT_PLAYED
                    },
                )
            }
        }
        val metadata = MediaMetadata.Builder()
            .setTitle(title)
            .setDisplayTitle(title)
            .setArtist(artist.ifEmpty { null })
            .setAlbumTitle(
                if (seriesId != null) {
                    artist.ifEmpty { localizedString(R.string.car_podcasts) }
                } else if (quality == "flac") {
                    "Hi-Fi"
                } else {
                    null
                },
            )
            .setSubtitle(if (quality == "flac") "$title · Hi-Fi" else null)
            .setStation(if (seriesId == null) title else null)
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(
                if (seriesId == null) {
                    MediaMetadata.MEDIA_TYPE_RADIO_STATION
                } else {
                    MediaMetadata.MEDIA_TYPE_PODCAST_EPISODE
                },
            )
            .setExtras(extras)
            .applyArtwork(artwork)
            .build()
        return MediaItem.Builder()
            .setMediaId(id)
            .setMediaMetadata(metadata)
            .apply { if (playable) setUri(url) }
            .build()
    }

    private fun itemFromJson(json: JSONObject): CatalogItem {
        val rawQuality = json.optString("quality", "").ifEmpty { null }
        val seriesId = json.optString("seriesId", "").ifEmpty { null }
        val quality = if (seriesId == null) {
            if (rawQuality == "low") "low" else "normal"
        } else {
            rawQuality
        }
        val rawUrl = json.optString("url", "")
        val url = if (seriesId == null && rawQuality == "flac") {
            rawUrl.removeSuffix("-flac")
        } else {
            rawUrl
        }
        return CatalogItem(
            id = json.optString("id", ""),
            url = url,
            title = json.optString("title", localizedString(R.string.app_name)),
            artist = json.optString("subtitle", ""),
            artwork = json.optString("artwork", ""),
            seriesId = seriesId,
            quality = quality,
            audioFormat = json.optString("audioFormat", "").ifEmpty {
                when (quality) {
                    "flac" -> "FLAC"
                    "low" -> "HE-AAC v2"
                    "normal", "high" -> "AAC-LC"
                    else -> if (seriesId != null) localizedString(R.string.car_podcast_audio) else null
                }
            },
            hiFiUrl = json.optString("hiFiUrl", "")
                .takeIf { it.startsWith("https://") && it.endsWith("-flac") },
        )
    }

    private fun allPlayableItems(): List<CatalogItem> {
        val output = mutableListOf<CatalogItem>()
        val categories = readCatalog().optJSONArray("categories") ?: return output
        for (category in allowedCatalogCategories(categories)) {
            val parentId = category.optString("id")
            addPlayable(parentId, category.optJSONArray("items"), output)
        }
        return output.distinctBy { it.id }
    }

    private fun addPlayable(
        parentId: String,
        items: JSONArray?,
        output: MutableList<CatalogItem>,
    ) {
        if (items == null) return
        for (i in 0 until items.length()) {
            val json = items.optJSONObject(i) ?: continue
            if (!json.optBoolean("playable", true)) continue
            if (!isAllowedCatalogItem(parentId, json)) continue
            val item = itemFromJson(json)
            if (item.id.isNotEmpty() && item.url.isNotEmpty()) output.add(item)
        }
    }

    private fun radioItems(): List<CatalogItem> {
        val categories = readCatalog().optJSONArray("categories")
        if (categories != null) {
            val output = mutableListOf<CatalogItem>()
            addPlayable(
                CAT_RADIO,
                allowedCategoryById(categories, CAT_RADIO)?.optJSONArray("items"),
                output,
            )
            if (output.isNotEmpty()) return output
        }
        return listOf(fallbackRadioItem())
    }

    private fun findItem(mediaId: String): CatalogItem? {
        val wantsHiFi = mediaId.endsWith(HIFI_MEDIA_ID_SUFFIX)
        val baseId = mediaId.removeSuffix(HIFI_MEDIA_ID_SUFFIX)
        val base = allPlayableItems().firstOrNull { it.id == baseId }
            ?: if (baseId == FALLBACK_RADIO_ID) fallbackRadioItem() else null
        return if (wantsHiFi) base?.toHiFiVariant() else base
    }

    private fun CatalogItem.toHiFiVariant(): CatalogItem? = hiFiUrl?.let { losslessUrl ->
        copy(
            id = id.removeSuffix(HIFI_MEDIA_ID_SUFFIX) + HIFI_MEDIA_ID_SUFFIX,
            url = losslessUrl,
            quality = "flac",
            audioFormat = "FLAC",
        )
    }

    private fun switchCarQuality(item: CatalogItem) {
        val resumePlaying = player.playWhenReady
        activeCatalogItem = item
        player.setMediaItem(item.toMediaItem(playable = true))
        player.prepare()
        player.playWhenReady = resumePlaying
        updateHiFiButton()
    }

    private fun hiFiButtonPreferences(): List<CommandButton> {
        val active = activeCatalogItem ?: return emptyList()
        val supportsHiFi = active.hiFiUrl != null || active.quality == "flac"
        if (!supportsHiFi) return emptyList()
        val now = android.os.SystemClock.elapsedRealtime()
        val awaitingConfirmation = active.quality != "flac" &&
            pendingHiFiMediaId == active.id && now <= pendingHiFiUntilMs
        val name = when {
            active.quality == "flac" -> "Normal"
            awaitingConfirmation -> "Confirm Hi-Fi"
            else -> "Hi-Fi"
        }
        val icon = if (active.quality == "flac") {
            CommandButton.ICON_CHECK_CIRCLE_FILLED
        } else {
            CommandButton.ICON_QUALITY
        }
        return listOf(
            CommandButton.Builder(icon)
                .setDisplayName(name)
                .setSessionCommand(hiFiCommand)
                .setCustomIconResId(R.drawable.car_format_hifi)
                .build(),
        )
    }

    private fun updateHiFiButton() {
        if (::librarySession.isInitialized) {
            librarySession.setMediaButtonPreferences(hiFiButtonPreferences())
        }
    }

    private fun fallbackRadioItem(): CatalogItem = CatalogItem(
        id = FALLBACK_RADIO_ID,
        url = FALLBACK_RADIO_URL,
        title = localizedString(R.string.app_name),
        artist = localizedString(R.string.car_live_radio),
        artwork = FALLBACK_RADIO_ARTWORK,
        quality = "normal",
        audioFormat = "AAC-LC",
    )

    private fun MediaMetadata.Builder.applyArtwork(artwork: String): MediaMetadata.Builder = apply {
        if (artwork.isBlank()) return@apply

        // Keep the original URI so in-process/current Media3 hosts can load the
        // full 2048 px resource. Also attach a tiny deterministic thumbnail for
        // hosts that cannot dereference resources owned by another package.
        runCatching { setArtworkUri(Uri.parse(artwork)) }
        val tileData = bundledTileResource(artwork)?.let(::renderBundledTile)
        if (tileData != null) {
            setArtworkData(tileData, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
        }
    }

    private fun bundledTileResource(artwork: String): Int? {
        val uri = runCatching { Uri.parse(artwork) }.getOrNull() ?: return null
        if (
            uri.scheme != ContentResolver.SCHEME_ANDROID_RESOURCE ||
            uri.authority != packageName
        ) {
            return null
        }
        return when (uri.lastPathSegment) {
            "car_tile_radio" -> R.drawable.car_tile_radio
            "car_tile_podcasts" -> R.drawable.car_tile_podcasts
            "car_station_radiotedu" -> R.drawable.car_station_radiotedu_thumb
            "car_station_classic" -> R.drawable.car_station_classic_thumb
            "car_station_cazz" -> R.drawable.car_station_cazz_thumb
            "car_station_lofi" -> R.drawable.car_station_lofi_thumb
            "car_station_energize" -> R.drawable.car_station_energize_thumb
            "car_station_rock" -> R.drawable.car_station_rock_thumb
            "car_station_en" -> R.drawable.car_station_en_thumb
            "car_station_fr" -> R.drawable.car_station_fr_thumb
            else -> null
        }
    }

    private fun renderBundledTile(resourceId: Int): ByteArray? {
        tileArtworkCache[resourceId]?.let { return it }
        val drawable = ContextCompat.getDrawable(this, resourceId)?.mutate() ?: return null
        val bitmap = Bitmap.createBitmap(
            CAR_TILE_SIZE_PX,
            CAR_TILE_SIZE_PX,
            Bitmap.Config.ARGB_8888,
        )
        drawable.setBounds(0, 0, bitmap.width, bitmap.height)
        drawable.draw(Canvas(bitmap))
        val bytes = ByteArrayOutputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
            output.toByteArray()
        }
        bitmap.recycle()
        return bytes.takeIf { it.size <= CAR_TILE_MAX_BYTES }?.also {
            tileArtworkCache[resourceId] = it
        }
    }

    private fun readCatalog(): JSONObject {
        val raw = prefs().getString(KEY_CATALOG, null) ?: return JSONObject()
        return runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
    }

    private fun localizedString(@StringRes resourceId: Int): String {
        val language = prefs().getString(
            KEY_LANGUAGE_PREFERENCE,
            SYSTEM_LANGUAGE_PREFERENCE,
        ) ?: SYSTEM_LANGUAGE_PREFERENCE
        if (language !in SUPPORTED_LANGUAGE_CODES) {
            return getString(resourceId)
        }
        val configuration = Configuration(resources.configuration).apply {
            setLocale(Locale.forLanguageTag(language))
        }
        return createConfigurationContext(configuration).getString(resourceId)
    }

    private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun logCarPlaybackStart() {
        val item = activeCatalogItem ?: return
        if (analyticsItemId == item.id && analyticsStartedAtMs > 0L) return
        analyticsItemId = item.id
        analyticsStartedAtMs = android.os.SystemClock.elapsedRealtime()
        FirebaseAnalytics.getInstance(this).logEvent(
            "playback_start",
            carAnalyticsBundle(item),
        )
    }

    private fun logCarListenComplete() {
        val item = activeCatalogItem ?: return
        val startedAt = analyticsStartedAtMs
        if (startedAt <= 0L) return
        val seconds = ((android.os.SystemClock.elapsedRealtime() - startedAt) / 1000L)
            .coerceAtLeast(0L)
        analyticsStartedAtMs = 0L
        if (seconds < 1L) return
        FirebaseAnalytics.getInstance(this).logEvent(
            "listen_complete",
            carAnalyticsBundle(item).apply { putLong("seconds", seconds) },
        )
    }

    private fun carAnalyticsBundle(item: CatalogItem) = Bundle().apply {
        putString("content_id", item.id.removeSuffix(HIFI_MEDIA_ID_SUFFIX))
        putString("content_type", if (item.seriesId == null) "radio" else "podcast")
        putString("station", item.title)
        putString("quality", if (item.quality == "flac") "hifi" else (item.quality ?: "normal"))
        putString("surface", "android_auto")
        putString("network_type", activeNetworkType())
    }

    private fun activeNetworkType(): String {
        val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "unknown"
        val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return "offline"
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "bluetooth"
            else -> "other"
        }
    }

    private fun isMeteredNetwork(): Boolean =
        (getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager)
            ?.isActiveNetworkMetered == true

    private fun normalize(value: String): String {
        val normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
            .lowercase(Locale.ROOT)
        return normalized.replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()
    }

    private fun isLatestPodcastQuery(query: String): Boolean {
        return CarVoiceQueryPolicy.isLatestPodcastQuery(query)
    }

}

/** Pure voice-intent policy kept outside Android APIs for executable JVM coverage. */
internal object CarVoiceQueryPolicy {
    private val latestWords = normalizedWords(
        "latest", "newest", "son", "yeni", "последний", "новый", "احدث",
        "neuester", "neueste", "letzte", "dernier", "nouveau", "nouvel",
    )
    private val podcastWords = normalizedWords(
        "podcast", "episode", "bolum", "подкаст", "выпуск", "بودكاست", "حلقة",
        "folge",
    )

    fun isLatestPodcastQuery(value: String): Boolean {
        val query = normalize(value)
        if (query in normalizedWords("podcast", "подкаст", "بودكاست")) return true
        val words = query.split(' ').filter(String::isNotEmpty).toSet()
        return latestWords.any(words::contains) && podcastWords.any(words::contains)
    }

    /** Specific station aliases outrank the generic RadioTEDU/main alias. */
    fun stationAliasScore(mediaId: String, value: String): Int {
        val query = normalize(value)
        val paddedQuery = " $query "
        val longestAlias = aliasesFor(mediaId)
            .map(::normalize)
            .filter { alias -> alias.isNotEmpty() && paddedQuery.contains(" $alias ") }
            .maxOfOrNull(String::length)
            ?: return 0
        val specificity = if (mediaId == "radiotedu-main") 100 else 1_000
        return specificity + longestAlias
    }

    fun bestStationAlias(value: String, mediaIds: List<String>): String? =
        mediaIds.map { mediaId -> mediaId to stationAliasScore(mediaId, value) }
            .filter { (_, score) -> score > 0 }
            .maxByOrNull { (_, score) -> score }
            ?.first

    private fun aliasesFor(mediaId: String): Set<String> = when (mediaId) {
        "radiotedu-main" -> setOf(
            "radiotedu", "radio tedu", "radio", "main", "ana kanal", "canli",
            "радио теду", "главная станция", "прямой эфир",
            "راديو تيدو", "الاذاعة الرئيسية", "بث مباشر",
            "hauptsender", "live radio", "station principale", "radio en direct",
        )
        "radiotedu-classic" -> setOf(
            "classic", "classical", "klasik", "классика", "классическая",
            "كلاسيك", "كلاسيكية", "klassik", "klassische musik", "classique",
            "musique classique",
        )
        "radiotedu-jazz" -> setOf("jazz", "cazz", "caz", "джаз", "جاز")
        "radiotedu-lofi" -> setOf(
            "lofi", "lo fi", "lo-fi", "лоу фай", "лоуфай", "لو فاي",
        )
        "radiotedu-energize" -> setOf(
            "energize", "energy", "enerji", "энергия", "طاقة", "energie",
        )
        "radiotedu-spark" -> setOf("voting", "oylama")
        "radiotedu-rock" -> setOf("rock", "рок", "روك")
        "radiotedu-en" -> setOf(
            "english", "ingilizce", "radio tedu english", "английский", "انجليزي",
            "englisch", "anglais",
        )
        "radiotedu-fr" -> setOf(
            "french", "francais", "fransizca", "radio tedu french", "французский",
            "فرنسي", "franzosisch",
        )
        else -> emptySet()
    }

    private fun normalizedWords(vararg values: String): Set<String> =
        values.map(::normalize).toSet()

    private fun normalize(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
            .lowercase(Locale.ROOT)
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .trim()
}

/** Pure cached-catalog boundary: old/foreign categories never reach car surfaces. */
internal object CarCatalogPolicy {
    fun isAllowedCategory(id: String, parentId: String, hasParentId: Boolean): Boolean = when {
        id in ROOT_CATEGORY_IDS -> !hasParentId
        id.startsWith(PODCAST_SERIES_PREFIX) -> parentId == CAT_PODCASTS
        else -> false
    }

    fun isAllowedItem(
        parentId: String,
        itemId: String,
        seriesId: String,
        playable: Boolean,
    ): Boolean {
        if (!playable) {
            return parentId == CAT_PODCASTS && itemId.startsWith(PODCAST_SERIES_PREFIX)
        }
        return when {
            parentId == CAT_RADIO -> seriesId.isEmpty()
            parentId == CAT_PODCASTS -> seriesId.startsWith(PODCAST_SERIES_PREFIX)
            parentId.startsWith(PODCAST_SERIES_PREFIX) -> seriesId == parentId
            else -> false
        }
    }
}

internal data class CarMetadataText(val title: String, val artist: String?)

/** Prevents station-only streams from leaking incoming ICY text to system surfaces. */
internal object CarMetadataPolicy {
    fun sanitizeIcy(
        mediaId: String,
        quality: String?,
        stationTitle: String,
        incoming: CarMetadataText,
    ): CarMetadataText =
        if (mediaId == "radiotedu-lofi" && quality != "flac") {
            CarMetadataText(title = stationTitle, artist = null)
        } else {
            incoming
        }
}
