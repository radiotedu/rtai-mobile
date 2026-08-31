package com.radiotedumobile.formfactor

import android.content.Intent
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionError
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.text.Normalizer
import java.util.Locale

/**
 * Standalone current-Media3 radio service shared by Android TV and Wear OS.
 * It remains usable when the activity is closed and supports system/voice search.
 */
@OptIn(UnstableApi::class)
class RadioPlaybackService : MediaLibraryService() {
    private lateinit var player: ExoPlayer
    private lateinit var mediaSession: MediaLibrarySession

    override fun onCreate() {
        super.onCreate()
        val httpFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(15_000)
            .setDefaultRequestProperties(mapOf("Icy-MetaData" to "1"))
            .setAllowCrossProtocolRedirects(true)
        val renderersFactory = DefaultRenderersFactory(this)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)

        player = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
            .build()
            .apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .setUsage(C.USAGE_MEDIA)
                        .build(),
                    true,
                )
                repeatMode = Player.REPEAT_MODE_ALL
            }
        mediaSession = MediaLibrarySession.Builder(this, player, LibraryCallback())
            .setId("RadioTeduFormFactorMediaLibrary")
            .build()
        setShowNotificationForIdlePlayer(SHOW_NOTIFICATION_FOR_IDLE_PLAYER_AFTER_STOP_OR_ERROR)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_PLAY) {
            intent.getStringExtra(EXTRA_CHANNEL_ID)?.let(::findChannel)?.let(::playChannel)
        }
        return super.onStartCommand(intent, flags, startId)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession =
        mediaSession

    override fun onDestroy() {
        mediaSession.release()
        player.release()
        super.onDestroy()
    }

    private inner class LibraryCallback : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> = Futures.immediateFuture(
            LibraryResult.ofItem(rootItem(), params),
        )

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            if (parentId != ROOT_ID || page < 0 || pageSize <= 0) {
                return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE))
            }
            val from = (page.toLong() * pageSize).coerceAtMost(RadioChannels.all.size.toLong()).toInt()
            val to = (from + pageSize).coerceAtMost(RadioChannels.all.size)
            return Futures.immediateFuture(
                LibraryResult.ofItemList(
                    RadioChannels.all.subList(from, to).map(::libraryItem),
                    params,
                ),
            )
        }

        override fun onGetItem(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> {
            val item = if (mediaId == ROOT_ID) rootItem() else findChannel(mediaId)?.let(::libraryItem)
            return Futures.immediateFuture(
                item?.let { LibraryResult.ofItem(it, null) }
                    ?: LibraryResult.ofError(SessionError.ERROR_BAD_VALUE),
            )
        }

        override fun onSearch(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<Void>> {
            session.notifySearchResultChanged(browser, query, searchChannels(query).size, params)
            return Futures.immediateFuture(LibraryResult.ofVoid(params))
        }

        override fun onGetSearchResult(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            if (page < 0 || pageSize <= 0) {
                return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE))
            }
            val results = searchChannels(query)
            val from = (page.toLong() * pageSize).coerceAtMost(results.size.toLong()).toInt()
            val to = (from + pageSize).coerceAtMost(results.size)
            return Futures.immediateFuture(
                LibraryResult.ofItemList(results.subList(from, to).map(::libraryItem), params),
            )
        }

        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            val requested = mediaItems.getOrNull(startIndex.coerceAtLeast(0))
                ?: mediaItems.firstOrNull()
                ?: return Futures.immediateFailedFuture(IllegalArgumentException("No station requested"))
            val channel = resolveRequestedChannel(requested)
                ?: return Futures.immediateFailedFuture(IllegalArgumentException("Unknown station"))
            val queue = RadioChannels.all.map(::playableItem)
            val queueIndex = RadioChannels.all.indexOfFirst { it.id == channel.id }.coerceAtLeast(0)
            return Futures.immediateFuture(
                MediaSession.MediaItemsWithStartPosition(queue, queueIndex, C.TIME_UNSET),
            )
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
        ): ListenableFuture<List<MediaItem>> = Futures.immediateFuture(
            mediaItems.mapNotNull(::resolveRequestedChannel).map(::playableItem),
        )

        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> = Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(
                RadioChannels.all.map(::playableItem),
                0,
                C.TIME_UNSET,
            ),
        )
    }

    private fun rootItem() = MediaItem.Builder()
        .setMediaId(ROOT_ID)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle("RadioTEDU")
                .setSubtitle("Live Radio")
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setArtworkUri(iconUri())
                .build(),
        )
        .build()

    private fun libraryItem(channel: RadioChannel) = channelItem(channel, playable = false)
    private fun playableItem(channel: RadioChannel) = channelItem(channel, playable = true)

    private fun channelItem(channel: RadioChannel, playable: Boolean) = MediaItem.Builder()
        .setMediaId(channel.id)
        .apply { if (playable) setUri(channel.url) }
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(channel.title)
                .setArtist("RadioTEDU")
                .setIsBrowsable(false)
                .setIsPlayable(true)
                .setArtworkUri(iconUri())
                .build(),
        )
        .build()

    private fun iconUri(): Uri = Uri.parse("android.resource://$packageName/drawable/app_icon")

    private fun playChannel(channel: RadioChannel) {
        player.setMediaItems(
            RadioChannels.all.map(::playableItem),
            RadioChannels.all.indexOf(channel),
            C.TIME_UNSET,
        )
        player.prepare()
        player.play()
    }

    private fun findChannel(value: String): RadioChannel? =
        RadioChannels.all.firstOrNull { it.id == value }

    private fun resolveRequestedChannel(item: MediaItem): RadioChannel? =
        findChannel(item.mediaId)
            ?: item.requestMetadata.searchQuery?.let(::bestVoiceMatch)
            ?: item.mediaMetadata.title?.toString()?.let(::bestVoiceMatch)

    private fun searchChannels(query: String): List<RadioChannel> {
        val normalized = normalize(query)
        if (normalized.isBlank() || normalized in GENERIC_RADIO_QUERIES) return RadioChannels.all
        return RadioChannels.all.filter { channel ->
            normalize(channel.title).contains(normalized) ||
                normalize(channel.id).contains(normalized) ||
                aliases(channel.id).any(normalized::contains)
        }
    }

    private fun bestVoiceMatch(query: String): RadioChannel? {
        val normalized = normalize(query)
        val specific = RadioChannels.all
            .filterNot { it.id == "radiotedu-main" }
            .firstOrNull { channel -> aliases(channel.id).any(normalized::contains) }
        return specific ?: searchChannels(query).firstOrNull() ?: RadioChannels.all.firstOrNull()
    }

    private fun aliases(id: String): Set<String> = when (id) {
        "radiotedu-classic" -> setOf("classic", "classical", "klasik", "klassik", "classique")
        "radiotedu-jazz" -> setOf("jazz", "cazz", "caz")
        "radiotedu-lofi" -> setOf("lofi", "lo fi", "lo-fi")
        "radiotedu-energize" -> setOf("energize", "energy", "enerji", "energie")
        "radiotedu-rock" -> setOf("rock")
        "radiotedu-en" -> setOf("english", "ingilizce", "anglais")
        "radiotedu-fr" -> setOf("french", "francais", "fransizca")
        else -> GENERIC_RADIO_QUERIES
    }

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .lowercase(Locale.ROOT)
        .replace(Regex("[^\\p{L}\\p{N}-]+"), " ")
        .trim()

    companion object {
        const val ACTION_PLAY = "com.radiotedumobile.action.PLAY_CHANNEL"
        const val EXTRA_CHANNEL_ID = "channel_id"
        private const val ROOT_ID = "radiotedu-root"
        private val GENERIC_RADIO_QUERIES = setOf(
            "radio", "radiotedu", "radio tedu", "live radio", "canli", "ana kanal",
        )
    }
}
